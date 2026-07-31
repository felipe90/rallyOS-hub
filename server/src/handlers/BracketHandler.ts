/**
 * BracketHandler — socket event layer for the tournament bracket (Tier 2).
 *
 * Spec: bracket-tournament-mvp. A thin validation + owner-gate + persistence
 * layer over {@link BracketEngine} (the pure domain). Matches the
 * ClubSessionHistoryHandler pattern: a handler is constructed ONCE and
 * `registerHandlers(socket)` is called per connection. The engine is the
 * single source of bracket truth; the handler only validates runtime payloads
 * (Socket.IO sends `any`), gates on `socket.data.isOwner === true` (R7),
 * debounces persistence (2s for slot changes, immediate for completed/reset
 * — design "Debounce persistence"), and emits BRACKET_STATE on every mutation.
 *
 * 2-step reset (R8): the first BRACKET_RESET (no/invalid confirmToken) issues
 * a single-use token with a 30s window; the second BRACKET_RESET with a valid
 * confirmToken clears the bracket. Tokens are per-socket and `unref`'d so the
 * process can exit cleanly.
 */

import type { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import { SocketHandlerBase } from './SocketHandlerBase';
import { SocketEvents } from '../../../shared/events';
import type { Player, TournamentBracket } from '../../../shared/types';
import { BracketEngine, BracketError, VALID_BRACKET_SLOTS } from '../domain/BracketEngine';
import { logger } from '../utils/logger';

/** Confirm-token window for the 2-step reset (spec R8). */
const RESET_TIMEOUT_MS = 30_000;
/** Debounce window for SLOT-class mutations (player/court assignment). */
const SAVE_DEBOUNCE_MS = 2_000;
const MAX_NAME_LEN = 50;

interface PendingReset {
  token: string;
  expiresAt: number;
}

interface BracketStoreSeam {
  getBracket(): TournamentBracket | null;
  setBracket(bracket: TournamentBracket | null): void;
}

export class BracketHandler extends SocketHandlerBase {
  private readonly engine = new BracketEngine();
  private readonly store: BracketStoreSeam;
  private readonly pendingResetBySocket = new Map<string, PendingReset>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    io: Server,
    tableManager: import('../domain/courtManager').CourtManager,
    ownerPin: string,
    store: BracketStoreSeam,
  ) {
    super(io, tableManager, ownerPin);
    this.store = store;
    // R10: hydrate the engine from persisted state on startup so a server
    // restart restores the bracket.
    const persisted = this.store.getBracket();
    if (persisted) {
      this.engine.restore(persisted);
      logger.info({ name: persisted.name }, 'BracketHandler: restored bracket from persisted state');
    }
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  /** Register all BRACKET_* handlers on a freshly-connected socket. */
  registerHandlers(socket: Socket): void {
    // Push the restored bracket to an already-verified owner (JWT reconnect
    // sets isOwner before io.on('connection')). PIN-flow owners fetch via
    // BRACKET_GET after verifying.
    if (this.isOwnerSocket(socket)) {
      this.emitState(socket);
    }

    socket.on(SocketEvents.CLIENT.BRACKET_CREATE, (data: unknown) =>
      this.onCreate(socket, data as Record<string, unknown>),
    );
    socket.on(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, (data: unknown) =>
      this.onAssignPlayer(socket, data as Record<string, unknown>),
    );
    socket.on(SocketEvents.CLIENT.BRACKET_SET_WINNER, (data: unknown) =>
      this.onSetWinner(socket, data as Record<string, unknown>),
    );
    socket.on(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, (data: unknown) =>
      this.onAssignCourt(socket, data as Record<string, unknown>),
    );
    socket.on(SocketEvents.CLIENT.BRACKET_UNDO_MATCH, (data: unknown) =>
      this.onUndoMatch(socket, data as Record<string, unknown>),
    );
    socket.on(SocketEvents.CLIENT.BRACKET_GET, () => this.onGet(socket));
    socket.on(SocketEvents.CLIENT.BRACKET_RESET, (data: unknown) =>
      this.onReset(socket, data as Record<string, unknown>),
    );

    socket.on('disconnect', () => {
      const pending = this.pendingResetBySocket.get(socket.id);
      if (pending) this.pendingResetBySocket.delete(socket.id);
      // Note: the save debounce timer is shared (single owner) and flushed on
      // the next mutation or process tick; it is unref'd and self-clears.
    });
  }

  // ── individual event handlers ───────────────────────────────────────────

  private onCreate(socket: Socket, data: Record<string, unknown>): void {
    if (!this.guardOwner(socket)) return;
    const name = data?.name;
    const numSlots = data?.numSlots;
    const includeThirdPlace = data?.includeThirdPlace;

    if (typeof name !== 'string' || name.length > MAX_NAME_LEN) {
      return this.emitError(socket, 'INVALID_NAME', 'name must be a string of at most 50 chars');
    }
    if (typeof includeThirdPlace !== 'boolean') {
      return this.emitError(socket, 'INVALID_PARAMS', 'includeThirdPlace must be boolean');
    }
    if (typeof numSlots !== 'number' || !(VALID_BRACKET_SLOTS as readonly number[]).includes(numSlots)) {
      return this.emitError(socket, 'INVALID_SIZE', 'numSlots must be 4, 8, 16 or 32');
    }

    this.engine.create(name, numSlots, includeThirdPlace); // engine also re-validates size
    this.persistNow(); // create must not be lost
    this.emitState(socket);
  }

  private onAssignPlayer(socket: Socket, data: Record<string, unknown>): void {
    if (!this.guardOwner(socket)) return;
    const m = data?.matchId;
    const s = data?.slot;
    const n = data?.name;
    if (typeof m !== 'string' || !m) return this.emitError(socket, 'INVALID_PARAMS', 'matchId required');
    if (s !== 'A' && s !== 'B') return this.emitError(socket, 'INVALID_PARAMS', 'slot must be A or B');
    if (typeof n !== 'string') return this.emitError(socket, 'INVALID_PARAMS', 'name must be a string');
    if (n.length > MAX_NAME_LEN) return this.emitError(socket, 'NAME_TOO_LONG', 'name must be at most 50 chars');

    try {
      this.engine.assignPlayer(m, s as Player, n);
    } catch (err) {
      return this.onEngineError(socket, err);
    }
    this.scheduleDebouncedSave();
    this.emitState(socket);
  }

  private onSetWinner(socket: Socket, data: Record<string, unknown>): void {
    if (!this.guardOwner(socket)) return;
    const m = data?.matchId;
    const w = data?.winner;
    if (typeof m !== 'string' || !m) return this.emitError(socket, 'INVALID_PARAMS', 'matchId required');
    if (w !== 'A' && w !== 'B') return this.emitError(socket, 'INVALID_WINNER', 'winner must be A or B');

    try {
      this.engine.setWinner(m, w as Player);
    } catch (err) {
      return this.onEngineError(socket, err);
    }
    this.persistNow(); // completed match must not be lost
    this.emitState(socket);
  }

  private onAssignCourt(socket: Socket, data: Record<string, unknown>): void {
    if (!this.guardOwner(socket)) return;
    const m = data?.matchId;
    const c = data?.courtId;
    if (typeof m !== 'string' || !m) return this.emitError(socket, 'INVALID_PARAMS', 'matchId required');
    if (c !== null && typeof c !== 'string') {
      return this.emitError(socket, 'INVALID_PARAMS', 'courtId must be a string or null');
    }
    if (typeof c === 'string' && !this.courtExists(c)) {
      return this.emitError(socket, 'COURT_NOT_FOUND', 'La cancha no existe');
    }

    try {
      this.engine.assignCourt(m, c);
    } catch (err) {
      return this.onEngineError(socket, err);
    }
    this.scheduleDebouncedSave();
    this.emitState(socket);
  }

  private onUndoMatch(socket: Socket, data: Record<string, unknown>): void {
    if (!this.guardOwner(socket)) return;
    const m = data?.matchId;
    if (typeof m !== 'string' || !m) return this.emitError(socket, 'INVALID_PARAMS', 'matchId required');

    try {
      this.engine.undoMatch(m);
    } catch (err) {
      return this.onEngineError(socket, err);
    }
    this.persistNow(); // undo reverts a completed match — must not be lost
    this.emitState(socket);
  }

  private onGet(socket: Socket): void {
    if (!this.guardOwner(socket)) return;
    this.emitState(socket);
  }

  private onReset(socket: Socket, data: Record<string, unknown>): void {
    if (!this.guardOwner(socket)) return;
    const confirmToken = (data?.confirmToken ?? undefined) as string | undefined;

    if (typeof confirmToken !== 'string' || confirmToken.length === 0) {
      // Step 1 — issue a single-use token with a 30s window.
      const token = crypto.randomUUID();
      this.pendingResetBySocket.set(socket.id, {
        token,
        expiresAt: Date.now() + RESET_TIMEOUT_MS,
      });
      socket.emit(SocketEvents.SERVER.BRACKET_RESET_CONFIRM, {
        token,
        expiresIn: Math.round(RESET_TIMEOUT_MS / 1000),
      });
      return;
    }

    // Step 2 — confirm.
    const pending = this.pendingResetBySocket.get(socket.id);
    if (!pending || pending.token !== confirmToken) {
      return this.emitError(socket, 'INVALID_TOKEN', 'Token de confirmación inválido');
    }
    if (Date.now() > pending.expiresAt) {
      this.pendingResetBySocket.delete(socket.id);
      return this.emitError(socket, 'RESET_EXPIRED', 'El token expiró');
    }

    this.pendingResetBySocket.delete(socket.id);
    this.engine.reset();
    this.store.setBracket(null); // immediate
    this.emitState(socket);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Owner gate (R7): non-owner → UNAUTHORIZED + no state mutation. */
  private guardOwner(socket: Socket): boolean {
    if (!this.isOwnerSocket(socket)) {
      this.emitError(socket, 'UNAUTHORIZED', 'Solo el dueño puede gestionar el bracket');
      return false;
    }
    return true;
  }

  private isOwnerSocket(socket: Socket): boolean {
    const data = socket.data as { isOwner?: unknown } | undefined;
    return data?.isOwner === true;
  }

  private emitState(socket: Socket): void {
    socket.emit(SocketEvents.SERVER.BRACKET_STATE, this.engine.bracket);
  }

  protected emitError(socket: Socket, code: string, message: string): void {
    socket.emit(SocketEvents.SERVER.BRACKET_ERROR, { code, message });
  }

  /** Translate a BracketEngine error into a BRACKET_ERROR emit; no mutation. */
  private onEngineError(socket: Socket, err: unknown): void {
    const code = err instanceof BracketError ? err.code : 'BRACKET_ERROR';
    this.emitError(socket, code, err instanceof Error ? err.message : code);
  }

  /** A tournament court id exists (R6 court validation). */
  private courtExists(courtId: string): boolean {
    return this.tableManager.getAllTournamentCourts().some((c) => c.id === courtId);
  }

  /** Immediate persistence — used for create / winner / undo / reset. */
  private persistNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.store.setBracket(this.engine.bracket);
  }

  /** Debounced (2s) persistence — used for slot-class mutations. */
  private scheduleDebouncedSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.store.setBracket(this.engine.bracket);
    }, SAVE_DEBOUNCE_MS);
    if (typeof this.saveTimer.unref === 'function') this.saveTimer.unref();
  }
}