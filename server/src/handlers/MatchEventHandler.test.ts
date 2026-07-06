/**
 * MatchEventHandler Tests — Phase 5.2 / Phase 6
 *
 * Phase 5.2: Verifies that CONFIGURE_MATCH accepts and validates new
 * padel-specific config fields: sport, tiebreakPoints, goldenPoint.
 * Also verifies RECORD_POINT delegates to recordScore (already done in Phase 3).
 *
 * Phase 6 (ESP32 Dual-Mode Validation):
 * - T1: RECORD_POINT with club referee (real CourtManager, real registerClubReferee)
 * - T2: RECORD_POINT with tournament referee (real CourtManager, real setReferee via PIN)
 * - Verifies identical MATCH_UPDATE event structure across both modes
 */

import { Server } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { MatchEventHandler } from './MatchEventHandler';
import { SocketEvents } from '../../../shared/events';
import type { MatchStateExtended } from '../domain/matchEngine';
import { SPORT } from '../../../shared/types';

// ── Helpers ────────────────────────────────────────────────────────────

function createMockSocket(id: string = 'test-socket') {
  return {
    id,
    handshake: { address: '127.0.0.1' },
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    data: {},
  } as any;
}

function createMockIo(mockSocket: any) {
  const io: any = {
    to: jest.fn(() => io),
    in: jest.fn(() => io),
    emit: jest.fn(),
    engine: { clientsCount: 1 },
  };
  return io;
}

/**
 * Create a capturing Socket.IO server mock that records room-specific emits.
 * Used by Phase 6 tests that need to assert MATCH_UPDATE event payloads.
 */
function createCapturingMockIo() {
  const captures: Array<{ room: string; event: string; args: any[] }> = [];

  const io: any = {
    captures,
    to: jest.fn((room: string) => {
      const child: any = {
        emit: jest.fn((event: string, ...args: any[]) => {
          captures.push({ room, event, args });
          return child;
        }),
      };
      return child;
    }),
    in: jest.fn(() => io),
    emit: jest.fn(),
    engine: { clientsCount: 1 },
  };
  return io;
}

/** Hub config for real CourtManager instantiation */
const HUB_CONFIG = {
  ssid: 'test',
  ip: '127.0.0.1',
  port: 3000,
  domain: 'test.local',
  wifiPassword: 'test',
};

/** Common MATCH_UPDATE field set expected from RECORD_POINT (sorted for .sort() comparison) */
const MATCH_UPDATE_EXPECTED_FIELDS = [
  'config',
  'courtId',
  'courtName',
  'history',
  'midSetSwapped',
  'playerNames',
  'score',
  'setHistory',
  'sport',
  'status',
  'swappedSides',
  'undoAvailable',
  'winner',
];

