/**
 * socket.ts — createSocketServer wiring smoke test (PR 2 task 2.6).
 *
 * Spec: club-session-history.
 *
 * Verifies that `createSocketServer` forwards the optional SessionHistoryStore
 * to SocketHandler so that the ClubSessionHistoryHandler is wired into the
 * per-connection pipeline. This is the production seam between `index.ts`
 * (which instantiates the store) and `SocketHandler` (which uses the store
 * for history broadcasts on admin connect + clear flow).
 *
 * Test layer: integration (smoke). Does NOT exercise real socket.io — uses
 * the same MockIo pattern as SocketHandler.test.ts. The behavioral coverage
 * of ClubSessionHistoryHandler itself lives in
 * `ClubSessionHistoryHandler.test.ts`; this test only asserts the pass-through.
 */

import { createSocketServer } from './socket';
import { CourtManager } from './domain/courtManager';
import { createTestCourtManager } from './domain/courtManager.test-factory';
import { ClubConfigStore } from './services/store/ClubConfigStore';
import { SessionHistoryStore } from './services/store/SessionHistoryStore';
import { SocketEvents } from '../../shared/events';
import type { SessionRecord } from '../../shared/types';

const TEST_SECRET = 'a'.repeat(64);

function makeMockIo() {
  const socketsMap = new Map<string, any>();
  return {
    io: {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      use: jest.fn(),
      on: jest.fn(),
      engine: { clientsCount: 0, opts: { transports: ['websocket'] } },
      sockets: { sockets: socketsMap },
    } as any,
    socketsMap,
  };
}

function makeFakeFs() {
  const files = new Map<string, string>();
  return {
    _files: files,
    writeFileSync: (p: string, d: string) => files.set(p, d),
    readFileSync: (p: string) => {
      const c = files.get(p);
      if (c === undefined) {
        throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      }
      return c;
    },
    renameSync: (o: string, n: string) => {
      const c = files.get(o);
      if (c === undefined) throw new Error('ENOENT');
      files.set(n, c);
      files.delete(o);
    },
    existsSync: (p: string) => files.has(p),
    unlinkSync: (p: string) => files.delete(p),
    mkdirSync: () => undefined as any,
  };
}

describe('createSocketServer — SessionHistoryStore pass-through (PR 2 task 2.6)', () => {
  let originalSecret: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('forwards the SessionHistoryStore to SocketHandler so admin connect emits CLUB_SESSION_HISTORY', () => {
    const record: SessionRecord = {
      courtName: 'Cancha Wiring',
      elapsedSeconds: 1200,
      elapsedMinutes: 20,
      mode: 'match',
      cost: 800,
      currency: 'ARS',
      timestamp: '2026-07-20T08:00:00.000Z',
      sessionId: 'wiring-uuid',
      // player-identity neutral defaults (pre-existing wiring test).
      playerName: '',
      phone: '',
      endedBy: 'player',
      adminId: null,
    };
    const fs = makeFakeFs() as any;
    fs._files.set('data/session-history.json', JSON.stringify([record], null, 2));
    const sessionHistoryStore = new SessionHistoryStore(fs, 'data/session-history.json');

    const { io, socketsMap } = makeMockIo();
    const courtManager = createTestCourtManager();
    const clubConfigStore = new ClubConfigStore(makeFakeFs() as any);

    createSocketServer(
      io,
      courtManager as CourtManager,
      '12345678',
      { ssid: 's', ip: '1', port: 3000, domain: 'd', wifiPassword: '' },
      clubConfigStore,
      sessionHistoryStore,
    );

    // Find the io.on('connection') handler and run it.
    const connectionCall = (io.on as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === 'connection',
    );
    expect(connectionCall).toBeDefined();

    const admin = {
      id: 'admin-wiring',
      handshake: { address: '127.0.0.1', auth: {} },
      data: { isClubAdmin: true },
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      rooms: new Set(),
    } as any;
    socketsMap.set(admin.id, admin);
    (connectionCall![1] as (s: any) => void)(admin);

    const historyEmit = (admin.emit as jest.Mock).mock.calls.find(
      ([event]: [string]) => event === SocketEvents.SERVER.CLUB_SESSION_HISTORY,
    );
    expect(historyEmit).toBeDefined();
    expect(historyEmit[1]).toEqual(
      expect.objectContaining({
        sessions: expect.arrayContaining([
          expect.objectContaining({ courtName: 'Cancha Wiring', sessionId: 'wiring-uuid' }),
        ]),
      }),
    );
  });

  it('still works when SessionHistoryStore is omitted (backward-compatible optional arg)', () => {
    const { io } = makeMockIo();
    const courtManager = createTestCourtManager();
    const clubConfigStore = new ClubConfigStore(makeFakeFs() as any);

    // Omitting sessionHistoryStore should NOT throw and should produce a
    // SocketHandler that handles normal sockets — admin connect will skip
    // the history emit (no ClubSessionHistoryHandler is wired).
    const handler = createSocketServer(
      io,
      courtManager as CourtManager,
      '12345678',
      { ssid: 's', ip: '1', port: 3000, domain: 'd', wifiPassword: '' },
      clubConfigStore,
    );
    expect(handler).toBeDefined();
  });
});