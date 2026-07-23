/**
 * Player Identity — foundation types & events (Phase 1, tasks 1.3–1.6).
 *
 * Verifies the compile-time AND runtime shape of the cross-cutting additions
 * made for the `player-identity` change:
 * - `SessionRecord` is extended with `playerName`, `phone`, `endedBy`,
 *   `adminId` (spec: "session-record (MODIFIED)" — 4 new fields alongside
 *   the existing 8).
 * - `ClubConfig.encryptionKey` is added (base64 AES-256 key, optional for
 *   backward compat with clubs that pre-date this change; auto-generated
 *   in Phase 2 on CLUB_SETUP / first CLUB_JOIN).
 * - `ClubKioskCourtInfo.playerName` is added (kiosk shows the player's
 *   name on an OCCUPIED court).
 * - `PhoneRevealAuditEntry` (NEW) — the row written to the
 *   PhoneRevealAuditStore on every admin phone reveal.
 * - `ClubCourt` (server internal) gains `playerName`, `phone`, `adminId`
 *   — start null, populated on occupy/START_FREE/NEW_MATCH.
 * - `PersistedClubCourt` mirrors the same three fields (optional for
 *   legacy v3 state-file compatibility — same precedence as sessionMode).
 * - `SocketEvents` gains `CLIENT.CLUB_ADMIN_OCCUPY`,
 *   `CLIENT.CLUB_REVEAL_PHONE`, `SERVER.CLUB_REVEAL_PHONE_RESULT`.
 *
 * These are structural (type/constant) changes — the runtime behavior that
 * USES them is exercised in Phase 2 (courtManager, ClubPlayerHandler) under
 * `pnpm --filter server test`. Per strict-tdd.md ("Triangulation skipped:
 * purely structural type additions; only one possible output, no logic"),
 * no triangulation is required for this test; one assertion per addition
 * documents the contract.
 */

import {
  type SessionRecord,
  type ClubConfig,
  type ClubKioskCourtInfo,
  type PhoneRevealAuditEntry,
  SESSION_MODE,
} from '../../../shared/types';
import { SocketEvents } from '../../../shared/events';
import type { ClubCourt, PersistedClubCourt } from '../domain/types';
import type { PersistedClubCourt as PersistedClubCourtFromPort } from '../domain/ports/persistence-types';
import { MatchEngine } from '../domain/matchEngine';

