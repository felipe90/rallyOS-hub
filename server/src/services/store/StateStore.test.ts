import { SPORT, TournamentBracket, BRACKET_STATUS, BRACKET_MATCH_STATUS } from '../../../../shared/types';
import { StateStore } from './StateStore';
import { FileSystem, PersistedCourt, PersistedClubCourt, PersistedStateV3 } from './types';

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

// ── Helpers ───────────────────────────────────────────────────────────

function makeTournamentCourt(overrides: Partial<PersistedCourt> = {}): PersistedCourt {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    pin: '4821',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
    matchState: {
      config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { a: 5, b: 3 },
        serving: 'B',
      },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
      history: [],
    },
    ...overrides,
  };
}

function makeClubCourt(overrides: Partial<PersistedClubCourt> = {}): PersistedClubCourt {
  return {
    id: 'club-1',
    number: 2,
    name: 'Club Court 1',
    kind: 'club',
    clubStatus: 'OCCUPIED',
    occupiedAt: 1700000001000,
    pin: '',
    playerNames: { a: '', b: '' },
    createdAt: 1700000000000,
    matchState: null,
    config: null,
    history: [],
    ...overrides,
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
    it('should write v4 JSON with tournamentCourts and clubCourts', () => {
      store.save([makeTournamentCourt()], [makeClubCourt()]);

      // After atomic write, content is at the final path (rename moved it from .tmp)
      const savedContent = fs._files.get('data/rallyos-state.json');
      expect(savedContent).toBeDefined();

      const parsed = JSON.parse(savedContent!);
      expect(parsed.version).toBe(4);
      expect(typeof parsed.savedAt).toBe('number');
      // v4 uses separate arrays (slice-1 bridge — liveSessions shape lands
      // with the slice-2 runtime conversion)
      expect(parsed.tournamentCourts).toHaveLength(1);
      expect(parsed.clubCourts).toHaveLength(1);
      expect(parsed.tournamentCourts[0].id).toBe('table-1');
      expect(parsed.clubCourts[0].id).toBe('club-1');
      // v2-style tables array should NOT exist
      expect(parsed.tables).toBeUndefined();
    });

    it('should accept empty arrays', () => {
      store.save([], []);

      const finalContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(finalContent!);
      expect(parsed.tournamentCourts).toHaveLength(0);
      expect(parsed.clubCourts).toHaveLength(0);
    });

    it('should rename tmp file to final path for atomic write', () => {
      store.save([makeTournamentCourt()], [makeClubCourt()]);

      // After rename, tmp content should be moved to final path
      const finalContent = fs._files.get('data/rallyos-state.json');
      expect(finalContent).toBeDefined();
      // tmp should be gone
      expect(fs._written.has('data/rallyos-state.json.tmp')).toBe(false);
      expect(fs._files.has('data/rallyos-state.json.tmp')).toBe(false);
    });

    it('should create data directory if it does not exist (no-op with fake fs)', () => {
      // The fake fs directory is always available, so this just tests
      // that save doesn't throw
      expect(() => store.save([makeTournamentCourt()], [makeClubCourt()])).not.toThrow();
    });

    it('should write before rename for atomic guarantee', () => {
      store.save([makeTournamentCourt()], [makeClubCourt()]);

      const finalContent = fs._files.get('data/rallyos-state.json');
      expect(finalContent).toBeDefined();
      const parsed = JSON.parse(finalContent!);
      expect(parsed.version).toBe(4);
    });

    it('should save multiple tournament courts', () => {
      const t1 = makeTournamentCourt({ id: 't1', number: 1 });
      const t2 = makeTournamentCourt({ id: 't2', number: 2 });
      store.save([t1, t2], []);

      const finalContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(finalContent!);
      expect(parsed.tournamentCourts).toHaveLength(2);
      expect(parsed.tournamentCourts[0].id).toBe('t1');
      expect(parsed.tournamentCourts[1].id).toBe('t2');
    });

    it('should save multiple club courts', () => {
      const c1 = makeClubCourt({ id: 'c1' });
      const c2 = makeClubCourt({ id: 'c2', clubStatus: 'FINISHED' });
      store.save([], [c1, c2]);

      const finalContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(finalContent!);
      expect(parsed.clubCourts).toHaveLength(2);
      expect(parsed.clubCourts[0].id).toBe('c1');
      expect(parsed.clubCourts[1].id).toBe('c2');
    });
  });

  describe('load', () => {
    it('should return v4 state when valid v4 JSON file exists', () => {
      const state: PersistedStateV3 = {
        version: 4,
        savedAt: 1700000000000,
        tournamentCourts: [makeTournamentCourt()],
        clubCourts: [makeClubCourt()],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(state));

      const result = store.load();

      expect(result).not.toBeNull();
      expect(result!.version).toBe(4);
      expect(result!.savedAt).toBe(1700000000000);
      expect(result!.tournamentCourts).toHaveLength(1);
      expect(result!.clubCourts).toHaveLength(1);
      expect(result!.tournamentCourts[0].id).toBe('table-1');
      expect(result!.clubCourts[0].id).toBe('club-1');
    });

    // ── PERS-1 WIPE: any version !== 4 is discarded (no migration chain) ──

    it('should WIPE a v3 file — discarded, not migrated (PERS-1)', () => {
      const state: PersistedStateV3 = {
        version: 3,
        savedAt: 1700000000000,
        tournamentCourts: [makeTournamentCourt()],
        clubCourts: [makeClubCourt()],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(state));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should WIPE a v1 file — discarded, not migrated (PERS-1)', () => {
      const tables = [makeTournamentCourt({ status: 'LIVE' })];
      delete (tables[0].matchState as any).sport; // v1: no sport field
      fs._files.set(
        'data/rallyos-state.json',
        JSON.stringify({ version: 1, savedAt: 1700000000000, tables }),
      );

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should WIPE a v2 file — discarded, not migrated (PERS-1)', () => {
      const tables = [makeTournamentCourt({ id: 't1', status: 'LIVE' })];
      fs._files.set(
        'data/rallyos-state.json',
        JSON.stringify({ version: 2, savedAt: 1700000000000, tables }),
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
      fs._files.set('data/rallyos-state.json', JSON.stringify({ tournamentCourts: [], clubCourts: [] }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is an old version — wiped before structure check (PERS-1)', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 1, tables: 'not-array' }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is v4 but tournamentCourts is not an array', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 4, tournamentCourts: 'bad', clubCourts: [] }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is v4 but clubCourts is not an array', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 4, tournamentCourts: [], clubCourts: 'bad' }));

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
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 4, savedAt: 0, tournamentCourts: [], clubCourts: [] }));

      const result = store.archive();

      expect(result).toMatch(/^data\/archive\/torneo-.*\.json$/);
      // Source should be gone
      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
      // Archive should contain the content
      expect(fs._files.has(result)).toBe(true);
    });

    it('should preserve content in archive', () => {
      const stored = JSON.stringify({ version: 4, savedAt: 1700000000000, tournamentCourts: [makeTournamentCourt()], clubCourts: [] });
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

      // Match: torneo-YYYY-MM-DDTHH-MM-SS-SSSZ.json (colons/dots replaced with dashes)
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
    it('should produce identical tournament data after save and load', () => {
      const tournamentCourts = [
        makeTournamentCourt({ id: 't1' }),
        makeTournamentCourt({ id: 't2', status: 'FINISHED', playerNames: { a: 'Carol', b: 'Dave' } }),
      ];

      store.save(tournamentCourts, []);
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.tournamentCourts).toHaveLength(2);
      expect(loaded!.tournamentCourts[0].id).toBe('t1');
      expect(loaded!.tournamentCourts[0].playerNames.a).toBe('Alice');
      expect(loaded!.tournamentCourts[0].pin).toBe('4821');
      expect(loaded!.tournamentCourts[1].id).toBe('t2');
      expect(loaded!.tournamentCourts[1].status).toBe('FINISHED');
      expect(loaded!.tournamentCourts[1].playerNames.a).toBe('Carol');
    });

    it('should produce identical club data after save and load', () => {
      const clubCourts = [
        makeClubCourt({ id: 'c1', clubStatus: 'OCCUPIED' }),
        makeClubCourt({ id: 'c2', clubStatus: 'FINISHED', playerNames: { a: 'X', b: 'Y' } }),
      ];

      store.save([], clubCourts);
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.clubCourts).toHaveLength(2);
      expect(loaded!.clubCourts[0].id).toBe('c1');
      expect(loaded!.clubCourts[0].clubStatus).toBe('OCCUPIED');
      expect(loaded!.clubCourts[1].id).toBe('c2');
      expect(loaded!.clubCourts[1].clubStatus).toBe('FINISHED');
      expect(loaded!.clubCourts[1].playerNames.a).toBe('X');
    });

    it('should persist and restore both tournament and club courts together', () => {
      const tournamentCourts = [makeTournamentCourt({ id: 't1', status: 'LIVE' })];
      const clubCourts = [makeClubCourt({ id: 'c1', clubStatus: 'OCCUPIED' })];

      store.save(tournamentCourts, clubCourts);
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.tournamentCourts).toHaveLength(1);
      expect(loaded!.tournamentCourts[0].id).toBe('t1');
      expect(loaded!.clubCourts).toHaveLength(1);
      expect(loaded!.clubCourts[0].id).toBe('c1');
    });
  });

  // ── Tournament Bracket persistence (`bracket` field on PersistedStateV3) ──
  //
  // Spec: bracket-tournament-mvp R10 — the bracket survives a server restart.
  // The `bracket` field is OPTIONAL so legacy v4 files (no bracket key) still
  // parse. Court saves MUST NOT wipe a previously-persisted bracket.

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

  // Bracket methods live on StateStore but are bracket-specific. We access
  // them via a typed view and ALWAYS call as methods (`view.setBracket(...)`)
  // — destructuring a method then invoking it standalone loses `this` and
  // would silently no-op inside setBracket's try/catch (caught the regression).
  interface BracketStoreView {
    setBracket(bracket: TournamentBracket | null): void;
    getBracket(): TournamentBracket | null;
  }
  function asBracketStore(s: StateStore): BracketStoreView {
    return s as unknown as BracketStoreView;
  }

  describe('bracket persistence (R10)', () => {
    it('setBracket persists the bracket and getBracket round-trips it', () => {
      const fs = makeFs();
      const store = asBracketStore(new StateStore(fs, 'state.json'));
      const bracket = makeBracket();

      store.setBracket(bracket);
      const got = store.getBracket();

      expect(got).not.toBeNull();
      expect(got!.name).toBe('Torneo');
      expect(got!.numSlots).toBe(4);
      expect(got!.matches).toHaveLength(3);
    });

    it('setBracket(null) clears the bracket but preserves persisted courts', () => {
      const fs = makeFs();
      const raw = new StateStore(fs, 'state.json');
      raw.save([makeTournamentCourt({ id: 't1', status: 'LIVE' })], []);
      const view = asBracketStore(raw);

      view.setBracket(makeBracket());
      view.setBracket(null);

      const loaded = raw.load();
      expect(loaded!.bracket).toBeNull();
      expect(loaded!.tournamentCourts).toHaveLength(1);
      expect(loaded!.tournamentCourts[0].id).toBe('t1');
    });

    it('court save (no bracket arg) preserves a previously-persisted bracket', () => {
      const fs = makeFs();
      const raw = new StateStore(fs, 'state.json');
      const view = asBracketStore(raw);
      view.setBracket(makeBracket({ name: 'Torneo Copa' }));

      // Simulate CourtManager.persistState — saves courts with no bracket arg.
      raw.save([makeTournamentCourt({ id: 't9', status: 'LIVE' })], []);

      const loaded = raw.load();
      expect(loaded!.bracket).not.toBeNull();
      expect(loaded!.bracket!.name).toBe('Torneo Copa');
    });

    it('legacy v4 file without a bracket key loads with bracket undefined/null', () => {
      const fs = makeFs();
      fs._files.set(
        'state.json',
        JSON.stringify({ version: 4, savedAt: 1, tournamentCourts: [], clubCourts: [] }),
      );
      const raw = new StateStore(fs, 'state.json');

      const loaded = raw.load();
      expect(loaded!.tournamentCourts).toEqual([]);
      expect(loaded!.bracket ?? null).toBeNull();
    });
  });

  // ── Fase 2 P2: in-memory bracket cache (no per-save full-file re-read) ──

  describe('bracket cache (P2)', () => {
    it('does not re-read the state file on repeated save() calls once the cache is seeded', () => {
      const fs = makeFs();
      const store = new StateStore(fs, 'state.json');
      const view = asBracketStore(store);

      view.setBracket(makeBracket({ name: 'Torneo Copa' }));

      // setBracket above already seeded the cache; from here on, court saves
      // must use the in-memory cache instead of readFileSync.
      const readSpy = jest.spyOn(fs, 'readFileSync');
      store.save([makeTournamentCourt({ id: 't1', status: 'LIVE' })], []);
      store.save([makeTournamentCourt({ id: 't1', status: 'LIVE' })], []);
      store.save([makeTournamentCourt({ id: 't1', status: 'LIVE' })], []);

      expect(readSpy).not.toHaveBeenCalled();

      // The cached bracket was carried forward into each write.
      const loaded = store.load();
      expect(loaded!.bracket!.name).toBe('Torneo Copa');
    });

    it('seeds the cache from disk on first save, then never reads again, returning the cached value', () => {
      const fs = makeFs();
      fs._files.set(
        'state.json',
        JSON.stringify({
          version: 4,
          savedAt: 1,
          tournamentCourts: [],
          clubCourts: [],
          bracket: makeBracket({ name: 'OnDisk' }),
        }),
      );
      const store = new StateStore(fs, 'state.json');

      const readSpy = jest.spyOn(fs, 'readFileSync');

      // First save (no bracket arg) reads the disk once to seed the cache.
      store.save([makeTournamentCourt({ id: 't1', status: 'LIVE' })], []);
      expect(readSpy).toHaveBeenCalledTimes(1);

      readSpy.mockClear();
      store.save([makeTournamentCourt({ id: 't1', status: 'LIVE' })], []);
      store.save([makeTournamentCourt({ id: 't1', status: 'LIVE' })], []);

      expect(readSpy).not.toHaveBeenCalled();

      // The cached value (from the initial disk read) is what gets carried.
      expect(store.load()!.bracket!.name).toBe('OnDisk');
    });
  });
});
