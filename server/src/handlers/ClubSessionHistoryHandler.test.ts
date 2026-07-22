/**
 * ClubSessionHistoryHandler — Socket handler for admin session history.
 *
 * Spec: club-session-history / "Server Events" + "Authorization & Security".
 * Covers:
 *   - Admin socket guard (silent ignore + warn log) for CLUB_CLEAR_HISTORY
 *     and CLUB_CLEAR_HISTORY_CONFIRM (spec: non-admin "ignored silently").
 *   - Clear + confirm flow: CLUB_CLEAR_HISTORY sets pendingClear, 30s timer
 *     starts; CLUB_CLEAR_HISTORY_CONFIRM (confirm=true) within window clears
 *     the store and broadcasts CLUB_SESSION_HISTORY([]) to ALL admin sockets.
 *   - 30s timeout discards pendingClear silently (no clear, no broadcast).
 *   - sendHistoryToSocket: emits CLUB_SESSION_HISTORY with persisted records
 *     to a single admin socket (used by SocketHandler on admin connect).
 *   - Broadcast reaches every admin socket (triangulate 1 vs 2 admins).
 */

import { ClubSessionHistoryHandler } from './ClubSessionHistoryHandler';
import { SessionHistoryStore } from '../services/store/SessionHistoryStore';
import { PhoneRevealAuditStore } from '../services/store/PhoneRevealAuditStore';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { encryptPhone } from '../services/crypto/phoneCipher';
import { SocketEvents } from '../../../shared/events';
import type { SessionRecord } from '../../../shared/types';
import type { Socket } from 'socket.io';
import type { FileSystem } from '../services/store/types';

// ── Fake FileSystem ─────────────────────────────────────────────────────

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

// ── Mock socket ────────────────────────────────────────────────────────

interface MockSocket {
  id: string;
  data: any;
  handshake: { address: string };
  on: jest.Mock;
  emit: jest.Mock;
  _listeners: Map<string, (...args: any[]) => void>;
  _trigger: (event: string, ...args: any[]) => void;
}

function createMockSocket(id: string, isAdmin = false, adminId?: string): MockSocket {
  const listeners = new Map<string, (...args: any[]) => void>();
  const emitted: Array<{ event: string; data: any }> = [];
  const data: any = isAdmin ? { isClubAdmin: true } : {};
  if (isAdmin && adminId) data.adminId = adminId;
  return {
    id,
    data,
    handshake: { address: '127.0.0.1' },
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners.set(event, handler);
    }),
    emit: jest.fn((event: string, data: any) => {
      emitted.push({ event, data });
    }),
    _listeners: listeners,
    _trigger: (event: string, ...args: any[]) => {
      listeners.get(event)?.(...args);
    },
  } as any;
}

// ── Mock io ─────────────────────────────────────────────────────────────

interface MockIo {
  _sockets: Map<string, MockSocket>;
}

