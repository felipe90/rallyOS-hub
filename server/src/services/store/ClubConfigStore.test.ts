import { ClubConfigStore } from './ClubConfigStore';
import { FileSystem } from './types';
import type { ClubConfig } from '../../../../shared/types';

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
      return undefined;
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ClubConfig> = {}): ClubConfig {
  return {
    clubName: 'My Club',
    sport: 'padel',
    configured: true,
    adminPinHash: 'salt:hash',
    adminPin: '123456',
    createdAt: 1_000_000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ClubConfigStore', () => {
  let fs: ReturnType<typeof makeFs>;
  let store: ClubConfigStore;

  beforeEach(() => {
    fs = makeFs();
    store = new ClubConfigStore(fs, 'data/club-config.json');
  });

  describe('save', () => {
    it('should write JSON with all ClubConfig fields', () => {
      store.save(makeConfig());

      const savedContent = fs._files.get('data/club-config.json');
      expect(savedContent).toBeDefined();

      const parsed = JSON.parse(savedContent!);
      expect(parsed.clubName).toBe('My Club');
      expect(parsed.sport).toBe('padel');
      expect(parsed.configured).toBe(true);
    });

    it('should rename tmp file to final path for atomic write', () => {
      store.save(makeConfig());

      expect(fs._files.has('data/club-config.json')).toBe(true);
      expect(fs._written.has('data/club-config.json.tmp')).toBe(false);
      expect(fs._files.has('data/club-config.json.tmp')).toBe(false);
    });
  });

  describe('load', () => {
    it('should return ClubConfig when valid JSON file exists', () => {
      fs._files.set('data/club-config.json', JSON.stringify(makeConfig()));

      const result = store.load();

      expect(result).not.toBeNull();
      expect(result!.clubName).toBe('My Club');
      expect(result!.sport).toBe('padel');
      expect(result!.configured).toBe(true);
    });

    it('should return null when file does not exist', () => {
      const result = store.load();
      expect(result).toBeNull();
    });

    it('should return null when file contains corrupt JSON', () => {
      fs._files.set('data/club-config.json', 'not-valid-json{{{');
      expect(store.load()).toBeNull();
    });

    it('should return null when file contains empty string', () => {
      fs._files.set('data/club-config.json', '');
      expect(store.load()).toBeNull();
    });

    it('should return null when JSON is valid but missing required fields', () => {
      fs._files.set('data/club-config.json', JSON.stringify({ notExpected: true }));
      expect(store.load()).toBeNull();
    });

    it('should return configured=false when saved with configured=false', () => {
      fs._files.set('data/club-config.json', JSON.stringify({
        clubName: '', sport: '', configured: false,
        adminPinHash: '', adminPin: '', createdAt: 0,
      }));

      const result = store.load();
      expect(result).not.toBeNull();
      expect(result!.configured).toBe(false);
    });
  });

  describe('checkExists', () => {
    it('should return true when file exists', () => {
      fs._files.set('data/club-config.json', '{}');
      expect(store.checkExists()).toBe(true);
    });

    it('should return false when file does not exist', () => {
      expect(store.checkExists()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should delete the file when it exists', () => {
      fs._files.set('data/club-config.json', '{}');
      store.clear();
      expect(fs._files.has('data/club-config.json')).toBe(false);
    });

    it('should not throw when file does not exist', () => {
      expect(() => store.clear()).not.toThrow();
    });
  });

  describe('save + load round-trip', () => {
    it('should produce identical data after save and load', () => {
      store.save(makeConfig({ clubName: 'Padel Palace', sport: 'padel', configured: true }));
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.clubName).toBe('Padel Palace');
      expect(loaded!.sport).toBe('padel');
      expect(loaded!.configured).toBe(true);
    });

    it('should round-trip configured=false correctly', () => {
      store.save(makeConfig({ clubName: 'Unconfigured Club', sport: 'tableTennis', configured: false }));
      const loaded = store.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.configured).toBe(false);
    });
  });
});
