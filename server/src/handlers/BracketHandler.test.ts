/**
 * BracketHandler — socket event layer for the bracket tournament (Tier 2).
 *
 * Spec: bracket-tournament-mvp. The handler is a thin validation + owner-gate
 * + persistence-debounce layer over {@link BracketEngine} (the pure domain).
 * Every behavior spec scenario that has a server side is covered here:
 *   - R1  create (valid + INVALID_SIZE)
 *   - R2  assign player (assign, clear, NAME_TOO_LONG)
 *   - R3  set winner (advance + MATCH_NOT_READY / INVALID_WINNER)
 *   - R4  undo (reverts winner + downstream)
 *   - R6  assign court (valid + unknown court COURT_NOT_FOUND)
 *   - R7  owner gate (non-owner → UNAUTHORIZED, no state mutation)
 *   - R8  2-step reset (BRACKET_RESET_CONFIRM token, confirm clears, expired,
 *         wrong token)
 *   - R9  third place flows through create
 *   - R10 restore: engine is hydrated from StateStore on construction
 *
 * RED until `server/src/handlers/BracketHandler.ts` exists.
 */

import { BracketHandler } from './BracketHandler';
import { BracketEngine } from '../domain/BracketEngine';
import { SocketEvents } from '../../../shared/events';
import type { TournamentBracket } from '../../../shared/types';
import type { Socket } from 'socket.io';

// ── Fake StateStore (bracket-only seam — slice 6 coordinator contract) ────
// setBracket mutates the in-memory snapshot ONLY (no disk I/O); flush() is
// the single atomic disk write. This mirrors PersistenceCoordinator.

interface FakeStateStore {
  getBracket: jest.Mock;
  setBracket: jest.Mock;
  flush: jest.Mock;
}
function createFakeStateStore(persisted: TournamentBracket | null = null): FakeStateStore {
  let state = persisted;
  return {
    getBracket: jest.fn(() => state),
    setBracket: jest.fn((b: TournamentBracket | null) => {
      state = b;
    }),
    flush: jest.fn(),
  };
}

// ── Fake CourtManager (only getAllTournamentCourts is used) ───────────────

function createFakeTableManager(
  courtIds: string[] = ['c1', 'c2'],
  runtimeCourts: Record<string, unknown> = {},
) {
  return {
    getAllTournamentCourts: jest.fn(() => courtIds.map((id) => ({ id }))),
    getCourt: jest.fn((id: string) => runtimeCourts[id]),
    releaseCourtFlow: jest.fn(),
    ensureRuntimeTournamentCourt: jest.fn(() => true),
  } as unknown as import('../domain/courtManager').CourtManager;
}

// ── Fake InventoryManager (catalog; slice-4 courtExists + cold-start) ─────

interface FakeInventoryRecord {
  courtId: string;
  inventoryStatus: string;
}
function createFakeInventory(
  records: FakeInventoryRecord[] = [
    { courtId: 'c1', inventoryStatus: 'ACTIVE' },
    { courtId: 'c2', inventoryStatus: 'ACTIVE' },
  ],
) {
  return {
    get: jest.fn((id: string) => records.find((r) => r.courtId === id)),
    hasActive: jest.fn(() => records.some((r) => r.inventoryStatus === 'ACTIVE')),
    list: jest.fn(() => records),
  } as unknown as import('../domain/inventory/InventoryManager').InventoryManager;
}

// ── Mock socket ───────────────────────────────────────────────────────────

interface EmitRecord {
  event: string;
  data: unknown;
}
interface MockSocket {
  id: string;
  data: { isOwner?: boolean; [k: string]: unknown };
  on: jest.Mock;
  emit: jest.Mock;
  broadcast: { emit: jest.Mock };
  _listeners: Map<string, (...args: any[]) => void>;
  _trigger: (event: string, ...args: any[]) => void;
  _emitted: EmitRecord[];
}

function createMockSocket(id: string, isOwner = true): MockSocket {
  const listeners = new Map<string, (...args: any[]) => void>();
  const emitted: EmitRecord[] = [];
  return {
    id,
    data: isOwner ? { isOwner: true } : {},
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners.set(event, handler);
    }),
    emit: jest.fn((event: string, data: unknown) => {
      emitted.push({ event, data });
    }),
    broadcast: { emit: jest.fn() },
    _listeners: listeners,
    _trigger: (event: string, ...args: any[]) => {
      listeners.get(event)?.(...args);
    },
    _emitted: emitted,
  } as unknown as MockSocket;
}

// ── Mock io (sockets map, for any owner broadcast) ────────────────────────

