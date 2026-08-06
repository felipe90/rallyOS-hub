import { SPORT, TournamentBracket, BRACKET_STATUS, BRACKET_MATCH_STATUS } from '../../../../shared/types';
import { StateStore } from './StateStore';
import { FileSystem, PersistedFlowSession, PersistedStateV4 } from './types';

// ── Fake FileSystem for DI ────────────────────────────────────────────

function makeFs(): FileSystem & { _written: Map<string, string>; _files: Map<string, string> } {
  const files = new Map<string, string>();
  const written = new Map<string, string>();

  return {
    _written: written,
    _files: files,

    writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
      written.set(path, data);
    },

    readFileSync(path: string, _encoding: BufferEncoding): string {
      if (!files.has(path)) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' });
      }
      return files.get(path)!;
    },

    renameSync(oldPath: string, newPath: string): void {
      const content = written.has(oldPath) ? written.get(oldPath) : files.get(oldPath);
      if (content === undefined) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, rename '${oldPath}'`), { code: 'ENOENT' });
      }
      files.set(newPath, content);
      files.delete(oldPath);
      written.delete(oldPath);
    },

    existsSync(path: string): boolean {
      return files.has(path) || written.has(path);
    },

    unlinkSync(path: string): void {
      files.delete(path);
      written.delete(path);
    },

    mkdirSync(_path: string, _options?: { recursive: boolean }): string | undefined {
      // No-op in fake — "directory" always exists
      return undefined;
    },
  };
}

// ── Helpers — v4 liveSessions rows (PERS-2) ───────────────────────────

function makeMatchState(status: string = 'LIVE') {
  return {
    config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
    score: { sets: { a: 0, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'B' },
    swappedSides: false,
    midSetSwapped: false,
    setHistory: [],
    status,
    winner: null,
    sport: SPORT.TABLE_TENNIS,
    history: [],
  };
}

function makeTournamentSession(overrides: Partial<PersistedFlowSession> = {}): PersistedFlowSession {
  return {
    courtId: 'table-1',
    flow: { mode: 'tournament', state: 'LIVE', startedAt: 1700000000000 },
    matchState: makeMatchState('LIVE'),
    number: 1,
    name: 'Mesa 1',
    pin: '4821',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
    ...overrides,
  };
}

function makeClubSession(overrides: Partial<PersistedFlowSession> = {}): PersistedFlowSession {
  return {
    courtId: 'club-1',
    flow: {
      mode: 'club',
      state: 'OCCUPIED',
      sessionMode: null,
      occupiedAt: 1700000001000,
      playerName: null,
      phone: null,
      adminId: null,
    },
    matchState: null,
    number: 2,
    name: 'Club Court 1',
    pin: '',
    playerNames: { a: '', b: '' },
    createdAt: 1700000000000,
    ...overrides,
  };
}

// ── Helper — v4 full document (PERS-4 single-writer contract) ─────────

function makeDoc(
  liveSessions: PersistedFlowSession[],
  bracket?: TournamentBracket | null,
): PersistedStateV4 {
  return {
    version: 4,
    savedAt: 0,
    liveSessions,
    ...(bracket !== undefined ? { bracket } : {}),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('StateStore', () => {
  let fs: ReturnType<typeof makeFs>;
  let store: StateStore;

  beforeEach(() => {
    fs = makeFs();
    store = new StateStore(fs, 'data/rallyos-state.json');
  });

  describe('save', () => {
    it('should write v4 JSON with liveSessions (PERS-2 shape)', () => {
      store.save(makeDoc([makeTournamentSession(), makeClubSession()]));

      const savedContent = fs._files.get('data/rallyos-state.json');
      expect(savedContent).toBeDefined();

      const parsed = JSON.parse(savedContent!);
      expect(parsed.version).toBe(4);
      expect(typeof parsed.savedAt).toBe('number');
      expect(parsed.liveSessions).toHaveLength(2);
      expect(parsed.liveSessions[0].courtId).toBe('table-1');
      expect(parsed.liveSessions[1].courtId).toBe('club-1');
      // The legacy v3 arrays are GONE (slice-5 bridge reversal).
      expect(parsed.tournamentCourts).toBeUndefined();
      expect(parsed.clubCourts).toBeUndefined();
      expect(parsed.tables).toBeUndefined();
    });

    it('should accept an empty sessions array', () => {
      store.save(makeDoc([]));

      const finalContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(finalContent!);
      expect(parsed.liveSessions).toHaveLength(0);
    });

    it('should rename tmp file to final path for atomic write', () => {
      store.save(makeDoc([makeTournamentSession()]));

      const finalContent = fs._files.get('data/rallyos-state.json');
      expect(finalContent).toBeDefined();
      expect(fs._written.has('data/rallyos-state.json.tmp')).toBe(false);
      expect(fs._files.has('data/rallyos-state.json.tmp')).toBe(false);
    });

    it('should create data directory if it does not exist (no-op with fake fs)', () => {
      expect(() => store.save(makeDoc([makeTournamentSession()]))).not.toThrow();
    });

    it('should write before rename for atomic guarantee', () => {
      store.save(makeDoc([makeTournamentSession()]));

      const finalContent = fs._files.get('data/rallyos-state.json');
      expect(finalContent).toBeDefined();
      const parsed = JSON.parse(finalContent!);
      expect(parsed.version).toBe(4);
    });

    it('should save multiple tournament sessions', () => {
      const t1 = makeTournamentSession({ courtId: 't1', number: 1 });
      const t2 = makeTournamentSession({ courtId: 't2', number: 2 });
      store.save(makeDoc([t1, t2]));

      const finalContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(finalContent!);
      expect(parsed.liveSessions).toHaveLength(2);
      expect(parsed.liveSessions[0].courtId).toBe('t1');
      expect(parsed.liveSessions[1].courtId).toBe('t2');
    });

    it('should save multiple club sessions', () => {
      const c1 = makeClubSession({ courtId: 'c1' });
      const c2 = makeClubSession({
        courtId: 'c2',
        flow: { ...makeClubSession().flow, state: 'FINISHED' } as PersistedFlowSession['flow'],
      });
      store.save(makeDoc([c1, c2]));

      const finalContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(finalContent!);
      expect(parsed.liveSessions).toHaveLength(2);
      expect(parsed.liveSessions[0].courtId).toBe('c1');
      expect(parsed.liveSessions[1].courtId).toBe('c2');
    });
  });

  describe('load', () => {
    it('should return v4 state when valid v4 JSON file exists', () => {
      const state: PersistedStateV4 = {
        version: 4,
        savedAt: 1700000000000,
        liveSessions: [makeTournamentSession(), makeClubSession()],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(state));

      const result = store.load();

      expect(result).not.toBeNull();
      expect(result!.version).toBe(4);
      expect(result!.savedAt).toBe(1700000000000);
      expect(result!.liveSessions).toHaveLength(2);
      expect(result!.liveSessions[0].courtId).toBe('table-1');
      expect(result!.liveSessions[1].courtId).toBe('club-1');
    });

    // ── PERS-1 WIPE: any version !== 4 is discarded (no migration chain) ──

    it('should WIPE a v3 file — discarded, not migrated (PERS-1)', () => {
      fs._files.set(
        'data/rallyos-state.json',
        JSON.stringify({ version: 3, savedAt: 1700000000000, tournamentCourts: [], clubCourts: [] }),
      );

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should WIPE a v1 file — discarded, not migrated (PERS-1)', () => {
      fs._files.set(
        'data/rallyos-state.json',
        JSON.stringify({ version: 1, savedAt: 1700000000000, tables: [] }),
      );

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should WIPE a v2 file — discarded, not migrated (PERS-1)', () => {
      fs._files.set(
        'data/rallyos-state.json',
        JSON.stringify({ version: 2, savedAt: 1700000000000, tables: [] }),
      );

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when file does not exist', () => {
      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when file contains corrupt JSON', () => {
      fs._files.set('data/rallyos-state.json', 'not-valid-json{{{');

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when file contains empty string', () => {
      fs._files.set('data/rallyos-state.json', '');

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is valid but missing version', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ liveSessions: [] }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is an old version — wiped before structure check (PERS-1)', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 1, tables: 'not-array' }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is v4 but liveSessions is not an array', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 4, liveSessions: 'bad' }));

      const result = store.load();

      expect(result).toBeNull();
    });
  });

  describe('checkExists', () => {
    it('should return true when file exists', () => {
      fs._files.set('data/rallyos-state.json', '{}');

      expect(store.checkExists()).toBe(true);
    });

    it('should return false when file does not exist', () => {
      expect(store.checkExists()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should delete the file when it exists', () => {
      fs._files.set('data/rallyos-state.json', '{}');

      store.clear();

      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
    });

    it('should not throw when file does not exist', () => {
      expect(() => store.clear()).not.toThrow();
    });
  });

  describe('archive', () => {
    it('should rename file to archive path and return the path', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 4, savedAt: 0, liveSessions: [] }));

      const result = store.archive();

      expect(result).toMatch(/^data\/archive\/torneo-.*\.json$/);
      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
      expect(fs._files.has(result)).toBe(true);
    });

    it('should preserve content in archive', () => {
      const stored = JSON.stringify({ version: 4, savedAt: 1700000000000, liveSessions: [makeTournamentSession()] });
      fs._files.set('data/rallyos-state.json', stored);

      const result = store.archive();
      expect(fs._files.get(result)).toBe(stored);
    });

    it('should return archive path even when source file does not exist', () => {
      const result = store.archive();

      expect(result).toMatch(/^data\/archive\/torneo-.*\.json$/);
      expect(fs._files.has(result)).toBe(false);
    });

    it('should include ISO-like timestamp in filename', () => {
      fs._files.set('data/rallyos-state.json', '{}');

      const result = store.archive();

      expect(result).toMatch(/torneo-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
    });
  });

  describe('constructor', () => {
    it('should use default path when none provided', () => {
      const defaultStore = new StateStore(fs);
      fs._files.set('data/rallyos-state.json', '{}');

      expect(defaultStore.checkExists()).toBe(true);
    });

    it('should accept custom file path', () => {
      const customStore = new StateStore(fs, 'custom/store.json');

      expect(customStore.checkExists()).toBe(false);
    });
  });

  describe('save + load round-trip', () => {
    it('should produce identical session data after save and load', () => {
      const sessions = [
        makeTournamentSession({ courtId: 't1' }),
        makeTournamentSession({
          courtId: 't2',
          flow: { mode: 'tournament', state: 'LIVE', startedAt: 1700000000000 },
          matchState: makeMatchState('FINISHED'),
          playerNames: { a: 'Carol', b: 'Dave' },
        }),
      ];

      store.save(makeDoc(sessions));
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.liveSessions).toHaveLength(2);
      expect(loaded!.liveSessions[0].courtId).toBe('t1');
      expect(loaded!.liveSessions[0].playerNames!.a).toBe('Alice');
      expect(loaded!.liveSessions[0].pin).toBe('4821');
      expect(loaded!.liveSessions[1].courtId).toBe('t2');
      expect((loaded!.liveSessions[1].matchState as any).status).toBe('FINISHED');
      expect(loaded!.liveSessions[1].playerNames!.a).toBe('Carol');
    });

    it('should round-trip club flow identity (sessionMode / occupiedAt / playerName)', () => {
      const sessions = [
        makeClubSession({
          courtId: 'c1',
          flow: {
            mode: 'club',
            state: 'OCCUPIED',
            sessionMode: 'free',
            occupiedAt: 1700000001000,
            playerName: 'Ana',
            phone: 'enc:1',
            adminId: 'admin-1',
          },
        }),
      ];

      store.save(makeDoc(sessions));
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.liveSessions).toHaveLength(1);
      const flow = loaded!.liveSessions[0].flow as { mode: 'club'; sessionMode: string; playerName: string; phone: string; adminId: string };
      expect(flow.sessionMode).toBe('free');
      expect(flow.playerName).toBe('Ana');
      expect(flow.phone).toBe('enc:1');
      expect(flow.adminId).toBe('admin-1');
    });
  });

  // ── Tournament Bracket persistence (`bracket` field on PersistedStateV4) ──

  function makeBracket(overrides: Partial<TournamentBracket> = {}): TournamentBracket {
    return {
      name: 'Torneo',
      numSlots: 4,
      includeThirdPlace: false,
      matches: [
        {
          id: 'R1-M1', round: 1, position: 0,
          playerA: 'Juan', playerB: null, winner: null,
          status: BRACKET_MATCH_STATUS.READY, courtId: null,
        },
        {
          id: 'R1-M2', round: 1, position: 1,
          playerA: null, playerB: null, winner: null,
          status: BRACKET_MATCH_STATUS.PENDING, courtId: null,
        },
        {
          id: 'R2-M1', round: 2, position: 0,
          playerA: null, playerB: null, winner: null,
          status: BRACKET_MATCH_STATUS.PENDING, courtId: null,
        },
      ],
      thirdPlaceMatch: null,
      status: BRACKET_STATUS.SETUP,
      createdAt: 1700000000000,
      ...overrides,
    };
  }

  // ── Single-document save (PERS-4: the FULL v4 document rides one save) ──

  describe('single-document save (PERS-4 coordinator contract)', () => {
    it('persists liveSessions AND bracket together in one save', () => {
      const fs = makeFs();
      const store = new StateStore(fs, 'state.json');
      store.save(makeDoc([makeTournamentSession({ courtId: 't1' })], makeBracket()));

      const loaded = store.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.liveSessions).toHaveLength(1);
      expect(loaded!.liveSessions[0].courtId).toBe('t1');
      expect(loaded!.bracket).not.toBeNull();
      expect(loaded!.bracket!.name).toBe('Torneo');
    });

    it('persists bracket: null when the document carries an explicit null', () => {
      const fs = makeFs();
      const store = new StateStore(fs, 'state.json');
      store.save(makeDoc([], null));

      const loaded = store.load();
      expect(loaded!.bracket).toBeNull();
      expect(loaded!.liveSessions).toEqual([]);
    });

    it('a bracket written after sessions survives a later session-only save', () => {
      // Simulates the PERS-4 interleave: the bracket writer mutates the shared
      // document, then the session writer saves the SAME document — both land
      // in one atomic write because save() serializes the whole document.
      const fs = makeFs();
      const store = new StateStore(fs, 'state.json');
      const doc = makeDoc([makeTournamentSession({ courtId: 't1' })], makeBracket());
      store.save(doc);

      // Session debounce fires again with a NEW session — bracket rides along.
      store.save(makeDoc([makeTournamentSession({ courtId: 't2' })], doc.bracket));

      const loaded = store.load();
      expect(loaded!.liveSessions).toHaveLength(1);
      expect(loaded!.liveSessions[0].courtId).toBe('t2');
      expect(loaded!.bracket!.name).toBe('Torneo');
    });

    it('writes version 4 and stamps savedAt on every save', () => {
      const fs = makeFs();
      const store = new StateStore(fs, 'state.json');
      store.save(makeDoc([], null));

      const loaded = store.load();
      expect(loaded!.version).toBe(4);
      expect(typeof loaded!.savedAt).toBe('number');
    });
  });

  // ── v4 round-trip restore (PERS-2/6.4: restart restores from ONE file) ──

  describe('v4 round-trip restore', () => {
    it('restores liveSessions + bracket from a single persisted file', () => {
      const fs = makeFs();
      const store = new StateStore(fs, 'state.json');
      store.save(makeDoc([makeTournamentSession({ courtId: 't1' })], makeBracket()));

      const freshStore = new StateStore(fs, 'state.json');
      const loaded = freshStore.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.liveSessions[0].courtId).toBe('t1');
      expect(loaded!.liveSessions[0].flow).toEqual({ mode: 'tournament', state: 'LIVE', startedAt: 1700000000000 });
      expect(loaded!.bracket!.name).toBe('Torneo');
    });
  });
});
