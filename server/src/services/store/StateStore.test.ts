import { SPORT } from '../../../../shared/types';
import { StateStore } from './StateStore';
import { FileSystem, PersistedCourt } from './types';

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

function makeTable(overrides: Partial<PersistedCourt> = {}): PersistedCourt {
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

// ── Tests ────────────────────────────────────────────────────────────

describe('StateStore', () => {
  let fs: ReturnType<typeof makeFs>;
  let store: StateStore;

  beforeEach(() => {
    fs = makeFs();
    store = new StateStore(fs, 'data/rallyos-state.json');
  });

  describe('save', () => {
    it('should write JSON with version, savedAt, and tables', () => {
      const tables = [makeTable()];
      store.save(tables);

      // After atomic write, content is at the final path (rename moved it from .tmp)
      const savedContent = fs._files.get('data/rallyos-state.json');
      expect(savedContent).toBeDefined();

      const parsed = JSON.parse(savedContent!);
      expect(parsed.version).toBe(2);
      expect(typeof parsed.savedAt).toBe('number');
      expect(parsed.tables).toHaveLength(1);
      expect(parsed.tables[0].id).toBe('table-1');
    });

    it('should rename tmp file to final path for atomic write', () => {
      store.save([makeTable()]);

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
      expect(() => store.save([makeTable()])).not.toThrow();
    });

    it('should write before rename for atomic guarantee', () => {
      // This is inherently tested by the rename moving content from _written to _files.
      // The tmp file is written first, then rename moves it.
      store.save([makeTable()]);

      // The final file should contain valid JSON
      const finalContent = fs._files.get('data/rallyos-state.json');
      expect(finalContent).toBeDefined();
      const parsed = JSON.parse(finalContent!);
      expect(parsed.version).toBe(2);
    });

    it('should save empty tables array', () => {
      store.save([]);

      const finalContent = fs._files.get('data/rallyos-state.json');
      expect(finalContent).toBeDefined();
      const parsed = JSON.parse(finalContent!);
      expect(parsed.tables).toHaveLength(0);
    });

    it('should save multiple tables', () => {
      const tables = [
        makeTable({ id: 't1', number: 1 }),
        makeTable({ id: 't2', number: 2 }),
      ];
      store.save(tables);

      const finalContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(finalContent!);
      expect(parsed.tables).toHaveLength(2);
      expect(parsed.tables[0].id).toBe('t1');
      expect(parsed.tables[1].id).toBe('t2');
    });
  });

  describe('load', () => {
    it('should return PersistedState when valid JSON file exists', () => {
      const tables = [makeTable()];
      const stored = { version: 1, savedAt: 1700000000000, tables };
      fs._files.set('data/rallyos-state.json', JSON.stringify(stored));

      const result = store.load();

      expect(result).not.toBeNull();
      // v1 state is auto-migrated to v2 on load
      expect(result!.version).toBe(2);
      expect(result!.savedAt).toBe(1700000000000);
      expect(result!.tables).toHaveLength(1);
      expect(result!.tables[0].id).toBe('table-1');
      // sport field added by migration
      expect(result!.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
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
      fs._files.set('data/rallyos-state.json', JSON.stringify({ tables: [] }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should return null when JSON is valid but tables is not an array', () => {
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 1, tables: 'not-array' }));

      const result = store.load();

      expect(result).toBeNull();
    });

    it('should load with multiple tables and preserve all fields', () => {
      const table1 = makeTable({ id: 't1', number: 1, pin: '1111', status: 'LIVE' });
      const table2 = makeTable({ id: 't2', number: 2, pin: '2222', status: 'FINISHED' });
      const stored = { version: 1, savedAt: 1700000000000, tables: [table1, table2] };
      fs._files.set('data/rallyos-state.json', JSON.stringify(stored));

      const result = store.load();

      expect(result!.tables).toHaveLength(2);
      expect(result!.tables[0].pin).toBe('1111');
      expect(result!.tables[1].pin).toBe('2222');
      expect(result!.tables[0].status).toBe('LIVE');
      expect(result!.tables[1].status).toBe('FINISHED');
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
      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 1, savedAt: 0, tables: [] }));

      const result = store.archive();

      expect(result).toMatch(/^data\/archive\/torneo-.*\.json$/);
      // Source should be gone
      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
      // Archive should contain the content
      expect(fs._files.has(result)).toBe(true);
    });

    it('should preserve content in archive', () => {
      const stored = JSON.stringify({ version: 1, savedAt: 1700000000000, tables: [makeTable()] });
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
    it('should produce identical data after save and load', () => {
      const tables = [
        makeTable({ id: 't1' }),
        makeTable({ id: 't2', status: 'FINISHED', playerNames: { a: 'Carol', b: 'Dave' } }),
      ];

      store.save(tables);
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.tables).toHaveLength(2);
      expect(loaded!.tables[0].id).toBe('t1');
      expect(loaded!.tables[0].playerNames.a).toBe('Alice');
      expect(loaded!.tables[0].pin).toBe('4821');
      expect(loaded!.tables[1].id).toBe('t2');
      expect(loaded!.tables[1].status).toBe('FINISHED');
      expect(loaded!.tables[1].playerNames.a).toBe('Carol');
    });
  });
});
