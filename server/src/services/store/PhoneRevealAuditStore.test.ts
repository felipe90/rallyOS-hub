/**
 * PhoneRevealAuditStore tests — player-identity Phase 4 (U2 task 4.1).
 *
 * Append-only JSONL audit log for admin phone reveals. Spec: `phone-reveal`
 * ("Phone Reveal Is Explicit And Audited") — every successful admin phone
 * decryption MUST be traceable to a specific admin action (habeas data /
 * GDPR compliance). One `PhoneRevealAuditEntry` per line.
 *
 * Spec scenarios covered:
 * - Append entry → load returns the entry
 * - Concurrent appends serialize (lock pattern) — both/all persist
 * - Load returns [] on missing file
 * - Load returns [] on corrupt file
 * - Malformed line among valid ones is skipped (audit log cannot be
 *   bricked by a single bad line); valid entries before/after survive
 *
 * Pattern follows SessionHistoryStore.test.ts: FileSystem DI with a
 * hand-rolled fake fs. No jest.mock. Atomic tmp+rename writes mirror the
 * sibling stores.
 */

import { PhoneRevealAuditStore } from './PhoneRevealAuditStore';
import { FileSystem } from './types';
import type { PhoneRevealAuditEntry } from '../../../../shared/types';

// ── Fake FileSystem for DI ────────────────────────────────────────────

interface FakeFs extends FileSystem {
  _files: Map<string, string>;
  _written: Map<string, string>;
  _dirs: Set<string>;
  _mkdirCalls: { path: string; options?: { recursive: boolean } }[];
  _renameCalls: { oldPath: string; newPath: string }[];
  _throwOnWrite: boolean;
  _throwOnRename: boolean;
}

