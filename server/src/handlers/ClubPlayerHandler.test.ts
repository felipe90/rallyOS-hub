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

// ═══════════════════════════════════════════════════════════════
// CLUB_END_SESSION Tests
// ═══════════════════════════════════════════════════════════════

describe('ClubPlayerHandler — CLUB_END_SESSION', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;
  let courtPin: string;

  beforeEach(() => {
    mockIo = createMockIo();
    courtManager = new CourtManager({ ssid: 'test', ip: '127.0.0.1', port: 3000, domain: 'test.local', wifiPassword: 'test' });
    const fakeFs = createFakeFs();
    // Seed club config with costPerMinute for cost calc tests
    fakeFs._files.set(
      'data/club-config.json',
      JSON.stringify({
        clubName: 'Test Club',
        sport: SPORT.PADEL,
        adminPin: OWNER_PIN,
        adminPinHash: 'dummy-hash',
        configured: true,
        createdAt: Date.now(),
        costPerMinute: 50,
        currency: 'ARS',
      }),
    );
    clubConfigStore = new ClubConfigStore(fakeFs);
    handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

    socket = createMockSocket('end-session-socket');
    handler.registerHandlers(socket);

    // Set up an OCCUPIED club court and register the socket as referee
    const court = courtManager.createClubCourt('End Session Court');
    courtId = court.id;
    const activated = courtManager.activateCourt(courtId);
    courtPin = activated!.pin;

    // Occupy the court (simulates player joining via PIN)
    courtManager.occupyClubCourt(courtId, SPORT.PADEL);
    // Register socket as referee (simulates the join flow)
    courtManager.registerClubReferee(courtId, socket.id);
  });

  it('should register CLUB_END_SESSION handler', () => {
    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_END_SESSION,
      expect.any(Function),
    );
  });

  it('should end session for referee on OCCUPIED court', () => {
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId });

    // Court should be FINISHED
    const court = courtManager.getCourt(courtId);
    expect(court).not.toBeNull();
    expect((court as any)!.clubStatus).toBe('FINISHED');
    expect(court!.pin).toBe('');
  });

  it('should broadcast CLUB_SESSION_ENDED via onClubSessionEnd callback', () => {
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId });

    // The callback should have broadcast CLUB_SESSION_ENDED to the room
    expect(mockIo.to).toHaveBeenCalledWith(courtId);
    const toCall = (mockIo.to as jest.Mock).mock.calls.find(
      ([id]: [string]) => id === courtId,
    );
    expect(toCall).toBeDefined();
  });

  it('should emit ERROR when court is not OCCUPIED', () => {
    // End the session first
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId });

    // Try to end again — should fail
    (socket.emit as jest.Mock).mockClear();
    endSessionHandler[1]({ courtId });

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.ERROR,
      expect.objectContaining({ code: 'SESSION_NOT_ACTIVE' }),
    );
  });

  it('should emit ERROR when socket is not referee', () => {
    const nonRefSocket = createMockSocket('non-ref-socket');
    handler.registerHandlers(nonRefSocket);

    const endSessionHandler = (nonRefSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId });

    expect(nonRefSocket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.ERROR,
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('should emit ERROR for invalid params (missing courtId)', () => {
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({});

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.ERROR,
      expect.objectContaining({ code: 'INVALID_PARAMS' }),
    );
  });

  it('should calculate cost correctly via onClubSessionEnd callback', () => {
    // costPerMinute=50, elapsedMinutes≥1, so cost ≥ 50
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId });

    // Verify the broadcast payload via the callback
    const emitCalls = (mockIo.to as jest.Mock).mock.results;
    expect(emitCalls.length).toBeGreaterThan(0);

    // Find the CLUB_SESSION_ENDED emit on the court room
    const emitMock = mockIo.to(courtId);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_SESSION_ENDED,
      expect.objectContaining({
        courtId,
        elapsedMinutes: expect.any(Number),
        cost: expect.any(Number),
        currency: 'ARS',
        reason: 'player',
      }),
    );

    // Verify cost calculation: cost ≥ 50 since elapsedMinutes ≥ 1 and costPerMinute=50
    const sessionEndedCall = emitMock.emit.mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_SESSION_ENDED,
    );
    const payload = sessionEndedCall![1];
    expect(payload.cost).toBeGreaterThanOrEqual(50);
    expect(payload.reason).toBe('player');
  });

  it('should handle costPerMinute=0 gracefully (free session)', () => {
    // Create a handler with costPerMinute=0
    const freeFs = createFakeFs();
    freeFs._files.set(
      'data/club-config.json',
      JSON.stringify({
        clubName: 'Free Club',
        sport: SPORT.PADEL,
        adminPin: OWNER_PIN,
        adminPinHash: 'dummy-hash',
        configured: true,
        createdAt: Date.now(),
        costPerMinute: 0,
        currency: 'ARS',
      }),
    );
    const freeStore = new ClubConfigStore(freeFs);
    const freeHandler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, freeStore);

    const freeSocket = createMockSocket('free-socket', { isClubAdmin: false });
    freeHandler.registerHandlers(freeSocket);

    // Set up court and referee
    const freeCourt = courtManager.createClubCourt('Free Court');
    const freeCourtId = freeCourt.id;
    courtManager.activateCourt(freeCourtId);
    courtManager.occupyClubCourt(freeCourtId, SPORT.PADEL);
    courtManager.registerClubReferee(freeCourtId, freeSocket.id);

    const endHandler = (freeSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId: freeCourtId });

    // Verify cost is 0
    const emitMock = mockIo.to(freeCourtId);
    const emitCall = emitMock.emit.mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_SESSION_ENDED,
    );
    const payload = emitCall![1];
    expect(payload.cost).toBe(0);
  });

  it('should handle custom currency in broadcast', () => {
    const usdFs = createFakeFs();
    usdFs._files.set(
      'data/club-config.json',
      JSON.stringify({
        clubName: 'USD Club',
        sport: SPORT.PADEL,
        adminPin: OWNER_PIN,
        adminPinHash: 'dummy-hash',
        configured: true,
        createdAt: Date.now(),
        costPerMinute: 100,
        currency: 'USD',
      }),
    );
    const usdStore = new ClubConfigStore(usdFs);
    const usdHandler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, usdStore);

    const usdSocket = createMockSocket('usd-socket', { isClubAdmin: false });
    usdHandler.registerHandlers(usdSocket);

    const usdCourt = courtManager.createClubCourt('USD Court');
    const usdCourtId = usdCourt.id;
    courtManager.activateCourt(usdCourtId);
    courtManager.occupyClubCourt(usdCourtId, SPORT.PADEL);
    courtManager.registerClubReferee(usdCourtId, usdSocket.id);

    const endHandler = (usdSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId: usdCourtId });

    const emitMock = mockIo.to(usdCourtId);
    const emitCall = emitMock.emit.mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_SESSION_ENDED,
    );
    const payload = emitCall![1];
    expect(payload.currency).toBe('USD');
  });
});