describe('player-identity — foundation types (Phase 1)', () => {
  describe('SessionRecord extension (spec: session-record MODIFIED)', () => {
    test('accepts a fully-populated record with the 4 new fields', () => {
      const record: SessionRecord = {
        courtName: 'Cancha 1',
        elapsedSeconds: 600,
        elapsedMinutes: 10,
        mode: SESSION_MODE.MATCH,
        cost: 500,
        currency: 'ARS',
        timestamp: '2026-07-21T12:00:00.000Z',
        sessionId: '11111111-1111-1111-1111-111111111111',
        // player-identity additions
        playerName: 'Jorge',
        phone: '_CT.base64.ciphertext==', // AES-256-GCM base64 wire-format string
        endedBy: 'player',
        adminId: null,
      };

      expect(record.playerName).toBe('Jorge');
      expect(record.phone).toBe('_CT.base64.ciphertext==');
      expect(record.endedBy).toBe('player');
      expect(record.adminId).toBeNull();
    });

    test('endedBy accepts "admin" with adminId populated (admin-initiated session)', () => {
      const record: SessionRecord = {
        courtName: 'Cancha 2',
        elapsedSeconds: 60,
        elapsedMinutes: 1,
        mode: SESSION_MODE.MATCH,
        cost: 0,
        currency: 'ARS',
        timestamp: '2026-07-21T12:01:00.000Z',
        sessionId: '22222222-2222-2222-2222-222222222222',
        playerName: 'Carlos',
        phone: 'cipher',
        endedBy: 'admin',
        adminId: 'socket-id-of-admin',
      };

      expect(record.endedBy).toBe('admin');
      expect(record.adminId).toBe('socket-id-of-admin');
    });

    test('12 fields total — 8 original + 4 player-identity additions (spec: schema modification)', () => {
      const record: SessionRecord = {
        courtName: 'C',
        elapsedSeconds: 1,
        elapsedMinutes: 1,
        mode: 'free',
        cost: 0,
        currency: 'ARS',
        timestamp: 'T',
        sessionId: 'id',
        playerName: '',
        phone: '',
        endedBy: 'player',
        adminId: null,
      };

      expect(Object.keys(record).sort()).toEqual([
        'adminId',
        'cost',
        'courtName',
        'currency',
        'elapsedMinutes',
        'elapsedSeconds',
        'endedBy',
        'mode',
        'phone',
        'playerName',
        'sessionId',
        'timestamp',
      ]);
    });

    test('endedBy is typed as literal "player" | "admin"', () => {
      const a: SessionRecord['endedBy'] = 'player';
      const b: SessionRecord['endedBy'] = 'admin';
      expect([a, b]).toEqual(['player', 'admin']);
    });

    test('adminId is typed as string | null', () => {
      const withAdmin: SessionRecord['adminId'] = 'sock';
      const without: SessionRecord['adminId'] = null;
      expect(withAdmin).toBe('sock');
      expect(without).toBeNull();
    });
  });

  describe('ClubConfig.encryptionKey (spec: Client-Side Phone Encryption)', () => {
    test('accepts a club config with encryptionKey populated', () => {
      const cfg: ClubConfig = {
        clubName: 'Club',
        sport: 'tableTennis',
        configured: true,
        adminPinHash: 'hash',
        createdAt: 0,
        encryptionKey: 'base64key==',
      };

      expect(cfg.encryptionKey).toBe('base64key==');
    });

    test('encryptionKey is OPTIONAL so legacy clubs (pre-change) still parse', () => {
      // Legacy clubs were created before this field existed. They load() back
      // without crashing, and Phase 2 auto-generates a key on first join.
      const cfg: ClubConfig = {
        clubName: 'Legacy Club',
        sport: 'tableTennis',
        configured: true,
        adminPinHash: 'hash',
        createdAt: 0,
        // no encryptionKey — TypeScript must accept this.
      };
      expect(cfg.encryptionKey).toBeUndefined();
    });
  });

  describe('ClubKioskCourtInfo.playerName (spec: Kiosk Player Name Display)', () => {
    test('accepts a kiosk court with playerName populated', () => {
      const info: ClubKioskCourtInfo = {
        id: 'c1',
        name: 'Cancha 1',
        status: 'OCCUPIED',
        mode: 'club',
        playerName: 'Jorge',
      };
      expect(info.playerName).toBe('Jorge');
    });

    test('playerName is OPTIONAL — empty when court is not OCCUPIED or no player set', () => {
      const info: ClubKioskCourtInfo = {
        id: 'c2',
        name: 'Cancha 2',
        status: 'AVAILABLE',
        mode: 'club',
      };
      expect(info.playerName).toBeUndefined();
    });
  });

  describe('PhoneRevealAuditEntry (NEW; spec: phone-reveal)', () => {
    test('accepts a fully-populated audit entry', () => {
      const entry: PhoneRevealAuditEntry = {
        adminId: 'sock-admin',
        sessionId: 'sid-123',
        courtName: 'Cancha 1',
        playerName: 'Jorge',
        timestamp: '2026-07-21T12:30:00.000Z',
      };

      expect(entry.adminId).toBe('sock-admin');
      expect(entry.sessionId).toBe('sid-123');
      expect(entry.courtName).toBe('Cancha 1');
      expect(entry.playerName).toBe('Jorge');
      expect(entry.timestamp).toBe('2026-07-21T12:30:00.000Z');
    });

    test('every field is present at runtime (structural — 5 keys)', () => {
      const entry: PhoneRevealAuditEntry = {
        adminId: 'a',
        sessionId: 'b',
        courtName: 'c',
        playerName: 'd',
        timestamp: 'e',
      };
      expect(Object.keys(entry).sort()).toEqual([
        'adminId',
        'courtName',
        'playerName',
        'sessionId',
        'timestamp',
      ]);
    });
  });
});

describe('player-identity — server internal ClubCourt fields (task 1.5)', () => {
  function makeClubCourt(overrides: Partial<ClubCourt> = {}): ClubCourt {
    const engine = new MatchEngine();
    engine.setCourtId('c-1', 'Cancha 1');
    return {
      kind: 'club',
      id: 'c-1',
      number: 1,
      name: 'Cancha 1',
      clubStatus: 'AVAILABLE',
      pin: '',
      sportRules: engine,
      playerNames: { a: '', b: '' },
      history: [],
      players: [],
      createdAt: 0,
      featured: false,
      occupiedAt: null,
      sessionMode: null,
      // player-identity additions — start null and are populated on occupy
      playerName: null,
      phone: null,
      adminId: null,
      ...overrides,
    };
  }

  test('ClubCourt accepts null player fields on creation (unoccupied)', () => {
    const court = makeClubCourt();
    expect(court.playerName).toBeNull();
    expect(court.phone).toBeNull();
    expect(court.adminId).toBeNull();
  });

  test('ClubCourt accepts populated player fields after an occupy (player flow)', () => {
    const court = makeClubCourt({
      clubStatus: 'OCCUPIED',
      playerName: 'Ana',
      phone: 'cipher',
      adminId: null, // player-initiated → adminId stays null
    });
    expect(court.playerName).toBe('Ana');
    expect(court.phone).toBe('cipher');
    expect(court.adminId).toBeNull();
  });

  test('ClubCourt accepts adminId populated for admin-initiated sessions', () => {
    const court = makeClubCourt({
      clubStatus: 'OCCUPIED',
      playerName: 'Beto',
      phone: 'cipher',
      adminId: 'socket-id-admin',
    });
    expect(court.adminId).toBe('socket-id-admin');
  });
});

