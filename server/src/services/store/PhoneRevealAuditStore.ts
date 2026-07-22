/**
 * PhoneRevealAuditStore — Append-only JSONL audit log for admin phone reveals.
 *
 * Spec: `phone-reveal` "Phone Reveal Is Explicit And Audited" — every
 * successful admin phone decryption MUST be traceable to a specific admin
 * action (habeas data / GDPR compliance). One `PhoneRevealAuditEntry` per
 * line in the file `data/phone-reveal-audit.jsonl`.
 *
 * Pattern mirrors the sibling stores (ClubConfigStore, SessionHistoryStore):
 * - FileSystem DI for testability (real `fs` in production, fake in tests).
 * - Atomic tmp+rename writes to guard against partial writes.
 * - Auto-creates the `data/` directory if missing on first write.
 * - Never throws upward: a persistence failure MUST NOT block the reveal
 *   flow (the admin already saw the phone; losing the audit row is logged
 *   and recovered manually — the reveal itself is not reverted).
 *
 * Concurrency (player-identity "File lock serializes concurrent appends"):
 * - `append()` (sync) serializes naturally inside the Node event loop.
 * - `appendAsync()` runs the load → push → write critical section under a
 *   single in-process mutex (Promise chain) so concurrent callers serialize.
 *   Failures inside the critical section are caught so the chain never
 *   permanently rejects — a single failed append cannot block the next.
 *
 * JSONL format note: unlike SessionHistoryStore (a JSON array), this log is
 * JSON Lines — one JSON object per physical line, with a trailing newline
 * after every entry. A reviewer reading the file by `tail`/`grep` sees
 * discrete audit rows, and a torn final line from a crash is skipped
 * (logged) on load rather than bricking the whole audit trail.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileSystem } from './types';
import type { PhoneRevealAuditEntry } from '../../../../shared/types';
import { logger } from '../../utils/logger';

const DEFAULT_PATH = 'data/phone-reveal-audit.jsonl';

export class PhoneRevealAuditStore {
  private readonly fs: FileSystem;
  private readonly filePath: string;
  /**
   * In-process async mutex (Promise chain). See SessionHistoryStore for
   * the rationale — each `appendAsync` call reassigns this field to a
   * Promise that resolves only after the previous critical section
   * completes. The chain never permanently rejects (failures are caught)
   * so a stuck mutex cannot block subsequent appends.
   */
  private mutexChain: Promise<void> = Promise.resolve();

  /**
   * @param fsImpl  Filesystem implementation (real `fs` in production; fake in tests).
   *                Defaults to the Node.js `fs` module.
   * @param filePath  Path to the audit JSONL file. Defaults to
   *                  `data/phone-reveal-audit.jsonl`.
   */
  constructor(fsImpl?: FileSystem, filePath?: string) {
    this.fs = fsImpl ?? (fs as unknown as FileSystem);
    this.filePath = filePath ?? DEFAULT_PATH;
  }

  /**
   * Ensure the directory containing `filePath` exists. Creates it
   * recursively when missing. Errors are non-fatal — the caller (append)
   * catches and logs them, never throwing up.
   */
  private ensureDir(): void {
    const dir = path.dirname(this.filePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Persist the given entries to disk atomically (tmp + rename) as JSONL —
   * one JSON object per line, trailing newline after each entry. Errors
   * are logged and NEVER thrown — see module docstring.
   */
  private writeAtomic(entries: PhoneRevealAuditEntry[]): void {
    try {
      this.ensureDir();
      const tmpPath = this.filePath + '.tmp';
      const jsonl = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length > 0 ? '\n' : '');
      this.fs.writeFileSync(tmpPath, jsonl, 'utf-8');
      this.fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      // Spec: audit failure must not block the reveal — log and swallow.
      logger.warn(
        { err, filePath: this.filePath },
        'PhoneRevealAuditStore: write failed — audit entry persistence skipped',
      );
    }
  }

  /**
   * Load all audit entries from disk as a parsed array.
   *
   * Returns `[]` when:
   * - the file does not exist,
   * - the file is empty,
   * - the file contains no parseable JSONL lines (fully corrupt).
   *
   * Robustness: a single malformed line (e.g. a torn final write from a
   * crash) is skipped and logged; the surrounding valid entries are still
   * returned. This keeps the audit log readable even after a crash — a
   * single bad line never bricks the whole trail.
   *
   * NEVER throws — corrupt state is treated as "no entries yet" (or, when
   * a few lines are bad, "fewer entries") with a logged warning.
   */
  load(): PhoneRevealAuditEntry[] {
    try {
      if (!this.fs.existsSync(this.filePath)) {
        return [];
      }

      const raw = this.fs.readFileSync(this.filePath, 'utf-8');
      if (!raw || raw.trim().length === 0) {
        return [];
      }

      const lines = raw.split('\n');
      const entries: PhoneRevealAuditEntry[] = [];
      let skipped = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        try {
          entries.push(JSON.parse(trimmed) as PhoneRevealAuditEntry);
        } catch {
          // Skip the malformed line but keep the rest of the audit trail.
          skipped++;
        }
      }
      if (skipped > 0) {
        logger.warn(
          { filePath: this.filePath, skipped },
          'PhoneRevealAuditStore: skipped malformed JSONL lines on load',
        );
      }
      return entries;
    } catch (err) {
      logger.warn(
        { err, filePath: this.filePath },
        'PhoneRevealAuditStore: load failed — returning empty array',
      );
      return [];
    }
  }

  /**
   * Sync critical section: load → push → write. NEVER throws — disk
   * failures are caught inside `writeAtomic` and logged.
   */
  private appendInternal(entry: PhoneRevealAuditEntry): void {
    const current = this.load();
    current.push(entry);
    this.writeAtomic(current);
  }

  /**
   * Append a single audit entry atomically. NEVER throws — on any failure
   * (disk full, permission denied, corrupt contents) the error is logged
   * and the call returns normally. The reveal flow MUST NOT be blocked by
   * a persistence failure.
   */
  append(entry: PhoneRevealAuditEntry): void {
    this.appendInternal(entry);
  }

  /**
   * Async append — runs the same load → push → write critical section
   * under the in-process mutex so concurrent callers serialize via
   * `Promise.all`. Both `appendAsync(A)` and `appendAsync(B)` invoked
   * concurrently will persist exactly one entry each; the second call's
   * critical section reads the file AFTER the first call's write completed.
   *
   * Never rejects — the mutex chain catches internal errors and releases
   * the lock on every path so a single failed append cannot permanently
   * block subsequent appends.
   */
  appendAsync(entry: PhoneRevealAuditEntry): Promise<void> {
    const run = (): Promise<void> => {
      try {
        this.appendInternal(entry);
      } catch (err) {
        logger.warn(
          { err, filePath: this.filePath },
          'PhoneRevealAuditStore: appendAsync critical section threw — mutex released',
        );
      }
      return Promise.resolve();
    };

    const next = this.mutexChain.then(run, run);
    this.mutexChain = next.then(() => undefined, () => undefined);
    return next;
  }

  /**
   * Alias for `load()`. Mirrors the `getAll()` naming convention used by
   * the sibling stores so consumers access audit rows uniformly.
   */
  getAll(): PhoneRevealAuditEntry[] {
    return this.load();
  }
}