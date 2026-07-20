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

function createMockSocket(id: string, isAdmin = false): MockSocket {
  const listeners = new Map<string, (...args: any[]) => void>();
  const emitted: Array<{ event: string; data: any }> = [];
  return {
    id,
    data: isAdmin ? { isClubAdmin: true } : {},
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
    ...overrides,
  };
}

function createStore(records: SessionRecord[]): SessionHistoryStore {
  const fs = createFakeFs();
  fs._files.set('data/session-history.json', JSON.stringify(records, null, 2));
  return new SessionHistoryStore(fs, 'data/session-history.json');
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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

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
      const handler = new ClubSessionHistoryHandler(io as any, store);

      handler.sendHistoryToSocket(nonAdmin as unknown as Socket);

      expect(nonAdmin.emit).not.toHaveBeenCalledWith(
        SocketEvents.SERVER.CLUB_SESSION_HISTORY,
        expect.anything(),
      );
    });
  });
});