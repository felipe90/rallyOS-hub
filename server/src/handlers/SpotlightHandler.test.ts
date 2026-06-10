/**
 * SpotlightHandler Tests
 *
 * Verifies:
 * - SET_FEATURED: owner-only, single-featured invariant, broadcast TABLE_UPDATE
 * - SUBSCRIBE_MATCH: only for featured courts, returns current match state
 * - UNSUBSCRIBE_MATCH: leave room
 * - Auto-clear on MATCH_WON in SocketHandler
 */

import { Server } from 'socket.io';
import { SocketHandler } from './SocketHandler';
import { CourtManager } from '../domain/courtManager';
import { SocketEvents } from '../../../shared/events';
import { SpotlightHandler } from './SpotlightHandler';

// ── Helpers ────────────────────────────────────────────────────────────

function createMockSocket(id: string = 'test-socket', overrides: Record<string, any> = {}) {
  return {
    id,
    handshake: { address: '127.0.0.1' },
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    data: { ...overrides },
  } as any;
}

function createMockIo() {
  const io: any = {
    to: jest.fn(() => io),
    in: jest.fn(() => io),
    emit: jest.fn(),
    engine: { clientsCount: 1 },
    use: jest.fn(),
    on: jest.fn(),
  };
  return io;
}

function createCourt(overrides: Record<string, any> = {}): any {
  return {
    id: 'court-1',
    number: 1,
    name: 'Cancha 1',
    status: 'LIVE',
    pin: '1234',
    featured: false,
    playerNames: { a: 'Player A', b: 'Player B' },
    players: [],
    history: [],
    createdAt: Date.now(),
    sportRules: {
      getState: () => ({
        status: 'LIVE',
        config: { sport: 'tableTennis', pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        winner: null,
        swappedSides: false,
        midSetSwapped: false,
      }),
      getConfig: jest.fn(),
      setPlayerNames: jest.fn(),
      setEventCallback: jest.fn(),
      setTableId: jest.fn(),
      startMatch: jest.fn(),
      recordPoint: jest.fn(),
      undoLast: jest.fn(),
      setServer: jest.fn(),
      swapSides: jest.fn(),
      getStateWithHistory: jest.fn(),
      reset: jest.fn(),
    },
    ...overrides,
  };
}

// Wait for async operations in handlers
const tick = () => new Promise(resolve => process.nextTick(resolve));

// ── SocketEvents Registration Test ─────────────────────────────────────

describe('Spotlight SocketEvents (PR #1)', () => {
  it('should have SET_FEATURED registered in SocketEvents.CLIENT', () => {
    expect(SocketEvents.CLIENT.SET_FEATURED).toBe('SET_FEATURED');
  });

  it('should have SUBSCRIBE_MATCH registered in SocketEvents.CLIENT', () => {
    expect(SocketEvents.CLIENT.SUBSCRIBE_MATCH).toBe('SUBSCRIBE_MATCH');
  });

  it('should have UNSUBSCRIBE_MATCH registered in SocketEvents.CLIENT', () => {
    expect(SocketEvents.CLIENT.UNSUBSCRIBE_MATCH).toBe('UNSUBSCRIBE_MATCH');
  });
});

// ── SET_FEATURED Handler ───────────────────────────────────────────────

describe('SET_FEATURED', () => {
  let handler: SpotlightHandler;
  let mockSocket: any;
  let mockIo: any;
  let tableManager: any;
  let registeredHandlers: Map<string, (...args: any[]) => void>;

  beforeEach(() => {
    mockSocket = createMockSocket('socket-1', { isOwner: true });
    mockIo = createMockIo();

    const courts: any[] = [
      createCourt({ id: 'court-1', name: 'Cancha 1', featured: false }),
      createCourt({ id: 'court-2', name: 'Cancha 2', featured: false }),
      createCourt({ id: 'court-3', name: 'Cancha 3', featured: false }),
    ];

    tableManager = {
      getTable: jest.fn((id: string) => courts.find(c => c.id === id)),
      getAllTables: jest.fn(() => courts),
      tableToInfo: jest.fn((t: any) => ({
        id: t.id,
        number: t.number,
        name: t.name,
        status: t.status,
        featured: t.featured,
      })),
      onTableUpdate: () => {},
      onMatchEvent: () => {},
    };

    handler = new SpotlightHandler(mockIo, tableManager, '12345678');

    // Intercept socket.on to capture registered handlers
    registeredHandlers = new Map();
    mockSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      registeredHandlers.set(event, fn);
    });

    handler.registerHandlers(mockSocket);
  });

  function getHandler(event: string): (...args: any[]) => void {
    const h = registeredHandlers.get(event);
    if (!h) throw new Error(`Handler not registered for event: ${event}`);
    return h;
  }

  describe('owner validation', () => {
    it('should reject SET_FEATURED when socket is not owner', () => {
      const nonOwnerSocket = createMockSocket('socket-2', { isOwner: false });
      registeredHandlers.clear();
      handler.registerHandlers(nonOwnerSocket);

      const handlerFn = registeredHandlers.get(SocketEvents.CLIENT.SET_FEATURED);
      expect(handlerFn).toBeUndefined();
    });

    it('should register SET_FEATURED when socket is owner', () => {
      const handlerFn = registeredHandlers.get(SocketEvents.CLIENT.SET_FEATURED);
      expect(handlerFn).toBeDefined();
    });
  });

  describe('table validation', () => {
    it('should emit TABLE_NOT_FOUND error when target table does not exist', () => {
      const handlerFn = getHandler(SocketEvents.CLIENT.SET_FEATURED);
      handlerFn({ targetTableId: 'nonexistent' });
      expect(mockSocket.emit).toHaveBeenCalledWith('ERROR', expect.objectContaining({ code: 'TABLE_NOT_FOUND' }));
    });

    it('should clear all featured when targetTableId is missing (null/empty)', () => {
      const court1 = tableManager.getTable('court-1');
      const court2 = tableManager.getTable('court-2');
      court1.featured = true;

      const handlerFn = getHandler(SocketEvents.CLIENT.SET_FEATURED);
      handlerFn({});

      expect(court1.featured).toBe(false);
      expect(court2.featured).toBe(false);
    });
  });

  describe('single-featured invariant', () => {
    it('should set a court as featured when no court is currently featured', () => {
      const handlerFn = getHandler(SocketEvents.CLIENT.SET_FEATURED);
      handlerFn({ targetTableId: 'court-1' });

      const court1 = tableManager.getTable('court-1');
      expect(court1.featured).toBe(true);
    });

    it('should unfeature the previously featured court when setting new one', () => {
      // Set court-2 as featured first
      const court2 = tableManager.getTable('court-2');
      court2.featured = true;

      const handlerFn = getHandler(SocketEvents.CLIENT.SET_FEATURED);
      handlerFn({ targetTableId: 'court-1' });

      const court1 = tableManager.getTable('court-1');
      const updatedCourt2 = tableManager.getTable('court-2');
      expect(court1.featured).toBe(true);
      expect(updatedCourt2.featured).toBe(false);
    });

    it('should broadcast TABLE_UPDATE for both previous and new featured courts', () => {
      const court2 = tableManager.getTable('court-2');
      court2.featured = true;

      const handlerFn = getHandler(SocketEvents.CLIENT.SET_FEATURED);
      handlerFn({ targetTableId: 'court-1' });

      expect(mockIo.emit).toHaveBeenCalledWith(SocketEvents.SERVER.TABLE_UPDATE, expect.objectContaining({ id: 'court-1', featured: true }));
      expect(mockIo.emit).toHaveBeenCalledWith(SocketEvents.SERVER.TABLE_UPDATE, expect.objectContaining({ id: 'court-2', featured: false }));
    });
  });

  describe('clear all featured', () => {
    it('should set all courts to non-featured when targetTableId is null or empty', () => {
      const court1 = tableManager.getTable('court-1');
      const court2 = tableManager.getTable('court-2');
      court1.featured = true;
      court2.featured = true;

      const handlerFn = getHandler(SocketEvents.CLIENT.SET_FEATURED);
      handlerFn({ targetTableId: null });

      expect(court1.featured).toBe(false);
      expect(court2.featured).toBe(false);
    });

    it('should broadcast TABLE_UPDATE for previously featured courts when clearing all', () => {
      const court1 = tableManager.getTable('court-1');
      court1.featured = true;

      const handlerFn = getHandler(SocketEvents.CLIENT.SET_FEATURED);
      handlerFn({ targetTableId: null });

      expect(mockIo.emit).toHaveBeenCalledWith(SocketEvents.SERVER.TABLE_UPDATE, expect.objectContaining({ id: 'court-1', featured: false }));
    });
  });
});

