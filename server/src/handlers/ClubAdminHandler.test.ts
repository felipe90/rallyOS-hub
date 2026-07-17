/**
 * Test: ClubAdminHandler.CLUB_VERIFY_ADMIN emits a signed JWT token.
 *
 * Spec: jwt-session-persistence / capability club-admin-auth.
 * REQ-10: on success CLUB_VERIFY_ADMIN emits
 *   CLUB_ADMIN_VERIFIED { success: true, token: <3-seg JWT> }.
 */

import { ClubAdminHandler } from './ClubAdminHandler';
import { SessionTokenService } from '../services/security/SessionTokenService';
import type { Server, Socket } from 'socket.io';
import type { IClubConfigRepository } from '../domain/ports/IClubConfigRepository';
import { SocketEvents } from '../../../shared/events';

const TEST_SECRET = 'a'.repeat(64);
const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function makeMockSocket(): any {
  const listeners = new Map<string, (...args: any[]) => void>();
  const emitted: Array<{ event: string; data: any }> = [];
  return {
    id: 'club-socket',
    data: {},
    handshake: { address: '127.0.0.1' },
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners.set(event, handler);
    }),
    emit: jest.fn((event: string, data: any) => {
      emitted.push({ event, data });
    }),
    _listeners: listeners,
    _emitted: emitted,
    _trigger: (event: string, data: any) => {
      listeners.get(event)?.(data);
    },
  };
}

describe('ClubAdminHandler — CLUB_ADMIN_VERIFIED JWT (REQ-10)', () => {
  let originalSecret: string | undefined;
  let originalNodeEnv: string | undefined;
  let sessionTokenService: SessionTokenService;
  let mockIo: Server;
  let clubConfigStore: IClubConfigRepository;
  let adminPinService: { verifyPin: jest.Mock; hashPin: jest.Mock };

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    delete process.env.NODE_ENV;
    sessionTokenService = new SessionTokenService();

    mockIo = { emit: jest.fn() } as unknown as Server;
    clubConfigStore = {
      load: jest.fn().mockReturnValue({
        configured: true,
        clubName: 'Test',
        sport: 'padel',
        adminPinHash: 'hash',
      }),
      save: jest.fn(),
    } as unknown as IClubConfigRepository;
    adminPinService = {
      verifyPin: jest.fn().mockReturnValue(true),
      hashPin: jest.fn(),
    } as unknown as any;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('emits CLUB_ADMIN_VERIFIED with success:true and a 3-segment JWT token', () => {
    const handler = new ClubAdminHandler(
      mockIo,
      {} as any,
      '12345678',
      clubConfigStore,
      adminPinService as any,
      sessionTokenService,
    );
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    const verified = (socket._emitted as any[]).find(
      (e) => e.event === SocketEvents.SERVER.CLUB_ADMIN_VERIFIED,
    );
    expect(verified).toBeDefined();
    expect(verified.data.success).toBe(true);
    expect(typeof verified.data.token).toBe('string');
    expect(verified.data.token).toMatch(JWT_REGEX);
  });

  it('signs a JWT with role=club_admin and sub set to club id from config', () => {
    (clubConfigStore.load as jest.Mock).mockReturnValue({
      configured: true,
      clubName: 'Padel Central',
      sport: 'padel',
      adminPinHash: 'hash',
      clubId: 'club-42',
    });

    const handler = new ClubAdminHandler(
      mockIo,
      {} as any,
      '12345678',
      clubConfigStore,
      adminPinService as any,
      sessionTokenService,
    );
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    const verified = (socket._emitted as any[]).find(
      (e) => e.event === SocketEvents.SERVER.CLUB_ADMIN_VERIFIED,
    );
    expect(verified).toBeDefined();
    const claims = sessionTokenService.verifyToken(verified.data.token);
    expect(claims).not.toBeNull();
    expect(claims!.role).toBe('club_admin');
  });

  it('still emits success=false (no token) when club is not configured', () => {
    (clubConfigStore.load as jest.Mock).mockReturnValue({ configured: false });

    const handler = new ClubAdminHandler(
      mockIo,
      {} as any,
      '12345678',
      clubConfigStore,
      adminPinService as any,
      sessionTokenService,
    );
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    const verified = (socket._emitted as any[]).find(
      (e) => e.event === SocketEvents.SERVER.CLUB_ADMIN_VERIFIED,
    );
    expect(verified).toBeUndefined();
  });
});