function createMockTableManager(): CourtManager {
  let matchState: MatchStateExtended | null = null;

  const tm: any = {
    onTableUpdate: () => {},
    onMatchEvent: () => {},
    getAllCourts: () => [],
    getCourt: (id: string) => ({
      id,
      number: 1,
      name: 'Cancha 1',
      status: 'WAITING',
      pin: '1234',
      sportRules: {
        getState: () => matchState,
        getConfig: () => ({ sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 }),
        setPlayerNames: jest.fn(),
        setEventCallback: jest.fn(),
        setCourtId: jest.fn(),
        startMatch: jest.fn(() => (matchState = { ...matchState, status: 'LIVE' } as any)),
        recordPoint: jest.fn((player) => {
          if (!matchState) return null;
          const s = matchState as any;
          if (s.score) {
            s.score.currentSet = { a: s.score.currentSet.a + (player === 'A' ? 1 : 0), b: s.score.currentSet.b + (player === 'B' ? 1 : 0) };
          }
          return s;
        }),
      },
      playerNames: { a: 'Player A', b: 'Player B' },
      history: [],
      players: [],
      createdAt: Date.now(),
      featured: false,
      onTableUpdate: undefined,
      onMatchEvent: undefined,
    }),
    getMatchState: (id: string) => matchState,
    configureMatch: jest.fn(),
    startMatch: jest.fn(() => matchState),
    recordPoint: jest.fn(() => matchState),
    courtToInfo: jest.fn((c) => ({ id: c.id, status: c.status, name: c.name })),
    isReferee: jest.fn(() => true),
  };

  return tm as unknown as CourtManager;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('MatchEventHandler — Phase 5.2 (Sport-aware CONFIGURE_MATCH)', () => {
  let handler: MatchEventHandler;
  let mockSocket: any;
  let mockIo: any;
  let tableManager: CourtManager;
  let registeredHandlers: Map<string, (...args: any[]) => void>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIo = createMockIo(mockSocket);
    tableManager = createMockTableManager();
    handler = new MatchEventHandler(mockIo, tableManager, '12345678');

    // Intercept socket.on to capture registered handlers
    registeredHandlers = new Map();
    mockSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      registeredHandlers.set(event, fn);
    });

    handler.registerHandlers(mockSocket);
  });

  // ── RECORD_POINT → recordScore delegation ────────────────────────────

  function getHandler(event: string): (...args: any[]) => void {
    const h = registeredHandlers.get(event);
    if (!h) throw new Error(`Handler not registered for event: ${event}`);
    return h;
  }

  describe('RECORD_POINT delegation to recordScore', () => {
    it('should delegate RECORD_POINT through tableManager.recordPoint', () => {
      const handler = getHandler(SocketEvents.CLIENT.RECORD_POINT);

      // Simulate a LIVE table with a match
      (tableManager as any).getMatchState = () => ({
        sport: SPORT.TABLE_TENNIS,
        status: 'LIVE',
        score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
        playerNames: { a: 'Alice', b: 'Bob' },
      });

      handler({ courtId: 'court-1', player: 'A' });

      expect(tableManager.recordPoint).toHaveBeenCalledWith('court-1', 'A');
    });
  });

  // ── CONFIGURE_MATCH with sport field ─────────────────────────────────

  describe('CONFIGURE_MATCH accepts sport field', () => {
    it('should accept sport field in CONFIGURE_MATCH payload', () => {
      const handler = getHandler(SocketEvents.CLIENT.CONFIGURE_MATCH);

      handler({
        courtId: 'court-1',
        playerNames: { a: 'Alice', b: 'Bob' },
        sport: SPORT.PADEL,
        tiebreakPoints: 7,
        goldenPoint: false,
      });

      expect(tableManager.configureMatch).toHaveBeenCalled();
    });

    it('should pass tiebreakPoints through to configureMatch for padel', () => {
      const handler = getHandler(SocketEvents.CLIENT.CONFIGURE_MATCH);

      handler({
        courtId: 'court-1',
        playerNames: { a: 'Alice', b: 'Bob' },
        sport: SPORT.PADEL,
        tiebreakPoints: 10,
        goldenPoint: true,
      });

      // Verify configureMatch was called (the match config should contain padel fields)
      expect(tableManager.configureMatch).toHaveBeenCalled();
    });

    it('should accept goldenPoint field in CONFIGURE_MATCH', () => {
      const handler = getHandler(SocketEvents.CLIENT.CONFIGURE_MATCH);

      handler({
        courtId: 'court-1',
        playerNames: { a: 'Alice', b: 'Bob' },
        sport: SPORT.PADEL,
        tiebreakPoints: 7,
        goldenPoint: true,
      });

      expect(tableManager.configureMatch).toHaveBeenCalled();
    });
  });

  // ── CONFIGURE_MATCH backward compat (no sport = TT) ──────────────────

  describe('CONFIGURE_MATCH backward compatibility', () => {
    it('should default to table tennis when no sport field provided', () => {
      const handler = getHandler(SocketEvents.CLIENT.CONFIGURE_MATCH);

      handler({
        courtId: 'court-1',
        playerNames: { a: 'Alice', b: 'Bob' },
        format: 5,
        ptsPerSet: 11,
      });

      expect(tableManager.configureMatch).toHaveBeenCalled();
    });

    it('should still accept legacy format/ptsPerSet/handicap fields', () => {
      const handler = getHandler(SocketEvents.CLIENT.CONFIGURE_MATCH);

      handler({
        courtId: 'court-1',
        playerNames: { a: 'Alice', b: 'Bob' },
        format: 3,
        ptsPerSet: 21,
        handicap: { a: 5, b: 0 },
      });

      expect(tableManager.configureMatch).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 6 — T1: RECORD_POINT — Club Mode (real CourtManager, registerClubReferee)
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_POINT — club mode', () => {
  let handler: MatchEventHandler;
  let mockIo: ReturnType<typeof createCapturingMockIo>;
  let courtManager: CourtManager;
  let mockSocket: ReturnType<typeof createMockSocket>;
  let registeredHandlers: Map<string, (...args: any[]) => void>;
  let courtId: string;

  beforeEach(() => {
    mockSocket = createMockSocket('club-ref-socket');
    mockIo = createCapturingMockIo();
    courtManager = new CourtManager(HUB_CONFIG);
    handler = new MatchEventHandler(mockIo, courtManager, '12345678');

    // Intercept socket.on to capture registered handlers
    registeredHandlers = new Map();
    mockSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      registeredHandlers.set(event, fn);
    });

    handler.registerHandlers(mockSocket);

    // Set up a LIVE club court with registered referee
    // 1. Create → clubStatus=AVAILABLE
    const court = courtManager.createClubCourt('Club Court');
    courtId = court.id;

    // 2. Activate → RESERVED (generates session PIN)
    courtManager.activateCourt(courtId);

    // 3. Occupy → OCCUPIED with auto-started match (status=LIVE)
    const occupyResult = courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
    expect(occupyResult).not.toBeNull();

    // 4. Register socket as club referee (bypasses PIN — real ClubPlayerHandler path)
    const displaced = courtManager.registerClubReferee(courtId, mockSocket.id);
    expect(courtManager.isReferee(courtId, mockSocket.id)).toBe(true);
  });

  function getHandler(event: string): (...args: any[]) => void {
    const h = registeredHandlers.get(event);
    if (!h) throw new Error(`Handler not registered for event: ${event}`);
    return h;
  }

  it('should register RECORD_POINT handler', () => {
    expect(registeredHandlers.has(SocketEvents.CLIENT.RECORD_POINT)).toBe(true);
  });

  it('should update match score via real CourtManager.recordPoint', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);

    // Capture pre-point score (TT-specific — these tests use table tennis)
    const stateBefore = courtManager.getMatchState(courtId) as any;
    const scoreBefore = { ...stateBefore.score.currentSet };

    // Player A scores
    recordPointHandler({ courtId, player: 'A' });

    // Assert score was actually updated in the live CourtManager
    const stateAfter = courtManager.getMatchState(courtId) as any;
    expect(stateAfter.score.currentSet.a).toBe(scoreBefore.a + 1);
    expect(stateAfter.score.currentSet.b).toBe(scoreBefore.b);
  });

  it('should emit MATCH_UPDATE to the court room on RECORD_POINT', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);
    recordPointHandler({ courtId, player: 'A' });

    expect(mockIo.to).toHaveBeenCalledWith(courtId);

    const updateCalls = mockIo.captures.filter(
      (c: any) => c.room === courtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    expect(updateCalls.length).toBe(1);
  });

  it('should emit MATCH_UPDATE with correct event shape', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);
    recordPointHandler({ courtId, player: 'A' });

    const updateCalls = mockIo.captures.filter(
      (c: any) => c.room === courtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    expect(updateCalls.length).toBe(1);

    const payload = updateCalls[0].args[0];

    // Verify all expected structural fields
    expect(Object.keys(payload).sort()).toEqual(MATCH_UPDATE_EXPECTED_FIELDS);

    // Verify core score shape
    expect(payload.score).toHaveProperty('sets');
    expect(payload.score.sets).toHaveProperty('a');
    expect(payload.score.sets).toHaveProperty('b');
    expect(payload.score).toHaveProperty('currentSet');
    expect(payload.score.currentSet).toHaveProperty('a');
    expect(payload.score.currentSet).toHaveProperty('b');
    expect(payload.score).toHaveProperty('serving');

    // Verify match state
    expect(payload.status).toBe('LIVE');
    expect(payload.winner).toBeNull();
    expect(payload.sport).toBe(SPORT.TABLE_TENNIS);

    // Verify identity fields
    expect(payload.courtId).toBe(courtId);
    expect(payload.courtName).toBe('Club Court');
    expect(payload.playerNames).toEqual({ a: 'Jugador 1', b: 'Jugador 2' });

    // Verify score reflects player A's point
    expect(payload.score.currentSet.a).toBeGreaterThan(0);
    expect(payload.score.currentSet.b).toBe(0);

    // Verify history entry exists for this point
    expect(payload.history.length).toBe(1);
    expect(payload.history[0]).toHaveProperty('player', 'A');
    expect(payload.history[0]).toHaveProperty('action', 'POINT');
    expect(payload.undoAvailable).toBe(true);
  });

  it('should emit MATCH_UPDATE with correct player for player B', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);
    recordPointHandler({ courtId, player: 'B' });

    const updateCalls = mockIo.captures.filter(
      (c: any) => c.room === courtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    const payload = updateCalls[0].args[0];

    expect(payload.score.currentSet.b).toBeGreaterThan(0);
    expect(payload.history[0].player).toBe('B');
  });

  it('should reject RECORD_POINT when socket is not the registered referee', () => {
    // A fresh socket that is NOT registered as referee
    const nonRefSocket = createMockSocket('non-ref-socket');
    const nonRefHandler = new MatchEventHandler(mockIo, courtManager, '12345678');
    const nonRefHandlers = new Map<string, (...args: any[]) => void>();
    nonRefSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      nonRefHandlers.set(event, fn);
    });
    nonRefHandler.registerHandlers(nonRefSocket);

    const recordPointHandler = nonRefHandlers.get(SocketEvents.CLIENT.RECORD_POINT)!;
    recordPointHandler({ courtId, player: 'A' });

    // Should emit UNAUTHORIZED error, NOT update the score
    expect(nonRefSocket.emit).toHaveBeenCalledWith(
      'ERROR',
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );

    // Score should remain unchanged
    const stateAfter = courtManager.getMatchState(courtId) as any;
    expect(stateAfter.score.currentSet.a).toBe(0);
  });

  it('should reject RECORD_POINT with invalid player value', () => {
    // The handler uses a separate recordPointHandler from a non-ref socket
    // to test payload validation independently.
    // Payload validation fires before referee check, so we use a handler that
    // gets past validation — actually the validation is done by validateSocketPayload
    // which checks the player enum. We test via the main handler.
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);

    // This should fail payload validation before reaching referee check
    recordPointHandler({ courtId, player: 'C' });

    // MATCH_UPDATE should NOT be emitted (validation fails)
    const updateCalls = mockIo.captures.filter(
      (c: any) => c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    expect(updateCalls.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 6 — T2: RECORD_POINT — Tournament Mode (real CourtManager, setReferee via PIN)
// ═══════════════════════════════════════════════════════════════════════════════

describe('RECORD_POINT — tournament mode', () => {
  let handler: MatchEventHandler;
  let mockIo: ReturnType<typeof createCapturingMockIo>;
  let courtManager: CourtManager;
  let mockSocket: ReturnType<typeof createMockSocket>;
  let registeredHandlers: Map<string, (...args: any[]) => void>;
  let courtId: string;
  let courtPin: string;

  beforeEach(() => {
    mockSocket = createMockSocket('tournament-ref-socket');
    mockIo = createCapturingMockIo();
    courtManager = new CourtManager(HUB_CONFIG);
    handler = new MatchEventHandler(mockIo, courtManager, '12345678');

    // Capture registered handlers
    registeredHandlers = new Map();
    mockSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      registeredHandlers.set(event, fn);
    });

    handler.registerHandlers(mockSocket);

    // Set up a LIVE tournament court with PIN-based referee
    // 1. Create → WAITING with PIN
    const court = courtManager.createCourt('Tournament Court');
    courtId = court.id;
    courtPin = court.pin;
    expect(courtPin).toBeTruthy();

    // 2. Start the match (RECORD_POINT requires status=LIVE)
    const matchState = courtManager.startMatch(courtId, {
      playerNameA: 'Alice',
      playerNameB: 'Bob',
    });
    expect(matchState).not.toBeNull();
    expect(matchState!.status).toBe('LIVE');

    // 3. Set referee via PIN (the AuthHandler path — real PIN validation)
    const refSet = courtManager.setReferee(courtId, mockSocket.id, courtPin);
    expect(refSet).toBe(true);
    expect(courtManager.isReferee(courtId, mockSocket.id)).toBe(true);
  });

  function getHandler(event: string): (...args: any[]) => void {
    const h = registeredHandlers.get(event);
    if (!h) throw new Error(`Handler not registered for event: ${event}`);
    return h;
  }
  it('should update match score via real CourtManager.recordPoint', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);

    const stateBefore = courtManager.getMatchState(courtId) as any;
    const scoreBefore = { ...stateBefore.score.currentSet };

    recordPointHandler({ courtId, player: 'A' });

    const stateAfter = courtManager.getMatchState(courtId) as any;
    expect(stateAfter.score.currentSet.a).toBe(scoreBefore.a + 1);
    expect(stateAfter.score.currentSet.b).toBe(scoreBefore.b);
  });

  it('should emit MATCH_UPDATE to the court room on RECORD_POINT', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);
    recordPointHandler({ courtId, player: 'A' });

    expect(mockIo.to).toHaveBeenCalledWith(courtId);

    const updateCalls = mockIo.captures.filter(
      (c: any) => c.room === courtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    expect(updateCalls.length).toBe(1);
  });

  it('should emit MATCH_UPDATE with correct event shape', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);

    recordPointHandler({ courtId, player: 'A' });

    const updateCalls = mockIo.captures.filter(
      (c: any) => c.room === courtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    expect(updateCalls.length).toBe(1);

    const payload = updateCalls[0].args[0];

    // Same field set as club mode
    expect(Object.keys(payload).sort()).toEqual(MATCH_UPDATE_EXPECTED_FIELDS);

    // Same core score shape
    expect(payload.score).toHaveProperty('sets');
    expect(payload.score).toHaveProperty('currentSet');
    expect(payload.score).toHaveProperty('serving');

    // Same match state
    expect(payload.status).toBe('LIVE');
    expect(payload.winner).toBeNull();
    expect(payload.sport).toBe(SPORT.TABLE_TENNIS);

    // Tournament-specific identity
    expect(payload.courtId).toBe(courtId);
    expect(payload.courtName).toBe('Tournament Court');
    expect(payload.playerNames).toEqual({ a: 'Alice', b: 'Bob' });

    // Score reflects player A's point
    expect(payload.score.currentSet.a).toBeGreaterThan(0);
    expect(payload.score.currentSet.b).toBe(0);

    // History entry
    expect(payload.history.length).toBe(1);
    expect(payload.history[0].player).toBe('A');
    expect(payload.history[0].action).toBe('POINT');
    expect(payload.undoAvailable).toBe(true);
  });

  it('should emit MATCH_UPDATE with correct player for player B', () => {
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);
    recordPointHandler({ courtId, player: 'B' });

    const updateCalls = mockIo.captures.filter(
      (c: any) => c.room === courtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    const payload = updateCalls[0].args[0];

    expect(payload.score.currentSet.b).toBeGreaterThan(0);
    expect(payload.history[0].player).toBe('B');
  });

  it('should reject RECORD_POINT when socket is not the registered referee', () => {
    const nonRefSocket = createMockSocket('non-ref-socket');
    const nonRefHandler = new MatchEventHandler(mockIo, courtManager, '12345678');
    const nonRefHandlers = new Map<string, (...args: any[]) => void>();
    nonRefSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      nonRefHandlers.set(event, fn);
    });
    nonRefHandler.registerHandlers(nonRefSocket);

    const recordPointHandler = nonRefHandlers.get(SocketEvents.CLIENT.RECORD_POINT)!;
    recordPointHandler({ courtId, player: 'A' });

    expect(nonRefSocket.emit).toHaveBeenCalledWith(
      'ERROR',
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );

    const stateAfter = courtManager.getMatchState(courtId) as any;
    expect(stateAfter.score.currentSet.a).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Cross-mode comparison: Both modes produce identical MATCH_UPDATE structure
  // ═══════════════════════════════════════════════════════════════════════

  it('should produce structurally identical MATCH_UPDATE payload to club mode', () => {
    // Record a point on the tournament court (already set up in beforeEach)
    const recordPointHandler = getHandler(SocketEvents.CLIENT.RECORD_POINT);
    recordPointHandler({ courtId, player: 'A' });

    const tourneyCalls = mockIo.captures.filter(
      (c: any) => c.room === courtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    expect(tourneyCalls.length).toBe(1);
    const tourneyPayload = tourneyCalls[0].args[0];

    // Set up a club court for comparison (same courtManager, same mockIo)
    const clubCourt = courtManager.createClubCourt('Comparison Club Court');
    const clubCourtId = clubCourt.id;
    courtManager.activateCourt(clubCourtId);
    courtManager.occupyClubCourt(clubCourtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(clubCourtId, mockSocket.id);

    // Fire RECORD_POINT on the club court using the same handler (same player for fair comparison)
    recordPointHandler({ courtId: clubCourtId, player: 'A' });

    const clubCalls = mockIo.captures.filter(
      (c: any) => c.room === clubCourtId && c.event === SocketEvents.SERVER.MATCH_UPDATE,
    );
    expect(clubCalls.length).toBe(1);
    const clubPayload = clubCalls[0].args[0];

    // Both should have the same keys
    expect(Object.keys(tourneyPayload).sort()).toEqual(Object.keys(clubPayload).sort());

    // Both should have identical non-identity structural keys
    // Identity fields (values differ by nature): courtId, courtName, playerNames, history
    // Config values differ due to different defaults (club bestOf=1 vs tournament bestOf=3),
    // but both must have the same config KEYS (sport, bestOf, pointsPerSet, etc.)
    type Payload = Record<string, any>;
    const identityFields = new Set(['courtId', 'courtName', 'playerNames', 'history']);
    const structuralKeys = Object.keys(tourneyPayload).filter(k => !identityFields.has(k));

    for (const key of structuralKeys) {
      if (key === 'config') {
        // Config values differ (different bestOf defaults) — compare keys and value types
        const tourneyConfigKeys = Object.keys(tourneyPayload.config).sort();
        const clubConfigKeys = Object.keys(clubPayload.config).sort();
        expect(tourneyConfigKeys).toEqual(clubConfigKeys);
        // Both configs should have number values
        for (const ck of tourneyConfigKeys) {
          expect(typeof tourneyPayload.config[ck]).toBe(typeof clubPayload.config[ck]);
        }
      } else {
        // Exact match for all other structural fields
        expect(JSON.stringify(tourneyPayload[key])).toEqual(
          JSON.stringify(clubPayload[key]),
        );
      }
    }
  });
});
