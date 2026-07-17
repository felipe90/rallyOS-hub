/**
 * SocketHandler — JWT reconnect middleware (io.use).
 *
 * Spec: jwt-session-persistence — REQ-07 (owner reconnect sets isOwner/
 * isAuthenticated) and REQ-11 (club admin reconnect sets isClubAdmin),
 * registered as a second io.use() AFTER the rate limiter, BEFORE
 * io.on('connection'). Invalid/expired/missing tokens MUST pass through
 * as unauthenticated (no flags, connection still accepted).
 */

import { SocketHandler } from './SocketHandler';
import { CourtManager } from '../domain/courtManager';
import { createTestCourtManager } from '../domain/courtManager.test-factory';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { SessionTokenService } from '../services/security/SessionTokenService';
import { SocketEvents } from '../../../shared/events';
import type { Socket } from 'socket.io';

const TEST_SECRET = 'a'.repeat(64);

function makeMockSocket(handshakeAuth: Record<string, unknown> = {}): any {
  return {
    id: 'test-socket-' + Math.random().toString(36).slice(2),
    handshake: { address: '127.0.0.1', auth: handshakeAuth },
    data: {},
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    rooms: new Set(),
  };
}

function makeMockIo(): any {
  return {
    to: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
    engine: { clientsCount: 0 },
  };
}

describe('SocketHandler — JWT reconnect middleware (REQ-07/11)', () => {
  let originalSecret: string | undefined;
  let originalNodeEnv: string | undefined;
  let sessionTokenService: SessionTokenService;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    delete process.env.NODE_ENV;
    sessionTokenService = new SessionTokenService();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  function buildHandler() {
    const io = makeMockIo();
    const courtManager = createTestCourtManager();
    const fakeFs: any = {
      writeFileSync: jest.fn(),
      readFileSync: jest.fn(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }),
      renameSync: jest.fn(),
      existsSync: jest.fn(() => false),
      mkdirSync: jest.fn(() => undefined),
      unlinkSync: jest.fn(),
    };
    const clubConfigStore = new ClubConfigStore(fakeFs);
    const handler = new SocketHandler(
      io as any,
      courtManager as CourtManager,
      '12345678',
      { ssid: 's', ip: '1', port: 3000, domain: 'd', wifiPassword: '' },
      clubConfigStore,
    );
    return { io, handler };
  }

  /** The JWT-reconnect middleware is the SECOND registered io.use. */
  function getReconnectMiddleware(io: any) {
    const useCalls = (io.use as jest.Mock).mock.calls;
    // First call = rate limiter; second call = JWT restore.
    expect(useCalls.length).toBeGreaterThanOrEqual(2);
    return useCalls[1][0] as (
      socket: any,
      next: (err?: Error) => void,
    ) => void;
  }

  it('sets isOwner=true, isAuthenticated=true for a valid tournament_owner JWT', () => {
    const { io } = buildHandler();
    const middleware = getReconnectMiddleware(io);

    const token = sessionTokenService.signToken({
      sub: 'owner',
      role: 'tournament_owner',
    });
    const socket = makeMockSocket({ sessionToken: token });
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith(); // no error — pass through
    expect((socket.data as any).isOwner).toBe(true);
    expect((socket.data as any).isAuthenticated).toBe(true);
  });

  it('sets isClubAdmin=true for a valid club_admin JWT', () => {
    const { io } = buildHandler();
    const middleware = getReconnectMiddleware(io);

    const token = sessionTokenService.signToken({
      sub: 'club-99',
      role: 'club_admin',
    });
    const socket = makeMockSocket({ sessionToken: token });
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect((socket.data as any).isClubAdmin).toBe(true);
  });

  it('passes through unauthenticated (no flags) when no sessionToken is sent', () => {
    const { io } = buildHandler();
    const middleware = getReconnectMiddleware(io);

    const socket = makeMockSocket({});
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect((socket.data as any).isOwner).toBeUndefined();
    expect((socket.data as any).isAuthenticated).toBeUndefined();
    expect((socket.data as any).isClubAdmin).toBeUndefined();
  });

  it('passes through unauthenticated when the JWT is expired beyond leeway', () => {
    const { io } = buildHandler();
    const middleware = getReconnectMiddleware(io);

    // Forge an expired token with a valid signature.
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'owner', role: 'tournament_owner', iat: now - 300, exp: now - 200 }),
    ).toString('base64url');
    const data = `${header}.${payload}`;
    const sig = require('crypto')
      .createHmac('sha256', TEST_SECRET)
      .update(data)
      .digest('base64url');
    const expired = `${data}.${sig}`;

    const socket = makeMockSocket({ sessionToken: expired });
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect((socket.data as any).isOwner).toBeUndefined();
  });

  it('passes through unauthenticated when the JWT is tampered', () => {
    const { io } = buildHandler();
    const middleware = getReconnectMiddleware(io);

    const token = sessionTokenService.signToken({
      sub: 'owner',
      role: 'tournament_owner',
    });
    const [h, p, s] = token.split('.');
    const tampered = `${h}.${p}X.${s}`;
    const socket = makeMockSocket({ sessionToken: tampered });
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect((socket.data as any).isOwner).toBeUndefined();
  });

  it('connects even with the legacy (non-JWT) sessionToken — passes through unauthenticated', () => {
    const { io } = buildHandler();
    const middleware = getReconnectMiddleware(io);

    const socket = makeMockSocket({ sessionToken: 'some-legacy-uuid' });
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect((socket.data as any).isOwner).toBeUndefined();
    expect((socket.data as any).isAuthenticated).toBeUndefined();
  });
});