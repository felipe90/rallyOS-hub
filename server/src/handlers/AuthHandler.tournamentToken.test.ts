/**
 * Test: AuthHandler.VERIFY_OWNER emits tournamentToken in OWNER_VERIFIED.
 *
 * Spec: jwt-session-persistence / capability tournament-owner-auth.
 * After VERIFY_OWNER succeeds, the server MUST sign a JWT and emit it
 * as `tournamentToken` (REQ-06). The token is a 3-segment base64url JWT
 * carrying role='tournament_owner' and sub='owner' — NOT a UUID.
 */

import { AuthHandler } from './AuthHandler';
import { SessionTokenService } from '../services/security/SessionTokenService';
import type { Server, Socket } from 'socket.io';
import type { CourtManager } from '../domain/courtManager';
import { SocketEvents } from '../../../shared/events';

// JWT shape: 3 base64url segments separated by dots.
const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;
const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function makeMockSocket(): Socket {
  const listeners = new Map<string, (...args: any[]) => void>();
  const emitted: Array<{ event: string; data: any }> = [];

  const socket: any = {
    id: 'mock-socket-id',
    data: { isOwner: false, isAuthenticated: false },
    handshake: { address: '127.0.0.1' },
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners.set(event, handler);
    }),
    emit: jest.fn((event: string, data: any) => {
      emitted.push({ event, data });
    }),
    join: jest.fn(),
    _listeners: listeners,
    _emitted: emitted,
    _trigger: (event: string, data: any) => {
      const handler = listeners.get(event);
      if (handler) handler(data);
    },
  };

  return socket as unknown as Socket;
}

describe('AuthHandler VERIFY_OWNER — tournamentToken (JWT)', () => {
  const TEST_SECRET = 'a'.repeat(64);
  let mockIo: Server;
  let mockTableManager: CourtManager;
  let socket: ReturnType<typeof makeMockSocket>;
  let sessionTokenService: SessionTokenService;
  let originalSecret: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    delete process.env.NODE_ENV;
    sessionTokenService = new SessionTokenService();

    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      engine: { clientsCount: 0 },
    } as unknown as Server;

    mockTableManager = {
      setReferee: jest.fn(),
      getTable: jest.fn(),
      getAllTables: jest.fn().mockReturnValue([]),
      isReferee: jest.fn(),
    } as unknown as CourtManager;

    socket = makeMockSocket();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('should emit OWNER_VERIFIED with tournamentToken as a 3-segment JWT', () => {
    const handler = new AuthHandler(mockIo as Server, mockTableManager, '12345678', sessionTokenService);
    handler.registerHandlers(socket as unknown as Socket);

    (socket as any)._trigger(SocketEvents.CLIENT.VERIFY_OWNER, { pin: '12345678' });

    const emitted = (socket as any)._emitted as Array<{ event: string; data: any }>;
    const ownerVerifiedEvent = emitted.find((e: { event: string; data: any }) => e.event === SocketEvents.SERVER.OWNER_VERIFIED);
    expect(ownerVerifiedEvent).toBeDefined();

    expect(ownerVerifiedEvent!.data.token).toBe('owner-session');
    const token = ownerVerifiedEvent!.data.tournamentToken;
    expect(typeof token).toBe('string');
    expect(token).toMatch(JWT_REGEX);
  });

  it('should produce a verifiable JWT with role=tournament_owner and sub=owner', () => {
    const handler = new AuthHandler(mockIo as Server, mockTableManager, '12345678', sessionTokenService);
    handler.registerHandlers(socket as unknown as Socket);

    (socket as any)._trigger(SocketEvents.CLIENT.VERIFY_OWNER, { pin: '12345678' });

    const emitted = (socket as any)._emitted as Array<{ event: string; data: any }>;
    const ownerVerifiedEvent = emitted.find((e: { event: string; data: any }) => e.event === SocketEvents.SERVER.OWNER_VERIFIED);
    const token = ownerVerifiedEvent!.data.tournamentToken;

    // Round-trip: the same service must verify the token it issued
    const claims = sessionTokenService.verifyToken(token);
    expect(claims).not.toBeNull();
    expect(claims!.role).toBe('tournament_owner');
    expect(claims!.sub).toBe('owner');
  });

  it('each segment must be base64url charset (no "=" "+" "/")', () => {
    const handler = new AuthHandler(mockIo as Server, mockTableManager, '12345678', sessionTokenService);
    handler.registerHandlers(socket as unknown as Socket);

    (socket as any)._trigger(SocketEvents.CLIENT.VERIFY_OWNER, { pin: '12345678' });

    const emitted = (socket as any)._emitted as Array<{ event: string; data: any }>;
    const ownerVerifiedEvent = emitted.find((e: { event: string; data: any }) => e.event === SocketEvents.SERVER.OWNER_VERIFIED);
    const segments = ownerVerifiedEvent!.data.tournamentToken.split('.');
    expect(segments).toHaveLength(3);
    for (const seg of segments) {
      expect(seg).toMatch(BASE64URL_SEGMENT);
      expect(seg).not.toContain('=');
      expect(seg).not.toContain('+');
      expect(seg).not.toContain('/');
    }
  });

  it('should NOT emit OWNER_VERIFIED when PIN is incorrect', () => {
    const handler = new AuthHandler(mockIo as Server, mockTableManager, '12345678', sessionTokenService);
    handler.registerHandlers(socket as unknown as Socket);

    (socket as any)._trigger(SocketEvents.CLIENT.VERIFY_OWNER, { pin: '00000000' });

    const emitted = (socket as any)._emitted as Array<{ event: string; data: any }>;
    const ownerVerifiedEvent = emitted.find((e: { event: string; data: any }) => e.event === SocketEvents.SERVER.OWNER_VERIFIED);
    expect(ownerVerifiedEvent).toBeUndefined();
  });
});