function createMockIo() {
  const map = new Map<string, MockSocket>();
  return {
    sockets: { sockets: map },
    emit: jest.fn(), // all-client broadcast (handleCourtMatchWon / broadcastStateToAll)
    _map: map,
  } as unknown as import('socket.io').Server;
}

function makeHandler(
  stateStore: FakeStateStore = createFakeStateStore(),
  courtIds: string[] = ['c1', 'c2'],
  opts: {
    runtimeCourts?: Record<string, unknown>;
    inventory?: ReturnType<typeof createFakeInventory>;
  } = {},
) {
  const io = createMockIo();
  const tableManager = createFakeTableManager(courtIds, opts.runtimeCourts ?? {});
  const inventory = opts.inventory ?? createFakeInventory();
  const handler = new BracketHandler(io, tableManager, 'pin', stateStore as any, inventory as any);
  return { io, tableManager, inventory, handler, stateStore };
}

function ownerBracketState(socket: MockSocket): TournamentBracket | null {
  // find the most recent BRACKET_STATE emit
  const rec = [...socket._emitted].reverse().find((e) => e.event === SocketEvents.SERVER.BRACKET_STATE);
  return (rec?.data as TournamentBracket | null) ?? null;
}

function lastError(socket: MockSocket): { code: string } | undefined {
  const rec = [...socket._emitted].reverse().find((e) => e.event === SocketEvents.SERVER.BRACKET_ERROR);
  return rec?.data as { code: string } | undefined;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('BracketHandler', () => {
  describe('owner gate (R7)', () => {
    it('rejects BRACKET_CREATE from a non-owner socket with UNAUTHORIZED and does not mutate state', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('n1', false);
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 8, includeThirdPlace: false });

      expect(lastError(socket)?.code).toBe('UNAUTHORIZED');
      expect(stateStore.setBracket).not.toHaveBeenCalled();
      expect(ownerBracketState(socket)).toBeNull(); // no BRACKET_STATE emitted
    });

    it('rejects every bracket event from a non-owner socket (triangulate)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('n2', false);
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_GET, {});
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'X' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M1', winner: 'A' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, {});

      const codes = socket._emitted.filter((e) => e.event === SocketEvents.SERVER.BRACKET_ERROR).map((e) => (e.data as { code: string }).code);
      expect(codes).toEqual(['UNAUTHORIZED', 'UNAUTHORIZED', 'UNAUTHORIZED', 'UNAUTHORIZED']);
    });
  });

  describe('BRACKET_CREATE (R1)', () => {
    it('creates an 8-slot bracket, emits BRACKET_STATE, and persists immediately', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o1');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'Torneo', numSlots: 8, includeThirdPlace: true });

      const b = ownerBracketState(socket);
      expect(b).not.toBeNull();
      expect(b!.numSlots).toBe(8);
      expect(b!.includeThirdPlace).toBe(true);
      // R9: third place generated
      expect(b!.thirdPlaceMatch).not.toBeNull();
      // immediate save (create is a setup mutation that must not be lost)
      expect(stateStore.setBracket).toHaveBeenCalledTimes(1);
      expect(stateStore.setBracket).toHaveBeenCalledWith(expect.objectContaining({ name: 'Torneo' }));
    });

    it('rejects an invalid size with INVALID_SIZE and persists nothing', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o2');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 6, includeThirdPlace: false });

      expect(lastError(socket)?.code).toBe('INVALID_SIZE');
      expect(stateStore.setBracket).not.toHaveBeenCalled();
    });

    it('rejects a name longer than 50 chars with INVALID_NAME', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o3');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'a'.repeat(51), numSlots: 4, includeThirdPlace: false });

      expect(lastError(socket)?.code).toBe('INVALID_NAME');
    });

    it('rejects a missing includeThirdPlace boolean with INVALID_PARAMS', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o4');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: 'yes' });

      expect(lastError(socket)?.code).toBe('INVALID_PARAMS');
    });

    it('broadcasts BRACKET_STATE to other clients (kiosk) on create, actor gets it directly', () => {
      const { handler } = makeHandler();
      const owner = createMockSocket('o-broadcast');
      handler.registerHandlers(owner as unknown as Socket);

      owner._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 8, includeThirdPlace: false });

      // Actor received BRACKET_STATE directly (socket.emit)
      const actorState = ownerBracketState(owner);
      expect(actorState).not.toBeNull();
      expect(actorState!.name).toBe('T');

      // Broadcast path fired so kiosk clients (other sockets) get the update.
      expect(owner.broadcast.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.BRACKET_STATE,
        expect.objectContaining({ name: 'T' }),
      );
    });
  });

  describe('BRACKET_ASSIGN_PLAYER (R2)', () => {
    it('assigns a player to slot A and emits BRACKET_STATE', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o5');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.playerA).toBe('Juan');
    });

    it("clears a slot when name is '' ", () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o6');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: '' });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.playerA).toBeNull();
    });

    it('sanitizes HTML from a player name before persisting (S7)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o7b');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
        matchId: 'R1-M1',
        slot: 'A',
        name: '<script>alert(1)</script>Juan',
      });

      const b = ownerBracketState(socket);
      // HTML tags stripped (script body kept as inert text) — no <script> remains.
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.playerA).toBe('alert(1)Juan');
    });

    it('rejects a name longer than 50 chars with NAME_TOO_LONG', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o7');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'a'.repeat(51) });

      expect(lastError(socket)?.code).toBe('NAME_TOO_LONG');
    });

    it('debounces the DISK flush for slot-saves while mutating the snapshot immediately', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o8');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      (stateStore.setBracket as jest.Mock).mockClear();
      (stateStore.flush as jest.Mock).mockClear();

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });

      // The in-memory snapshot is mutated immediately (PERS-4: the shared
      // source of truth stays current so a concurrent CourtManager flush
      // serializes the latest bracket)…
      expect(stateStore.setBracket).toHaveBeenCalled();
      // …but the DISK write (flush) is debounced 2s — no immediate save.
      expect(stateStore.flush).not.toHaveBeenCalled();
    });

    it('flushes the debounced slot-save after the 2s window — one atomic write', () => {
      jest.useFakeTimers();
      try {
        const { handler, stateStore } = makeHandler();
        const socket = createMockSocket('o8b');
        handler.registerHandlers(socket as unknown as Socket);
        socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
        (stateStore.flush as jest.Mock).mockClear();

        socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });
        expect(stateStore.flush).not.toHaveBeenCalled();

        jest.advanceTimersByTime(2_000);
        expect(stateStore.flush).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('BRACKET_SET_WINNER (R3)', () => {
    it('declares a winner, advances, and saves immediately', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o9');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'B', name: 'Maria' });
      (stateStore.setBracket as jest.Mock).mockClear();

      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M1', winner: 'A' });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R2-M1')!.playerA).toBe('Juan'); // advanced
      expect(stateStore.setBracket).toHaveBeenCalledTimes(1); // immediate
    });

    it('rejects a non-ready match with MATCH_NOT_READY and does not mutate', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o10');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M2', winner: 'A' });

      expect(lastError(socket)?.code).toBe('MATCH_NOT_READY');
      expect(stateStore.setBracket).toHaveBeenCalledTimes(1); // only the create save
    });

    it('rejects an invalid winner value with INVALID_WINNER', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o11');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'B', name: 'Maria' });

      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M1', winner: 'C' });

      expect(lastError(socket)?.code).toBe('INVALID_WINNER');
    });
  });

  describe('BRACKET_UNDO_MATCH (R4)', () => {
    it('undoes a match and saves immediately', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o12');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'B', name: 'Maria' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M1', winner: 'A' });
      (stateStore.setBracket as jest.Mock).mockClear();

      socket._trigger(SocketEvents.CLIENT.BRACKET_UNDO_MATCH, { matchId: 'R1-M1' });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.winner).toBeNull();
      expect(stateStore.setBracket).toHaveBeenCalledTimes(1);
    });
  });

  describe('BRACKET_ASSIGN_COURT (R6)', () => {
    it('assigns a known court id', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o13');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBe('c1');
    });

    it('rejects an unknown court id with COURT_NOT_FOUND', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o14');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'no-such-court' });

      expect(lastError(socket)?.code).toBe('COURT_NOT_FOUND');
    });

    it('nullifies a court id with null', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o15');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: null });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBeNull();
    });
  });

  describe('Option 2 — court↔bracket registry (reverse index)', () => {
    it('rejects binding a court already bound to ANOTHER match with COURT_ALREADY_ASSIGNED', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o24');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M2', courtId: 'c1' });

      expect(lastError(socket)?.code).toBe('COURT_ALREADY_ASSIGNED');
      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBe('c1'); // unchanged
      expect(b!.matches.find((m) => m.id === 'R1-M2')!.courtId).toBeNull(); // not bound
    });

    it('allows re-assigning the same court to the same match (idempotent)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o25');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      expect(lastError(socket)?.code).toBeUndefined();
      expect(ownerBracketState(socket)!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBe('c1');
    });

    it('nullifying a binding frees the court for another match', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o26');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: null });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M2', courtId: 'c1' });

      expect(lastError(socket)?.code).toBeUndefined();
      expect(ownerBracketState(socket)!.matches.find((m) => m.id === 'R1-M2')!.courtId).toBe('c1');
    });

    it('keeps the existing COURT_NOT_FOUND validation', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o27');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'nope' });

      expect(lastError(socket)?.code).toBe('COURT_NOT_FOUND');
    });

    it('resolveBracketMatchForCourt returns the bound match, null for unbound/no bracket', () => {
      const { handler } = makeHandler();
      // no bracket yet
      expect(handler.resolveBracketMatchForCourt('c1')).toBeNull();

      const socket = createMockSocket('o28');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      expect(handler.resolveBracketMatchForCourt('c1')?.id).toBe('R1-M1');
      expect(handler.resolveBracketMatchForCourt('c2')).toBeNull(); // unbound court
    });

    it('resolveBracketMatchForCourt includes the third-place match', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o29');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: true });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'TP-M1', courtId: 'c2' });

      expect(handler.resolveBracketMatchForCourt('c2')?.id).toBe('TP-M1');
    });

    it('resolveBracketMatchForCourt returns null after reset', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o30');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, {});
      const token = (socket._emitted.find((e) => e.event === SocketEvents.SERVER.BRACKET_RESET_CONFIRM)!.data as { token: string }).token;
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: token });

      expect(handler.resolveBracketMatchForCourt('c1')).toBeNull();
    });
  });

  describe('Option 2 — handleCourtMatchWon (auto-advance)', () => {
    /** Build a bracket + court bindings via socket events, then exercise the server-internal path. */
    function buildBoundBracket(handler: BracketHandler, socket: MockSocket, opts: { thirdPlace?: boolean; matchId?: string; courtId?: string } = {}) {
      const { thirdPlace = false, matchId = 'R1-M1', courtId = 'c1' } = opts;
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: thirdPlace });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'B', name: 'Maria' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId, courtId });
    }

    it('auto-sets the winner by name and advances to the next round', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o31');
      handler.registerHandlers(socket as unknown as Socket);
      buildBoundBracket(handler, socket);

      const advanced = handler.handleCourtMatchWon('c1', 'Juan');

      expect(advanced).toBe(true);
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBe('A');
      expect(b.matches.find((m) => m.id === 'R1-M1')!.status).toBe('COMPLETED');
      expect(b.matches.find((m) => m.id === 'R2-M1')!.playerA).toBe('Juan');
    });

    it('maps the winning name to the correct slot (winner B)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o32');
      handler.registerHandlers(socket as unknown as Socket);
      buildBoundBracket(handler, socket);

      const advanced = handler.handleCourtMatchWon('c1', 'Maria');

      expect(advanced).toBe(true);
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBe('B');
      expect(b.matches.find((m) => m.id === 'R2-M1')!.playerA).toBe('Maria');
    });

    it('broadcasts BRACKET_STATE to ALL clients after advancing', () => {
      const { handler, io } = makeHandler();
      const socket = createMockSocket('o33');
      handler.registerHandlers(socket as unknown as Socket);
      buildBoundBracket(handler, socket);

      handler.handleCourtMatchWon('c1', 'Juan');

      expect((io.emit as jest.Mock)).toHaveBeenCalledWith(
        SocketEvents.SERVER.BRACKET_STATE,
        expect.objectContaining({ name: 'T' }),
      );
    });

    it('feeds the semifinal loser into the third-place match', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o34');
      handler.registerHandlers(socket as unknown as Socket);
      buildBoundBracket(handler, socket, { thirdPlace: true });

      const advanced = handler.handleCourtMatchWon('c1', 'Juan');

      expect(advanced).toBe(true);
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.thirdPlaceMatch!.playerA).toBe('Maria'); // SF1 (pos 0) loser → TP A
      expect(b.thirdPlaceMatch!.status).toBe('READY'); // single slot → ready, not completed
    });

    it('is a no-op for a court not bound to any bracket match', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o35');
      handler.registerHandlers(socket as unknown as Socket);
      buildBoundBracket(handler, socket);
      // c2 exists as a tournament court but is not bound.
      expect(handler.handleCourtMatchWon('c2', 'Juan')).toBe(false);
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBeNull();
    });

    it('is a no-op when there is no bracket', () => {
      const { handler } = makeHandler();
      expect(handler.handleCourtMatchWon('c1', 'Juan')).toBe(false);
    });

    it('never overwrites an already-COMPLETED bracket match (replay / manual win)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o36');
      handler.registerHandlers(socket as unknown as Socket);
      buildBoundBracket(handler, socket);
      // Owner manually declares the winner first (manual path stays).
      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M1', winner: 'A' });
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBe('A');

      // Court match replays with the other player winning — must NOT overwrite.
      expect(handler.handleCourtMatchWon('c1', 'Maria')).toBe(false);
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBe('A');
    });

    it('is a no-op when the bracket match is not READY (empty slots)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o37');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });
      // R1-M1 has NO players → PENDING.

      expect(handler.handleCourtMatchWon('c1', 'Juan')).toBe(false);
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBeNull();
    });

    it('is a no-op when the winning name matches neither slot (referee edited names)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o38');
      handler.registerHandlers(socket as unknown as Socket);
      buildBoundBracket(handler, socket);

      expect(handler.handleCourtMatchWon('c1', 'Edited Name')).toBe(false);
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBeNull();
    });

    it('does not crash when the engine rejects (e.g. bye winner slot invalid)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o39');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' }); // bye
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      // R1-M1 is READY (bye). Court names say 'Juan' won → maps to slot A, valid.
      expect(handler.handleCourtMatchWon('c1', 'Juan')).toBe(true);
      const b = handler['engine'].bracket as TournamentBracket;
      expect(b.matches.find((m) => m.id === 'R1-M1')!.winner).toBe('A');
    });
  });

  describe('BRACKET_GET', () => {
    it('emits the current bracket state to the owner', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o16');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._emitted.length = 0; // reset emitted log

      socket._trigger(SocketEvents.CLIENT.BRACKET_GET, {});

      const b = ownerBracketState(socket);
      expect(b).not.toBeNull();
      expect(b!.name).toBe('T');
    });

    it('emits null state when no bracket exists', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o17');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_GET, {});

      // BRACKET_STATE emitted with null (permit null bracket state)
      const rec = socket._emitted.find((e) => e.event === SocketEvents.SERVER.BRACKET_STATE);
      expect(rec).toBeDefined();
      expect(rec!.data).toBeNull();
    });
  });

  describe('BRACKET_RESET — 2-step (R8)', () => {
    it('step 1: emits BRACKET_RESET_CONFIRM with a token and 30s expiry', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o18');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, {});

      const confirm = socket._emitted.find((e) => e.event === SocketEvents.SERVER.BRACKET_RESET_CONFIRM);
      expect(confirm).toBeDefined();
      const payload = confirm!.data as { token: string; expiresIn: number };
      expect(typeof payload.token).toBe('string');
      expect(payload.token.length).toBeGreaterThan(0);
      expect(payload.expiresIn).toBe(30);
    });

    it('step 2: a valid confirmToken resets the bracket and emits BRACKET_STATE null', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o19');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, {});
      const token = (socket._emitted.find((e) => e.event === SocketEvents.SERVER.BRACKET_RESET_CONFIRM)!.data as { token: string }).token;

      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: token });

      const rec = socket._emitted.filter((e) => e.event === SocketEvents.SERVER.BRACKET_STATE).pop();
      expect(rec!.data).toBeNull();
      expect(stateStore.setBracket).toHaveBeenCalledWith(null);
      // reset is immediate — the disk flush fires synchronously (no debounce).
      expect(stateStore.flush).toHaveBeenCalled();
    });

    it('rejects an expired confirmToken with RESET_EXPIRED', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o20');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      jest.useFakeTimers();
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, {});
      const token = (socket._emitted.find((e) => e.event === SocketEvents.SERVER.BRACKET_RESET_CONFIRM)!.data as { token: string }).token;

      jest.advanceTimersByTime(31_000);
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: token });
      jest.useRealTimers();

      expect(lastError(socket)?.code).toBe('RESET_EXPIRED');
    });

    it('rejects a wrong confirmToken with INVALID_TOKEN', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o21');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, {});
      socket._trigger(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: 'not-the-token' });

      expect(lastError(socket)?.code).toBe('INVALID_TOKEN');
    });
  });

  describe('NO_BRACKET guard', () => {
    it('assigning on a missing bracket emits NO_BRACKET', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o22');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'X' });

      expect(lastError(socket)?.code).toBe('NO_BRACKET');
    });
  });

  describe('restore on construction (R10)', () => {
    it('hydrates the engine from a persisted bracket so BRACKET_GET restores it', () => {
      const persisted = new BracketEngine().create('Persistido', 8, false);
      const store = createFakeStateStore(persisted);
      const { handler } = makeHandler(store);

      const socket = createMockSocket('o23');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_GET, {});

      const b = ownerBracketState(socket);
      expect(b).not.toBeNull();
      expect(b!.name).toBe('Persistido');
      expect(b!.numSlots).toBe(8);
    });
  });

  // ── Slice 4: TOURNAMENT_SELECT_TABLE (D13, TCS-1/TCS-2, Q1/Q2) ────────

  describe('TOURNAMENT_SELECT_TABLE (TCS-1/TCS-2, Q1/Q2)', () => {
    it('binds a match to an inventory-ACTIVE flow-empty court and emits BRACKET_STATE', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('s1');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBe('c1');
    });

    it('emits PIN_REGENERATED with the court PIN after SELECT (owner sees it immediately)', () => {
      const { handler, tableManager } = makeHandler(undefined, ['c1', 'c2'], {
        runtimeCourts: { c1: { id: 'c1', pin: '4321' } },
      });
      const socket = createMockSocket('s1');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      // The runtime court carries a PIN; the owner receives it immediately
      // instead of waiting for a pins re-request.
      const pinEvent = (socket._emitted as any[]).find(
        (e) => e.event === SocketEvents.SERVER.PIN_REGENERATED,
      );
      expect(pinEvent).toBeDefined();
      expect(pinEvent.data.courtId).toBe('c1');
      expect(pinEvent.data.newPin).toBe('4321');
    });

    it('rejects a MAINTENANCE inventory court with COURT_NOT_FOUND (TCS-2)', () => {
      const inventory = createFakeInventory([
        { courtId: 'c1', inventoryStatus: 'MAINTENANCE' },
        { courtId: 'c2', inventoryStatus: 'ACTIVE' },
      ]);
      const { handler } = makeHandler(undefined, ['c1', 'c2'], { inventory });
      const socket = createMockSocket('s2');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      expect(lastError(socket)?.code).toBe('COURT_NOT_FOUND');
      expect(ownerBracketState(socket)!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBeNull();
    });

    it('refuses a court with a live club flow (OCCUPIED) — COURT_BUSY (TCS-2)', () => {
      const inventory = createFakeInventory([
        { courtId: 'c1', inventoryStatus: 'ACTIVE' },
      ]);
      const { handler } = makeHandler(undefined, ['c1'], {
        inventory,
        runtimeCourts: { c1: { id: 'c1', mode: 'club', clubStatus: 'OCCUPIED' } },
      });
      const socket = createMockSocket('s3');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      expect(lastError(socket)?.code).toBe('COURT_BUSY');
      expect(ownerBracketState(socket)!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBeNull();
    });

    it('refuses a club court in RESERVED (pending PIN) state — COURT_RESERVED (Q2)', () => {
      const inventory = createFakeInventory([
        { courtId: 'c1', inventoryStatus: 'ACTIVE' },
      ]);
      const { handler } = makeHandler(undefined, ['c1'], {
        inventory,
        runtimeCourts: { c1: { id: 'c1', mode: 'club', clubStatus: 'RESERVED' } },
      });
      const socket = createMockSocket('s4');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      expect(lastError(socket)?.code).toBe('COURT_RESERVED');
      expect(ownerBracketState(socket)!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBeNull();
    });

    it('rejects a court already bound to ANOTHER bracket match with COURT_ALREADY_ASSIGNED (TCS-2 reverse index)', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('s5');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M2', courtId: 'c1' });

      expect(lastError(socket)?.code).toBe('COURT_ALREADY_ASSIGNED');
      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBe('c1');
      expect(b!.matches.find((m) => m.id === 'R1-M2')!.courtId).toBeNull();
    });

    it('rejects a non-owner socket with UNAUTHORIZED and no binding', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('s6', false);
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      expect(lastError(socket)?.code).toBe('UNAUTHORIZED');
    });

    it('rejects a missing matchId or courtId with INVALID_PARAMS', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('s7');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: '', courtId: 'c1' });
      expect(lastError(socket)?.code).toBe('INVALID_PARAMS');

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: '' });
      expect(lastError(socket)?.code).toBe('INVALID_PARAMS');
    });

    it('rejects an unknown matchId via the engine MATCH_NOT_FOUND path', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('s8');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'NOPE', courtId: 'c1' });

      expect(lastError(socket)?.code).toBe('MATCH_NOT_FOUND');
    });
  });

  // ── Slice 4: courtExists widening (TCS-2) ─────────────────────────────

  describe('courtExists widened to inventory-ACTIVE (TCS-2)', () => {
    it('BRACKET_ASSIGN_COURT rejects a runtime-only tournament court not in the catalog', () => {
      // inventory has c1 only; runtime has c1 + a legacy runtime-only c9.
      const inventory = createFakeInventory([{ courtId: 'c1', inventoryStatus: 'ACTIVE' }]);
      const { handler } = makeHandler(undefined, ['c1', 'c9'], { inventory });
      const socket = createMockSocket('w1');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c9' });

      expect(lastError(socket)?.code).toBe('COURT_NOT_FOUND');
    });

    it('BRACKET_ASSIGN_COURT accepts an inventory-ACTIVE court', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('w2');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, { matchId: 'R1-M1', courtId: 'c1' });

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBe('c1');
    });
  });

  // ── Slice 4: unbindMatch public seam (AFE-2 completion) ───────────────

  describe('unbindMatch (AFE-2 public seam)', () => {
    it('nulls the courtId of the bound match and persists', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('u1');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });

      handler.unbindMatch('R1-M1');

      const b = ownerBracketState(socket);
      expect(b!.matches.find((m) => m.id === 'R1-M1')!.courtId).toBeNull();
      // debounced save is scheduled (2s) — the save timer will fire later; the
      // engine state is what matters for the assertion above.
      expect(stateStore.setBracket).toHaveBeenCalled();
    });

    it('is a no-op for an unknown match (no throw)', () => {
      const { handler } = makeHandler();
      expect(() => handler.unbindMatch('DOES-NOT-EXIST')).not.toThrow();
    });
  });

  // ── Slice 4: releaseAllCourts (TCS-3, Q4) ─────────────────────────────

  describe('releaseAllCourts (TCS-3, Q4)', () => {
    it('unbinds every match, releases the tournament flows → IDLE via CourtManager, and KEEPS the bracket for display', () => {
      const { handler, tableManager, stateStore } = makeHandler();
      const socket = createMockSocket('r1');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: true });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M2', courtId: 'c2' });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'TP-M1', courtId: 'c1' });

      const released = handler.releaseAllCourts();

      expect(released.sort()).toEqual(['c1', 'c2']);
      // every match unbound — the bracket itself is KEPT (Q4).
      const b = ownerBracketState(socket);
      expect(b).not.toBeNull();
      for (const m of b!.matches) expect(m.courtId).toBeNull();
      expect(b!.thirdPlaceMatch!.courtId).toBeNull();
      // tournament flow release delegated per distinct released court.
      expect(tableManager.releaseCourtFlow).toHaveBeenCalledWith('c1');
      expect(tableManager.releaseCourtFlow).toHaveBeenCalledWith('c2');
      // persisted once.
      expect(stateStore.setBracket).toHaveBeenCalled();
    });

    it('is a no-op when nothing is bound — bracket untouched, no release calls', () => {
      const { handler, tableManager } = makeHandler();
      const socket = createMockSocket('r2');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      expect(handler.releaseAllCourts()).toEqual([]);
      expect(tableManager.releaseCourtFlow).not.toHaveBeenCalled();
      expect(ownerBracketState(socket)).not.toBeNull();
    });

    it('completing the FINAL match auto-releases the bracket courts (Q4 — courts IDLE, bracket kept)', () => {
      const { handler, tableManager } = makeHandler();
      const socket = createMockSocket('r3');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: true });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M1', courtId: 'c1' });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R1-M2', courtId: 'c2' });
      socket._trigger(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, { matchId: 'R2-M1', courtId: 'c1' });
      // Decide both semis + feed the third-place losers.
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'A1' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'B', name: 'B1' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M1', winner: 'A' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M2', slot: 'A', name: 'A2' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M2', slot: 'B', name: 'B2' });
      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R1-M2', winner: 'A' });

      // The final is now decided → bracket COMPLETED → courts auto-released.
      socket._trigger(SocketEvents.CLIENT.BRACKET_SET_WINNER, { matchId: 'R2-M1', winner: 'A' });

      const b = ownerBracketState(socket);
      expect(b!.status).toBe('COMPLETED');
      expect(b).not.toBeNull(); // bracket kept for display (Q4)
      expect(tableManager.releaseCourtFlow).toHaveBeenCalledWith('c1');
      expect(tableManager.releaseCourtFlow).toHaveBeenCalledWith('c2');
      for (const m of b!.matches) expect(m.courtId).toBeNull();
    });
  });

  // ── Slice 4: strict cold start (TCS-4) ────────────────────────────────

  describe('strict cold start (TCS-4)', () => {
    it('BRACKET_CREATE is rejected with COURT_INVENTORY_EMPTY when no ACTIVE inventory court exists', () => {
      const inventory = createFakeInventory([
        { courtId: 'c1', inventoryStatus: 'MAINTENANCE' },
      ]);
      const { handler, stateStore } = makeHandler(undefined, ['c1'], { inventory });
      const socket = createMockSocket('c1s');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      expect(lastError(socket)?.code).toBe('COURT_INVENTORY_EMPTY');
      expect(stateStore.setBracket).not.toHaveBeenCalled();
      expect(ownerBracketState(socket)).toBeNull();
    });

    it('BRACKET_CREATE is allowed when at least one ACTIVE inventory court exists', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('c2s');
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      expect(lastError(socket)).toBeUndefined();
      expect(ownerBracketState(socket)).not.toBeNull();
    });
  });
});

