import { SPORT } from '../../../../shared/types';
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
    it('should write v3 JSON with tournamentCourts and clubCourts', () => {
      store.save([makeTournamentCourt()], [makeClubCourt()]);

      // After atomic write, content is at the final path (rename moved it from .tmp)
      const savedContent = fs._files.get('data/rallyos-state.json');
      expect(savedContent).toBeDefined();

      const parsed = JSON.parse(savedContent!);
      expect(parsed.version).toBe(3);
      expect(typeof parsed.savedAt).toBe('number');
      // v3 uses separate arrays
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
      expect(parsed.version).toBe(3);
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
    it('should return v3 state when valid v3 JSON file exists', () => {
      const state: PersistedStateV3 = {
        version: 3,
        savedAt: 1700000000000,
        tournamentCourts: [makeTournamentCourt()],
        clubCourts: [makeClubCourt()],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(state));

      const result = store.load();

      expect(result).not.toBeNull();
      expect(result!.version).toBe(3);
      expect(result!.savedAt).toBe(1700000000000);
      expect(result!.tournamentCourts).toHaveLength(1);
      expect(result!.clubCourts).toHaveLength(1);
      expect(result!.tournamentCourts[0].id).toBe('table-1');
      expect(result!.clubCourts[0].id).toBe('club-1');
    });

    it('should migrate v1 state to v3 on load', () => {
      const tables = [makeTournamentCourt({ status: 'LIVE' })];
      // Remove matchState.sport to simulate v1
      delete (tables[0].matchState as any).sport;
      const stored = { version: 1, savedAt: 1700000000000, tables };
      fs._files.set('data/rallyos-state.json', JSON.stringify(stored));

      const result = store.load();

      expect(result).not.toBeNull();
      expect(result!.version).toBe(3);
      // sport field added by v1→v2 migration
      expect(result!.tournamentCourts[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
    });

    it('should migrate v2 state to v3 on load', () => {
      const tables = [
        makeTournamentCourt({ id: 't1', status: 'LIVE' }),
        {
          ...makeTournamentCourt({ id: 'c1', status: 'WAITING' }),
          mode: 'club' as any,
          clubStatus: 'OCCUPIED',
        },
      ];
      const stored = { version: 2, savedAt: 1700000000000, tables };
      fs._files.set('data/rallyos-state.json', JSON.stringify(stored));

      const result = store.load();

      expect(result).not.toBeNull();
      expect(result!.version).toBe(3);
      expect(result!.tournamentCourts).toHaveLength(1);
      expect(result!.tournamentCourts[0].id).toBe('t1');
      expect(result!.clubCourts).toHaveLength(1);
      expect(result!.clubCourts[0].id).toBe('c1');
      expect(result!.clubCourts[0].clubStatus).toBe('OCCUPIED');
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

    it('should return null when JSON is v1/v2 but tables is not an array', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 1, tables: 'not-array' }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is v3 but tournamentCourts is not an array', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 3, tournamentCourts: 'bad', clubCourts: [] }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is v3 but clubCourts is not an array', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 3, tournamentCourts: [], clubCourts: 'bad' }));

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
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 3, savedAt: 0, tournamentCourts: [], clubCourts: [] }));

      const result = store.archive();

      expect(result).toMatch(/^data\/archive\/torneo-.*\.json$/);
      // Source should be gone
      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
      // Archive should contain the content
      expect(fs._files.has(result)).toBe(true);
    });

    it('should preserve content in archive', () => {
      const stored = JSON.stringify({ version: 3, savedAt: 1700000000000, tournamentCourts: [makeTournamentCourt()], clubCourts: [] });
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
});
