/**
 * ClubCourtHandler tests — Phase 3 (U2) admin occupy flow.
 *
 * Spec: `admin-session-start` — admin "Iniciar sesión" modal occupies a
 * RESERVED court with player name + phone + mode. The server transitions
 * RESERVED → OCCUPIED, starts the timer, stores playerName/phone/adminId
 * on the court, and the kiosk update surfaces playerName. The PIN stays
 * valid through the transition (the player can still QR-join later for
 * reconnection). See `player-identity` spec (admin-session-start).
 *
 * Scope (U2):
 *   - CLUB_ADMIN_OCCUPY happy path (RESERVED → OCCUPIED, fields stored,
 *     timer started, kiosk broadcast carries playerName)
 *   - Non-admin → UNAUTHORIZED + no state change
 *   - Court not RESERVED (AVAILABLE / FINISHED) → OCCUPY_FAILED + no change
 *   - Missing socket.data.adminId → UNAUTHORIZED + no change (covers the
 *     JWT-restore gap warning from U1 review — fixed in task 3.2)
 *
 * Not asserted here (other tasks):
 *   - SessionHistoryStore lock+dedup (3.3 / 3.4)
 *   - admin force-end endedBy='admin' (3.5 / 3.6)
 *   - Phone reveal (4.x)
 */

import { ClubCourtHandler } from './ClubCourtHandler';
import { CourtManager } from '../domain/courtManager';
import { createTestCourtManager } from '../domain/courtManager.test-factory';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { SocketEvents } from '../../../shared/events';
import { SPORT, CLUB_STATUS } from '../../../shared/types';
import type { Socket } from 'socket.io';
import type { FileSystem } from '../services/store/types';

// ── Fake FileSystem for ClubConfigStore DI ──────────────────────────────

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

// ── Mock socket / io ────────────────────────────────────────────────────

interface MockSocket {
  id: string;
  data: any;
  on: jest.Mock;
  emit: jest.Mock;
  _listeners: Map<string, (...args: any[]) => void>;
  _trigger: (event: string, ...args: any[]) => void;
}

function createMockSocket(id: string, data: any = {}): MockSocket {
  const listeners = new Map<string, (...args: any[]) => void>();
  return {
    id,
    data,
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners.set(event, handler);
    }),
    emit: jest.fn(),
    _listeners: listeners,
    _trigger: (event: string, ...args: any[]) => {
      listeners.get(event)?.(...args);
    },
  } as any;
}

