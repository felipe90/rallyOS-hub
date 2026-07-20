/**
 * ClubAdminHandler — PIN-verify → history emit bridge (task 3.6).
 *
 * Spec (club-session-history apply-gotchas-pr2 #4): admin clients that
 * arrive without a JWT (no session restore) and verify via PIN do NOT
 * auto-receive CLUB_SESSION_HISTORY — the SocketHandler admin-connect
 * hook only fires for the JWT reconnect path. Task 3.6 closes the gap
 * by calling `historyHandler.sendHistoryToSocket(socket)` inside the
 * success branch of ClubAdminHandler.CLUB_VERIFY_ADMIN.
 *
 * The historyHandler dependency is OPTIONAL — older tests and code paths
 * that don't need session history still construct ClubAdminHandler
 * without it. Backward compatibility preserved (gotcha: do NOT silently
 * remove the no-history branch).
 */

import { ClubAdminHandler } from './ClubAdminHandler';
import { SessionTokenService } from '../services/security/SessionTokenService';
import type { Server, Socket } from 'socket.io';
import type { IClubConfigRepository } from '../domain/ports/IClubConfigRepository';
import { SocketEvents } from '../../../shared/events';

const TEST_SECRET = 'a'.repeat(64);

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

describe('ClubAdminHandler — PIN verify → history emit bridge (task 3.6)', () => {
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

  function buildHandler(historyHandler?: { sendHistoryToSocket: jest.Mock }) {
    return new ClubAdminHandler(
      mockIo,
      {} as any,
      '12345678',
      clubConfigStore,
      adminPinService as any,
      sessionTokenService,
      historyHandler as any,
    );
  }

  it('calls historyHandler.sendHistoryToSocket(socket) on PIN verify success when handler is injected', () => {
    const historyHandler = { sendHistoryToSocket: jest.fn() };
    const handler = buildHandler(historyHandler);
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    expect(historyHandler.sendHistoryToSocket).toHaveBeenCalledTimes(1);
    expect(historyHandler.sendHistoryToSocket).toHaveBeenCalledWith(socket);
  });

  it('does NOT call historyHandler on failed PIN verify', () => {
    (adminPinService.verifyPin as jest.Mock).mockReturnValue(false);
    const historyHandler = { sendHistoryToSocket: jest.fn() };
    const handler = buildHandler(historyHandler);
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    expect(historyHandler.sendHistoryToSocket).not.toHaveBeenCalled();
  });

  it('does NOT call historyHandler when club is not configured', () => {
    (clubConfigStore.load as jest.Mock).mockReturnValue({ configured: false });
    const historyHandler = { sendHistoryToSocket: jest.fn() };
    const handler = buildHandler(historyHandler);
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    expect(historyHandler.sendHistoryToSocket).not.toHaveBeenCalled();
  });

  it('still emits CLUB_ADMIN_VERIFIED with the JWT when historyHandler is injected (no regression)', () => {
    const historyHandler = { sendHistoryToSocket: jest.fn() };
    const handler = buildHandler(historyHandler);
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    const verified = (socket._emitted as any[]).find(
      (e) => e.event === SocketEvents.SERVER.CLUB_ADMIN_VERIFIED,
    );
    expect(verified).toBeDefined();
    expect(verified.data.success).toBe(true);
    expect(typeof verified.data.token).toBe('string');
  });

  it('works with NO historyHandler injected (backward-compat — older tests / non-history callers)', () => {
    const handler = buildHandler(undefined);
    const socket = makeMockSocket();
    handler.registerHandlers(socket as unknown as Socket);

    // Must not throw
    socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

    const verified = (socket._emitted as any[]).find(
      (e) => e.event === SocketEvents.SERVER.CLUB_ADMIN_VERIFIED,
    );
    expect(verified).toBeDefined();
    expect(verified.data.success).toBe(true);
  });
});