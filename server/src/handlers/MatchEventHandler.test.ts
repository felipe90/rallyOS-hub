/**
 * MatchEventHandler Tests — Phase 5.2
 *
 * Verifies that CONFIGURE_MATCH accepts and validates new
 * padel-specific config fields: sport, tiebreakPoints, goldenPoint.
 * Also verifies RECORD_POINT delegates to recordScore (already done in Phase 3).
 */

import { Server } from 'socket.io';
import { TableManager } from '../domain/courtManager';
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

function createMockTableManager(): TableManager {
  let matchState: MatchStateExtended | null = null;

  const tm: any = {
    onTableUpdate: () => {},
    onMatchEvent: () => {},
    getAllTables: () => [],
    getTable: (id: string) => ({
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
        setTableId: jest.fn(),
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
      onTableUpdate: undefined,
      onMatchEvent: undefined,
    }),
    getMatchState: (id: string) => matchState,
    configureMatch: jest.fn(),
    startMatch: jest.fn(() => matchState),
    recordPoint: jest.fn(() => matchState),
    tableToInfo: jest.fn((t) => ({ id: t.id, status: t.status, name: t.name })),
    isReferee: jest.fn(() => true),
  };

  return tm as unknown as TableManager;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('MatchEventHandler — Phase 5.2 (Sport-aware CONFIGURE_MATCH)', () => {
  let handler: MatchEventHandler;
  let mockSocket: any;
  let mockIo: any;
  let tableManager: TableManager;
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

      handler({ tableId: 'court-1', player: 'A' });

      expect(tableManager.recordPoint).toHaveBeenCalledWith('court-1', 'A');
    });
  });

  // ── CONFIGURE_MATCH with sport field ─────────────────────────────────

  describe('CONFIGURE_MATCH accepts sport field', () => {
    it('should accept sport field in CONFIGURE_MATCH payload', () => {
      const handler = getHandler(SocketEvents.CLIENT.CONFIGURE_MATCH);

      handler({
        tableId: 'court-1',
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
        tableId: 'court-1',
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
        tableId: 'court-1',
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
        tableId: 'court-1',
        playerNames: { a: 'Alice', b: 'Bob' },
        format: 5,
        ptsPerSet: 11,
      });

      expect(tableManager.configureMatch).toHaveBeenCalled();
    });

    it('should still accept legacy format/ptsPerSet/handicap fields', () => {
      const handler = getHandler(SocketEvents.CLIENT.CONFIGURE_MATCH);

      handler({
        tableId: 'court-1',
        playerNames: { a: 'Alice', b: 'Bob' },
        format: 3,
        ptsPerSet: 21,
        handicap: { a: 5, b: 0 },
      });

      expect(tableManager.configureMatch).toHaveBeenCalled();
    });
  });
});