describe('player-identity — PersistedClubCourt fields (task 1.6)', () => {
  test('PersistedClubCourt accepts the three new fields expressed in a v3 snapshot', () => {
    const persisted: PersistedClubCourt = {
      id: 'c-1',
      number: 1,
      name: 'Cancha 1',
      kind: 'club',
      clubStatus: 'OCCUPIED',
      occupiedAt: 1700000000000,
      pin: '1234',
      playerNames: { a: 'A', b: 'B' },
      createdAt: 1700000000000,
      matchState: null,
      config: null,
      history: [],
      // player-identity additions
      playerName: 'Ana',
      phone: 'cipher',
      adminId: null,
    };

    expect(persisted.playerName).toBe('Ana');
    expect(persisted.phone).toBe('cipher');
    expect(persisted.adminId).toBeNull();
  });

  test('PersistedClubCourt fields are OPTIONAL so legacy v3 files still parse (precedent: sessionMode)', () => {
    // A legacy v3 state file written before these fields existed MUST still
    // parse without crashing. The three new fields default to null/undefined
    // on load. courtManager.loadTournament restores the court with null
    // defaults so the in-memory shape stays consistent.
    const legacy: PersistedClubCourt = {
      id: 'c-legacy',
      number: 1,
      name: 'Legacy',
      kind: 'club',
      clubStatus: 'OCCUPIED',
      occupiedAt: 0,
      pin: '1234',
      playerNames: { a: '', b: '' },
      createdAt: 0,
      matchState: null,
      config: null,
      history: [],
      // no playerName / phone / adminId — legacy v3 state file
    };

    // Same shape re-importable via the persistence-types port (verify the
    // port path exports the same type surface).
    const alsoLegacy: PersistedClubCourtFromPort = legacy;
    expect(alsoLegacy).toBe(legacy);
    expect(legacy.playerName).toBeUndefined();
    expect(legacy.phone).toBeUndefined();
    expect(legacy.adminId).toBeUndefined();
  });
});

describe('player-identity — new socket events (task 1.4)', () => {
  test('CLUB_ADMIN_OCCUPY client event is registered', () => {
    expect(SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY).toBeDefined();
    expect(SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY).toBe('CLUB_ADMIN_OCCUPY');
  });

  test('CLUB_REVEAL_PHONE client event is registered', () => {
    expect(SocketEvents.CLIENT.CLUB_REVEAL_PHONE).toBeDefined();
    expect(SocketEvents.CLIENT.CLUB_REVEAL_PHONE).toBe('CLUB_REVEAL_PHONE');
  });

  test('CLUB_REVEAL_PHONE_RESULT server event is registered', () => {
    expect(SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT).toBeDefined();
    expect(SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT).toBe('CLUB_REVEAL_PHONE_RESULT');
  });

  test('the three new event names are unique across the entire dictionary', () => {
    const allValues = [
      ...Object.values(SocketEvents.CLIENT),
      ...Object.values(SocketEvents.SERVER),
    ];
    const newEvents = [
      SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY,
      SocketEvents.CLIENT.CLUB_REVEAL_PHONE,
      SocketEvents.SERVER.CLUB_REVEAL_PHONE_RESULT,
    ];
    for (const ev of newEvents) {
      const occurrences = allValues.filter((v) => v === ev).length;
      expect(occurrences).toBe(1); // exactly itself
    }
  });

  test('pre-existing club-player events remain intact (regression guard)', () => {
    expect(SocketEvents.CLIENT.CLUB_JOIN).toBe('CLUB_JOIN');
    expect(SocketEvents.CLIENT.CLUB_START_FREE).toBe('CLUB_START_FREE');
    expect(SocketEvents.CLIENT.CLUB_NEW_MATCH).toBe('CLUB_NEW_MATCH');
    expect(SocketEvents.SERVER.CLUB_JOIN_RESULT).toBe('CLUB_JOIN_RESULT');
    expect(SocketEvents.SERVER.CLUB_SESSION_ENDED).toBe('CLUB_SESSION_ENDED');
  });
});