function createMockIo(): any {
  const io: any = {
    emit: jest.fn(),
    to: jest.fn(function (this: any) { return this; }),
    in: jest.fn(function (this: any) { return this; }),
    engine: { clientsCount: 0 },
    use: jest.fn(),
    on: jest.fn(),
    sockets: { sockets: new Map() },
  };
  return io;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const OWNER_PIN = '123456';

function setupClubConfig(sport: 'tableTennis' | 'padel' = 'tableTennis'): ClubConfigStore {
  const fs = createFakeFs();
  fs._files.set(
    'data/club-config.json',
    JSON.stringify({
      clubName: 'Occupy Club',
      sport: sport === 'padel' ? SPORT.PADEL : SPORT.TABLE_TENNIS,
      adminPinHash: 'dummy-hash',
      configured: true,
      createdAt: Date.now(),
      costPerMinute: 50,
      currency: 'ARS',
      encryptionKey: 'ccccCCCC22aa==',
    }),
  );
  return new ClubConfigStore(fs, 'data/club-config.json');
}

// Wire courtManager.onTableUpdate so notifyUpdate broadcasts the kiosk
// payload via mockIo — mirrors production SocketHandler.onTableUpdate.
function wireKioskBroadcast(manager: CourtManager, clubConfigStore: ClubConfigStore, io: any): void {
  manager.onTableUpdate = () => {
    const clubConfig = clubConfigStore.load();
    const payload = manager.getClubKioskPayload(clubConfig);
    io.emit(SocketEvents.SERVER.CLUB_KIOSK_DATA, payload);
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('ClubCourtHandler — CLUB_ADMIN_OCCUPY (Phase 3 task 3.1)', () => {
  let manager: CourtManager;
  let clubConfigStore: ClubConfigStore;
  let io: any;
  let handler: ClubCourtHandler;

  beforeEach(() => {
    io = createMockIo();
    manager = createTestCourtManager();
    clubConfigStore = setupClubConfig();
    wireKioskBroadcast(manager, clubConfigStore, io);
    handler = new ClubCourtHandler(io, manager, OWNER_PIN, clubConfigStore);
  });

  function triggerOccupy(socket: MockSocket, payload: any) {
    socket._trigger(SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY, payload);
  }

  describe('happy path — RESERVED → OCCUPIED with player identity', () => {
    beforeEach(() => {
      // Create + activate a club court → RESERVED with a PIN.
      const court = manager.createClubCourt('Occupy Court');
      manager.activateCourt(court.id);
    });

    function getReservedCourtId(): string {
      const courts = manager.getClubCourts();
      const reserved = courts.find((c) => c.clubStatus === CLUB_STATUS.RESERVED);
      if (!reserved) throw new Error('no RESERVED court found in fixture');
      return reserved.id;
    }

    it('transitions the court from RESERVED to OCCUPIED', () => {
      const socket = createMockSocket('admin-1', { isClubAdmin: true, adminId: 'admin-1' });
      handler.registerHandlers(socket as unknown as Socket);

      const courtId = getReservedCourtId();
      triggerOccupy(socket, {
        courtId,
        playerName: 'Lucía',
        phone: 'enc:nonce:body:tag',
        mode: 'free',
      });

      const court = manager.getCourt(courtId);
      expect(court).toBeDefined();
      expect((court as any).clubStatus).toBe(CLUB_STATUS.OCCUPIED);
    });

    it('stores playerName, phone, and adminId on the court', () => {
      const socket = createMockSocket('admin-2', { isClubAdmin: true, adminId: 'admin-2' });
      handler.registerHandlers(socket as unknown as Socket);

      const courtId = getReservedCourtId();
      triggerOccupy(socket, {
        courtId,
        playerName: 'Mario',
        phone: 'enc:NNN:BBB:TTT',
        mode: 'match',
      });

      const court = manager.getCourt(courtId) as any;
      expect(court.playerName).toBe('Mario');
      expect(court.phone).toBe('enc:NNN:BBB:TTT');
      // adminId comes from socket.data.adminId (set at CLUB_VERIFY_ADMIN or
      // at JWT restore — see task 3.2 fix for applySessionClaims).
      expect(court.adminId).toBe('admin-2');
    });

    it('starts the timer — sets occupiedAt to a fresh epoch ms (non-null, recent)', () => {
      const socket = createMockSocket('admin-3', { isClubAdmin: true, adminId: 'admin-3' });
      handler.registerHandlers(socket as unknown as Socket);

      const courtId = getReservedCourtId();
      const before = Date.now();
      triggerOccupy(socket, {
        courtId,
        playerName: 'Paula',
        phone: 'enc',
        mode: 'free',
      });
      const after = Date.now();

      const court = manager.getCourt(courtId) as any;
      expect(court.occupiedAt).not.toBeNull();
      expect(typeof court.occupiedAt).toBe('number');
      // Timer was set within this tick window.
      expect(court.occupiedAt).toBeGreaterThanOrEqual(before);
      expect(court.occupiedAt).toBeLessThanOrEqual(after);
    });

    it('sets sessionMode from the payload (free or match)', () => {
      const socketFree = createMockSocket('admin-4', { isClubAdmin: true, adminId: 'admin-4' });
      handler.registerHandlers(socketFree as unknown as Socket);
      const courtIdFree = getReservedCourtId();
      triggerOccupy(socketFree, {
        courtId: courtIdFree,
        playerName: 'Free Player',
        phone: 'enc',
        mode: 'free',
      });
      expect((manager.getCourt(courtIdFree) as any).sessionMode).toBe('free');

      // Triangulate: a second court + match mode picks the other branch.
      const court2 = manager.createClubCourt('Occupy Court 2');
      manager.activateCourt(court2.id);
      const socketMatch = createMockSocket('admin-5', { isClubAdmin: true, adminId: 'admin-5' });
      handler.registerHandlers(socketMatch as unknown as Socket);
      triggerOccupy(socketMatch, {
        courtId: court2.id,
        playerName: 'Match Player',
        phone: 'enc',
        mode: 'match',
      });
      expect((manager.getCourt(court2.id) as any).sessionMode).toBe('match');
    });

    it('emits CLUB_KIOSK_DATA broadcast carrying the player name (kiosk shows playerName)', () => {
      const socket = createMockSocket('admin-6', { isClubAdmin: true, adminId: 'admin-6' });
      handler.registerHandlers(socket as unknown as Socket);

      const courtId = getReservedCourtId();
      triggerOccupy(socket, {
        courtId,
        playerName: 'Kiosk Visible',
        phone: 'enc',
        mode: 'free',
      });

      // Find the LAST CLUB_KIOSK_DATA broadcast on the global io emitter.
      // `activateCourt` (in beforeEach) also triggers a broadcast where the
      // court is still RESERVED and has no playerName; we want the
      // post-occupy one that carries the player's name.
      const kioskCalls = (io.emit as jest.Mock).mock.calls.filter(
        ([event]: [string]) => event === SocketEvents.SERVER.CLUB_KIOSK_DATA,
      );
      expect(kioskCalls.length).toBeGreaterThan(0);
      const lastKiosk = kioskCalls[kioskCalls.length - 1];
      const payload = lastKiosk[1];
      const court = payload.courts.find((c: any) => c.id === courtId);
      expect(court).toBeDefined();
      // Spec: "Kiosk Player Name Display" — playerName appears on the
      // court card only when the court is OCCUPIED.
      expect(court.playerName).toBe('Kiosk Visible');
      expect(court.status).toBe(CLUB_STATUS.OCCUPIED);
    });

    it('keeps the PIN valid through RESERVED → OCCUPIED (player can still re-join via PIN for reconnect)', () => {
      // Spec admin-session-start: "The PIN SHALL remain valid."
      const socket = createMockSocket('admin-7', { isClubAdmin: true, adminId: 'admin-7' });
      handler.registerHandlers(socket as unknown as Socket);
      const courtId = getReservedCourtId();
      const reservedCourt = manager.getCourt(courtId) as any;
      const pinBefore = reservedCourt.pin;
      expect(pinBefore).toBeTruthy();

      triggerOccupy(socket, {
        courtId,
        playerName: 'Pin Stays',
        phone: 'enc',
        mode: 'free',
      });

      const occupiedCourt = manager.getCourt(courtId) as any;
      expect(occupiedCourt.pin).toBe(pinBefore);
      expect(occupiedCourt.pin.length).toBeGreaterThan(0);
    });
  });

  describe('authorization — non-admin and unattributed sockets', () => {
    beforeEach(() => {
      const court = manager.createClubCourt('Auth Court');
      manager.activateCourt(court.id);
    });

    function getReservedCourtId(): string {
      const courts = manager.getClubCourts();
      const reserved = courts.find((c) => c.clubStatus === CLUB_STATUS.RESERVED)!;
      return reserved.id;
    }

    it('rejects a non-admin socket with UNAUTHORIZED and leaves the court RESERVED', () => {
      const socket = createMockSocket('non-admin', { isClubAdmin: false });
      handler.registerHandlers(socket as unknown as Socket);
      const courtId = getReservedCourtId();

      triggerOccupy(socket, {
        courtId,
        playerName: 'Should Not Happen',
        phone: 'enc',
        mode: 'free',
      });

      // Spec: non-admin receives an UNAUTHORIZED error.
      expect(socket.emit).toHaveBeenCalledWith(
        'ERROR',
        expect.objectContaining({ code: 'UNAUTHORIZED' }),
      );
      // Court unchanged.
      expect((manager.getCourt(courtId) as any).clubStatus).toBe(CLUB_STATUS.RESERVED);
      expect((manager.getCourt(courtId) as any).playerName).toBeNull();
    });

    it('rejects an admin socket without socket.data.adminId with UNAUTHORIZED (covers the JWT-restore gap)', () => {
      // U1 review warning #2: applySessionClaims (JWT restore) sets
      // isClubAdmin but NOT adminId. Task 3.2 fix closes that gap; this
      // test asserts the server refuses to attribute an occupy to an
      // anonymous admin even if isClubAdmin === true.
      const socket = createMockSocket('restored-admin', { isClubAdmin: true /* no adminId */ });
      handler.registerHandlers(socket as unknown as Socket);
      const courtId = getReservedCourtId();

      triggerOccupy(socket, {
        courtId,
        playerName: 'Anonymous Admin',
        phone: 'enc',
        mode: 'free',
      });

      // The handler MUST refuse — no adminId means we can't attribute the
      // SessionRecord.adminId. Either UNAUTHORIZED or a dedicated
      // "ADMIN_IDENTITY_REQUIRED" code is acceptable; assert non-success.
      const errorCalls = (socket.emit as jest.Mock).mock.calls.filter(
        ([event]: [string]) => event === 'ERROR',
      );
      expect(errorCalls.length).toBeGreaterThan(0);
      expect((manager.getCourt(courtId) as any).clubStatus).toBe(CLUB_STATUS.RESERVED);
      // No phone written to the court — refusal happened before any state change.
      expect((manager.getCourt(courtId) as any).phone).toBeNull();
    });
  });

  describe('state guard — admin-occupy auto-activates AVAILABLE courts', () => {
    it('auto-activates and occupies when the court is AVAILABLE (single-step admin flow)', () => {
      const socket = createMockSocket('admin-avail', { isClubAdmin: true, adminId: 'admin-avail' });
      handler.registerHandlers(socket as unknown as Socket);
      const court = manager.createClubCourt('Avail Court');
      // Available — no activation. Server auto-activates + occupies.

      triggerOccupy(socket, {
        courtId: court.id,
        playerName: 'Ana',
        phone: 'enc:ABC',
        mode: 'free',
      });

      // Court should now be OCCUPIED with player identity set.
      const occupied = manager.getCourt(court.id) as any;
      expect(occupied.clubStatus).toBe(CLUB_STATUS.OCCUPIED);
      expect(occupied.playerName).toBe('Ana');
      expect(occupied.phone).toBe('enc:ABC');
      expect(socket.emit).not.toHaveBeenCalledWith(
        'ERROR',
        expect.objectContaining({ code: 'OCCUPY_FAILED' }),
      );
    });

    it('triangulates: returns OCCUPY_FAILED when the court is already OCCUPIED (double-occupy rejected)', () => {
      const socket = createMockSocket('admin-dbl', { isClubAdmin: true, adminId: 'admin-dbl' });
      handler.registerHandlers(socket as unknown as Socket);

      const court = manager.createClubCourt('Dbl Court');
      manager.activateCourt(court.id);
      // Player flow takes it to OCCUPIED first.
      manager.occupyClubCourt(court.id, SPORT.TABLE_TENNIS);

      triggerOccupy(socket, {
        courtId: court.id,
        playerName: 'Second Occupy',
        phone: 'enc',
        mode: 'free',
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'ERROR',
        expect.objectContaining({ code: 'OCCUPY_FAILED' }),
      );
      // Player-flow occupy nulls player identity fields; the failed admin
      // occupy MUST NOT have mutated them further.
      expect((manager.getCourt(court.id) as any).playerName).toBeNull();
    });
  });

  describe('validation — payload shape', () => {
    beforeEach(() => {
      const court = manager.createClubCourt('Validation Court');
      manager.activateCourt(court.id);
    });

    function getReservedCourtId(): string {
      const courts = manager.getClubCourts();
      return courts.find((c) => c.clubStatus === CLUB_STATUS.RESERVED)!.id;
    }

    it('rejects an invalid `mode` value with a VALIDATION error and no state change', () => {
      const socket = createMockSocket('admin-mode', { isClubAdmin: true, adminId: 'admin-mode' });
      handler.registerHandlers(socket as unknown as Socket);
      const courtId = getReservedCourtId();

      triggerOccupy(socket, {
        courtId,
        playerName: 'Bad Mode',
        phone: 'enc',
        mode: 'tournament', // only 'free' | 'match' accepted
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'ERROR',
        expect.objectContaining({ code: 'VALIDATION_ERROR', field: 'mode' }),
      );
      expect((manager.getCourt(courtId) as any).clubStatus).toBe(CLUB_STATUS.RESERVED);
    });

    it('rejects when courtId is missing (required field validation)', () => {
      const socket = createMockSocket('admin-no-id', { isClubAdmin: true, adminId: 'admin-no-id' });
      handler.registerHandlers(socket as unknown as Socket);

      triggerOccupy(socket, {
        playerName: 'No Court',
        phone: 'enc',
        mode: 'free',
      });

      const errorCalls = (socket.emit as jest.Mock).mock.calls.filter(
        ([event]: [string]) => event === 'ERROR',
      );
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][1].field).toBe('courtId');
    });
  });

  // ── CLUB_FORCE_END (Phase 3 task 3.5) ─────────────────────────────────
  //
  // Spec (`session-record` MODIFIED + admin traceability): an admin
  // force-ending a court MUST attribute the action — the SessionRecord
  // built on end carries `endedBy='admin'` AND `adminId=<socket.data.adminId>`.
  // Before this change, a PLAYER-occupied court (court.adminId=null) force-
  // ended by an admin produced `endedBy='admin'` but `adminId=null` — the
  // admin action was unattributed.
  //
  // Guard contract: a non-admin socket OR an admin socket missing
  // socket.data.adminId MUST be refused with UNAUTHORIZED and MUST NOT
  // transition the court (no SessionRecord produced, no admin stamping).

  describe('CLUB_FORCE_END (Phase 3 task 3.5)', () => {
    function getOccupiedCourtId(): string {
      const court = manager.createClubCourt('Force End Court');
      manager.activateCourt(court.id);
      manager.occupyClubCourt(court.id, SPORT.TABLE_TENNIS);
      return court.id;
    }

    function triggerForceEnd(socket: MockSocket, payload: any) {
      socket._trigger(SocketEvents.CLIENT.CLUB_FORCE_END, payload);
    }

    it('admin force-end stamps the court.adminId with socket.data.adminId (observable before court resets)', () => {
      // Observe the adminId via the onClubSessionEnd callback — the
      // callback fires synchronously inside forceEndSession, so the stamp
      // is visible there. This is the same seam ClubPlayerHandler uses to
      // build the SessionRecord (court.adminId → record.adminId).
      const adminIdSeen: string[] = [];
      manager.onClubSessionEnd = (courtId) => {
        const c = manager.getCourt(courtId) as any;
        adminIdSeen.push(c?.adminId ?? null);
      };

      const courtId = getOccupiedCourtId(); // player-flow occupy → adminId null
      const socket = createMockSocket('admin-fe-1', { isClubAdmin: true, adminId: 'admin-fe-1' });
      handler.registerHandlers(socket as unknown as Socket);

      triggerForceEnd(socket, { courtId });

      // endedBy='admin' is derived from reason='force' inside ClubPlayerHandler;
      // the assertion the apply layer owns here is that adminId is attributed.
      expect(adminIdSeen).toContain('admin-fe-1');
    });

    it('rejects a non-admin socket with UNAUTHORIZED and leaves the court OCCUPIED (no admin stamping)', () => {
      const courtId = getOccupiedCourtId();
      const socket = createMockSocket('non-admin-fe', { isClubAdmin: false });
      handler.registerHandlers(socket as unknown as Socket);

      let callbackFired = false;
      manager.onClubSessionEnd = () => { callbackFired = true; };

      triggerForceEnd(socket, { courtId });

      expect(socket.emit).toHaveBeenCalledWith(
        'ERROR',
        expect.objectContaining({ code: 'UNAUTHORIZED' }),
      );
      expect(callbackFired).toBe(false);
      // Court unchanged — still OCCUPIED, still null adminId (player flow).
      expect((manager.getCourt(courtId) as any).clubStatus).toBe(CLUB_STATUS.OCCUPIED);
      expect((manager.getCourt(courtId) as any).adminId).toBeNull();
    });

    it('rejects an admin socket WITHOUT socket.data.adminId with UNAUTHORIZED (covers the JWT-restore gap for force-end)', () => {
      // Mirrors the CLUB_ADMIN_OCCUPY guard: isClubAdmin===true but no
      // adminId → refuse, because an unattributed force-end would leave
      // SessionRecord.adminId null even though endedBy='admin'.
      const courtId = getOccupiedCourtId();
      const socket = createMockSocket('restored-admin-fe', { isClubAdmin: true /* no adminId */ });
      handler.registerHandlers(socket as unknown as Socket);

      let callbackFired = false;
      manager.onClubSessionEnd = () => { callbackFired = true; };

      triggerForceEnd(socket, { courtId });

      const errorCalls = (socket.emit as jest.Mock).mock.calls.filter(
        ([event]: [string]) => event === 'ERROR',
      );
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][1].code).toBe('UNAUTHORIZED');
      expect(callbackFired).toBe(false);
      expect((manager.getCourt(courtId) as any).clubStatus).toBe(CLUB_STATUS.OCCUPIED);
    });
  });
});