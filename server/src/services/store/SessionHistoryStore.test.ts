/**
 * SessionHistoryStore tests — PR 1 Foundation
 *
 * Append-only JSON persistence for club session records.
 *
 * Spec scenarios covered:
 * - Record appended on session end
 * - Corrupt file handled gracefully (returns empty array)
 * - Missing file handled gracefully (returns empty array)
 * - data/ directory auto-created on first write
 * - Write failure does not block session end (append never throws)
 * - Concurrent append — last-writer-wins (documented acceptable tradeoff)
 *
 * Pattern follows ClubConfigStore.test.ts: FileSystem DI with an in-memory
 * fake fs. No jest.mock — the fake fs is a hand-rolled test double.
 */

import { SessionHistoryStore } from './SessionHistoryStore';
import { FileSystem } from './types';
import type { SessionRecord } from '../../../../shared/types';

// ── Fake FileSystem for DI ────────────────────────────────────────────

interface FakeFs extends FileSystem {
  _files: Map<string, string>;
  _written: Map<string, string>;
  _dirs: Set<string>;
  _mkdirCalls: { path: string; options?: { recursive: boolean } }[];
  _renameCalls: { oldPath: string; newPath: string }[];
  // Toggleable failure injection for append-never-throws tests
  _throwOnWrite: boolean;
  _throwOnRename: boolean;
  _throwOnMkdir: boolean;
  _throwOnRead: boolean;
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
    _throwOnMkdir: false,
    _throwOnRead: false,

    writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
      if (this._throwOnWrite) {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      }
      written.set(path, data);
    },

    readFileSync(path: string, _encoding: BufferEncoding): string {
      if (this._throwOnRead) {
        throw new Error('read failed');
      }
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
      if (this._throwOnMkdir) {
        throw new Error('mkdir failed');
      }
      mkdirCalls.push({ path, options });
      // Simulate the directory now existing on disk.
      dirs.add(path);
      return undefined;
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    courtName: 'Cancha 1',
    elapsedSeconds: 600,
    elapsedMinutes: 10,
    mode: 'match',
    cost: 500,
    currency: 'ARS',
    timestamp: '2026-07-20T14:30:00.000Z',
    sessionId: '11111111-1111-1111-1111-111111111111',
    // player-identity neutral defaults — these tests pre-date the new
    // fields; they don't exercise phone/name flows, so empty/null values
    // are sufficient. Tests that DO exercise the new fields pass overrides.
    playerName: '',
    phone: '',
    endedBy: 'player',
    adminId: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('SessionHistoryStore', () => {
  let fs: FakeFs;
  let store: SessionHistoryStore;

  beforeEach(() => {
    fs = makeFs();
    store = new SessionHistoryStore(fs, 'data/session-history.json');
  });

  describe('load', () => {
    it('should return an empty array when the file does not exist (spec: missing file → empty)', () => {
      expect(store.load()).toEqual([]);
    });

    it('should return an empty array when the JSON is corrupt (spec: corrupt file → empty)', () => {
      fs._files.set('data/session-history.json', 'not-valid-json{{{');
      expect(store.load()).toEqual([]);
    });

    it('should return an empty array when the JSON is valid but not an array', () => {
      fs._files.set('data/session-history.json', JSON.stringify({ not: 'an array' }));
      expect(store.load()).toEqual([]);
    });

    it('should return an empty array when the file contains an empty string', () => {
      fs._files.set('data/session-history.json', '');
      expect(store.load()).toEqual([]);
    });

    it('should return parsed records when the file contains a valid array', () => {
      const records = [makeRecord(), makeRecord({ sessionId: 'id-2' })];
      fs._files.set('data/session-history.json', JSON.stringify(records));

      const loaded = store.load();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].courtName).toBe('Cancha 1');
      expect(loaded[1].sessionId).toBe('id-2');
    });
  });

  describe('getAll', () => {
    it('should be an alias for load — same result object shape', () => {
      const records = [makeRecord()];
      fs._files.set('data/session-history.json', JSON.stringify(records));

      expect(store.getAll()).toEqual(records);
      expect(store.getAll()).toEqual(store.load());
    });

    it('returns empty array when nothing persisted', () => {
      expect(store.getAll()).toEqual([]);
    });
  });

  describe('append', () => {
    it('should write an array containing the new record when file does not exist (spec: append on empty)', () => {
      store.append(makeRecord({ sessionId: 'new-1' }));

      const saved = fs._files.get('data/session-history.json');
      expect(saved).toBeDefined();
      const parsed = JSON.parse(saved!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].sessionId).toBe('new-1');
    });

    it('should append a record to the existing array (spec: 2 records → append → 3 records)', () => {
      fs._files.set(
        'data/session-history.json',
        JSON.stringify([makeRecord({ sessionId: 'old-1' }), makeRecord({ sessionId: 'old-2' })]),
      );

      store.append(makeRecord({ sessionId: 'new-3' }));

      const saved = JSON.parse(fs._files.get('data/session-history.json')!);
      expect(saved).toHaveLength(3);
      expect(saved[0].sessionId).toBe('old-1');
      expect(saved[1].sessionId).toBe('old-2');
      expect(saved[2].sessionId).toBe('new-3');
    });

    it('should auto-create the data/ directory when missing (spec: data/ auto-created on first write)', () => {
      store.append(makeRecord());

      const mkdirCall = fs._mkdirCalls.find((c) => c.path === 'data');
      expect(mkdirCall).toBeDefined();
      expect(mkdirCall?.options?.recursive).toBe(true);
    });

    it('should NOT call mkdir when the data/ directory already exists', () => {
      // Mark 'data' as an existing directory on the fake fs so the store's
      // existsSync('data') check returns true and the mkdir branch is skipped.
      fs._dirs.add('data');
      fs._mkdirCalls.length = 0;
      store.append(makeRecord());

      const calls = fs._mkdirCalls.filter((c) => c.path === 'data');
      expect(calls).toHaveLength(0);

      // Sanity — the file still got written via tmp+rename.
      expect(fs._files.has('data/session-history.json')).toBe(true);
    });

    it('should use atomic tmp+rename (tmp file must NOT remain on disk)', () => {
      store.append(makeRecord());

      // Final file exists, tmp file does not
      expect(fs._files.has('data/session-history.json')).toBe(true);
      expect(fs._files.has('data/session-history.json.tmp')).toBe(false);
      expect(fs._written.has('data/session-history.json.tmp')).toBe(false);

      // rename was invoked exactly once with tmp → final
      const renames = fs._renameCalls.filter(
        (r) => r.oldPath === 'data/session-history.json.tmp' && r.newPath === 'data/session-history.json',
      );
      expect(renames).toHaveLength(1);
    });

    it('should NOT throw when writeFileSync fails (spec: write failure does not block session end)', () => {
      fs._throwOnWrite = true;
      expect(() => store.append(makeRecord())).not.toThrow();
    });

    it('should NOT throw when renameSync fails (partial atomic write is caught)', () => {
      fs._throwOnRename = true;
      expect(() => store.append(makeRecord())).not.toThrow();
    });

    it('should NOT throw when mkdirSync fails (permission denied on data/)', () => {
      fs._throwOnMkdir = true;
      expect(() => store.append(makeRecord())).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should write an empty array to disk (spec: clear writes empty array)', () => {
      fs._files.set('data/session-history.json', JSON.stringify([makeRecord()]));

      store.clear();

      const saved = fs._files.get('data/session-history.json');
      expect(saved).toBeDefined();
      expect(JSON.parse(saved!)).toEqual([]);
    });

    it('should produce an empty array from load after clear', () => {
      fs._files.set('data/session-history.json', JSON.stringify([makeRecord()]));
      store.clear();
      expect(store.load()).toEqual([]);
    });

    it('should NOT throw when no file exists', () => {
      expect(() => store.clear()).not.toThrow();
      // After clear, a fresh empty array file is created so subsequent loads
      // return an empty array deterministically.
      expect(store.load()).toEqual([]);
    });

    it('auto-creates data/ directory on clear when missing', () => {
      store.clear();

      const mkdirCall = fs._mkdirCalls.find((c) => c.path === 'data');
      expect(mkdirCall).toBeDefined();
    });
  });

  describe('concurrent append — last-writer-wins (documented acceptable tradeoff)', () => {
    it('documents that two simultaneous appends race and one record is lost — explicitly load-modify-write', () => {
      // Spec: "two courts end sessions simultaneously → both append() calls
      // read the file, push a record, and write back → one record is lost
      // (last writer wins). This is acceptable for the current scale."
      //
      // The store performs load → push → write atomically per call, but two
      // concurrent calls do NOT coordinate via a mutex. The below scenario
      // simulates the race deterministically: both load the same starting
      // array, both write back their respective single-record result. The
      // second write overrides the first.

      fs._files.set('data/session-history.json', JSON.stringify([]));

      // Pre-load both "concurrent" operations against the same file state
      // (i.e., neither sees the other's pending write — no mutex).
      // Then commit both writes to the fake fs in order.
      const recordA = makeRecord({ sessionId: 'a' });
      const recordB = makeRecord({ sessionId: 'b' });

      // First append completes its file write.
      store.append(recordA);
      expect(store.load()).toHaveLength(1);

      // Second append loads fresh, sees recordA, pushes recordB, writes
      // back both — there is no race here because the operations are
      // sequential in this single-threaded simulation. To simulate the
      // last-writer-wins race deterministically, we overwrite the file
      // with a stale snapshot for the second load:
      fs._files.set('data/session-history.json', JSON.stringify([recordA]));

      // Now recordB's append reads [recordA], pushes recordB, writes [recordA, recordB].
      // But in TRUE concurrency, recordB could have loaded an empty array
      // (before recordA's write completed) and would write [recordB],
      // overwriting recordA. We simulate this directly:
      fs._files.set('data/session-history.json', JSON.stringify([recordB]));

      expect(store.load()).toEqual([recordB]);
      // recordA is lost — this is the documented acceptable tradeoff per
      // the spec. If contention becomes problematic, a per-file mutex
      // SHALL be added.
    });
  });

  describe('default filePath', () => {
    it('defaults to data/session-history.json when no path is provided', () => {
      const defaultStore = new SessionHistoryStore(fs);
      defaultStore.append(makeRecord());

      expect(fs._files.has('data/session-history.json')).toBe(true);
    });
  });

  describe('default FileSystem', () => {
    it('uses the real Node fs module when no fs is injected (smoke — does not throw on type)', () => {
      // We don't actually hit disk here — just verify the constructor shape.
      const s = new SessionHistoryStore();
      expect(typeof s.load).toBe('function');
      expect(typeof s.append).toBe('function');
      expect(typeof s.clear).toBe('function');
      expect(typeof s.getAll).toBe('function');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // player-identity (Phase 3 / U2 tasks 3.3, 3.4) — SessionHistoryStore
  // lock + dedup. Spec: `session-history` MODIFIED. Replaces the
  // documented "last-writer-wins" tradeoff (above) with a file-level
  // mutex that serializes concurrent appends AND a sessionId duplicate
  // check that rejects the second append without overwriting the
  // existing record.
  // ═══════════════════════════════════════════════════════════════════

  describe('player-identity — dedup by sessionId (spec: "Duplicate sessionId rejected")', () => {
    it('rejects the second append when sessionId already exists — existing record unchanged', () => {
      const recordA = makeRecord({ sessionId: 'dup-1', courtName: 'Cancha A' });
      fs._files.set('data/session-history.json', JSON.stringify([recordA]));

      // Triangulate the dedup rejection with a SECOND record using the
      // SAME sessionId but a different courtName — proving the store
      // distinguishes by sessionId (not by record contents).
      const duplicateRecord = makeRecord({ sessionId: 'dup-1', courtName: 'Cancha B' });
      store.append(duplicateRecord);

      const loaded = store.load();
      expect(loaded).toHaveLength(1);
      // The EXISTING record (Cancha A) is preserved — the duplicate
      // (Cancha B) was rejected, not merged.
      expect(loaded[0].courtName).toBe('Cancha A');
      expect(loaded[0].sessionId).toBe('dup-1');
    });

    it('appends the second record when sessionId is different (triangulate — dedup is by sessionId, not "always reject")', () => {
      const recordA = makeRecord({ sessionId: 'sess-A', courtName: 'Cancha A' });
      store.append(recordA);

      const recordB = makeRecord({ sessionId: 'sess-B', courtName: 'Cancha B' });
      store.append(recordB);

      const loaded = store.load();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].sessionId).toBe('sess-A');
      expect(loaded[1].sessionId).toBe('sess-B');
    });

    it('preserves prior records when a duplicate is rejected (dedup is additive, not destructive)', () => {
      const existing = [
        makeRecord({ sessionId: 'sess-1', courtName: 'Cancha 1' }),
        makeRecord({ sessionId: 'sess-2', courtName: 'Cancha 2' }),
      ];
      fs._files.set('data/session-history.json', JSON.stringify(existing));

      const duplicate = makeRecord({ sessionId: 'sess-1', courtName: 'Cancha Evil' });
      store.append(duplicate);

      const loaded = store.load();
      expect(loaded).toHaveLength(2);
      expect(loaded.find((r) => r.sessionId === 'sess-1')?.courtName).toBe('Cancha 1');
      expect(loaded.find((r) => r.sessionId === 'sess-2')?.courtName).toBe('Cancha 2');
    });

    it('reports dedup rejection via appendDedup boolean (true on insert, false on duplicate)', () => {
      // The dedup result is observable so callers can distinguish
      // "real new record" from "ignored duplicate". The existing void
      // `append()` stays unchanged for backward-compat; `appendDedup()`
      // exposes the boolean outcome.
      const first = store.appendDedup(makeRecord({ sessionId: 'dedup-1' }));
      expect(first).toBe(true);

      const second = store.appendDedup(makeRecord({ sessionId: 'dedup-1' }));
      expect(second).toBe(false);

      // Triangulate — a fresh sessionId still inserts.
      const third = store.appendDedup(makeRecord({ sessionId: 'dedup-2' }));
      expect(third).toBe(true);

      expect(store.load()).toHaveLength(2);
    });

    it('append() (legacy void-return) silently ignores duplicates — preserves caller contract', () => {
      // The legacy `append()` callers (ClubPlayerHandler.onClubSessionEnd)
      // rely on its void-best-effort contract: never throws, persists when
      // possible. Duplicates are silently skipped (NOT thrown) so session
      // end is never blocked.
      expect(() => store.append(makeRecord({ sessionId: 'legacy-1' }))).not.toThrow();
      expect(() => store.append(makeRecord({ sessionId: 'legacy-1' }))).not.toThrow();
      expect(store.load()).toHaveLength(1);
    });
  });

  describe('player-identity — appendAsync: lock serializes concurrent appends (spec: "File lock serializes concurrent appends")', () => {
    it('persists BOTH records when two appendAsync calls run concurrently via Promise.all', async () => {
      // Spec scenario: "two sessions end simultaneously → both append()
      // calls occur → the lock SHALL serialize writes → both records
      // SHALL be persisted."
      //
      // The in-process mutex (a Promise chain) serializes the load →
      // push → write sequence: appendB's critical section cannot start
      // until appendA's critical section resolves. Both records make it
      // to disk in the order they were acquired — the second sees the
      // first already in the loaded array.
      const recordA = makeRecord({ sessionId: 'async-A', courtName: 'Cancha A' });
      const recordB = makeRecord({ sessionId: 'async-B', courtName: 'Cancha B' });

      await Promise.all([
        store.appendAsync(recordA),
        store.appendAsync(recordB),
      ]);

      const loaded = store.load();
      expect(loaded).toHaveLength(2);
      // Both sessionId values are present (order not asserted — mutex
      // serializes the writes but acquisition order is non-deterministic
      // for truly concurrent Promise.all callers in production).
      const sessionIds = loaded.map((r) => r.sessionId).sort();
      expect(sessionIds).toEqual(['async-A', 'async-B']);
    });

    it('triangulates with 3 concurrent appends — all three persist (lock holds under more contention)', async () => {
      const records = [
        makeRecord({ sessionId: 'c-1' }),
        makeRecord({ sessionId: 'c-2' }),
        makeRecord({ sessionId: 'c-3' }),
      ];

      await Promise.all(records.map((r) => store.appendAsync(r)));

      const loaded = store.load();
      expect(loaded).toHaveLength(3);
      expect(loaded.map((r) => r.sessionId).sort()).toEqual(['c-1', 'c-2', 'c-3']);
    });

    it('applies dedup inside appendAsync — concurrent appendAsync with same sessionId persists only ONE', async () => {
      // The mutex serializes; the inner critical section still applies
      // the sessionId check. Two concurrent calls with the SAME
      // sessionId produce exactly one record — the second is rejected
      // by the dedup check inside the lock.
      const dupA = makeRecord({ sessionId: 'async-dup', courtName: 'Cancha A' });
      const dupB = makeRecord({ sessionId: 'async-dup', courtName: 'Cancha B' });

      await Promise.all([
        store.appendAsync(dupA),
        store.appendAsync(dupB),
      ]);

      expect(store.load()).toHaveLength(1);
      // Whichever arrived first inside the mutex won; no merge happened.
      // Either A or B — but not both, and no corrupted record.
      const loaded = store.load()[0];
      expect(['Cancha A', 'Cancha B']).toContain(loaded.courtName);
      expect(loaded.sessionId).toBe('async-dup');
    });

    it('swallows disk errors and never throws (preserves the legacy never-block-session-end contract under the async path)', async () => {
      fs._throwOnWrite = true;
      const record = makeRecord({ sessionId: 'broken' });

      await expect(store.appendAsync(record)).resolves.not.toThrow();
      // No record persisted — but the promise resolved without rejection.
      expect(store.load()).toEqual([]);
    });

    it('releases the mutex after a failed write — subsequent appendAsync calls still proceed', async () => {
      fs._throwOnWrite = true;
      await store.appendAsync(makeRecord({ sessionId: 'a-fail' }));
      // First call failed inside the critical section but MUST release
      // the mutex — otherwise subsequent calls would hang forever.
      fs._throwOnWrite = false;
      await store.appendAsync(makeRecord({ sessionId: 'a-ok' }));

      expect(store.load()).toHaveLength(1);
      expect(store.load()[0].sessionId).toBe('a-ok');
    });
  });
});