// ── SUBSCRIBE_MATCH Handler ────────────────────────────────────────────

describe('SUBSCRIBE_MATCH', () => {
  let handler: SpotlightHandler;
  let mockSocket: any;
  let mockIo: any;
  let tableManager: any;
  let registeredHandlers: Map<string, (...args: any[]) => void>;

  beforeEach(() => {
    mockSocket = createMockSocket('socket-1');
    mockIo = createMockIo();

    const matchState = {
      sport: 'tableTennis',
      status: 'LIVE',
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'A' },
      playerNames: { a: 'Alice', b: 'Bob' },
    };

    const courts: any[] = [
      createCourt({ id: 'court-1', featured: true }),
      createCourt({ id: 'court-2', featured: false }),
    ];

    tableManager = {
      getTable: jest.fn((id: string) => courts.find(c => c.id === id)),
      getMatchState: jest.fn((id: string) => {
        if (id === 'court-1') return matchState;
        return null;
      }),
      onTableUpdate: () => {},
      onMatchEvent: () => {},
    };

    handler = new SpotlightHandler(mockIo, tableManager, '12345678');

    registeredHandlers = new Map();
    mockSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      registeredHandlers.set(event, fn);
    });

    handler.registerHandlers(mockSocket);
  });

  function getHandler(event: string): (...args: any[]) => void {
    const h = registeredHandlers.get(event);
    if (!h) throw new Error(`Handler not registered for event: ${event}`);
    return h;
  }

  it('should register SUBSCRIBE_MATCH handler', () => {
    const handlerFn = registeredHandlers.get(SocketEvents.CLIENT.SUBSCRIBE_MATCH);
    expect(handlerFn).toBeDefined();
  });

  it('should reject subscription when court is not featured', () => {
    const handlerFn = getHandler(SocketEvents.CLIENT.SUBSCRIBE_MATCH);
    handlerFn({ courtId: 'court-2' });
    expect(mockSocket.emit).toHaveBeenCalledWith('ERROR', expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('should join socket room for featured court', () => {
    const handlerFn = getHandler(SocketEvents.CLIENT.SUBSCRIBE_MATCH);
    handlerFn({ courtId: 'court-1' });
    expect(mockSocket.join).toHaveBeenCalledWith('court-1');
  });

  it('should emit current match state when subscribing to a featured court', () => {
    const handlerFn = getHandler(SocketEvents.CLIENT.SUBSCRIBE_MATCH);
    handlerFn({ courtId: 'court-1' });
    expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.SERVER.MATCH_UPDATE, expect.objectContaining({
      sport: 'tableTennis',
    }));
  });

  it('should emit TABLE_NOT_FOUND when courtId does not exist', () => {
    const handlerFn = getHandler(SocketEvents.CLIENT.SUBSCRIBE_MATCH);
    handlerFn({ courtId: 'nonexistent' });
    expect(mockSocket.emit).toHaveBeenCalledWith('ERROR', expect.objectContaining({ code: 'TABLE_NOT_FOUND' }));
  });
});

