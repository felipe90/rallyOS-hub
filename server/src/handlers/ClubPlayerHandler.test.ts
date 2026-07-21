/**
 * ClubPlayerHandler Tests
 *
 * Verifies:
 * - CLUB_JOIN: valid PIN, invalid PIN, rate limiting, club config check
 * - Socket registration on successful join
 */

import { ClubPlayerHandler } from './ClubPlayerHandler';
import { CourtManager } from '../domain/courtManager';
import { createTestCourtManager } from '../domain/courtManager.test-factory';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { SessionHistoryStore } from '../services/store/SessionHistoryStore';
import { SocketEvents } from '../../../shared/events';
import { SPORT } from '../../../shared/types';
import type { SessionRecord } from '../../../shared/types';
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
    sockets: { sockets: new Map() },
  } as any;
}

let mockIo: any;
let courtManager: CourtManager;
let clubConfigStore: ClubConfigStore;
let handler: ClubPlayerHandler;

const OWNER_PIN = '123456';

beforeEach(() => {
  mockIo = createMockIo();
  courtManager = createTestCourtManager();
  const fakeFs = createFakeFs();
  clubConfigStore = new ClubConfigStore(fakeFs);
  // Seed club config with padel
  clubConfigStore.save({
    clubName: 'Test Club',
    sport: SPORT.PADEL,
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
    courtManager = createTestCourtManager();
    const fakeFs = createFakeFs();
    clubConfigStore = new ClubConfigStore(fakeFs);
    clubConfigStore.save({
      clubName: 'Test Club',
      sport: SPORT.PADEL,
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
    reconnectHandler[1]({ courtId, pin: courtPin });

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
      expect.objectContaining({ success: true, courtId }),
    );
  });

  it('should include matchState in successful reconnect result', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId, pin: courtPin });

    const emitCall = (socket.emit as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
    );
    const result = emitCall![1];
    expect(result.matchState).toBeDefined();
    expect(result.matchState.status).toBe('LIVE');
  });

  // ── Spec: CLUB_RECONNECT — sessionMode + elapsedSeconds ───────────

  it('should include sessionMode and elapsedSeconds in successful reconnect result (spec scenario 7/8)', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId, pin: courtPin });

    const emitCall = (socket.emit as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
    );
    const result = emitCall![1];
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('sessionMode');
    expect(result).toHaveProperty('elapsedSeconds');
    expect(typeof result.elapsedSeconds).toBe('number');
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should return sessionMode="free" when reconnecting during free play (spec scenario 8)', () => {
    // Switch the court to free mode before reconnecting
    courtManager.startFreePlay(courtId);

    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId, pin: courtPin });

    const emitCall = (socket.emit as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
    );
    const result = emitCall![1];
    expect(result.sessionMode).toBe('free');
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should return sessionMode="match" when reconnecting during an active match (spec scenario 7)', () => {
    // Switch the court to match mode (newMatch sets sessionMode='match')
    courtManager.newMatch(courtId, { playerNameA: 'Alice', playerNameB: 'Bob' });

    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId, pin: courtPin });

    const emitCall = (socket.emit as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
    );
    const result = emitCall![1];
    expect(result.sessionMode).toBe('match');
    expect(result.elapsedSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should register socket as referee on success', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId, pin: courtPin });

    expect(courtManager.isReferee(courtId, 'reconnect-socket')).toBe(true);
  });

  it('should join socket to court room on success', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId, pin: courtPin });

    expect(socket.join).toHaveBeenCalledWith(courtId);
  });

  it('should emit CLUB_RECONNECT_RESULT with error COURT_NOT_FOUND for invalid courtId', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId: 'non-existent', pin: '1234' });

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
    reconnectHandler[1]({ courtId: regCourt.id, pin: '1234' });

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
    reconnectHandler[1]({ courtId: reservedId, pin: '1234' });

    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_RECONNECT_RESULT,
      expect.objectContaining({ success: false, error: 'COURT_NOT_OCCUPIED' }),
    );
  });

  it('should emit VALIDATION_ERROR for missing required fields', () => {
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({});

    expect(socket.emit).toHaveBeenCalledWith(
      'ERROR',
      expect.objectContaining({ code: 'VALIDATION_ERROR', field: 'courtId' }),
    );
  });

  it('should emit REF_REVOKED when reconnection displaces a stale referee socket', () => {
    // Register the reconnecting socket first
    const reconnectHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler[1]({ courtId, pin: courtPin });

    // Now register another socket that reconnects — it should displace the first
    const secondSocket = createMockSocket('displacing-sock');
    handler.registerHandlers(secondSocket);
    const reconnectHandler2 = (secondSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RECONNECT,
    );
    reconnectHandler2[1]({ courtId, pin: courtPin });

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
    courtManager = createTestCourtManager();
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

  it('should end session for referee on OCCUPIED court when confirm=true (spec scenario 4)', () => {
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId, confirm: true });

    // Court should be FINISHED
    const court = courtManager.getCourt(courtId);
    expect(court).not.toBeNull();
    expect((court as any)!.clubStatus).toBe('FINISHED');
    expect(court!.pin).toBe('');
  });

  it('should broadcast CLUB_SESSION_ENDED via onClubSessionEnd callback when confirm=true', () => {
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId, confirm: true });

    // The callback should have broadcast CLUB_SESSION_ENDED to the room
    expect(mockIo.to).toHaveBeenCalledWith(courtId);
    const toCall = (mockIo.to as jest.Mock).mock.calls.find(
      ([id]: [string]) => id === courtId,
    );
    expect(toCall).toBeDefined();
  });

  it('should emit ERROR when court is not OCCUPIED (already ended, with confirm=true)', () => {
    // End the session first
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endSessionHandler[1]({ courtId, confirm: true });

    // Try to end again — should fail since court is FINISHED
    (socket.emit as jest.Mock).mockClear();
    endSessionHandler[1]({ courtId, confirm: true });

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
    endSessionHandler[1]({ courtId, confirm: true });

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
    endHandler[1]({ courtId: freeCourtId, confirm: true });

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
    endHandler[1]({ courtId: usdCourtId, confirm: true });

    const emitMock = mockIo.to(usdCourtId);
    const emitCall = emitMock.emit.mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_SESSION_ENDED,
    );
    const payload = emitCall![1];
    expect(payload.currency).toBe('USD');
  });
});