function createMockIo(sockets: MockSocket[] = []): MockIo & any {
  const map = new Map<string, MockSocket>();
  for (const s of sockets) map.set(s.id, s);
  // Mirror socket.io v4 layout: io.sockets is the default namespace; its
  // `.sockets` field is a Map<socketId, Socket>.
  return {
    _sockets: map,
    sockets: {
      sockets: map,
      values: () => map.values(),
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function createRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    courtName: 'Cancha 1',
    elapsedSeconds: 1800,
    elapsedMinutes: 30,
    mode: 'match',
    cost: 1500,
    currency: 'ARS',
    timestamp: '2026-07-20T12:00:00.000Z',
    sessionId: 'uuid-' + Math.random().toString(36).slice(2),
    // player-identity neutral defaults (pre-existing tests don't exercise
    // the new fields; passed overrides win when a test cares).
    playerName: '',
    phone: '',
    endedBy: 'player',
    adminId: null,
    ...overrides,
  };
}

function createStore(records: SessionRecord[]): SessionHistoryStore {
  const fs = createFakeFs();
  fs._files.set('data/session-history.json', JSON.stringify(records, null, 2));
  return new SessionHistoryStore(fs, 'data/session-history.json');
}

// Dummy store factories for handler constructor (used in pre-reveal tests that
// don't exercise the CLUB_REVEAL_PHONE path but still need the 4 required args).
function createDummyAuditStore(): PhoneRevealAuditStore {
  return new PhoneRevealAuditStore(createFakeFs(), 'data/phone-reveal-audit.jsonl');
}

function createDummyClubConfigStore(): ClubConfigStore {
  const fs = createFakeFs();
  fs._files.set(
    'data/club-config.json',
    JSON.stringify({
      clubName: 'Default Club',
      sport: 'tableTennis',
      adminPinHash: 'dummy-hash',
      configured: true,
      createdAt: Date.now(),
      costPerMinute: 50,
      currency: 'ARS',
      encryptionKey: '',
    }),
  );
  return new ClubConfigStore(fs, 'data/club-config.json');
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('ClubSessionHistoryHandler', () => {
  describe('admin guard — non-admin sockets silently ignored', () => {
    it('ignores CLUB_CLEAR_HISTORY from a non-admin socket (no store.clear, no broadcast, no error emitted)', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const adminA = createMockSocket('admin-A', true);
      const nonAdmin = createMockSocket('non-admin', false);
      const io = createMockIo([adminA, nonAdmin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      const socket = nonAdmin;
      handler.registerHandlers(socket as unknown as Socket);
      socket._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);

      // Spec: silently ignored → no broadcast reaches admins, no clear call.
      expect(spyClear).not.toHaveBeenCalled();
      expect(adminA.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        expect.anything(),
      );
      // Spec: no error emitted to the non-admin socket.
      const errorEmit = (socket as any)._listeners;
      // Only CLUB_CLEAR_HISTORY was registered — no error was emitted back.
      expect((socket.emit as jest.Mock).mock.calls).toEqual([]);
    });

    it('ignores CLUB_CLEAR_HISTORY_CONFIRM from a non-admin socket', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const adminA = createMockSocket('admin-A', true);
      const nonAdmin = createMockSocket('non-admin', false);
      const io = createMockIo([adminA, nonAdmin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(nonAdmin as unknown as Socket);
      // First set pendingClear on an admin socket (legal), then non-admin
      // attempts confirm — should be ignored.
      handler.registerHandlers(adminA as unknown as Socket);
      adminA._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);
      nonAdmin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true });

      expect(spyClear).not.toHaveBeenCalled();
      expect(adminA.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        [],
      );
    });
  });

  describe('CLUB_CLEAR_HISTORY → sets pending state, no immediate clear', () => {
    it('admin CLUB_CLEAR_HISTORY does NOT clear the store immediately', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);

      expect(spyClear).not.toHaveBeenCalled();
      // No empty-array broadcast emitted to admins on the request event alone.
      expect(admin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        [],
      );
    });

    it('admin CLUB_CLEAR_HISTORY_CONFIRM without prior CLUB_CLEAR_HISTORY is a no-op', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true });

      expect(spyClear).not.toHaveBeenCalled();
      expect(admin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        [],
      );
    });

    it('admin CLUB_CLEAR_HISTORY_CONFIRM with confirm=false (or absent) is a no-op', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: false });

      expect(spyClear).not.toHaveBeenCalled();
      expect(admin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        [],
      );
    });
  });

  describe('CLUB_CLEAR_HISTORY + CLUB_CLEAR_HISTORY_CONFIRM (confirm=true) flow', () => {
    it('clears the store and broadcasts CLUB_SESSION_HISTORY([]) to ALL admin sockets (single admin)', () => {
      const records = [createRecord(), createRecord({ courtName: 'Cancha 2' })];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true });

      expect(spyClear).toHaveBeenCalledTimes(1);
      expect(admin.emit).toHaveBeenCalledWith(SocketEvents.SERVER.CLUB_SESSION_HISTORY, {
        sessions: [],
      });
    });

    it('broadcasts CLUB_SESSION_HISTORY([]) to EVERY connected admin (triangulate: 2 admins)', () => {
      const records = [createRecord()];
      const store = createStore(records);
      jest.spyOn(store, 'clear');
      const adminA = createMockSocket('admin-A', true);
      const adminB = createMockSocket('admin-B', true);
      const playerZ = createMockSocket('player-z', false);
      const io = createMockIo([adminA, adminB, playerZ]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      // Only adminA requests clear + confirm. Both adminA and adminB MUST
      // receive the empty-array broadcast (spec: "to ALL admin sockets").
      handler.registerHandlers(adminA as unknown as Socket);
      handler.registerHandlers(adminB as unknown as Socket);
      adminA._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);
      adminA._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true });

      expect(adminA.emit).toHaveBeenCalledWith(SocketEvents.SERVER.CLUB_SESSION_HISTORY, {
        sessions: [],
      });
      expect(adminB.emit).toHaveBeenCalledWith(SocketEvents.SERVER.CLUB_SESSION_HISTORY, {
        sessions: [],
      });
      // Non-admin sockets MUST never receive the broadcast (spec: security).
      expect(playerZ.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        expect.anything(),
      );
    });

    it('store.getAll() returns [] after a confirmed clear (the persisted file was emptied)', () => {
      const records = [createRecord(), createRecord({ courtName: 'Cancha 2' })];
      const store = createStore(records);
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true });

      expect(store.getAll()).toEqual([]);
    });
  });

  describe('30s timeout — pending state discarded silently', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('discards pendingClear after 30s — subsequent confirm is a no-op (no clear, no broadcast)', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);

      // Advance past the 30s window.
      jest.advanceTimersByTime(30_000 + 50);

      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true });

      expect(spyClear).not.toHaveBeenCalled();
      expect(admin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        [],
      );
    });

    it('does NOT broadcast anything on timeout itself (silent discard)', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);

      jest.advanceTimersByTime(30_000 + 50);

      // No broadcast emitted at any point during the timeout window.
      expect(admin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        [],
      );
    });

    it('a confirmed clear before the 30s timeout completes normally', () => {
      const records = [createRecord()];
      const store = createStore(records);
      const spyClear = jest.spyOn(store, 'clear');
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY);

      jest.advanceTimersByTime(5_000); // 5 seconds in
      admin._trigger(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, { confirm: true });

      jest.advanceTimersByTime(30_000); // well past the original 30s window

      expect(spyClear).toHaveBeenCalledTimes(1);
      // No further clears after timeout (timer was cleared on confirm).
      jest.advanceTimersByTime(60_000);
      expect(spyClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendHistoryToSocket — admin connect push', () => {
    it('emits CLUB_SESSION_HISTORY with all persisted records to the given admin socket', () => {
      const a = createRecord({ courtName: 'Cancha A' });
      const b = createRecord({ courtName: 'Cancha B' });
      const store = createStore([a, b]);
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.sendHistoryToSocket(admin as unknown as Socket);

      expect(admin.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        expect.objectContaining({
          sessions: expect.arrayContaining([
            expect.objectContaining({ courtName: 'Cancha A' }),
            expect.objectContaining({ courtName: 'Cancha B' }),
          ]),
        }),
      );
    });

    it('emits CLUB_SESSION_HISTORY with empty array when store has no records', () => {
      const store = createStore([]);
      const admin = createMockSocket('admin', true);
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.sendHistoryToSocket(admin as unknown as Socket);

      expect(admin.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        expect.objectContaining({ sessions: [] }),
      );
    });

    it('does not emit history to a non-admin socket', () => {
      const store = createStore([createRecord()]);
      const nonAdmin = createMockSocket('player', false);
      const io = createMockIo([nonAdmin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, createDummyAuditStore(), createDummyClubConfigStore());

      handler.sendHistoryToSocket(nonAdmin as unknown as Socket);

      expect(nonAdmin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        expect.anything(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // player-identity (Phase 4 / U2 tasks 4.3 + 4.4) — CLUB_REVEAL_PHONE.
  //
  // Spec: `phone-reveal` ("Phone Reveal Is Explicit And Audited").
  //   - Admin guard: socket.data.isClubAdmin === true AND socket.data.adminId
  //     present, else emit CLUB_REVEAL_PHONE_RESULT { success:false,
  //     error:'unauthorized' } + NO audit.
  //   - Session resolution: resolve sessionId from payload → find the
  //     SessionRecord in the history store. If not found → emit { success:
  //     false, error:'not_found' } + NO audit.
  //   - Success: server-side decrypt phone via phoneCipher using
  //     ClubConfig.encryptionKey → append PhoneRevealAuditEntry to the audit
  //     store → emit { success:true, phone } ONLY to that socket.
  //   - On every failure path the audit store is NOT written (no audit for
  //     a refused or unresolved reveal).
  // ═══════════════════════════════════════════════════════════════════

  describe('CLUB_REVEAL_PHONE (Phase 4 task 4.3)', () => {
    // ── Reveal-scoped fakes/seeders ────────────────────────────────────

    const REVEAL_KEY_B64 = 'WCKb3b+s+JDl/rODyTPIujBSlHCeOg7d4o6IxcakAFQ='; // 32-byte AES-256 key
    const PLAINTEXT_PHONE = '+54 11 5555-1234';

    function createRevealClubConfigStore(): ClubConfigStore {
      const fs = createFakeFs();
      fs._files.set(
        'data/club-config.json',
        JSON.stringify({
          clubName: 'Reveal Club',
          sport: 'tableTennis',
          adminPinHash: 'dummy-hash',
          configured: true,
          createdAt: Date.now(),
          costPerMinute: 50,
          currency: 'ARS',
          encryptionKey: REVEAL_KEY_B64,
        }),
      );
      return new ClubConfigStore(fs, 'data/club-config.json');
    }

    function createRevealAuditStore(): PhoneRevealAuditStore {
      return new PhoneRevealAuditStore(createFakeFs(), 'data/phone-reveal-audit.jsonl');
    }

    function createRevealStore(records: SessionRecord[]): SessionHistoryStore {
      const fs = createFakeFs();
      fs._files.set('data/session-history.json', JSON.stringify(records, null, 2));
      return new SessionHistoryStore(fs, 'data/session-history.json');
    }

    function seedEncryptedRecord(sessionId: string): SessionRecord {
      // Build a real AES-256-GCM ciphertext so the handler's decryptPhone
      // round-trips to the plaintext — proves the decryption path is real,
      // not faked.
      const ciphertext = encryptPhone(PLAINTEXT_PHONE, REVEAL_KEY_B64);
      return createRecord({
        sessionId,
        courtName: 'Cancha Revelada',
        playerName: 'Lucía Reveal',
        phone: ciphertext,
        endedBy: 'player',
        adminId: null,
      });
    }

    // ── Tests ──────────────────────────────────────────────────────────

    it('admin success: decrypts the phone, appends an audit entry, and emits { success:true, phone } to the requesting socket only', () => {
      const sessionId = 'sess-reveal-ok';
      const store = createRevealStore([seedEncryptedRecord(sessionId)]);
      const auditStore = createRevealAuditStore();
      const clubConfigStore = createRevealClubConfigStore();
      const spyAppend = jest.spyOn(auditStore, 'append');
      const admin = createMockSocket('admin-reveal', true, 'admin-reveal-id');
      // A second admin must NOT receive the revealed phone (result is
      // socket-private per spec).
      const otherAdmin = createMockSocket('admin-other', true, 'admin-other-id');
      const io = createMockIo([admin, otherAdmin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, auditStore, clubConfigStore);

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, { sessionId });

      // Audit: one entry atributed to the requesting admin, with the
      // resolved session fields.
      expect(spyAppend).toHaveBeenCalledTimes(1);
      const auditEntry = spyAppend.mock.calls[0][0];
      expect(auditEntry.adminId).toBe('admin-reveal-id');
      expect(auditEntry.sessionId).toBe(sessionId);
      expect(auditEntry.courtName).toBe('Cancha Revelada');
      expect(auditEntry.playerName).toBe('Lucía Reveal');
      expect(typeof auditEntry.timestamp).toBe('string');

      // Result: success + decrypted phone, emitted ONLY to the requesting socket.
      expect(admin.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT,
        { success: true, phone: PLAINTEXT_PHONE },
      );
      expect(otherAdmin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT,
        expect.anything(),
      );
      // The decrypted phone matches the original plaintext.
      expect(auditStore.load()).toHaveLength(1);
      expect(auditStore.load()[0].adminId).toBe('admin-reveal-id');
    });

    it('non-admin: emits { success:false, error:\'unauthorized\' }, appends NO audit, and emits NO success result', () => {
      const sessionId = 'sess-reveal-nono';
      const store = createRevealStore([seedEncryptedRecord(sessionId)]);
      const auditStore = createRevealAuditStore();
      const clubConfigStore = createRevealClubConfigStore();
      const spyAppend = jest.spyOn(auditStore, 'append');
      const nonAdmin = createMockSocket('player', false);
      const io = createMockIo([nonAdmin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, auditStore, clubConfigStore);

      handler.registerHandlers(nonAdmin as unknown as Socket);
      nonAdmin._trigger(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, { sessionId });

      expect(spyAppend).not.toHaveBeenCalled();
      expect(nonAdmin.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT,
        { success: false, error: 'unauthorized' },
      );
      // No success result ever emitted.
      const successCalls = (nonAdmin.emit as jest.Mock).mock.calls.filter(
        ([event, data]: [string, any]) =>
          event === SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT && data?.success === true,
      );
      expect(successCalls).toHaveLength(0);
      expect(auditStore.load()).toHaveLength(0);
    });

    it('admin WITHOUT socket.data.adminId: emits unauthorized + NO audit (closes the JWT-restore gap for reveal)', () => {
      // isClubAdmin===true but adminId absent → refuse: an unattributed
      // reveal would produce an audit row with no adminId, breaking
      // traceability. Mirrors the CLUB_ADMIN_OCCUPY / CLUB_FORCE_END guards.
      const sessionId = 'sess-reveal-noid';
      const store = createRevealStore([seedEncryptedRecord(sessionId)]);
      const auditStore = createRevealAuditStore();
      const clubConfigStore = createRevealClubConfigStore();
      const spyAppend = jest.spyOn(auditStore, 'append');
      const adminNoId = createMockSocket('restored-admin', true /* no adminId */);
      const io = createMockIo([adminNoId]);
      const handler = new ClubSessionHistoryHandler(io as any, store, auditStore, clubConfigStore);

      handler.registerHandlers(adminNoId as unknown as Socket);
      adminNoId._trigger(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, { sessionId });

      expect(spyAppend).not.toHaveBeenCalled();
      expect(adminNoId.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT,
        { success: false, error: 'unauthorized' },
      );
      expect(auditStore.load()).toHaveLength(0);
    });

    it('unknown sessionId: emits { success:false, error:\'not_found\' }, appends NO audit, no success result', () => {
      const sessionId = 'sess-reveal-known';
      const store = createRevealStore([seedEncryptedRecord(sessionId)]);
      const auditStore = createRevealAuditStore();
      const clubConfigStore = createRevealClubConfigStore();
      const spyAppend = jest.spyOn(auditStore, 'append');
      const admin = createMockSocket('admin-unresolvable', true, 'admin-unresolvable-id');
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, auditStore, clubConfigStore);

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, {
        sessionId: 'sess-does-not-exist',
      });

      expect(spyAppend).not.toHaveBeenCalled();
      expect(admin.emit).toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT,
        { success: false, error: 'not_found' },
      );
      const successCalls = (admin.emit as jest.Mock).mock.calls.filter(
        ([event, data]: [string, any]) =>
          event === SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT && data?.success === true,
      );
      expect(successCalls).toHaveLength(0);
      expect(auditStore.load()).toHaveLength(0);
    });

    it('triangulates audit: a second reveal appends a SECOND audit entry (audit is append-only, not overwrite)', () => {
      const sessionId = 'sess-reveal-x2';
      const store = createRevealStore([seedEncryptedRecord(sessionId)]);
      const auditStore = createRevealAuditStore();
      const clubConfigStore = createRevealClubConfigStore();
      const admin = createMockSocket('admin-x2', true, 'admin-x2-id');
      const io = createMockIo([admin]);
      const handler = new ClubSessionHistoryHandler(io as any, store, auditStore, clubConfigStore);

      handler.registerHandlers(admin as unknown as Socket);
      admin._trigger(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, { sessionId });
      admin._trigger(SocketEvents.CLIENT.CLUB_REVEAL_PHONE, { sessionId });

      expect(auditStore.load()).toHaveLength(2);
      expect(auditStore.load()[0].adminId).toBe('admin-x2-id');
      expect(auditStore.load()[1].adminId).toBe('admin-x2-id');
      // Two success results emitted.
      const successCalls = (admin.emit as jest.Mock).mock.calls.filter(
        ([event, data]: [string, any]) =>
          event === SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT && data?.success === true,
      );
      expect(successCalls).toHaveLength(2);
    });
  });
});