function makeFs(): FakeFs {
  const files = new Map<string, string>();
  const written = new Map<string, string>();
  const dirs = new Set<string>();
  const mkdirCalls: { path: string; options?: { recursive: boolean } }[] = [];
  const renameCalls: { oldPath: string; newPath: string }[] = [];

  return {
    _files: files,
    _written: written,
    _dirs: dirs,
    _mkdirCalls: mkdirCalls,
    _renameCalls: renameCalls,
    _throwOnWrite: false,
    _throwOnRename: false,

    writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
      if (this._throwOnWrite) {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      }
      written.set(path, data);
    },

    readFileSync(path: string, _encoding: BufferEncoding): string {
      if (!files.has(path)) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, open '${path}'`),
          { code: 'ENOENT' },
        );
      }
      return files.get(path)!;
    },

    renameSync(oldPath: string, newPath: string): void {
      if (this._throwOnRename) {
        throw new Error('rename failed');
      }
      renameCalls.push({ oldPath, newPath });
      const content = written.has(oldPath) ? written.get(oldPath) : files.get(oldPath);
      if (content === undefined) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, rename '${oldPath}'`),
          { code: 'ENOENT' },
        );
      }
      files.set(newPath, content);
      files.delete(oldPath);
      written.delete(oldPath);
    },

    existsSync(path: string): boolean {
      return files.has(path) || written.has(path) || dirs.has(path);
    },

    unlinkSync(path: string): void {
      files.delete(path);
      written.delete(path);
    },

    mkdirSync(path: string, options?: { recursive: boolean }): string | undefined {
      mkdirCalls.push({ path, options });
      dirs.add(path);
      return undefined;
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<PhoneRevealAuditEntry> = {}): PhoneRevealAuditEntry {
  return {
    adminId: 'admin-1',
    sessionId: '11111111-1111-1111-1111-111111111111',
    courtName: 'Cancha 1',
    playerName: 'Lucía',
    timestamp: '2026-07-20T14:30:00.000Z',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PhoneRevealAuditStore', () => {
  let fs: FakeFs;
  let store: PhoneRevealAuditStore;

  beforeEach(() => {
    fs = makeFs();
    store = new PhoneRevealAuditStore(fs, 'data/phone-reveal-audit.jsonl');
  });

  describe('append + load roundtrip', () => {
    it('appends an entry → load returns exactly that entry (file created as JSONL)', () => {
      const entry = makeEntry();
      store.append(entry);

      const loaded = store.load();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toEqual(entry);

      // Triangulate the FORMAT — the persisted content is JSON Lines (one
      // JSON object per line), not a JSON array. A reviewer reading the
      // audit file by tail/grep sees discrete entries.
      const raw = fs._files.get('data/phone-reveal-audit.jsonl')!;
      expect(raw).toEqual(JSON.stringify(entry) + '\n');
    });

    it('appends two entries → load returns BOTH in insertion order', () => {
      const a = makeEntry({ adminId: 'admin-a', sessionId: 'sess-a', playerName: 'Ana' });
      const b = makeEntry({ adminId: 'admin-b', sessionId: 'sess-b', playerName: 'Bruno' });

      store.append(a);
      store.append(b);

      const loaded = store.load();
      expect(loaded).toHaveLength(2);
      expect(loaded[0]).toEqual(a);
      expect(loaded[1]).toEqual(b);
    });
  });

  describe('load — defensive handling', () => {
    it('returns [] when the file does not exist (spec: missing file → empty)', () => {
      expect(store.load()).toEqual([]);
    });

    it('returns [] when the file is entirely corrupt (spec: corrupt file → empty)', () => {
      fs._files.set('data/phone-reveal-audit.jsonl', 'not-valid-json{{{');
      expect(store.load()).toEqual([]);
    });

    it('returns the valid entries and skips a single malformed line (one bad line does not brick the audit log)', () => {
      const a = makeEntry({ adminId: 'admin-a', sessionId: 'sess-a' });
      const b = makeEntry({ adminId: 'admin-b', sessionId: 'sess-b' });
      // Two valid JSONL lines sandwiching a malformed one — a robust loader
      // keeps the valid audit trail readable even if one line was torn
      // during a crash.
      const corrupt =
        JSON.stringify(a) + '\n' +
        'GARBAGE-LINE-NOT-JSON\n' +
        JSON.stringify(b) + '\n';
      fs._files.set('data/phone-reveal-audit.jsonl', corrupt);

      const loaded = store.load();
      expect(loaded).toHaveLength(2);
      expect(loaded[0]).toEqual(a);
      expect(loaded[1]).toEqual(b);
    });

    it('returns [] for an empty file (spec parity with sibling stores)', () => {
      fs._files.set('data/phone-reveal-audit.jsonl', '');
      expect(store.load()).toEqual([]);
    });
  });

  describe('atomic + never-throw writes', () => {
    it('uses atomic tmp+rename (tmp file does not remain on disk)', () => {
      store.append(makeEntry());

      expect(fs._files.has('data/phone-reveal-audit.jsonl')).toBe(true);
      expect(fs._files.has('data/phone-reveal-audit.jsonl.tmp')).toBe(false);

      const renames = fs._renameCalls.filter(
        (r) => r.oldPath === 'data/phone-reveal-audit.jsonl.tmp'
          && r.newPath === 'data/phone-reveal-audit.jsonl',
      );
      expect(renames).toHaveLength(1);
    });

    it('auto-creates the data/ directory when missing on first write', () => {
      store.append(makeEntry());
      const mkdirCall = fs._mkdirCalls.find((c) => c.path === 'data');
      expect(mkdirCall).toBeDefined();
      expect(mkdirCall?.options?.recursive).toBe(true);
    });

    it('does NOT throw when writeFileSync fails (audit failure must not block the reveal)', () => {
      fs._throwOnWrite = true;
      expect(() => store.append(makeEntry())).not.toThrow();
    });

    it('does NOT throw when renameSync fails', () => {
      fs._throwOnRename = true;
      expect(() => store.append(makeEntry())).not.toThrow();
    });
  });

  describe('appendAsync — lock serializes concurrent appends (spec: "File lock serializes concurrent appends")', () => {
    it('persists BOTH entries when two appendAsync calls race via Promise.all', async () => {
      const a = makeEntry({ adminId: 'admin-a', sessionId: 'sess-a', playerName: 'Ana' });
      const b = makeEntry({ adminId: 'admin-b', sessionId: 'sess-b', playerName: 'Bruno' });

      await Promise.all([
        store.appendAsync(a),
        store.appendAsync(b),
      ]);

      const loaded = store.load();
      expect(loaded).toHaveLength(2);
      expect(loaded.map((e) => e.sessionId).sort()).toEqual(['sess-a', 'sess-b']);
    });

    it('triangulates with 3 concurrent appends — all persist under more contention', async () => {
      const entries = [
        makeEntry({ sessionId: 'c-1', adminId: 'a-1' }),
        makeEntry({ sessionId: 'c-2', adminId: 'a-2' }),
        makeEntry({ sessionId: 'c-3', adminId: 'a-3' }),
      ];

      await Promise.all(entries.map((e) => store.appendAsync(e)));

      const loaded = store.load();
      expect(loaded).toHaveLength(3);
      expect(loaded.map((e) => e.sessionId).sort()).toEqual(['c-1', 'c-2', 'c-3']);
    });

    it('releases the mutex after a failed write — subsequent appendAsync calls still proceed', async () => {
      fs._throwOnWrite = true;
      await store.appendAsync(makeEntry({ sessionId: 'a-fail' }));
      fs._throwOnWrite = false;
      await store.appendAsync(makeEntry({ sessionId: 'a-ok' }));

      expect(store.load()).toHaveLength(1);
      expect(store.load()[0].sessionId).toBe('a-ok');
    });
  });

  describe('getAll — alias for load', () => {
    it('returns the same result as load', () => {
      store.append(makeEntry({ sessionId: 'x-1' }));
      expect(store.getAll()).toEqual(store.load());
      expect(store.getAll()).toHaveLength(1);
    });
  });

  describe('default file path', () => {
    it('defaults to data/phone-reveal-audit.jsonl when no path is provided', () => {
      const defaultStore = new PhoneRevealAuditStore(fs);
      defaultStore.append(makeEntry());
      expect(fs._files.has('data/phone-reveal-audit.jsonl')).toBe(true);
    });
  });
});