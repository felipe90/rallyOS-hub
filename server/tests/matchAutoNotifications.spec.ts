/**
 * Match Auto Notifications — TDD RED phase
 *
 * Tests that MatchEventHandler (START_MATCH) and SocketHandler (MATCH_WON)
 * automatically emit KIOSK_NOTIFICATION events to all kiosk clients.
 *
 * These tests reference production code that does NOT exist yet.
 * They will fail until the implementation is added.
 */

import { MatchEventHandler } from '../src/handlers/MatchEventHandler';
import { SocketHandler } from '../src/handlers/SocketHandler';
import { SocketEvents } from '../../shared/events';

// ── Mock Factories ────────────────────────────────────────────────

function createMockSocket(ip = '127.0.0.1') {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    id: `mock-socket-${Math.random().toString(36).slice(2, 8)}`,
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      handlers[event] = handler;
    }),
    emit: jest.fn(),
    handshake: { address: ip },
    data: {},
    _handlers: handlers,
  };
}

function createMockIo() {
  return {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    socketsLeave: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
    engine: { clientsCount: 0 },
  };
}

function createMockTableManager() {
  return {
    getTable: jest.fn(),
    getAllTables: jest.fn().mockReturnValue([]),
    getMatchState: jest.fn(),
    getAllTablesWithPins: jest.fn().mockReturnValue([]),
    isReferee: jest.fn(),
    getRefereeSocketId: jest.fn(),
    startMatch: jest.fn(),
    configureMatch: jest.fn(),
    tableToInfo: jest.fn(),
    onTableUpdate: undefined as any,
    onMatchEvent: undefined as any,
  };
}

function createMockHubConfig() {
  return {
    ssid: 'test-hub',
    ip: '127.0.0.1',
    port: 3000,
    domain: 'test.local',
    wifiPassword: '',
  };
}

// ── Task 1.2: START_MATCH Notification ─────────────────────────────

describe('START_MATCH auto-notification', () => {
  test('emits KIOSK_NOTIFICATION with info type, duration 10, and match details', () => {
    const mockIo = createMockIo();
    const mockTM = createMockTableManager();
    mockTM.startMatch.mockReturnValue({
      playerNames: { a: 'Alice', b: 'Bob' },
    });
    mockTM.getTable.mockReturnValue({ id: 'table-1', players: [] });
    mockTM.tableToInfo.mockReturnValue({ id: 'table-1' });
    mockTM.isReferee.mockReturnValue(true);

    const handler = new MatchEventHandler(mockIo as any, mockTM as any, '12345678');
    const mockSocket: any = createMockSocket();
    handler.registerHandlers(mockSocket);

    const handlerFn = mockSocket._handlers[SocketEvents.CLIENT.START_MATCH];
    expect(handlerFn).toBeDefined();

    mockIo.emit.mockClear();
    handlerFn({ tableId: 'table-1' });

    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.objectContaining({
        type: 'info',
        duration: 10,
        message: 'Match started: Alice vs Bob',
        timestamp: expect.any(Number),
      }),
    );
  });
});

// ── Task 1.3: MATCH_WON Notification ───────────────────────────────

describe('MATCH_WON auto-notification', () => {
  test('emits KIOSK_NOTIFICATION with important type, duration 10, and winner name', () => {
    const mockIo = createMockIo();
    const mockTM = createMockTableManager();
    const hubConfig = createMockHubConfig();

    // Create SocketHandler to wire up onMatchEvent callback
    const socketHandler = new SocketHandler(mockIo as any, mockTM as any, '12345678', hubConfig);

    // Set up match state with player names
    mockTM.getMatchState.mockReturnValue({
      playerNames: { a: 'Alice', b: 'Bob' },
    });

    mockIo.emit.mockClear();
    mockTM.onMatchEvent('table-1', { type: 'MATCH_WON', winner: 'A' } as any);

    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.objectContaining({
        type: 'important',
        duration: 10,
        message: 'Winner: Alice!',
        timestamp: expect.any(Number),
      }),
    );
  });
});

// ── Task 1.4: Fallback Names ───────────────────────────────────────

describe('Fallback names', () => {
  test('START_MATCH uses "Player A" vs "Player B" when playerNames undefined', () => {
    const mockIo = createMockIo();
    const mockTM = createMockTableManager();
    mockTM.startMatch.mockReturnValue({});
    mockTM.getTable.mockReturnValue({ id: 'table-1', players: [] });
    mockTM.tableToInfo.mockReturnValue({ id: 'table-1' });
    mockTM.isReferee.mockReturnValue(true);

    const handler = new MatchEventHandler(mockIo as any, mockTM as any, '12345678');
    const mockSocket: any = createMockSocket();
    handler.registerHandlers(mockSocket);

    const handlerFn = mockSocket._handlers[SocketEvents.CLIENT.START_MATCH];
    mockIo.emit.mockClear();
    handlerFn({ tableId: 'table-1' });

    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.objectContaining({
        type: 'info',
        message: 'Match started: Player A vs Player B',
      }),
    );
  });

  test('MATCH_WON uses "Player B" when match state unavailable', () => {
    const mockIo = createMockIo();
    const mockTM = createMockTableManager();
    const hubConfig = createMockHubConfig();

    const socketHandler = new SocketHandler(mockIo as any, mockTM as any, '12345678', hubConfig);

    // getMatchState returns null (no state available)
    mockTM.getMatchState.mockReturnValue(null);

    mockIo.emit.mockClear();
    mockTM.onMatchEvent('table-1', { type: 'MATCH_WON', winner: 'B' } as any);

    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.objectContaining({
        type: 'important',
        message: 'Winner: Player B!',
      }),
    );
  });
});

// ── Task 1.5: Existing Emissions Unchanged ─────────────────────────

describe('Existing emissions unchanged', () => {
  test('START_MATCH still emits TABLE_UPDATE and MATCH_UPDATE', () => {
    const mockIo = createMockIo();
    const mockTM = createMockTableManager();
    mockTM.startMatch.mockReturnValue({
      playerNames: { a: 'Alpha', b: 'Beta' },
    });
    mockTM.getTable.mockReturnValue({ id: 'table-1', players: [] });
    mockTM.tableToInfo.mockReturnValue({ id: 'table-1' });
    mockTM.isReferee.mockReturnValue(true);

    const handler = new MatchEventHandler(mockIo as any, mockTM as any, '12345678');
    const mockSocket: any = createMockSocket();
    handler.registerHandlers(mockSocket);

    const handlerFn = mockSocket._handlers[SocketEvents.CLIENT.START_MATCH];
    handlerFn({ tableId: 'table-1' });

    // Existing events still emitted
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.TABLE_UPDATE,
      expect.any(Object),
    );
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.MATCH_UPDATE,
      expect.any(Object),
    );
  });

  test('MATCH_WON still emits MATCH_WON event to room', () => {
    const mockIo = createMockIo();
    const mockTM = createMockTableManager();
    const hubConfig = createMockHubConfig();

    const socketHandler = new SocketHandler(mockIo as any, mockTM as any, '12345678', hubConfig);

    mockTM.getMatchState.mockReturnValue({
      playerNames: { a: 'Charlie', b: 'Dana' },
    });

    mockIo.emit.mockClear();
    const event = { type: 'MATCH_WON', winner: 'A', finalScore: [], sets: { a: 0, b: 0 } };
    mockTM.onMatchEvent('table-1', event as any);

    // Original MATCH_WON still emitted
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.MATCH_WON,
      expect.objectContaining({ tableId: 'table-1', winner: 'A' }),
    );
  });
});