// ── UNSUBSCRIBE_MATCH Handler ──────────────────────────────────────────

describe('UNSUBSCRIBE_MATCH', () => {
  let handler: SpotlightHandler;
  let mockSocket: any;
  let mockIo: any;
  let tableManager: any;
  let registeredHandlers: Map<string, (...args: any[]) => void>;

  beforeEach(() => {
    mockSocket = createMockSocket('socket-1');
    mockIo = createMockIo();

    tableManager = {
      getTable: jest.fn(),
      getAllTables: jest.fn(() => []),
      onTableUpdate: () => {},
      onMatchEvent: () => {},
    };

    handler = new SpotlightHandler(mockIo, tableManager, '12345678');

    registeredHandlers = new Map();
    mockSocket.on.mockImplementation((event: string, fn: (...args: any[]) => void) => {
      registeredHandlers.set(event, fn);
    });

    handler.registerHandlers(mockSocket);
  });

  function getHandler(event: string): (...args: any[]) => void {
    const h = registeredHandlers.get(event);
    if (!h) throw new Error(`Handler not registered for event: ${event}`);
    return h;
  }

  it('should register UNSUBSCRIBE_MATCH handler', () => {
    const handlerFn = registeredHandlers.get(SocketEvents.CLIENT.UNSUBSCRIBE_MATCH);
    expect(handlerFn).toBeDefined();
  });

  it('should leave the specified court room', () => {
    const handlerFn = getHandler(SocketEvents.CLIENT.UNSUBSCRIBE_MATCH);
    handlerFn({ courtId: 'court-1' });
    expect(mockSocket.leave).toHaveBeenCalledWith('court-1');
  });
});

