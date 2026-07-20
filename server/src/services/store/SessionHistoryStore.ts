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
 * requirement):
 * - `load()` returns `[]` on missing file, corrupt JSON, non-array JSON, or
 *   empty string. It NEVER throws — corrupt state is treated as "no
 *   history yet" and a warning is logged.
 * - `append()` performs load → push → write atomically. If any step throws,
 *   the error is logged and the call returns without throwing. The session
 *   end flow MUST NOT be blocked by a persistence failure (the court still
 *   transitions to FINISHED; the record for that end is lost).
 * - `clear()` writes `[]` to disk atomically.
 * - `getAll()` is an alias for `load()`.
 *
 * Concurrency note (spec: "Concurrent append — last-writer-wins"):
 * The load → push → write sequence is NOT coordinated via a mutex. Two
 * concurrent `append` calls may both read the same starting array, push
 * their respective record, and write back — one record is lost. This is an
 * ACCEPTABLE tradeoff for the current scale. If contention becomes
 * problematic, a per-file mutex SHALL be added.
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
   * Append a single session record atomically.
   *
   * Performs load → push → write. NEVER throws — on any failure (disk
   * full, permission denied, corrupt contents) the error is logged and the
   * call returns normally. Session end flow MUST NOT be blocked.
   */
  append(record: SessionRecord): void {
    const current = this.load();
    current.push(record);
    this.writeAtomic(current);
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