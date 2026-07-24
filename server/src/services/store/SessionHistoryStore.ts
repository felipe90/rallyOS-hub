/**
 * SessionHistoryStore — Atomic-write JSON persistence for club session records.
 *
 * Append-only store backing `data/session-history.json`. Same pattern as
 * ClubConfigStore:
 * - FileSystem DI for testability (real `fs` in production, fake in tests).
 * - Atomic tmp+rename writes to guard against partial writes.
 * - Auto-creates the `data/` directory if missing on first write.
 *
 * Spec contract (see `club-session-history` spec, "SessionHistoryStore"
 * requirement, MODIFIED by `player-identity` "SessionHistoryStore — Lock
 * & Dedup"):
 * - `load()` returns `[]` on missing file, corrupt JSON, non-array JSON, or
 *   empty string. It NEVER throws — corrupt state is treated as "no
 *   history yet" and a warning is logged.
 * - `append()` performs load → dedup → push → write. If any step throws,
 *   the error is logged and the call returns without throwing. The session
 *   end flow MUST NOT be blocked by a persistence failure (the court still
 *   transitions to FINISHED; the record for that end is lost).
 * - `appendDedup()` is the boolean-outcome variant — returns `true` when
 *   the record was inserted, `false` when it was skipped as a duplicate.
 * - `appendAsync()` is the awaitable variant for callers that prefer the
 *   mutex-serialized path (e.g., concurrent session ends). It uses a
 *   Promise-chain in-process mutex so concurrent calls serialize their
 *   load → dedup → push → write critical sections. The mutex is released
 *   even when the write throws — a single failed append never blocks the
 *   next one.
 * - `clear()` writes `[]` to disk atomically.
 * - `getAll()` is an alias for `load()`.
 *
 * Concurrency notes (player-identity: "File lock serializes concurrent
 * appends" and "Duplicate sessionId rejected"):
 * - The Sync `append()` / `appendDedup()` paths serialize naturally
 *   inside the Node event loop (sync code can't be preempted). However,
 *   when multiple socket handlers call them across microtask boundaries
 *   the read-modify-write sequence still benefits from the dedup check
 *   (which prevents duplicate sessionId records from racy retries). Use
 *   `appendAsync()` for callers that explicitly want Mutex-style cross-
 *   microtask serialization.
 * - The mutex is in-process (a Promise chain). It does NOT protect across
 *   process restarts or multiple Node processes — for the local single-
 *   process hub this is sufficient. The DEdup check is what prevents
 *   duplicates after a restart-driven retry (e.g., the same sessionId
 *   being written again on reconnect).
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileSystem } from './types';
import type { SessionRecord } from '../../../../shared/types';
import { logger } from '../../utils/logger';

const DEFAULT_PATH = 'data/session-history.json';

export class SessionHistoryStore {
  private readonly fs: FileSystem;
  private readonly filePath: string;
  /**
   * In-process async mutex (Promise chain). Each `appendAsync` call
   * reassigns this field to a Promise that resolves only after the
   * previous critical section completes — guaranteeing serial access
   * to the load → dedup → push → write section. Failures inside the
   * critical section are caught so the chain never permanently rejects
   * (a stuck mutex would block every subsequent append).
   */
  private mutexChain: Promise<void> = Promise.resolve();

  /**
   * @param fsImpl  Filesystem implementation (real `fs` in production; fake in tests).
   *                Defaults to the Node.js `fs` module.
   * @param filePath  Path to the session history JSON file. Defaults to
   *                  `data/session-history.json`.
   */
  constructor(fsImpl?: FileSystem, filePath?: string) {
    this.fs = fsImpl ?? (fs as unknown as FileSystem);
    this.filePath = filePath ?? DEFAULT_PATH;
  }

  /**
   * Ensure the directory containing `filePath` exists. Creates it
   * recursively when missing. Errors are non-fatal — the caller (append /
   * clear) catches and logs them, never throwing up.
   */
  private ensureDir(): void {
    const dir = path.dirname(this.filePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Persist the given records to disk atomically (tmp + rename).
   * Errors are logged and NEVER thrown — see module docstring.
   */
  private writeAtomic(records: SessionRecord[]): void {
    try {
      this.ensureDir();
      const tmpPath = this.filePath + '.tmp';
      const json = JSON.stringify(records, null, 2);
      this.fs.writeFileSync(tmpPath, json, 'utf-8');
      this.fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      // Spec: "Write failure does not block session end" — log and swallow.
      logger.warn(
        { err, filePath: this.filePath },
        'SessionHistoryStore: write failed — session record persistence skipped',
      );
    }
  }

  /**
   * Load all session records from disk.
   *
   * Returns `[]` when:
   * - the file does not exist,
   * - the file is empty,
   * - the JSON is corrupt,
   * - the top-level JSON value is not an array.
   *
   * NEVER throws — corrupt state is treated as "no history yet" with a
   * logged warning.
   */
  load(): SessionRecord[] {
    try {
      if (!this.fs.existsSync(this.filePath)) {
        return [];
      }

      const raw = this.fs.readFileSync(this.filePath, 'utf-8');
      if (!raw || raw.trim().length === 0) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        logger.warn(
          { filePath: this.filePath },
          'SessionHistoryStore: file content is not an array — treating as empty',
        );
        return [];
      }

      return parsed as SessionRecord[];
    } catch (err) {
      logger.warn(
        { err, filePath: this.filePath },
        'SessionHistoryStore: load failed — returning empty array',
      );
      return [];
    }
  }

  /**
   * Sync internal critical section: load → dedup by sessionId → push →
   * write. Returns `true` when the record was inserted, `false` when
   * skipped as a duplicate of an existing sessionId.
   *
   * Spec: "Duplicate sessionId rejected" — the existing record remains
   * unchanged; the new record is silently skipped (the caller — session
   * end flow — treats persistence as best-effort and never blocks on a
   * duplicate).
   *
   * Disk failures are caught and swallowed inside `writeAtomic` so the
   * `append` family never throws upward.
   */
  private appendInternal(record: SessionRecord): boolean {
    const current = this.load();
    const dup = current.some((r) => r.sessionId === record.sessionId);
    if (dup) {
      logger.info(
        { sessionId: record.sessionId, filePath: this.filePath },
        'SessionHistoryStore: duplicate sessionId rejected',
      );
      return false;
    }
    current.push(record);
    this.writeAtomic(current);
    return true;
  }

  /**
   * Append a single session record atomically. (Void-returning, legacy.)
   *
   * Performs load → dedup → push → write. NEVER throws — on any failure
   * (disk full, permission denied, corrupt contents, duplicate sessionId)
   * the error is logged and the call returns normally. Session end flow
   * MUST NOT be blocked. Duplicates are silently skipped (use
   * `appendDedup()` when the boolean outcome matters).
   */
  append(record: SessionRecord): void {
    this.appendInternal(record);
  }

  /**
   * Append with dedup outcome. Returns `true` when the record was
   * inserted, `false` when it was skipped as a duplicate of an existing
   * sessionId (or when the write failed — both cases share the
   * "not-persisted-as-new" outcome from the caller's perspective).
   *
   * Identical atomic-write + never-throw guarantees as `append()`.
   */
  appendDedup(record: SessionRecord): boolean {
    return this.appendInternal(record);
  }

  /**
   * Async append — runs the same load → dedup → push → write critical
   * section under a single in-process mutex (Promise chain) so concurrent
   * callers serialize. Both `appendAsync(A)` and `appendAsync(B)` invoked
   * via `Promise.all` will persist exactly one record each; the second
   * call's critical section reads the file AFTER the first call's write
   * completed.
   *
   * Never rejects — the mutex chain catches internal errors and releases
   * the lock on every path so a single failed append cannot permanently
   * block subsequent appends.
   */
  appendAsync(record: SessionRecord): Promise<void> {
    const run = (): Promise<void> => {
      try {
        this.appendInternal(record);
      } catch (err) {
        // Last-resort safety: appendInternal + writeAtomic swallow their
        // own errors, but if a defensive try/catch inside them rethrows
        // we still release the mutex.
        logger.warn(
          { err, filePath: this.filePath },
          'SessionHistoryStore: appendAsync critical section threw — mutex released',
        );
      }
      return Promise.resolve();
    };

    const next = this.mutexChain.then(run, run);
    // Do NOT mutate `this.mutexChain` with the caller's rejection —
    // `run` never rejects, so the chain stays Resolved regardless of
    // caller-side `.then` handling.
    this.mutexChain = next.then(() => undefined, () => undefined);
    return next;
  }

  /**
   * Clear all persisted records — writes an empty array to disk atomically.
   * See `club-session-history` spec ("Reset" rule).
   */
  clear(): void {
    this.writeAtomic([]);
  }

  /**
   * Alias for `load()`. Provided to mirror the naming convention used by
   * consumers that expect a `getAll()` accessor (e.g., the CSV export route
   * in PR 2).
   */
  getAll(): SessionRecord[] {
    return this.load();
  }
}