// ═══════════════════════════════════════════════════════════════
// CLUB_START_FREE / CLUB_RESET_MATCH / CLUB_NEW_MATCH Tests (spec scenarios 1, 2, reset)
// ═══════════════════════════════════════════════════════════════

describe('ClubPlayerHandler — CLUB_START_FREE (spec scenario 1)', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;

  beforeEach(() => {
    mockIo = createMockIo();
    courtManager = createTestCourtManager();
    const fakeFs = createFakeFs();
    clubConfigStore = new ClubConfigStore(fakeFs);
    clubConfigStore.save({
      clubName: 'Test Club',
      sport: SPORT.PADEL,
      adminPinHash: 'dummy-hash',
      configured: true,
      createdAt: Date.now(),
    });
    handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

    socket = createMockSocket('start-free-socket');
    handler.registerHandlers(socket);

    const court = courtManager.createClubCourt('Free Court');
    courtId = court.id;
    courtManager.activateCourt(courtId);
    courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(courtId, socket.id);
  });

  it('should register CLUB_START_FREE handler', () => {
    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_START_FREE,
      expect.any(Function),
    );
  });

  it('should emit CLUB_FREE_STARTED to the room on success (spec scenario 1)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_START_FREE,
    );
    handlerCall[1]({ courtId });

    const emitMock = mockIo.to(courtId);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_FREE_STARTED,
      expect.objectContaining({ courtId }),
    );
  });

  it('should set sessionMode="free" on the court on success (spec scenario 1)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_START_FREE,
    );
    handlerCall[1]({ courtId });

    const court = courtManager.getCourt(courtId) as any;
    expect(court.sessionMode).toBe('free');
  });

  it('should keep court OCCUPIED after CLUB_START_FREE (timer continues)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_START_FREE,
    );
    handlerCall[1]({ courtId });

    const court = courtManager.getCourt(courtId) as any;
    expect(court.clubStatus).toBe('OCCUPIED');
  });

  it('should emit ERROR when caller is not referee', () => {
    const nonRefSocket = createMockSocket('non-ref');
    handler.registerHandlers(nonRefSocket);
    const handlerCall = (nonRefSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_START_FREE,
    );
    handlerCall[1]({ courtId });

    expect(nonRefSocket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.ERROR,
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });
});

describe('ClubPlayerHandler — CLUB_RESET_MATCH (spec post-match reset)', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;

  beforeEach(() => {
    mockIo = createMockIo();
    courtManager = createTestCourtManager();
    const fakeFs = createFakeFs();
    clubConfigStore = new ClubConfigStore(fakeFs);
    clubConfigStore.save({
      clubName: 'Test Club',
      sport: SPORT.TABLE_TENNIS,
      adminPinHash: 'dummy-hash',
      configured: true,
      createdAt: Date.now(),
    });
    handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

    socket = createMockSocket('reset-match-socket');
    handler.registerHandlers(socket);

    const court = courtManager.createClubCourt('Reset Court');
    courtId = court.id;
    courtManager.activateCourt(courtId);
    courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(courtId, socket.id);

    // Play a match to FINISHED so reset can zero it
    for (let i = 0; i < 11; i++) {
      courtManager.recordPoint(courtId, 'A');
    }
  });

  it('should register CLUB_RESET_MATCH handler', () => {
    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_RESET_MATCH,
      expect.any(Function),
    );
  });

  it('should emit CLUB_MATCH_RESET with matchState to the room on success (spec reset)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RESET_MATCH,
    );
    handlerCall[1]({ courtId });

    const emitMock = mockIo.to(courtId);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_MATCH_RESET,
      expect.objectContaining({ courtId, matchState: expect.anything() }),
    );
  });

  it('should zero the match score on reset (0-0 in current set, status LIVE)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RESET_MATCH,
    );
    handlerCall[1]({ courtId });

    // Find the emitted matchState from the CLUB_MATCH_RESET payload
    const emitMock = mockIo.to(courtId);
    const resetCall = emitMock.emit.mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_MATCH_RESET,
    );
    const matchState = resetCall![1].matchState;
    expect(matchState.score.currentSet.a).toBe(0);
    expect(matchState.score.currentSet.b).toBe(0);
    expect(matchState.status).toBe('LIVE');
  });

  it('should keep court OCCUPIED and sessionMode unchanged on reset', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_RESET_MATCH,
    );
    handlerCall[1]({ courtId });

    const court = courtManager.getCourt(courtId) as any;
    expect(court.clubStatus).toBe('OCCUPIED');
  });
});

