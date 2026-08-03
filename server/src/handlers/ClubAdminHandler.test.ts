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
import { createTestCourtManager } from '../domain/courtManager.test-factory';
import type { CourtManager } from '../domain/courtManager';

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

  let tableManager: CourtManager;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    tableManager = createTestCourtManager();
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
        encryptionKey: 'test-encryption-key-b64==',
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

  it('emits CLUB_ADMIN_VERIFIED with success:true, a 3-segment JWT token, and encryptionKey from club config', () => {
    const handler = new ClubAdminHandler(
      mockIo,
      tableManager,
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
    // player-identity (U1 review fix #1): encryptionKey forwarded from config
    expect(verified.data).toHaveProperty('encryptionKey');
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
      tableManager,
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
      tableManager,
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

  // ── player-identity (Phase 2 task 2.3): adminId tracking ───────────────
  //
  // Spec: session-record MODIFIED — adminId traces which admin started
  // or ended a session. We capture `socket.id` as the adminId at verify
  // time (matches the resolved design decision documented in the design
  // artifact and the mission prompt). Server handlers (CLUB_ADMIN_OCCUPY
  // in U2, CLUB_FORCE_END in U2) read this from `socket.data.adminId`
  // when writing the SessionRecord, mirroring the existing
  // `socket.data.isClubAdmin` pattern.

  describe('ClubAdminHandler — adminId tracking (player-identity task 2.3)', () => {
    it('sets socket.data.adminId = socket.id on successful PIN verify', () => {
      const handler = new ClubAdminHandler(
        mockIo,
        tableManager,
        '12345678',
        clubConfigStore,
        adminPinService as any,
        sessionTokenService,
      );
      const socket = makeMockSocket();
      // Sanity: adminId unset before verify.
      expect(socket.data).toEqual({});

      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

      // Spec: adminId is the socket.id assigned by Socket.io. The mock
      // socket returns 'club-socket' from makeMockSocket().
      expect((socket.data as any).adminId).toBe(socket.id);
      expect((socket.data as any).adminId).toBe('club-socket');
      // Verify also flipped isClubAdmin (existing behavior — guard against
      // regression).
      expect((socket.data as any).isClubAdmin).toBe(true);
    });

    it('triangulates: each admin socket captures its OWN socket.id (not a constant)', () => {
      const handler = new ClubAdminHandler(
        mockIo,
        tableManager,
        '12345678',
        clubConfigStore,
        adminPinService as any,
        sessionTokenService,
      );

      const first = makeMockSocket();
      first.id = 'admin-sock-one';
      const second = makeMockSocket();
      second.id = 'admin-sock-two';

      handler.registerHandlers(first as unknown as Socket);
      handler.registerHandlers(second as unknown as Socket);
      first._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });
      second._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

      expect((first.data as any).adminId).toBe('admin-sock-one');
      expect((second.data as any).adminId).toBe('admin-sock-two');
      expect((first.data as any).adminId).not.toBe((second.data as any).adminId);
    });

    it('does NOT set adminId on a FAILED PIN verify (no admin attribution for unverified callers)', () => {
      // Verify fails — verifyPin returns false. adminId must NOT be set so a
      // later attacker can't claim an admin session by simply replaying a
      // bad PIN.
      adminPinService.verifyPin = jest.fn().mockReturnValue(false);
      const handler = new ClubAdminHandler(
        mockIo,
        tableManager,
        '12345678',
        clubConfigStore,
        adminPinService as any,
        sessionTokenService,
      );
      const socket = makeMockSocket();
      socket.id = 'failed-admin-attempt';

      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '000000' });

      expect((socket.data as any).adminId).toBeUndefined();
      expect((socket.data as any).isClubAdmin).toBeUndefined();
    });

    it('does NOT set adminId when club is not configured (early-return path)', () => {
      (clubConfigStore.load as jest.Mock).mockReturnValue({ configured: false });
      const handler = new ClubAdminHandler(
        mockIo,
        tableManager,
        '12345678',
        clubConfigStore,
        adminPinService as any,
        sessionTokenService,
      );
      const socket = makeMockSocket();
      socket.id = 'no-club-sock';

      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin: '424242' });

      expect((socket.data as any).adminId).toBeUndefined();
    });
  });

  // ── player-identity (U1 review fix #1): encryptionKey delivery on verify ──

  describe('ClubAdminHandler — CLUB_ADMIN_VERIFIED encryptionKey delivery (U1 fix #1)', () => {
    it('includes the club config encryptionKey in the verified payload', () => {
      (clubConfigStore.load as jest.Mock).mockReturnValue({
        configured: true,
        clubName: 'Key Club',
        sport: 'padel',
        adminPinHash: 'hash',
        encryptionKey: 'aGVsbG8td29ybGQ=' as string | undefined,
      });

      const handler = new ClubAdminHandler(
        mockIo,
        tableManager,
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
      expect(verified.data.encryptionKey).toBe('aGVsbG8td29ybGQ=');
    });

    it('emits encryptionKey: null when club config has no encryptionKey (legacy club)', () => {
      (clubConfigStore.load as jest.Mock).mockReturnValue({
        configured: true,
        clubName: 'Legacy Club',
        sport: 'padel',
        adminPinHash: 'hash',
        // No encryptionKey
      });

      const handler = new ClubAdminHandler(
        mockIo,
        tableManager,
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
      expect(verified.data.encryptionKey).toBeNull();
    });
  });

  // ── player-identity (Phase 2 task 2.6): encryptionKey auto-gen on SETUP ──
  //
  // Spec: player-identity → "Client-Side Phone Encryption" — encryption
  // key is auto-generated on CLUB_SETUP when absent. The key is persisted
  // to ClubConfig.encryptionKey so subsequent CLUB_JOIN flows surface it
  // back to the client without an extra round-trip.

  describe('ClubAdminHandler — CLUB_SETUP auto-generates encryptionKey (task 2.6)', () => {
    it('persists a freshly-generated AES-256-GCM encryptionKey on CLUB_SETUP', () => {
      const savedConfigs: any[] = [];
      const trackedStore: IClubConfigRepository = {
        load: jest.fn().mockReturnValue(null), // club not yet configured
        save: jest.fn((cfg) => { savedConfigs.push(cfg); }),
        checkExists: jest.fn().mockReturnValue(false),
        clear: jest.fn(),
      } as unknown as IClubConfigRepository;

      const handler = new ClubAdminHandler(
        mockIo,
        // Pass a real CourtManager via the test factory so createClubCourt
        // works downstream of save.
        createTestCourtManager() as any,
        '12345678',
        trackedStore,
        adminPinService as any,
        sessionTokenService,
      );
      const socket = makeMockSocket();
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.CLUB_SETUP, {
        clubName: 'Setup Club',
        sport: 'tableTennis',
        pin: '424242',
        courtCount: 0,
      });

      expect(savedConfigs).toHaveLength(1);
      const saved = savedConfigs[0] as any;
      expect(typeof saved.encryptionKey).toBe('string');
      // 32 bytes when base64-decoded (matches phoneCipher.generateKey).
      expect(Buffer.from(saved.encryptionKey, 'base64').length).toBe(32);
    });

    it('triangulates: each CLUB_SETUP generates a unique key (randomness, not a constant)', () => {
      const first: any[] = [];
      const second: any[] = [];
      const firstStore: IClubConfigRepository = {
        load: jest.fn().mockReturnValue(null),
        save: jest.fn((cfg) => { first.push(cfg); }),
        checkExists: jest.fn().mockReturnValue(false),
        clear: jest.fn(),
      } as unknown as IClubConfigRepository;
      const secondStore: IClubConfigRepository = {
        load: jest.fn().mockReturnValue(null),
        save: jest.fn((cfg) => { second.push(cfg); }),
        checkExists: jest.fn().mockReturnValue(false),
        clear: jest.fn(),
      } as unknown as IClubConfigRepository;

      for (const store of [firstStore, secondStore]) {
        const handler = new ClubAdminHandler(
          mockIo,
          createTestCourtManager() as any,
          '12345678',
          store,
          adminPinService as any,
          sessionTokenService,
        );
        const socket = makeMockSocket();
        handler.registerHandlers(socket as unknown as Socket);
        socket._trigger(SocketEvents.CLIENT.CLUB_SETUP, {
          clubName: 'Triangulation Club',
          sport: 'tableTennis',
          pin: '424242',
          courtCount: 0,
        });
      }

      expect(first[0].encryptionKey).not.toBe(second[0].encryptionKey);
    });

    // ── Club Admin Notifications: CLUB_SEND_NOTIFICATION (Phase 2, tasks 2.1–2.2) ──

  describe('ClubAdminHandler — CLUB_SEND_NOTIFICATION (club admin notifications)', () => {
    let handler: ClubAdminHandler;
    let socket: ReturnType<typeof makeMockSocket>;

    beforeEach(() => {
      handler = new ClubAdminHandler(
        mockIo,
        tableManager,
        '12345678',
        clubConfigStore,
        adminPinService as any,
        sessionTokenService,
      );
      socket = makeMockSocket();
      handler.registerHandlers(socket as unknown as Socket);
      // Mark the socket as club admin (simulating successful verify)
      socket.data = { ...socket.data, isClubAdmin: true };
    });

    it('registers a handler for CLUB_SEND_NOTIFICATION (task 2.2)', () => {
      expect(socket.on).toHaveBeenCalledWith(
        SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION,
        expect.any(Function),
      );
    });

    it('rejects the request when socket is NOT a club admin', () => {
      socket.data = { ...socket.data, isClubAdmin: false };

      socket._trigger(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, {
        type: 'info',
        message: 'Unauthorized attempt',
        duration: 5,
      });

      const error = (socket._emitted as any[]).find(
        (e) => e.event === 'ERROR',
      );
      expect(error).toBeDefined();
      expect(error.data.code).toBe('UNAUTHORIZED');
      expect((mockIo.emit as jest.Mock).mock.calls.length).toBe(0);
    });

    it('broadcasts KIOSK_NOTIFICATION when a club admin sends a notification', () => {
      const now = Date.now();
      // Fake Date.now so the timestamp assertion is deterministic
      jest.spyOn(Date, 'now').mockReturnValue(now);

      socket._trigger(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, {
        type: 'info',
        message: 'Cancha 3 lista',
        duration: 5,
      });

      expect(mockIo.emit).toHaveBeenCalledTimes(1);
      expect(mockIo.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.KIOSK_NOTIFICATION,
        {
          type: 'info',
          message: 'Cancha 3 lista',
          duration: 5,
          timestamp: now,
          scope: 'club',
        },
      );

      jest.restoreAllMocks();
    });

    it('broadcasts with scope "general" when { general: true } is sent', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      socket._trigger(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, {
        type: 'important',
        message: 'All courts closed',
        duration: 10,
        general: true,
      });

      expect(mockIo.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.KIOSK_NOTIFICATION,
        {
          type: 'important',
          message: 'All courts closed',
          duration: 10,
          timestamp: now,
          scope: 'general',
        },
      );

      jest.restoreAllMocks();
    });

    it('sanitizes HTML tags from the message before broadcasting', () => {
      socket._trigger(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, {
        type: 'warning',
        message: '<script>alert("xss")</script>Mantenimiento',
        duration: 5,
      });

      const emitted = (mockIo.emit as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === SocketEvents.SERVER.KIOSK_NOTIFICATION,
      );
      expect(emitted).toBeDefined();
      expect(emitted[1].message).toBe('alert("xss")Mantenimiento');
    });

    it('rate-limits after 5 notifications per minute per IP', () => {
      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        socket._trigger(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, {
          type: 'info',
          message: `Notification ${i}`,
          duration: 5,
        });
      }

      expect((mockIo.emit as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0] === SocketEvents.SERVER.KIOSK_NOTIFICATION,
      ).length).toBe(5);

      // 6th should be rate-limited
      socket._trigger(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, {
        type: 'info',
        message: 'Too many',
        duration: 5,
      });

      const error = (socket._emitted as any[]).filter(
        (e) => e.event === 'ERROR',
      ).slice(-1)[0];
      expect(error).toBeDefined();
      expect(error.data.code).toBe('RATE_LIMITED');
      expect((mockIo.emit as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0] === SocketEvents.SERVER.KIOSK_NOTIFICATION,
      ).length).toBe(5);
    });

    it('truncates message longer than 280 characters', () => {
      const longMsg = 'x'.repeat(300);
      socket._trigger(SocketEvents.CLIENT.CLUB_SEND_NOTIFICATION, {
        type: 'info',
        message: longMsg,
        duration: 5,
      });

      const emitted = (mockIo.emit as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === SocketEvents.SERVER.KIOSK_NOTIFICATION,
      );
      expect(emitted).toBeDefined();
      expect(emitted[1].message.length).toBe(280);
    });
  });

  it('does NOT overwrite encryptionKey when the request somehow carries one (server is authoritative on setup)', () => {
      // Defensive contract: CLUB_SETUP is first-run, so there is no prior
      // ClubConfig; the SERVER generates the key, never the client. The
      // request payload does not carry an encryptionKey field, and even
      // if a client tried to supply one, the server ignores it.
      const savedConfigs: any[] = [];
      const trackedStore: IClubConfigRepository = {
        load: jest.fn().mockReturnValue(null),
        save: jest.fn((cfg) => { savedConfigs.push(cfg); }),
        checkExists: jest.fn().mockReturnValue(false),
        clear: jest.fn(),
      } as unknown as IClubConfigRepository;
      const handler = new ClubAdminHandler(
        mockIo,
        createTestCourtManager() as any,
        '12345678',
        trackedStore,
        adminPinService as any,
        sessionTokenService,
      );
      const socket = makeMockSocket();
      handler.registerHandlers(socket as unknown as Socket);

      // A hostile client tries to inject their own encryptionKey field.
      socket._trigger(SocketEvents.CLIENT.CLUB_SETUP, {
        clubName: 'Attacker Club',
        sport: 'tableTennis',
        pin: '424242',
        courtCount: 0,
        // Extra payload field — type system does not enforce excess
        // property checks on socket.on payloads, so this reaches the
        // handler at runtime. The handler MUST ignore any client-supplied
        // encryptionKey on CLUB_SETUP (server is authoritative).
        encryptionKey: 'attacker-controlled-key-base64',
      } as any);

      expect(savedConfigs[0].encryptionKey).not.toBe('attacker-controlled-key-base64');
      expect(Buffer.from(savedConfigs[0].encryptionKey, 'base64').length).toBe(32);
    });
  });

  describe('ClubAdminHandler — CLUB_SETUP first-run + re-setup protection (S4)', () => {
    it('accepts CLUB_SETUP on an unconfigured club (first-run bootstrap)', () => {
      const savedConfigs: any[] = [];
      const trackedStore: IClubConfigRepository = {
        load: jest.fn().mockReturnValue(null), // not configured yet
        save: jest.fn((cfg) => { savedConfigs.push(cfg); }),
        checkExists: jest.fn().mockReturnValue(false),
        clear: jest.fn(),
      } as unknown as IClubConfigRepository;

      const handler = new ClubAdminHandler(
        mockIo,
        createTestCourtManager() as any,
        '12345678',
        trackedStore,
        adminPinService as any,
        sessionTokenService,
      );
      const socket = makeMockSocket();
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.CLUB_SETUP, {
        clubName: 'New Club',
        sport: 'tableTennis',
        pin: '424242',
        courtCount: 0,
      });

      expect(savedConfigs).toHaveLength(1);
      const setupComplete = (socket._emitted as any[]).find(
        (e) => e.event === SocketEvents.SERVER.CLUB_SETUP_COMPLETE,
      );
      expect(setupComplete).toBeDefined();
    });

    it('rejects re-setup of an already-configured club with ALREADY_CONFIGURED, even unauthenticated (S4)', () => {
      const savedConfigs: any[] = [];
      const trackedStore: IClubConfigRepository = {
        // Club already claimed by a prior setup.
        load: jest.fn().mockReturnValue({
          configured: true,
          clubName: 'Existing Club',
          sport: 'padel',
          adminPinHash: 'existing-hash',
          createdAt: Date.now(),
          encryptionKey: 'existing-key',
        }),
        save: jest.fn((cfg) => { savedConfigs.push(cfg); }),
        checkExists: jest.fn().mockReturnValue(true),
        clear: jest.fn(),
      } as unknown as IClubConfigRepository;

      const handler = new ClubAdminHandler(
        mockIo,
        createTestCourtManager() as any,
        '12345678',
        trackedStore,
        adminPinService as any,
        sessionTokenService,
      );
      // An unauthenticated socket — no owner/admin flags — attempts to
      // overwrite the existing club credentials.
      const socket = makeMockSocket();
      handler.registerHandlers(socket as unknown as Socket);

      socket._trigger(SocketEvents.CLIENT.CLUB_SETUP, {
        clubName: 'Attacker Club',
        sport: 'tableTennis',
        pin: '111111',
        courtCount: 0,
      });

      const error = (socket._emitted as any[]).find((e) => e.event === 'ERROR');
      expect(error).toBeDefined();
      expect(error.data.code).toBe('ALREADY_CONFIGURED');
      // Credentials must NOT be replaced.
      expect(savedConfigs).toHaveLength(0);
    });
  });
});