// ── Slice 6: BracketHandler through a REAL coordinator (PERS-4 wiring) ──

import { StateStore } from '../services/store/StateStore';
import { PersistenceCoordinator } from '../services/store/PersistenceCoordinator';
import type { FileSystem, PersistedStateV4 } from '../services/store/types';

function realFs(): FileSystem & { _files: Map<string, string> } {
  const files = new Map<string, string>();
  const written = new Map<string, string>();
  return {
    _files: files,
    writeFileSync(p: string, d: string) { written.set(p, d); },
    readFileSync(p: string) {
      if (!files.has(p)) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      return files.get(p)!;
    },
    renameSync(o: string, n: string) {
      const c = written.has(o) ? written.get(o) : files.get(o);
      files.set(n, c!);
      files.delete(o);
      written.delete(o);
    },
    existsSync(p: string) { return files.has(p) || written.has(p); },
    unlinkSync(p: string) { files.delete(p); written.delete(p); },
    mkdirSync() { return undefined; },
  };
}

describe('BracketHandler — real coordinator (PERS-4 single writer)', () => {
  it('bracket writes land in the shared snapshot; a later session-only flush keeps them (R2 fixed)', () => {
    const fs = realFs();
    const store = new StateStore(fs, 'state.json');
    const coordinator = new PersistenceCoordinator(store, {
      version: 4,
      savedAt: 0,
      liveSessions: [],
      bracket: null,
    } as PersistedStateV4);
    const io = createMockIo();
    const tableManager = createFakeTableManager(['c1'], {});
    const handler = new BracketHandler(io, tableManager, 'pin', coordinator, createFakeInventory() as never);

    const socket = createMockSocket('real1');
    handler.registerHandlers(socket as unknown as Socket);
    socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

    // Simulate CourtManager's session debounce firing AFTER the bracket write:
    // it mutates liveSessions on the SAME snapshot and flushes.
    coordinator.mutate((s) => {
      s.liveSessions = [{ courtId: 't1', flow: { mode: 'tournament', state: 'LIVE', startedAt: 1 }, matchState: null }];
    });
    coordinator.flush();

    const loaded = store.load();
    expect(loaded!.bracket).not.toBeNull();
    expect(loaded!.bracket!.name).toBe('T');
    expect(loaded!.liveSessions).toHaveLength(1);
    expect(loaded!.liveSessions[0].courtId).toBe('t1');
  });

  it('hydrates the engine from the coordinator snapshot at construction (R10)', () => {
    const fs = realFs();
    const store = new StateStore(fs, 'state.json');
    const persisted = {
      version: 4,
      savedAt: 0,
      liveSessions: [],
      bracket: {
        name: 'Restored',
        numSlots: 4,
        includeThirdPlace: false,
        matches: [
          {
            id: 'R1-M1', round: 1, position: 0,
            playerA: 'Juan', playerB: null, winner: null,
            status: 'READY', courtId: null,
          },
        ],
        thirdPlaceMatch: null,
        status: 'SETUP',
        createdAt: 1,
      } as TournamentBracket,
    };
    store.save(persisted);

    const freshStore = new StateStore(fs, 'state.json');
    const coordinator = new PersistenceCoordinator(freshStore, freshStore.load()!);
    const io = createMockIo();
    const tableManager = createFakeTableManager(['c1'], {});
    const handler = new BracketHandler(io, tableManager, 'pin', coordinator, createFakeInventory() as never);

    const socket = createMockSocket('real2');
    handler.sendStateToSocket(socket as unknown as Socket);
    const emitted = (socket as unknown as MockSocket)._emitted.find(
      (e) => e.event === SocketEvents.SERVER.BRACKET_STATE,
    );
    expect((emitted!.data as TournamentBracket).name).toBe('Restored');
    expect((emitted!.data as TournamentBracket).matches[0].playerA).toBe('Juan');
  });
});