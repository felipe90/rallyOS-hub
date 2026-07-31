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

// ── Fake StateStore (bracket-only seam) ──────────────────────────────────

interface FakeStateStore {
  getBracket: jest.Mock;
  setBracket: jest.Mock;
}
function createFakeStateStore(persisted: TournamentBracket | null = null): FakeStateStore {
  let state = persisted;
  return {
    getBracket: jest.fn(() => state),
    setBracket: jest.fn((b: TournamentBracket | null) => {
      state = b;
    }),
  };
}

// ── Fake CourtManager (only getAllTournamentCourts is used) ───────────────

function createFakeTableManager(courtIds: string[] = ['c1', 'c2']) {
  return {
    getAllTournamentCourts: jest.fn(() => courtIds.map((id) => ({ id }))),
  } as unknown as import('../domain/courtManager').CourtManager;
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
    _map: map,
  } as unknown as import('socket.io').Server;
}

function makeHandler(
  stateStore: FakeStateStore = createFakeStateStore(),
  courtIds: string[] = ['c1', 'c2'],
) {
  const io = createMockIo();
  const tableManager = createFakeTableManager(courtIds);
  const handler = new BracketHandler(io, tableManager, 'pin', stateStore as any);
  return { io, tableManager, handler, stateStore };
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

    it('rejects a name longer than 50 chars with NAME_TOO_LONG', () => {
      const { handler } = makeHandler();
      const socket = createMockSocket('o7');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'a'.repeat(51) });

      expect(lastError(socket)?.code).toBe('NAME_TOO_LONG');
    });

    it('debounces slot-save: setBracket is NOT called synchronously', () => {
      const { handler, stateStore } = makeHandler();
      const socket = createMockSocket('o8');
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.BRACKET_CREATE, { name: 'T', numSlots: 4, includeThirdPlace: false });
      const savesAfterCreate = (stateStore.setBracket as jest.Mock).mock.calls.length;

      socket._trigger(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Juan' });

      // debounced 2s — no immediate save beyond the create save
      expect((stateStore.setBracket as jest.Mock).mock.calls.length).toBe(savesAfterCreate);
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
});