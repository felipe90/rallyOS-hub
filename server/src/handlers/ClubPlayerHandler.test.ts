/**
 * ClubPlayerHandler Tests
 *
 * Verifies:
 * - CLUB_JOIN: valid PIN, invalid PIN, rate limiting, club config check
 * - Socket registration on successful join
 */

import { ClubPlayerHandler } from './ClubPlayerHandler';
import { CourtManager } from '../domain/courtManager';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { SocketEvents } from '../../../shared/events';
import { SPORT } from '../../../shared/types';
import type { Socket } from 'socket.io';
import type { FileSystem } from '../services/store/types';

// ── Fake FileSystem for DI ─────────────────────────────────────────────

function createFakeFs(): FileSystem & { _files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    _files: files,
    writeFileSync(path: string, data: string): void {
      files.set(path, data);
    },
    readFileSync(path: string): string {
      const content = files.get(path);
      if (content === undefined) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, open '${path}'`),
          { code: 'ENOENT' },
        );
      }
      return content;
    },
    renameSync(oldPath: string, newPath: string): void {
      const content = files.get(oldPath);
      if (content === undefined) throw new Error('ENOENT');
      files.set(newPath, content);
      files.delete(oldPath);
    },
    existsSync(path: string): boolean {
      return files.has(path);
    },
    mkdirSync(_path: string): string | undefined {
      return undefined;
    },
    unlinkSync(path: string): void {
      files.delete(path);
    },
  };
}

// ── Mock Socket / IO ───────────────────────────────────────────────────

function createMockSocket(id = 'test-socket', overrides: Record<string, any> = {}): jest.Mocked<Socket> {
  return {
    id,
    handshake: { address: '127.0.0.1' },
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    data: { ...overrides },
    rooms: new Set(),
  } as any;
}

function createMockIo() {
  return {
    to: jest.fn(() => mockIo),
    in: jest.fn(() => mockIo),
    emit: jest.fn(),
    engine: { clientsCount: 1 },
    use: jest.fn(),
    on: jest.fn(),
  } as any;
}

let mockIo: any;
let courtManager: CourtManager;
let clubConfigStore: ClubConfigStore;
let handler: ClubPlayerHandler;

const OWNER_PIN = '123456';

beforeEach(() => {
  mockIo = createMockIo();
  courtManager = new CourtManager({ ssid: 'test', ip: '127.0.0.1', port: 3000, domain: 'test.local', wifiPassword: 'test' });
  const fakeFs = createFakeFs();
  clubConfigStore = new ClubConfigStore(fakeFs);
  // Seed club config with padel
  clubConfigStore.save({
    clubName: 'Test Club',
    sport: SPORT.PADEL,
    adminPin: OWNER_PIN,
    adminPinHash: 'dummy-hash',
    configured: true,
    createdAt: Date.now(),
  });
  handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);
});

describe('ClubPlayerHandler — CLUB_JOIN', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;
  let courtPin: string;

  beforeEach(() => {
    socket = createMockSocket('player-socket');
    handler.registerHandlers(socket);

    // Create and activate a club court
    const court = courtManager.createClubCourt('Test Court');
    courtId = court.id;
    const activated = courtManager.activateCourt(courtId);
    courtPin = activated!.pin;
  });

  function simulateJoin(pin: string) {
    const joinHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_JOIN,
    );
    if (!joinHandler) throw new Error('CLUB_JOIN handler not registered');
    joinHandler[1]({ pin });
  }

  it('should register CLUB_JOIN handler', () => {
    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_JOIN,
      expect.any(Function),
    );
  });

  it('should succeed with valid PIN — emits CLUB_JOIN_RESULT with success=true', () => {
    simulateJoin(courtPin);

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_JOIN_RESULT,
      expect.objectContaining({ success: true, courtId }),
    );
  });

  it('should include matchState in successful join result', () => {
    simulateJoin(courtPin);

    const joinCall = (socket.emit as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_JOIN_RESULT,
    );
    const result = joinCall![1];
    expect(result.success).toBe(true);
    expect(result.matchState).toBeDefined();
    expect(result.matchState.status).toBe('LIVE');
    expect(result.courtName).toBe('Test Court');
  });

  it('should emit CLUB_JOIN_RESULT with error=INVALID_PIN for wrong PIN', () => {
    simulateJoin('0000');

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_JOIN_RESULT,
      expect.objectContaining({ success: false, error: 'INVALID_PIN' }),
    );
  });

  it('should join the socket to the court room on success', () => {
    simulateJoin(courtPin);

    expect(socket.join).toHaveBeenCalledWith(courtId);
  });

  it('should register socket as referee on success', () => {
    simulateJoin(courtPin);

    const isReferee = courtManager.isReferee(courtId, 'player-socket');
    expect(isReferee).toBe(true);
  });

  it('should emit RATE_LIMITED after 5 failed attempts from the same IP', () => {
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      simulateJoin('0000');
    }

    // Clear previous emit calls to isolate the rate-limited response
    (socket.emit as jest.Mock).mockClear();

    // 6th attempt — should be rate limited
    simulateJoin('0000');

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_JOIN_RESULT,
      expect.objectContaining({ success: false, error: 'RATE_LIMITED', retryAfterSeconds: expect.any(Number) }),
    );
  });

  it('should reset rate limiter on successful join after failed attempts', () => {
    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      simulateJoin('0000');
    }

    // Successful join — should reset counter
    simulateJoin(courtPin);

    // Clear emits, then try 5 more wrong attempts, 5th should NOT be rate-limited
    // because the counter was reset
    (socket.emit as jest.Mock).mockClear();
    for (let i = 0; i < 4; i++) {
      simulateJoin('0000');
    }

    // 5th wrong attempt — should succeed in failing (INVALID_PIN, not RATE_LIMITED)
    simulateJoin('0000');

    // Check that the last emit is INVALID_PIN, not RATE_LIMITED
    const emits = (socket.emit as jest.Mock).mock.calls.filter(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_JOIN_RESULT,
    );
    const lastEmit = emits[emits.length - 1];
    expect(lastEmit[1].error).toBe('INVALID_PIN');
  });

  it('should emit CLUB_NOT_CONFIGURED when club is not configured', () => {
    // Create a new handler with no club config (empty fake FS)
    const emptyStore = new ClubConfigStore(createFakeFs());
    const noConfigHandler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, emptyStore);
    const freshSocket = createMockSocket('fresh-socket');
    noConfigHandler.registerHandlers(freshSocket);

    const joinHandler = (freshSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_JOIN,
    );
    joinHandler[1]({ pin: courtPin });

    expect(freshSocket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_JOIN_RESULT,
      expect.objectContaining({ success: false, error: 'CLUB_NOT_CONFIGURED' }),
    );
  });

  describe('CLUB_JOIN — REF_REVOKED on displacement', () => {
    it('should emit REF_REVOKED when registering club referee displaces an existing referee', () => {
      // First player joins and becomes referee
      const firstSocket = createMockSocket('first-sock');
      handler.registerHandlers(firstSocket);

      const joinHandler1 = (firstSocket.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_JOIN,
      );
      joinHandler1[1]({ pin: courtPin });

      // Register a fresh socket for the second handler to avoid stale listeners
      const secondSocket = createMockSocket('second-sock');
      handler.registerHandlers(secondSocket);

      // Simulate — occupyClubCourt returns existing state since it's already OCCUPIED
      // But we need to find the CLUB_JOIN handler on the second socket
      const joinHandler2 = (secondSocket.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_JOIN,
      );
      // Join again with the same PIN
      joinHandler2[1]({ pin: courtPin });

      // First socket should receive REF_REVOKED
      const toCalls = (mockIo.to as jest.Mock).mock.calls;
      const revokedCall = toCalls.find(
        ([socketId]: [string]) => socketId === 'first-sock',
      );
      expect(revokedCall).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// CLUB_RECONNECT Tests
// ═══════════════════════════════════════════════════════════════

describe('ClubPlayerHandler — CLUB_RECONNECT', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;
  let courtPin: string;
  let occupyResult: ReturnType<CourtManager['occupyClubCourt']>;

  beforeEach(() => {
    // Create fresh mocks and handler for each test
    mockIo = createMockIo();
    courtManager = new CourtManager({ ssid: 'test', ip: '127.0.0.1', port: 3000, domain: 'test.local', wifiPassword: 'test' });
    const fakeFs = createFakeFs();
    clubConfigStore = new ClubConfigStore(fakeFs);
    clubConfigStore.save({
      clubName: 'Test Club',
      sport: SPORT.PADEL,
      adminPin: OWNER_PIN,
      adminPinHash: 'dummy-hash',
      configured: true,
      createdAt: Date.now(),
    });
    handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

    socket = createMockSocket('reconnect-socket');
    handler.registerHandlers(socket);

    // Set up an OCCUPIED club court
    const court = courtManager.createClubCourt('Reconnect Court');
    courtId = court.id;
    const activated = courtManager.activateCourt(courtId);
    courtPin = activated!.pin;
    occupyResult = courtManager.occupyClubCourt(courtId, SPORT.PADEL);
  });

  it('should register CLUB_RECONNECT handler', () => {
    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_RECONNECT,
      expect.any(Function),
    );
  });

  it('should emit CLUB_RECONNECT_RESULT with success for OCCUPIED club court', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId });

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
      expect.objectContaining({ success: true, courtId }),
    );
  });

  it('should include matchState in successful reconnect result', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId });

    const emitCall = (socket.emit as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
    );
    const result = emitCall![1];
    expect(result.matchState).toBeDefined();
    expect(result.matchState.status).toBe('LIVE');
  });

  it('should register socket as referee on success', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId });

    expect(courtManager.isReferee(courtId, 'reconnect-socket')).toBe(true);
  });

  it('should join socket to court room on success', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId });

    expect(socket.join).toHaveBeenCalledWith(courtId);
  });

  it('should emit CLUB_RECONNECT_RESULT with error COURT_NOT_FOUND for invalid courtId', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId: 'non-existent' });

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
      expect.objectContaining({ success: false, error: 'COURT_NOT_FOUND' }),
    );
  });

  it('should emit CLUB_RECONNECT_RESULT with error NOT_CLUB_MODE for tournament court', () => {
    // Create a regular (non-club) court
    const regCourt = courtManager.createCourt('Regular');
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId: regCourt.id });

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
      expect.objectContaining({ success: false, error: 'NOT_CLUB_MODE' }),
    );
  });

  it('should emit CLUB_RECONNECT_RESULT with error COURT_NOT_OCCUPIED for non-OCCUPIED club court', () => {
    // Create an activated but not occupied court (RESERVED)
    const reservedCourt = courtManager.createClubCourt('Reserved Court');
    const reservedId = reservedCourt.id;
    courtManager.activateCourt(reservedId);

    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId: reservedId });

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
      expect.objectContaining({ success: false, error: 'COURT_NOT_OCCUPIED' }),
    );
  });

  it('should emit CLUB_RECONNECT_RESULT with error INVALID_PARAMS for missing courtId', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({});

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
      expect.objectContaining({ success: false, error: 'INVALID_PARAMS' }),
    );
  });

  it('should emit REF_REVOKED when reconnection displaces a stale referee socket', () => {
    // Register the reconnecting socket first
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId });

    // Now register another socket that reconnects — it should displace the first
    const secondSocket = createMockSocket('displacing-sock');
    handler.registerHandlers(secondSocket);
    const reconnectHandler2 = (secondSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler2[1]({ courtId });

    // The original socket should receive REF_REVOKED
    const toCalls = (mockIo.to as jest.Mock).mock.calls;
    const revokedCall = toCalls.find(
      ([targetId]: [string]) => targetId === 'reconnect-socket',
    );
    expect(revokedCall).toBeDefined();
  });
});
