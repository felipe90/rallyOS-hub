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
import type { Player, TournamentBracket, BracketMatch } from '../../../shared/types';
import { BRACKET_MATCH_STATUS, BRACKET_STATUS, INVENTORY_STATUS } from '../../../shared/types';
import { BracketEngine, BracketError, VALID_BRACKET_SLOTS } from '../domain/BracketEngine';
import type { InventoryManager } from '../domain/inventory/InventoryManager';
import { sanitizePlayerName } from '../../../shared/validation';
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
  /**
   * Admin court catalog (D3) — the existence authority for `courtExists`
   * (TCS-2: a bracket court MUST be inventory-ACTIVE) and the strict
   * cold-start gate (TCS-4: no ACTIVE inventory court → no bracket). Optional
   * for older test wiring; when absent the legacy `getAllTournamentCourts`
   * check is used and the cold-start gate is skipped (bridge honesty — the
   * production index.ts always injects it).
   */
  private readonly inventoryManager?: InventoryManager;

  constructor(
    io: Server,
    tableManager: import('../domain/courtManager').CourtManager,
    ownerPin: string,
    store: BracketStoreSeam,
    inventoryManager?: InventoryManager,
  ) {
    super(io, tableManager, ownerPin);
    this.store = store;
    this.inventoryManager = inventoryManager;
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
    // The connect-time BRACKET_STATE push is handled centrally by
    // SocketHandler (it calls sendStateToSocket for every connecting socket,
    // owner or kiosk). We do NOT emit here so the owner does not receive a
    // duplicate state push on connect.

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
    // Owner-picker court binding (D13/TCS-1): TOURNAMENT_SELECT_TABLE binds a
    // bracket match to an inventory-ACTIVE court. Registered here (not in
    // CourtEventHandler — DEVIATION, see header note) because the engine +
    // reverse index + owner gate are private to BracketHandler; the slice-3
    // AFE-2 seam pattern applies the same way (BracketHandler exposes public
    // seams to other handlers).
    socket.on(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, (data: unknown) =>
      this.onSelectTable(socket, data as Record<string, unknown>),
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
    // TCS-4 strict cold start: a tournament MUST NOT start when no
    // inventory-ACTIVE court exists. No provisional seeding, no escape hatch.
    // Skipped only when no InventoryManager is wired (legacy test wiring).
    if (this.inventoryManager && !this.inventoryManager.hasActive()) {
      return this.emitError(
        socket,
        'COURT_INVENTORY_EMPTY',
        'No hay mesas disponibles. Configurá el inventario como admin para comenzar un torneo.',
      );
    }
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
    this.broadcastState(socket);
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
      // Sanitize before persisting: names are rendered on the kiosk + owner
      // dashboard, so strip HTML and truncate (shared sanitizePlayerName, S7).
      this.engine.assignPlayer(m, s as Player, sanitizePlayerName(n));
    } catch (err) {
      return this.onEngineError(socket, err);
    }
    this.scheduleDebouncedSave();
    this.broadcastState(socket);
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
    this.releaseIfCompleted(); // Q4 — final decided → courts IDLE, bracket kept
    this.broadcastState(socket);
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
    // Option 2 — reverse-index validation: a court cannot be bound to TWO
    // bracket matches. Re-assigning the same court to the same match is a
    // harmless no-op and stays allowed.
    if (typeof c === 'string') {
      const boundMatch = this.buildCourtIndex().get(c);
      if (boundMatch && boundMatch.id !== m) {
        return this.emitError(
          socket,
          'COURT_ALREADY_ASSIGNED',
          'La cancha ya está asignada a otro partido del bracket',
        );
      }
    }

    try {
      this.engine.assignCourt(m, c);
    } catch (err) {
      return this.onEngineError(socket, err);
    }
    this.scheduleDebouncedSave();
    this.broadcastState(socket);
  }

  /**
   * Owner picker → bracket binding (D13, TCS-1/TCS-2, Q1/Q2 payload).
   *
   * `TOURNAMENT_SELECT_TABLE { matchId, courtId }` binds a bracket match to an
   * inventory-ACTIVE court. Availability-only (TCS-1 — never mutates
   * existence). Guards, in order:
   *   1. owner gate (guardOwner);
   *   2. inventory-ACTIVE (TCS-2 — the widened courtExists);
   *   3. club RESERVED (Q2 — a pending-PIN club court reads IDLE from
   *      availability but MUST be excluded from SELECT);
   *   4. flow-empty (TCS-2 — a live club/tournament flow refuses SELECT);
   *   5. reverse index (TCS-2 — a court cannot be bound to TWO matches).
   * Success → `engine.assignCourt` → the binding makes availability BUSY
   * (INV-4 — the flow slot is derived).
   */
  private onSelectTable(socket: Socket, data: Record<string, unknown>): void {
    if (!this.guardOwner(socket)) return;
    const m = data?.matchId;
    const c = data?.courtId;
    if (typeof m !== 'string' || !m) {
      return this.emitError(socket, 'INVALID_PARAMS', 'matchId required');
    }
    if (typeof c !== 'string' || !c) {
      return this.emitError(socket, 'INVALID_PARAMS', 'courtId must be a string');
    }
    if (!this.courtExists(c)) {
      return this.emitError(socket, 'COURT_NOT_FOUND', 'La cancha no existe o no está disponible');
    }
    const runtime = this.tableManager.getCourt(c);
    if (runtime && (runtime as { kind?: string }).kind === 'club') {
      const clubStatus = (runtime as { clubStatus?: string }).clubStatus;
      // Q2: RESERVED (pending PIN) is pre-flow but must never be SELECTED.
      if (clubStatus === 'RESERVED') {
        return this.emitError(socket, 'COURT_RESERVED', 'La cancha está reservada para una sesión de club');
      }
      // TCS-2: a live club flow (OCCUPIED/FINISHED) refuses SELECT.
      if (clubStatus === 'OCCUPIED' || clubStatus === 'FINISHED') {
        return this.emitError(socket, 'COURT_BUSY', 'La cancha está en uso');
      }
    } else if (runtime && (runtime as { status?: string }).status === 'LIVE') {
      // TCS-2: a live tournament flow refuses SELECT.
      return this.emitError(socket, 'COURT_BUSY', 'La cancha está en uso');
    }
    // TCS-2 reverse index — a court cannot be bound to TWO bracket matches.
    const boundMatch = this.buildCourtIndex().get(c);
    if (boundMatch && boundMatch.id !== m) {
      return this.emitError(
        socket,
        'COURT_ALREADY_ASSIGNED',
        'La cancha ya está asignada a otro partido del bracket',
      );
    }
    try {
      this.engine.assignCourt(m, c);
    } catch (err) {
      return this.onEngineError(socket, err);
    }
    this.scheduleDebouncedSave();
    this.broadcastState(socket);
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
    this.broadcastState(socket);
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
    // TCS-3/Q4: before clearing the bracket, release every court binding so
    // tournament flows reach IDLE (courts freed for club/tournament reuse).
    this.releaseAllCourts();
    this.engine.reset();
    this.store.setBracket(null); // immediate
    this.broadcastState(socket);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /**
   * Option 2 — reverse index `courtId → BracketMatch`, rebuilt lazily from
   * the CURRENT engine state on every lookup. Because it derives from the
   * live bracket it stays correct after create / assign / undo / reset /
   * restore without explicit invalidation points. Bracket sizes are capped at
   * 32 slots (≤ 31 main matches + 1 TP) so a fresh O(n) build per lookup is
   * negligible compared to a socket round-trip.
   */
  private buildCourtIndex(): Map<string, BracketMatch> {
    const b = this.engine.bracket;
    const index = new Map<string, BracketMatch>();
    if (!b) return index;
    for (const m of b.matches) {
      if (m.courtId) index.set(m.courtId, m);
    }
    if (b.thirdPlaceMatch?.courtId) {
      index.set(b.thirdPlaceMatch.courtId, b.thirdPlaceMatch);
    }
    return index;
  }

  /**
   * Option 2 — resolve the bracket match currently bound to a court, or null
   * when the court is not bound / no bracket exists. Public because the
   * SocketHandler (court match flow) consumes it; this is the seam a future
   * Option-4 (explicit per-court matchId override) swaps out.
   */
  resolveBracketMatchForCourt(courtId: string): BracketMatch | null {
    return this.buildCourtIndex().get(courtId) ?? null;
  }

  /**
   * Option 2 — auto-advance the bracket when a court match finishes.
   *
   * Called by SocketHandler.onMatchEvent on MATCH_WON for tournament courts.
   * The engine methods are pure and NOT owner-gated, so a server-internal
   * call is safe without a socket. Flow:
   *   1. Resolve the bound match by court; unbound courts are a no-op.
   *   2. Skip already-COMPLETED matches (replay / manual win — never overwrite)
   *      and non-READY matches (empty slots → organizer closes manually).
   *   3. Map the winning NAME to the logical slot (name === playerA → 'A',
   *      name === playerB → 'B'); referee-edited names fall back to manual.
   *   4. `engine.setWinner`, then — for a semifinal — feed the loser into the
   *      third-place match via `engine.setThirdPlaceLoser`.
   *   5. Persist immediately and broadcast BRACKET_STATE to every client
   *      (owner dashboard + kiosk).
   *
   * Any BracketError is caught and logged — the court flow NEVER crashes on
   * a bracket issue; the organizer keeps full manual control.
   *
   * @returns true when the bracket advanced, false for no-op/manual fallback.
   */
  handleCourtMatchWon(courtId: string, winningName: string): boolean {
    const b = this.engine.bracket;
    const m = b ? this.resolveBracketMatchForCourt(courtId) : null;
    if (!b || !m) return false; // court not bound → normal tournament flow
    if (m.status === BRACKET_MATCH_STATUS.COMPLETED) return false; // manual win wins
    if (m.status !== BRACKET_MATCH_STATUS.READY) return false; // slots empty → manual

    const winnerSlot: Player | null =
      winningName && winningName === m.playerA
        ? 'A'
        : winningName && winningName === m.playerB
          ? 'B'
          : null;
    if (!winnerSlot) return false; // referee edited the names → manual

    try {
      this.engine.setWinner(m.id, winnerSlot);
      const totalRounds = Math.log2(b.numSlots);
      if (b.thirdPlaceMatch && m.round === totalRounds - 1) {
        const loserSlot: Player = winnerSlot === 'A' ? 'B' : 'A';
        this.engine.setThirdPlaceLoser(m.id, loserSlot);
      }
    } catch (err) {
      logger.warn({ courtId, matchId: m.id, err }, 'Bracket auto-advance failed; falling back to manual');
      return false;
    }
    this.persistNow(); // a decided match must not be lost
    this.releaseIfCompleted(); // Q4 — auto-advance completing the final frees courts
    this.broadcastStateToAll();
    return true;
  }

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

  /**
   * Broadcast the current bracket state to every connected client (owner +
   * kiosks) on a mutation. The acting socket receives the state directly via
   * `socket.emit` (so the owner's `useBracket` updates synchronously and
   * unit tests can observe it on the actor's emit log), and every OTHER
   * socket receives it via `socket.broadcast.emit`. This delivers live
   * bracket updates to kiosk clients without any new client→server event and
   * without double-delivering to the actor.
   */
  private broadcastState(socket: Socket): void {
    socket.emit(SocketEvents.SERVER.BRACKET_STATE, this.engine.bracket);
    socket.broadcast.emit(SocketEvents.SERVER.BRACKET_STATE, this.engine.bracket);
  }

  /**
   * Broadcast BRACKET_STATE to EVERY connected client (owner + kiosks).
   * Used by the server-internal auto-advance path (`handleCourtMatchWon`),
   * which has no acting socket — unlike `broadcastState(socket)` which emits
   * directly to the actor and broadcasts to everyone else.
   */
  private broadcastStateToAll(): void {
    this.io.emit(SocketEvents.SERVER.BRACKET_STATE, this.engine.bracket);
  }

  /**
   * Push the current bracket state to a single socket. Called by
   * SocketHandler on connect so a freshly connected kiosk (or owner) learns
   * the current bracket immediately, mirroring the KIOSK_MODE connect push.
   * Public because SocketHandler invokes it outside the handler's own
   * `registerHandlers` flow.
   */
  sendStateToSocket(socket: Socket): void {
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

  /** A tournament court id exists (R6 court validation, TCS-2 widening). */
  private courtExists(courtId: string): boolean {
    // TCS-2 (slice 4): existence is the admin catalog — a bracket court MUST
    // be inventory-ACTIVE. Live club flows can never enter the reverse index
    // because SELECT requires flow-empty (they never pass the guard above).
    if (this.inventoryManager) {
      return this.inventoryManager.get(courtId)?.inventoryStatus === INVENTORY_STATUS.ACTIVE;
    }
    // Legacy fallback for wiring without an inventory (old tests).
    return this.tableManager.getAllTournamentCourts().some((c) => c.id === courtId);
  }

  /**
   * Public unbind seam (AFE-2 completion, slice 4): null a bracket match's
   * courtId binding (engine.assignCourt(m, null)). Consumed by the
   * INVENTORY_FORCE_END flow context so a force-ended tournament court frees
   * its bracket binding (no setWinner / no advance). Unknown match → no-op
   * (the binding is already gone).
   */
  unbindMatch(matchId: string): void {
    try {
      this.engine.assignCourt(matchId, null);
    } catch {
      return; // MATCH_NOT_FOUND — nothing bound, nothing to unbind
    }
    this.scheduleDebouncedSave();
    this.broadcastStateToAll();
  }

  /**
   * Release every bracket court binding + tournament flow on tournament
   * end/reset (TCS-3, Q4). Public so the HTTP finish route can invoke it via
   * the SocketHandler seam. Bracket-scoped: only courtIds bound in the
   * bracket are released — club courts are never touched (they are not in
   * bracket.matches). The completed bracket is KEPT for display (Q4 — no
   * engine.reset()/setBracket(null) here). Persists once. Returns the
   * released courtIds (distinct).
   */
  releaseAllCourts(): string[] {
    const courtIds = this.engine.releaseAll();
    for (const courtId of courtIds) {
      this.tableManager.releaseCourtFlow(courtId);
    }
    if (courtIds.length > 0) {
      this.persistNow();
      this.broadcastStateToAll();
    }
    return courtIds;
  }

  /**
   * Release the bracket courts when the tournament COMPLETES (Q4): after the
   * final is decided the courts must reach IDLE while the completed bracket
   * stays on display. Called from the mutation paths that can complete the
   * bracket (manual setWinner + auto-advance).
   */
  private releaseIfCompleted(): void {
    if (this.engine.bracket?.status === BRACKET_STATUS.COMPLETED) {
      this.releaseAllCourts();
    }
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