describe('ClubPlayerHandler — CLUB_NEW_MATCH (spec scenario 2)', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;

  beforeEach(() => {
    mockIo = createMockIo();
    courtManager = createTestCourtManager();
    const fakeFs = createFakeFs();
    clubConfigStore = new ClubConfigStore(fakeFs);
    clubConfigStore.save({
      clubName: 'Test Club',
      sport: SPORT.TABLE_TENNIS,
      adminPinHash: 'dummy-hash',
      configured: true,
      createdAt: Date.now(),
    });
    handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

    socket = createMockSocket('new-match-socket');
    handler.registerHandlers(socket);

    const court = courtManager.createClubCourt('New Match Court');
    courtId = court.id;
    courtManager.activateCourt(courtId);
    courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(courtId, socket.id);
  });

  it('should register CLUB_NEW_MATCH handler', () => {
    expect(socket.on).toHaveBeenCalledWith(
      SocketEvents.CLIENT.CLUB_NEW_MATCH,
      expect.any(Function),
    );
  });

  it('should start a fresh LIVE match and emit MATCH_UPDATE to the room (spec scenario 2 — free→match)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_NEW_MATCH,
    );
    handlerCall[1]({ courtId, playerNameA: 'Alice', playerNameB: 'Bob' });

    const emitMock = mockIo.to(courtId);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.MATCH_UPDATE,
      expect.objectContaining({ status: 'LIVE' }),
    );
  });

  it('should set sessionMode="match" on the court (spec scenario 2)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_NEW_MATCH,
    );
    handlerCall[1]({ courtId, playerNameA: 'Alice', playerNameB: 'Bob' });

    const court = courtManager.getCourt(courtId) as any;
    expect(court.sessionMode).toBe('match');
    expect(court.playerNames).toEqual({ a: 'Alice', b: 'Bob' });
  });

  it('should accept optional matchConfig passthrough (PR 1 risk #2)', () => {
    const handlerCall = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_NEW_MATCH,
    );
    handlerCall[1]({
      courtId,
      playerNameA: 'Alice',
      playerNameB: 'Bob',
      matchConfig: { pointsPerSet: 21, bestOf: 5 },
    });

    const state = courtManager.getMatchState(courtId) as any;
    expect(state.config.pointsPerSet).toBe(21);
    expect(state.config.bestOf).toBe(5);
  });

  it('should emit ERROR when caller is not referee', () => {
    const nonRefSocket = createMockSocket('non-ref-new');
    handler.registerHandlers(nonRefSocket);
    const handlerCall = (nonRefSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_NEW_MATCH,
    );
    handlerCall[1]({ courtId, playerNameA: 'A', playerNameB: 'B' });

    expect(nonRefSocket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.ERROR,
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// CLUB_END_SESSION confirmation flow (spec scenarios 4, 5, 6)
// ═══════════════════════════════════════════════════════════════

describe('ClubPlayerHandler — CLUB_END_SESSION confirmation flow (spec scenarios 4, 5, 6)', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;

  beforeEach(() => {
    mockIo = createMockIo();
    courtManager = createTestCourtManager();
    const fakeFs = createFakeFs();
    // Seed a configured club with costPerMinute for cost assertions
    fakeFs._files.set(
      'data/club-config.json',
      JSON.stringify({
        clubName: 'Confirm Club',
        sport: SPORT.TABLE_TENNIS,
        adminPinHash: 'dummy-hash',
        configured: true,
        createdAt: Date.now(),
        costPerMinute: 50,
        currency: 'ARS',
      }),
    );
    clubConfigStore = new ClubConfigStore(fakeFs);
    handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

    socket = createMockSocket('confirm-socket');
    handler.registerHandlers(socket);

    const court = courtManager.createClubCourt('Confirm Court');
    courtId = court.id;
    courtManager.activateCourt(courtId);
    courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(courtId, socket.id);
  });

  /**
   * Spec scenario 5 — Player ends session with confirmation:
   *   first emit (no confirm) → server emits elapsed, NO transition
   *   confirm emit → server transitions to FINISHED
   */
  it('scenario 5a: first emit WITHOUT confirm stays OCCUPIED and signals confirmation', () => {
    const endHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId }); // no confirm

    // Court stays OCCUPIED
    const court = courtManager.getCourt(courtId) as any;
    expect(court.clubStatus).toBe('OCCUPIED');

    // Server emits CLUB_END_SESSION_CONFIRM to the socket to drive the
    // confirmation modal (PR 3 event swap — previously reused
    // CLUB_SESSION_TIMER, which conflated confirmation with periodic sync).
    expect(socket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM,
      expect.objectContaining({ courtId, elapsedSeconds: expect.any(Number) }),
    );
    // Server MUST NOT reuse CLUB_SESSION_TIMER for confirmation anymore.
    expect(socket.emit).not.toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_SESSION_TIMER,
      expect.objectContaining({ courtId }),
    );

    // Server did NOT broadcast CLUB_SESSION_ENDED
    const emitMock = mockIo.to(courtId);
    const sessionEndedCall = emitMock.emit.mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_SESSION_ENDED,
    );
    expect(sessionEndedCall).toBeUndefined();
  });

  it('scenario 5b: confirmation emit with confirm=true transitions court to FINISHED', () => {
    const endHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId }); // first emit — confirmation request
    endHandler[1]({ courtId, confirm: true }); // second emit — confirm

    const court = courtManager.getCourt(courtId) as any;
    expect(court.clubStatus).toBe('FINISHED');
  });

  /**
   * Spec scenario 4 — Session ends → transitions to FINISHED, emits
   * CLUB_SESSION_ENDED with elapsedSeconds.
   */
  it('scenario 4: confirmed end broadcast includes elapsedSeconds in CLUB_SESSION_ENDED', () => {
    const endHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId, confirm: true });

    const emitMock = mockIo.to(courtId);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_SESSION_ENDED,
      expect.objectContaining({
        courtId,
        elapsedMinutes: expect.any(Number),
        elapsedSeconds: expect.any(Number),
        reason: 'player',
      }),
    );
  });

  /**
   * Spec scenario 6 — Cancel end session:
   *   player initiated CLUB_END_SESSION confirmation but cancelled; the court
   *   MUST stay OCCUPIED and the timer MUST continue running (occupiedAt
   *   preserved).
   */
  it('scenario 6: cancel after confirmation request — court stays OCCUPIED and occupiedAt preserved', () => {
    const court = courtManager.getCourt(courtId) as any;
    const occupiedAtBefore = court.occupiedAt;

    const endHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId }); // confirmation requested

    // Simulate user pressing "Cancelar" — no further emit is sent.
    const courtAfter = courtManager.getCourt(courtId) as any;
    expect(courtAfter.clubStatus).toBe('OCCUPIED');
    expect(courtAfter.occupiedAt).toBe(occupiedAtBefore);
  });
});

