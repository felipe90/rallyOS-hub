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
import { SPORT, CLUB_STATUS } from '../../../shared/types';
import type { ClubCourt } from '../domain/types';
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

// ═══════════════════════════════════════════════════════════════
// SocketHandler.onMatchEvent — club MATCH_WON post-match flow
// Spec: court stays OCCUPIED, server emits post-match state event
// ═══════════════════════════════════════════════════════════════

describe('SocketHandler.onMatchEvent — club MATCH_WON keeps OCCUPIED and emits post-match state (spec scenario 3)', () => {
  function buildMatchHandler() {
    const io: any = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      use: jest.fn(),
      on: jest.fn(),
      engine: { clientsCount: 0 },
    };
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
    new SocketHandler(
      io as any,
      courtManager as CourtManager,
      '12345678',
      { ssid: 's', ip: '1', port: 3000, domain: 'd', wifiPassword: '' },
      clubConfigStore,
    );

    // Simulate one client connection so all per-connection handler
    // `registerHandlers(socket)` methods run — that wiring installs the
    // onClubSessionEnd callback inside ClubPlayerHandler.
    const connectionCall = (io.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === 'connection',
    );
    expect(connectionCall).toBeDefined();
    const playerSocket = makeMockSocket({});
    (connectionCall![1] as (s: any) => void)(playerSocket);

    return { io, courtManager };
  }

  it('scenario 3: keeps the court OCCUPIED and emits MATCH_WON + MATCH_UPDATE to the room when a club match finishes', () => {
    const { io, courtManager } = buildMatchHandler();
    const court = courtManager.createClubCourt('Post-Match Club Court');
    courtManager.activateCourt(court.id);
    courtManager.occupyClubCourt(court.id, SPORT.TABLE_TENNIS);

    // Play 11 points so the TennisTable match finishes (MATCH_WON fires
    // through the engine via onMatchEvent wired by the SocketHandler ctor).
    for (let i = 0; i < 11; i++) {
      courtManager.recordPoint(court.id, 'A');
    }

    // Court STAYS OCCUPIED — the session is not auto-ended.
    const updated = courtManager.getCourt(court.id) as ClubCourt;
    expect(updated.clubStatus).toBe(CLUB_STATUS.OCCUPIED);

    // Server emitted MATCH_WON to the room
    const emitMock = io.to(court.id);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.MATCH_WON,
      expect.objectContaining({ courtId: court.id }),
    );

    // Server emitted MATCH_UPDATE to the room with the post-match matchState
    // (post-match state event drives the client's post-match modal in PR 4).
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.MATCH_UPDATE,
      expect.objectContaining({ status: 'FINISHED' }),
    );
  });

  it('scenario 10: admin force-end (CLUB_FORCE_END) transitions FINISHED and broadcasts CLUB_SESSION_ENDED with reason=force', () => {
    const { io, courtManager } = buildMatchHandler();
    const court = courtManager.createClubCourt('Force End Club Court');
    courtManager.activateCourt(court.id);
    courtManager.occupyClubCourt(court.id, SPORT.TABLE_TENNIS);

    // Simulate admin force-ending the session — same path that the
    // ClubCourtHandler.CLUB_FORCE_END handler calls.
    const ended = courtManager.forceEndSession(court.id);
    expect(ended).not.toBeNull();

    const updated = courtManager.getCourt(court.id) as ClubCourt;
    expect(updated.clubStatus).toBe(CLUB_STATUS.FINISHED);

    // The onClubSessionEnd callback (wired by SocketHandler's ClubPlayerHandler
    // sub-construction) must have broadcast CLUB_SESSION_ENDED with reason
    // "force".
    const emitMock = io.to(court.id);
    expect(emitMock.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.CLUB_SESSION_ENDED,
      expect.objectContaining({
        courtId: court.id,
        reason: 'force',
        elapsedMinutes: expect.any(Number),
        elapsedSeconds: expect.any(Number),
      }),
    );
  });

  it('scenario 9: all players disconnect — court stays OCCUPIED, players empty, occupiedAt preserved (timer continues)', () => {
    const { courtManager } = buildMatchHandler();
    const court = courtManager.createClubCourt('Disconnect Court');
    courtManager.activateCourt(court.id);
    courtManager.occupyClubCourt(court.id, SPORT.TABLE_TENNIS);
    const occupiedAtBefore = (courtManager.getCourt(court.id) as ClubCourt).occupiedAt;

    // Register a player socket as referee so it appears in court.players
    const playerSocketId = 'player-disconnect-socket';
    courtManager.registerClubReferee(court.id, playerSocketId);
    expect((courtManager.getCourt(court.id) as ClubCourt).players.length).toBeGreaterThan(0);

    // Simulate the disconnect path used by SocketHandler disconnect handler:
    // for each court where the socket is a player, remove it.
    const allCourts = courtManager.getAllCourts();
    for (const c of allCourts) {
      const courtObj = courtManager.getCourt(c.id);
      if (courtObj?.players.some(p => p.socketId === playerSocketId)) {
        courtManager.leaveTable(c.id, playerSocketId);
      }
    }

    const updated = courtManager.getCourt(court.id) as ClubCourt;
    // Spec scenario 9: court stays OCCUPIED (no auto-terminate)
    expect(updated.clubStatus).toBe(CLUB_STATUS.OCCUPIED);
    // "sin jugadores": no remaining players
    expect(updated.players).toEqual([]);
    // Timer continues — occupiedAt is preserved
    expect(updated.occupiedAt).toBe(occupiedAtBefore);
  });
});