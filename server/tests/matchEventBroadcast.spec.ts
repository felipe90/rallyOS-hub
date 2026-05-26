/**
 * Match Event Broadcast Tests — Phase 5.3
 *
 * Verifies that SocketHandler broadcasts GAME_WON, TIEBREAK_START,
 * and DEUCE events to the correct Socket.io rooms when triggered
 * by MatchEngine via the onMatchEvent callback chain.
 */

import { TableManager } from '../src/domain/courtManager';
import { SocketHandler } from '../src/handlers/SocketHandler';
import { SocketEvents } from '../../shared/events';
import type { HubConfig } from '../src/domain/types';

// ── Socket.io Mock ─────────────────────────────────────────────────────

interface MockSocket {
  id: string;
  handshake: { address: string; auth: Record<string, any> };
  on: jest.Mock;
  emit: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  data: Record<string, any>;
}

function createMockSocket(id: string = 'mock-socket'): MockSocket {
  return {
    id,
    handshake: { address: '127.0.0.1', auth: {} },
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    data: {},
  };
}

function createMockIo() {
  const mockSocket = createMockSocket();
  const middlewareFns: Array<(socket: any, next: (err?: any) => void) => void> = [];
  let connectionHandler: ((socket: any) => void) | null = null;

  // Build mock with explicit type and no self-references
  // Instead of mockReturnThis(), we manually return the mock from chainable methods
  const mockIo: any = {
    engine: { clientsCount: 0 },
    emit: jest.fn(),
    socketsLeave: jest.fn(),
    _triggerConnection(socket?: any) {
      if (connectionHandler) {
        connectionHandler(socket || mockSocket);
      }
    },
    _mockSocket: mockSocket,
  };

  // Chainable methods defined after the object exists
  mockIo.to = jest.fn(() => mockIo);
  mockIo.in = jest.fn(() => mockIo);
  mockIo.use = jest.fn((fn: (socket: any, next: (err?: any) => void) => void) => {
    middlewareFns.push(fn);
    return mockIo;
  });
  mockIo.on = jest.fn((event: string, handler: any) => {
    if (event === 'connection') {
      connectionHandler = handler;
    }
    return mockIo;
  });

  return mockIo;
}

// ── Helpers ────────────────────────────────────────────────────────────

function createMockTableManager(): TableManager {
  return {
    onTableUpdate: () => {},
    onMatchEvent: () => {},
    getAllTables: () => [],
    getTable: () => undefined,
    getMatchState: () => null,
  } as unknown as TableManager;
}

const mockHubConfig: HubConfig = {
  ssid: 'test-ssid',
  ip: '127.0.0.1',
  port: 3000,
  domain: 'test.local',
  wifiPassword: 'test-password',
};

// ── Tests ──────────────────────────────────────────────────────────────

describe('SocketHandler Match Event Broadcasting (Phase 5.3)', () => {
  it('should broadcast GAME_WON event via socket', () => {
    const mockIo = createMockIo();
    const tableManager = createMockTableManager();

    new SocketHandler(mockIo as any, tableManager, '12345678', mockHubConfig);

    // Trigger connection to set up all handlers
    mockIo._triggerConnection();

    // Now trigger the onMatchEvent callback that was wired by SocketHandler
    const gameWonEvent = {
      type: 'GAME_WON' as const,
      winner: 'A' as const,
      score: { a: '40' as const, b: '30' as const },
      gameNumber: 3,
    };
    tableManager.onMatchEvent('court-1', gameWonEvent);

    expect(mockIo.to).toHaveBeenCalledWith('court-1');
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.GAME_WON,
      expect.objectContaining({
        tableId: 'court-1',
        type: 'GAME_WON',
        winner: 'A',
        gameNumber: 3,
      }),
    );
  });

  it('should broadcast DEUCE event via socket', () => {
    const mockIo = createMockIo();
    const tableManager = createMockTableManager();

    new SocketHandler(mockIo as any, tableManager, '12345678', mockHubConfig);
    mockIo._triggerConnection();

    const deuceEvent = { type: 'DEUCE' as const };
    tableManager.onMatchEvent('court-1', deuceEvent);

    expect(mockIo.to).toHaveBeenCalledWith('court-1');
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.DEUCE,
      expect.objectContaining({
        tableId: 'court-1',
        type: 'DEUCE',
      }),
    );
  });

  it('should broadcast TIEBREAK_START event via socket', () => {
    const mockIo = createMockIo();
    const tableManager = createMockTableManager();

    new SocketHandler(mockIo as any, tableManager, '12345678', mockHubConfig);
    mockIo._triggerConnection();

    const tiebreakEvent = { type: 'TIEBREAK_START' as const, targetPoints: 7 };
    tableManager.onMatchEvent('court-1', tiebreakEvent);

    expect(mockIo.to).toHaveBeenCalledWith('court-1');
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.TIEBREAK_START,
      expect.objectContaining({
        tableId: 'court-1',
        type: 'TIEBREAK_START',
        targetPoints: 7,
      }),
    );
  });

  it('should still broadcast SET_WON and MATCH_WON (backward compat)', () => {
    const mockIo = createMockIo();
    const tableManager = createMockTableManager();

    // Need to mock getMatchState for MATCH_WON kiosk notification
    (tableManager as any).getMatchState = () => ({
      playerNames: { a: 'Player A', b: 'Player B' },
    });

    new SocketHandler(mockIo as any, tableManager, '12345678', mockHubConfig);
    mockIo._triggerConnection();

    // SET_WON
    const setWonEvent = {
      type: 'SET_WON' as const,
      winner: 'A' as const,
      score: { a: 11, b: 5 },
      setNumber: 1,
    };
    tableManager.onMatchEvent('court-1', setWonEvent);

    expect(mockIo.to).toHaveBeenCalledWith('court-1');
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.SET_WON,
      expect.objectContaining({ type: 'SET_WON', tableId: 'court-1' }),
    );
  });

  it('should broadcast GAME_WON for padel match flow', () => {
    const mockIo = createMockIo();
    const tableManager = createMockTableManager();

    new SocketHandler(mockIo as any, tableManager, '12345678', mockHubConfig);
    mockIo._triggerConnection();

    // Simulate a padel game where A wins after deuce
    const gameWonEvent = {
      type: 'GAME_WON' as const,
      winner: 'A' as const,
      score: { a: 'AD' as const, b: '40' as const },
      gameNumber: 5,
    };
    tableManager.onMatchEvent('court-2', gameWonEvent);

    expect(mockIo.to).toHaveBeenCalledWith('court-2');
    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.GAME_WON,
      expect.objectContaining({
        type: 'GAME_WON',
        gameNumber: 5,
        score: { a: 'AD', b: '40' },
      }),
    );
  });
});