// ── Auto-clear on MATCH_WON (SocketHandler integration) ────────────────

describe('MATCH_WON auto-clear featured', () => {
  let socketHandler: SocketHandler;
  let mockIo: any;
  let tableManager: any;

  beforeEach(() => {
    mockIo = createMockIo();

    const courts: any[] = [
      createCourt({ id: 'court-1', featured: true, status: 'LIVE' }),
      createCourt({ id: 'court-2', featured: false, status: 'LIVE' }),
    ];

    tableManager = {
      getTable: jest.fn((id: string) => courts.find(c => c.id === id)),
      getAllTables: jest.fn(() => courts.map(c => ({
        id: c.id,
        number: c.number,
        name: c.name,
        status: c.status,
        featured: c.featured,
      }))),
      getMatchState: jest.fn(() => ({
        playerNames: { a: 'Alice', b: 'Bob' },
      })),
      onTableUpdate: () => {},
      onTournamentFinish: () => {},
      onMatchEvent: () => {},
      leaveTable: jest.fn(),
      tableToInfo: jest.fn((t: any) => ({
        id: t.id,
        number: t.number,
        name: t.name,
        status: t.status,
        featured: t.featured,
      })),
    };

    socketHandler = new SocketHandler(mockIo, tableManager as unknown as CourtManager, '12345678', {
      ssid: 'test', ip: '0.0.0.0', port: 3000, domain: 'test.local', wifiPassword: 'test',
    });
  });

  it('should clear featured when MATCH_WON occurs on a featured court', () => {
    const court1 = tableManager.getTable('court-1');
    expect(court1.featured).toBe(true);

    // Simulate MATCH_WON event
    tableManager.onMatchEvent('court-1', { type: 'MATCH_WON', winner: 'A', finalScore: [], sets: { a: 0, b: 0 } });

    const updatedCourt1 = tableManager.getTable('court-1');
    expect(updatedCourt1.featured).toBe(false);
  });

  it('should not clear featured when MATCH_WON occurs on a non-featured court', () => {
    const court2 = tableManager.getTable('court-2');
    expect(court2.featured).toBe(false);

    // Simulate MATCH_WON event on the non-featured court
    tableManager.onMatchEvent('court-2', { type: 'MATCH_WON', winner: 'B', finalScore: [], sets: { a: 0, b: 0 } });

    // Should still be false (no change)
    expect(court2.featured).toBe(false);
  });

  it('should broadcast TABLE_UPDATE for court when auto-clearing featured', () => {
    // Simulate MATCH_WON event on featured court
    tableManager.onMatchEvent('court-1', { type: 'MATCH_WON', winner: 'A', finalScore: [], sets: { a: 0, b: 0 } });

    expect(mockIo.emit).toHaveBeenCalledWith(SocketEvents.SERVER.TABLE_UPDATE, expect.objectContaining({ id: 'court-1', featured: false }));
  });

  it('should not affect non-MATCH_WON events on featured court', () => {
    const court1 = tableManager.getTable('court-1');

    // Trigger non-MATCH_WON events
    tableManager.onMatchEvent('court-1', { type: 'SET_WON', winner: 'A', score: { a: 1, b: 0 }, setNumber: 1 });
    expect(court1.featured).toBe(true);

    tableManager.onMatchEvent('court-1', { type: 'GAME_WON', winner: 'A', score: { a: 40, b: 15 }, gameNumber: 3 });
    expect(court1.featured).toBe(true);
  });
});