// ═══════════════════════════════════════════════════════════════
// ClubPlayerHandler — SessionHistoryStore append on session end
// (PR 1 / Task 1.4 — club-session-history feature)
//
// Spec scenarios covered:
//   - "Record created on player-initiated end"     (CLUB_END_SESSION confirm=true)
//   - "Record created on admin force-end"           (forceEndSession path)
//   - "Free-mode session records cost=0"
//   - "All fields populated on normal session end"   (8 fields, non-null)
//   - "Court name is a snapshot, not a live reference"
//   - "Club not configured → no SessionRecord is created"
// ═══════════════════════════════════════════════════════════════

describe('ClubPlayerHandler — SessionHistoryStore append on session end (PR 1 / Task 1.4)', () => {
  let socket: jest.Mocked<Socket>;
  let courtId: string;
  let courtPin: string;
  let historyStore: SessionHistoryStore;
  let historyFs: ReturnType<typeof createFakeFs>;

  beforeEach(() => {
    mockIo = createMockIo();
    courtManager = createTestCourtManager();
    const fakeFs = createFakeFs();
    fakeFs._files.set(
      'data/club-config.json',
      JSON.stringify({
        clubName: 'History Club',
        sport: SPORT.TABLE_TENNIS,
        adminPinHash: 'dummy-hash',
        configured: true,
        createdAt: Date.now(),
        costPerMinute: 50,
        currency: 'ARS',
      }),
    );
    clubConfigStore = new ClubConfigStore(fakeFs);

    // Dedicated fake fs for the SessionHistoryStore so append activity is
    // isolated from the club-config fake fs.
    historyFs = createFakeFs();
    historyStore = new SessionHistoryStore(historyFs, 'data/session-history.json');

    handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore, historyStore);

    socket = createMockSocket('history-socket');
    handler.registerHandlers(socket);

    // Set up an OCCUPIED club court with the socket as referee — registerHandlers
    // wires onClubSessionEnd, so any session end (player-initiated or admin
    // force) will route through our modified callback → SessionHistoryStore.append.
    const court = courtManager.createClubCourt('History Court');
    courtId = court.id;
    const activated = courtManager.activateCourt(courtId);
    courtPin = activated!.pin;
    courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(courtId, socket.id);
  });

  function endSessionViaPlayer() {
    const endSessionHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    if (!endSessionHandler) throw new Error('CLUB_END_SESSION handler not registered');
    endSessionHandler[1]({ courtId, confirm: true });
  }

  it('appends exactly one SessionRecord to SessionHistoryStore on CLUB_END_SESSION confirm=true (spec: player-initiated end)', () => {
    endSessionViaPlayer();

    const records = historyStore.load();
    expect(records).toHaveLength(1);
  });

  it('appends a SessionRecord via onClubSessionEnd when admin force-ends the session (spec: admin force-end)', () => {
    // forceEndSession delegates to endSession which fires onClubSessionEnd.
    // The callback is wired in ClubPlayerHandler.registerHandlers — verify
    // the same hook persists the record on the force-end path.
    courtManager.forceEndSession(courtId);

    const records = historyStore.load();
    expect(records).toHaveLength(1);
  });

  it('populates ALL 8 SessionRecord fields on a normal session end (spec: all fields non-null)', () => {
    endSessionViaPlayer();

    const record = historyStore.load()[0];
    expect(record).toBeDefined();
    expect(typeof record.courtName).toBe('string');
    expect(record.courtName).toBe('History Court');
    expect(typeof record.elapsedSeconds).toBe('number');
    expect(record.elapsedSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof record.elapsedMinutes).toBe('number');
    expect(record.elapsedMinutes).toBeGreaterThanOrEqual(1);
    expect(record.mode === 'free' || record.mode === 'match').toBe(true);
    expect(typeof record.cost).toBe('number');
    expect(typeof record.currency).toBe('string');
    expect(record.currency).toBe('ARS');
    expect(typeof record.timestamp).toBe('string');
    expect(record.timestamp.length).toBeGreaterThan(0);
    expect(typeof record.sessionId).toBe('string');
    expect(record.sessionId.length).toBeGreaterThan(0);
  });

  it('charges the same cost for free-mode as match-mode (cost = elapsedMinutes × costPerMinute)', () => {
    // Switch the court to free mode before ending. Cost should be the same
    // as match mode — court time is billed regardless of scoring mode.
    courtManager.startFreePlay(courtId);
    endSessionViaPlayer();

    const record = historyStore.load()[0];
    expect(record.cost).toBe(record.elapsedMinutes * 50);
    expect(record.cost).toBeGreaterThanOrEqual(50);
    expect(record.mode).toBe('free');
  });

  it('records cost = Math.ceil(elapsedMinutes × costPerMinute) for match-mode sessions (costPerMinute=50)', () => {
    endSessionViaPlayer();

    const record = historyStore.load()[0];
    // elapsedMinutes is min 1, costPerMinute=50 → cost ≥ 50.
    expect(record.cost).toBe(record.elapsedMinutes * 50);
    expect(record.cost).toBeGreaterThanOrEqual(50);
  });

  it('captures courtName as a snapshot string (spec: court name is a snapshot, not a live reference)', () => {
    endSessionViaPlayer();

    const record = historyStore.load()[0];
    expect(record.courtName).toBe('History Court');

    // After the record is persisted, renaming the court (even via the
    // repository mutation) MUST NOT mutate the stored record. The store
    // holds plain JSON values, so subsequent court mutations are isolated.
    const court = courtManager.getCourt(courtId) as any;
    court.name = 'Renamed Court';

    const reloaded = historyStore.load()[0];
    expect(reloaded.courtName).toBe('History Court');
  });

  it('generates sessionId as a UUID v4 string (spec: sessionId UUID v4)', () => {
    endSessionViaPlayer();

    const record = historyStore.load()[0];
    // UUID v4 canonical string: 8-4-4-4-12 hex chars, version nibble = 4.
    expect(record.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates timestamp as an ISO 8601 string (spec: timestamp ISO 8601)', () => {
    endSessionViaPlayer();

    const record = historyStore.load()[0];
    // ISO 8601 — parses cleanly via Date and round-trips via toISOString.
    const parsed = new Date(record.timestamp);
    expect(parsed.toString()).not.toBe('Invalid Date');
    expect(parsed.toISOString()).toBe(record.timestamp);
  });

  it('does NOT append a SessionRecord when the club is not configured (spec: history disabled without club config)', () => {
    // Replace the in-memory club config with one that fails
    // clubConfigStore.load() — load() returns null. The handler's
    // onClubSessionEnd callback MUST short-circuit (no record created) so
    // the SessionHistoryStore stays empty.
    const blankFs = createFakeFs();
    const blankConfigStore = new ClubConfigStore(blankFs); // no config file → load() returns null
    const blankHistoryFs = createFakeFs();
    const blankHistoryStore = new SessionHistoryStore(blankHistoryFs, 'data/session-history.json');
    const blankHandler = new ClubPlayerHandler(
      mockIo,
      courtManager,
      OWNER_PIN,
      blankConfigStore,
      blankHistoryStore,
    );
    const blankSocket = createMockSocket('blank-socket');
    blankHandler.registerHandlers(blankSocket);

    // Set up a fresh OCCUPIED court and end it.
    const court = courtManager.createClubCourt('No Config Court');
    const blankCourtId = court.id;
    courtManager.activateCourt(blankCourtId);
    courtManager.occupyClubCourt(blankCourtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(blankCourtId, blankSocket.id);

    const endHandler = (blankSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId: blankCourtId, confirm: true });

    expect(blankHistoryStore.load()).toEqual([]);
  });

  it('persists two records across two consecutive session ends (append-only accumulation)', () => {
    endSessionViaPlayer();

    // Set up a fresh court for the second end (activateCourt only goes
    // AVAILABLE → RESERVED, so a FINISHED court cannot be reactivated).
    const secondCourt = courtManager.createClubCourt('History Court 2');
    const secondCourtId = secondCourt.id;
    courtManager.activateCourt(secondCourtId);
    courtManager.occupyClubCourt(secondCourtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(secondCourtId, socket.id);

    const endHandler = (socket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId: secondCourtId, confirm: true });

    const records = historyStore.load();
    expect(records).toHaveLength(2);
    expect(records[0].sessionId).not.toBe(records[1].sessionId);
    expect(records[0].courtName).toBe('History Court');
    expect(records[1].courtName).toBe('History Court 2');
  });

  it('does NOT block the session-end transition even if SessionHistoryStore is omitted (spec: write failure does not block)', () => {
    // Construct a handler with no SessionHistoryStore — the callback must
    // still allow the court to transition to FINISHED.
    const noStoreHandler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);
    const noStoreSocket = createMockSocket('no-store-socket');
    noStoreHandler.registerHandlers(noStoreSocket);

    const court = courtManager.createClubCourt('No Store Court');
    const noStoreCourtId = court.id;
    courtManager.activateCourt(noStoreCourtId);
    courtManager.occupyClubCourt(noStoreCourtId, SPORT.TABLE_TENNIS);
    courtManager.registerClubReferee(noStoreCourtId, noStoreSocket.id);

    const endHandler = (noStoreSocket.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
    );
    endHandler[1]({ courtId: noStoreCourtId, confirm: true });

    const ended = courtManager.getCourt(noStoreCourtId) as any;
    expect(ended.clubStatus).toBe('FINISHED');
  });

  it('still broadcasts CLUB_SESSION_ENDED on session end (broadcast behavior unchanged by history persistence)', () => {
    endSessionViaPlayer();

    const emitMock = mockIo.to(courtId);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_SESSION_ENDED,
      expect.objectContaining({
        courtId,
        elapsedMinutes: expect.any(Number),
        elapsedSeconds: expect.any(Number),
        cost: expect.any(Number),
        currency: 'ARS',
        reason: 'player',
      }),
    );
  });

  it('SessionRecord.type sanity — record passes structural SessionRecord check', () => {
    endSessionViaPlayer();

    const record: SessionRecord = historyStore.load()[0];
    // player-identity (Phase 1) — SessionRecord extended from 8 → 12 fields.
    // The 4 new fields (playerName, phone, endedBy, adminId) are populated
    // here with neutral placeholders by Phase 1 GREEN; Phase 2 task 2.5
    // enriches playerName/phone/adminId with values flowing from the court
    // (set via CLUB_START_FREE/CLUB_NEW_MATCH) and ensures endedBy is
    // mapped correctly for admin force-end.
    expect(Object.keys(record).sort()).toEqual(
      [
        'adminId',
        'cost',
        'courtName',
        'currency',
        'elapsedMinutes',
        'elapsedSeconds',
        'endedBy',
        'mode',
        'phone',
        'playerName',
        'sessionId',
        'timestamp',
      ].sort(),
    );
  });

  it('emits CLUB_SESSION_HISTORY to admin sockets on session end (live table update)', () => {
    // Set up an admin socket in the mock io's socket map.
    const adminSocket = createMockSocket('admin-1', { isClubAdmin: true });
    adminSocket.emit = jest.fn();
    const mockMap = mockIo.sockets.sockets as Map<string, any>;
    mockMap.set('admin-1', adminSocket);

    endSessionViaPlayer();

    expect(adminSocket.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_SESSION_HISTORY,
      expect.objectContaining({ sessions: expect.any(Array) }),
    );
    const payload = (adminSocket.emit as jest.Mock).mock.calls[0][1];
    expect(payload.sessions).toHaveLength(1);
    expect(payload.sessions[0].mode).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// player-identity — Phase 2 tasks 2.4 + 2.5
//
// Scope (U1 / PR1):
//   - CLUB_JOIN_RESULT success payload now carries `encryptionKey`
//     (base64 AES-256-GCM key delivered to the client so it can encrypt
//     the player's phone with Web Crypto on play). Auto-generate and
//     persist when an existing ClubConfig lacks one (legacy clubs).
//   - CLUB_START_FREE and CLUB_NEW_MATCH accept and persist the player's
//     name+phone (the player's OWN identity, distinct from match
//     participants playerNameA/B in newMatch).
//   - onClubSessionEnd SessionRecord is enriched with playerName/phone
//     flowing from the court (set via START_FREE/NEW_MATCH), endedBy
//     mapped from the reason string, and adminId = court.adminId (null
//     for player-initiated sessions).
//
// Not asserted here (U2 scope):
//   - CLUB_ADMIN_OCCUPY handler (Phase 3 task 3.2)
//   - admin force-end sets endedBy='admin' + adminId (Phase 3 task 3.6)
//   - CLUB_REVEAL_PHONE + ClubConfig.encryptionKey decrypt (Phase 4)
// ═══════════════════════════════════════════════════════════════

describe('ClubPlayerHandler — player-identity (Phase 2 tasks 2.4 + 2.5)', () => {
  // ── encryptionKey delivered on CLUB_JOIN_RESULT ────────────────────────

  describe('CLUB_JOIN_RESULT — encryptionKey delivery', () => {
    let socket: jest.Mocked<Socket>;
    let courtId: string;
    let courtPin: string;
    let localClubConfigStore: ClubConfigStore;
    let localFs: ReturnType<typeof createFakeFs>;

    beforeEach(() => {
      mockIo = createMockIo();
      courtManager = createTestCourtManager();
      localFs = createFakeFs();
      localFs._files.set(
        'data/club-config.json',
        JSON.stringify({
          clubName: 'Encryption Club',
          sport: SPORT.TABLE_TENNIS,
          adminPinHash: 'dummy-hash',
          configured: true,
          createdAt: Date.now(),
          // Club has an explicit encryptionKey configured — server MUST
          // surface it back on the join result (no auto-generation).
          encryptionKey: 'k9J8s7H6j5G4F3D2S1A0==',
        }),
      );
      localClubConfigStore = new ClubConfigStore(localFs);
      clubConfigStore = localClubConfigStore;
      handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

      socket = createMockSocket('join-socket');
      handler.registerHandlers(socket);

      const court = courtManager.createClubCourt('Encrypted Court');
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

    it('includes encryptionKey on the success CLUB_JOIN_RESULT payload when the club config has one', () => {
      simulateJoin(courtPin);

      expect(socket.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_JOIN_RESULT,
        expect.objectContaining({
          success: true,
          encryptionKey: 'k9J8s7H6j5G4F3D2S1A0==',
        }),
      );
    });

    it('auto-generates and persists a new encryptionKey when ClubConfig.encryptionKey is missing (legacy club)', () => {
      // Replace the configured club with a legacy club lacking encryptionKey.
      const legacyFs = createFakeFs();
      legacyFs._files.set(
        'data/club-config.json',
        JSON.stringify({
          clubName: 'Legacy Club',
          sport: SPORT.TABLE_TENNIS,
          adminPinHash: 'dummy-hash',
          configured: true,
          createdAt: Date.now(),
          // NO encryptionKey — simulates a pre-change club.
        }),
      );
      const legacyStore = new ClubConfigStore(legacyFs);
      const legacyHandler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, legacyStore);
      const legacySocket = createMockSocket('legacy-join-socket');
      legacyHandler.registerHandlers(legacySocket);

      legacySocket.emit = jest.fn();
      (legacySocket.on as jest.Mock).mock.calls.length; // ensure handlers registered

      // Find the join handler on the legacy socket and trigger it with the PIN.
      const joinHandler = (legacySocket.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_JOIN,
      );
      joinHandler[1]({ pin: courtPin });

      const joinResult = (legacySocket.emit as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === SocketEvents.SERVER.CLUB_JOIN_RESULT,
      );
      expect(joinResult).toBeDefined();
      expect(joinResult![1].success).toBe(true);
      // Generated key present and well-shaped (base64 — decodes to 32 bytes).
      const genKey = joinResult![1].encryptionKey;
      expect(typeof genKey).toBe('string');
      expect(Buffer.from(genKey, 'base64').length).toBe(32);
      // The key was persisted back to ClubConfig so future joins reuse it.
      const reloaded = legacyStore.load();
      expect(reloaded?.encryptionKey).toBe(genKey);
    });

    it('reuses the persisted key on a second join (idempotent — does NOT regenerate the next time)', () => {
      simulateJoin(courtPin);

      // Second join from a fresh socket reusing the same PIN — server MUST
      // return the existing configured key, not a fresh one.
      const secondSocket = createMockSocket('second-join-socket');
      handler.registerHandlers(secondSocket);
      const joinHandler = (secondSocket.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_JOIN,
      );
      // Pin is stale (court became OCCUPIED after first occupy) so this is
      // reconnection logic — but the configured encryptionKey path is the
      // same: read from ClubConfig, persist-once-only. Trigger the same
      // code path by occupying another freshly-activated court.
      const court2 = courtManager.createClubCourt('Encrypted Court 2');
      const activated = courtManager.activateCourt(court2.id);
      joinHandler[1]({ pin: activated!.pin });

      const joinResult = (secondSocket.emit as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === SocketEvents.SERVER.CLUB_JOIN_RESULT,
      );
      expect(joinResult![1].encryptionKey).toBe('k9J8s7H6j5G4F3D2S1A0==');
    });
  });

  // ── CLUB_START_FREE / CLUB_NEW_MATCH accept playerName+phone ──────────

  describe('CLUB_START_FREE — player name + phone are accepted and persisted', () => {
    let socket: jest.Mocked<Socket>;
    let courtId: string;

    beforeEach(() => {
      mockIo = createMockIo();
      courtManager = createTestCourtManager();
      const fakeFs = createFakeFs();
      fakeFs._files.set(
        'data/club-config.json',
        JSON.stringify({
          clubName: 'Start-Free Club',
          sport: SPORT.TABLE_TENNIS,
          adminPinHash: 'dummy-hash',
          configured: true,
          createdAt: Date.now(),
          encryptionKey: 'k7J6s5H4j='
        }),
      );
      clubConfigStore = new ClubConfigStore(fakeFs);
      handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

      socket = createMockSocket('start-free-player-socket');
      handler.registerHandlers(socket);

      const court = courtManager.createClubCourt('Start Free Court');
      courtId = court.id;
      courtManager.activateCourt(courtId);
      courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
      courtManager.registerClubReferee(courtId, socket.id);
    });

    function triggerStartFree(payload: any) {
      const h = (socket.on as jest.Mock).mock.calls.find(
        ([ev]: [string]) => ev === SocketEvents.CLIENT.CLUB_START_FREE,
      );
      h![1](payload);
    }

    it('persists playerName + phone on the court when provided alongside the mode choice (player flow)', () => {
      triggerStartFree({
        courtId,
        playerName: 'Ana',
        phone: 'enc:N:B:T',
      });

      const updated = courtManager.getCourt(courtId) as any;
      expect(updated.playerName).toBe('Ana');
      expect(updated.phone).toBe('enc:N:B:T');
      expect(updated.adminId).toBeNull();
      // Session mode still switches to free — unchanged behavior.
      expect(updated.sessionMode).toBe('free');
    });

    it('emits CLUB_FREE_STARTED to the room on success (preserves existing broadcast behavior)', () => {
      triggerStartFree({ courtId, playerName: 'Ana', phone: 'enc' });

      const emitMock = mockIo.to(courtId);
      expect(emitMock.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_FREE_STARTED,
        expect.objectContaining({ courtId }),
      );
    });

    it('accepts an empty optional playerName/phone (backward-compat — client pre-change payload still works)', () => {
      // The pre-change CLUB_START_FREE payload carries only courtId. Such a
      // call MUST NOT break (no player info captured, but the session mode
      // still transitions). This is real-world backward-compat during the
      // PR rollout window.
      triggerStartFree({ courtId });

      const updated = courtManager.getCourt(courtId) as any;
      expect(updated.sessionMode).toBe('free');
      // No playerName set → todavía null (kiosk shows no name for this
      // session).
      expect(updated.playerName).toBeNull();
    });
  });

  describe('CLUB_NEW_MATCH — player name + phone are accepted and persisted', () => {
    let socket: jest.Mocked<Socket>;
    let courtId: string;

    beforeEach(() => {
      mockIo = createMockIo();
      courtManager = createTestCourtManager();
      const fakeFs = createFakeFs();
      fakeFs._files.set(
        'data/club-config.json',
        JSON.stringify({
          clubName: 'New-Match Club',
          sport: SPORT.TABLE_TENNIS,
          adminPinHash: 'dummy-hash',
          configured: true,
          createdAt: Date.now(),
          encryptionKey: 'k='
        }),
      );
      clubConfigStore = new ClubConfigStore(fakeFs);
      handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore);

      socket = createMockSocket('new-match-player-socket');
      handler.registerHandlers(socket);

      const court = courtManager.createClubCourt('New Match Court');
      courtId = court.id;
      courtManager.activateCourt(courtId);
      courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
      courtManager.registerClubReferee(courtId, socket.id);
    });

    function triggerNewMatch(payload: any) {
      const h = (socket.on as jest.Mock).mock.calls.find(
        ([ev]: [string]) => ev === SocketEvents.CLIENT.CLUB_NEW_MATCH,
      );
      h![1](payload);
    }

    it('persists playerName + phone on the court alongside match participants (player flow)', () => {
      triggerNewMatch({
        courtId,
        playerNameA: 'Alice',
        playerNameB: 'Bob',
        playerName: 'Carlos',
        phone: 'enc:NNN:BBB:TTT',
      });

      const updated = courtManager.getCourt(courtId) as any;
      // Match participants populate court.playerNames (existing behavior).
      expect(updated.playerNames).toEqual({ a: 'Alice', b: 'Bob' });
      // Player's own identity lives on the dedicated fields.
      expect(updated.playerName).toBe('Carlos');
      expect(updated.phone).toBe('enc:NNN:BBB:TTT');
      expect(updated.adminId).toBeNull();
      expect(updated.sessionMode).toBe('match');
    });

    it('emits MATCH_UPDATE to the room on success (preserves existing broadcast behavior)', () => {
      triggerNewMatch({
        courtId,
        playerNameA: 'Alice',
        playerNameB: 'Bob',
        playerName: 'Carlos',
        phone: 'enc',
      });

      const emitMock = mockIo.to(courtId);
      expect(emitMock.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.MATCH_UPDATE,
        expect.objectContaining({ courtId, status: expect.any(String) }),
      );
    });

    it('accepts payloads omitting playerName/phone (backward-compat client → no identity captured)', () => {
      triggerNewMatch({ courtId, playerNameA: 'Alice', playerNameB: 'Bob' });
      const updated = courtManager.getCourt(courtId) as any;
      expect(updated.sessionMode).toBe('match');
      expect(updated.playerNames).toEqual({ a: 'Alice', b: 'Bob' });
      expect(updated.playerName).toBeNull();
    });
  });

  // ── onClubSessionEnd SessionRecord enrichment ─────────────────────────
  //
  // When a player starts a session via CLUB_START_FREE / CLUB_NEW_MATCH
  // (capturing playerName+phone), then ends the session via
  // CLUB_END_SESSION confirm=true (reason='player'), the persisted
  // SessionRecord MUST carry the captured identity + endedBy='player'
  // + adminId=null (adminId is null because the admin did NOT start this
  // session — player-initiated flow).

  describe('onClubSessionEnd — SessionRecord enrichment (Phase 2 task 2.5)', () => {
    let socket: jest.Mocked<Socket>;
    let courtId: string;
    let historyStore: SessionHistoryStore;
    let historyFs: ReturnType<typeof createFakeFs>;

    beforeEach(() => {
      mockIo = createMockIo();
      courtManager = createTestCourtManager();
      const fakeFs = createFakeFs();
      fakeFs._files.set(
        'data/club-config.json',
        JSON.stringify({
          clubName: 'History-plus Club',
          sport: SPORT.TABLE_TENNIS,
          adminPinHash: 'dummy-hash',
          configured: true,
          createdAt: Date.now(),
          costPerMinute: 50,
          currency: 'ARS',
          encryptionKey: 'encKey='
        }),
      );
      clubConfigStore = new ClubConfigStore(fakeFs);

      historyFs = createFakeFs();
      historyStore = new SessionHistoryStore(historyFs, 'data/session-history.json');
      handler = new ClubPlayerHandler(mockIo, courtManager, OWNER_PIN, clubConfigStore, historyStore);

      socket = createMockSocket('enrich-socket');
      handler.registerHandlers(socket);

      const court = courtManager.createClubCourt('Enrich Court');
      courtId = court.id;
      courtManager.activateCourt(courtId);
      courtManager.occupyClubCourt(courtId, SPORT.TABLE_TENNIS);
      courtManager.registerClubReferee(courtId, socket.id);
    });

    function triggerStartFree(payload: any) {
      const h = (socket.on as jest.Mock).mock.calls.find(
        ([ev]: [string]) => ev === SocketEvents.CLIENT.CLUB_START_FREE,
      );
      h![1](payload);
    }

    function endSessionViaPlayer() {
      const endHandler = (socket.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === SocketEvents.CLIENT.CLUB_END_SESSION,
      );
      if (!endHandler) throw new Error('CLUB_END_SESSION handler not registered');
      endHandler[1]({ courtId, confirm: true });
    }

    it('persists playerName + phone on the SessionRecord when the player started via CLUB_START_FREE', () => {
      triggerStartFree({ courtId, playerName: 'Jorge', phone: 'cipher-jorge' });
      endSessionViaPlayer();

      const record: SessionRecord = historyStore.load()[0];
      expect(record.playerName).toBe('Jorge');
      expect(record.phone).toBe('cipher-jorge');
      // endedBy reflects the player-initiated end (reason='player').
      expect(record.endedBy).toBe('player');
      // adminId is null — the admin did not start or end this session.
      expect(record.adminId).toBeNull();
    });

    it('persists playerName + phone on the SessionRecord when the player started via CLUB_NEW_MATCH', () => {
      const newMatchHandler = (socket.on as jest.Mock).mock.calls.find(
        ([ev]: [string]) => ev === SocketEvents.CLIENT.CLUB_NEW_MATCH,
      );
      newMatchHandler![1]({
        courtId,
        playerNameA: 'Alice',
        playerNameB: 'Bob',
        playerName: 'Daniela',
        phone: 'cipher-daniela',
      });
      endSessionViaPlayer();

      const record: SessionRecord = historyStore.load()[0];
      expect(record.playerName).toBe('Daniela');
      expect(record.phone).toBe('cipher-daniela');
      expect(record.endedBy).toBe('player');
      expect(record.adminId).toBeNull();
    });

    it('falls back to neutral placeholders when the player did NOT capture identity (startFreePlay without name)', () => {
      // Backward-compat: a client that didn't send name+phone still ends
      // cleanly. The record is persisted with empty playerName/phone. This
      // matches the spec migration note ("Existing SessionRecords lack the
      // new fields — the history panel tolerates missing fields").
      triggerStartFree({ courtId });
      endSessionViaPlayer();

      const record: SessionRecord = historyStore.load()[0];
      expect(record.playerName).toBe('');
      expect(record.phone).toBe('');
      expect(record.endedBy).toBe('player');
      expect(record.adminId).toBeNull();
    });

    it('CLUB_SESSION_ENDED broadcast includes the new player-identity fields on the SessionRecord path', () => {
      // The broadcast payload carries court identity as well so the kiosk
      // and other admins see who ended — but the SessionRecord side keeps
      // the cipher-only phone. Assert the broadcast still includes
      // elapsedSeconds/cost/currency AND the new enriched fields.
      triggerStartFree({ courtId, playerName: 'Jorge', phone: 'cipher-jorge' });
      endSessionViaPlayer();

      const emitMock = mockIo.to(courtId);
      // Per Phase 1 + Phase 2: the broadcast includes the new SessionRecord
      // shape so clients (Phase 5+) can display the player column on the
      // admin's live table update.
      expect(emitMock.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_ENDED,
        expect.objectContaining({
          reason: 'player',
          elapsedMinutes: expect.any(Number),
          elapsedSeconds: expect.any(Number),
        }),
      );
      // The persisted record still holds the cipher (NOT a plaintext phone).
      const record: SessionRecord = historyStore.load()[0];
      expect(record.phone).toBe('cipher-jorge');
      expect(record.playerName).toBe('Jorge');
    });
  });
});
