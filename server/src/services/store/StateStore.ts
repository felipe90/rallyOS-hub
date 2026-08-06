import * as fs from 'fs';
import * as path from 'path';
import { FileSystem, PersistedStateV4, PERSISTENCE_VERSION } from './types';
import { logger } from '../../utils/logger';
import type { ICourtPersistence } from '../../domain/ports/ICourtPersistence';

const DEFAULT_PATH = 'data/rallyos-state.json';

export class StateStore implements ICourtPersistence {
  private readonly fs: FileSystem;
  private readonly filePath: string;

  /**
   * @param fsImpl  Filesystem implementation (real `fs` in production; fake in tests).
   *                Defaults to the Node.js `fs` module.
   * @param filePath  Path to the state JSON file. Defaults to `data/rallyos-state.json`.
   */
  constructor(fsImpl?: FileSystem, filePath?: string) {
    this.fs = fsImpl ?? (fs as unknown as FileSystem);
    this.filePath = filePath ?? DEFAULT_PATH;
  }

  /**
   * Persist the FULL v4 document (PERS-4 single-writer contract) to disk
   * atomically (tmp + rename). The coordinator owns the in-memory snapshot
   * (liveSessions + bracket) and hands it to save() unchanged; save() only
   * stamps `savedAt` and serializes — it never reads the file first (no
   * read-modify-write, so two writers can no longer tear each other's update).
   */
  save(state: PersistedStateV4): void {
    const persisted: PersistedStateV4 = {
      ...state,
      version: PERSISTENCE_VERSION,
      savedAt: Date.now(),
    };

    const dir = path.dirname(this.filePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = this.filePath + '.tmp';
    const json = JSON.stringify(persisted, null, 2);

    this.fs.writeFileSync(tmpPath, json, 'utf-8');
    this.fs.renameSync(tmpPath, this.filePath);
  }

  /**
   * Load persisted state from disk (PERS-1 WIPE).
   *
   * v4 is the ONLY accepted format: any file whose `version !== 4` (v1/v2/v3)
   * is DISCARDED — no v3→v4 data migration, no v1→v2 chain (one-way door).
   * The catalog starts fresh and the admin rebuilds it. Returns `null` when
   * the file is missing, empty, invalid, or from a wiped version.
   */
  load(): PersistedStateV4 | null {
    try {
      if (!this.fs.existsSync(this.filePath)) {
        return null;
      }

      const raw = this.fs.readFileSync(this.filePath, 'utf-8');

      if (!raw || raw.trim().length === 0) {
        return null;
      }

      const parsed = JSON.parse(raw);

      // Basic schema validation
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.version !== 'number'
      ) {
        logger.warn('StateStore: invalid state format, returning null');
        return null;
      }

      // PERS-1 WIPE — any version other than 4 is discarded (no migration).
      if (parsed.version !== PERSISTENCE_VERSION) {
        logger.warn(
          { version: parsed.version, current: PERSISTENCE_VERSION },
          'StateStore: persistence wiped (version mismatch) — returning null',
        );
        return null;
      }

      // v4 — validate structure and return as-is.
      if (!Array.isArray(parsed.liveSessions)) {
        logger.warn('StateStore: invalid v4 format, returning null');
        return null;
      }

      return parsed as PersistedStateV4;
    } catch (err) {
      logger.warn({ err }, 'StateStore: failed to load state, returning null');
      return null;
    }
  }

  /** Check whether the state file exists on disk. */
  checkExists(): boolean {
    return this.fs.existsSync(this.filePath);
  }

  /** Delete the state file. No-op if the file does not exist. */
  clear(): void {
    try {
      if (this.fs.existsSync(this.filePath)) {
        this.fs.unlinkSync(this.filePath);
      }
    } catch {
      // Silently ignore — file might already be gone or unwritable
    }
  }

  /**
   * Move the current state file to an archive directory.
   * Creates `data/archive/` if it does not exist.
   * Returns the archive file path.
   */
  archive(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(path.dirname(this.filePath), 'archive');
    const archivePath = path.join(archiveDir, `torneo-${timestamp}.json`);

    if (!this.fs.existsSync(archiveDir)) {
      this.fs.mkdirSync(archiveDir, { recursive: true });
    }

    if (this.fs.existsSync(this.filePath)) {
      this.fs.renameSync(this.filePath, archivePath);
    }

    return archivePath;
  }
}
