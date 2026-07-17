import * as fs from 'fs';
import * as path from 'path';
import { FileSystem, PersistedCourt, PersistedClubCourt, PersistedState, PersistedStateV3, PERSISTENCE_VERSION } from './types';
import { migrateV1toV2, migrateV2toV3 } from './migration';
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
   * Persist courts to disk atomically (tmp + rename).
   * Always writes version 3 format with separate tournament and club arrays.
   * Only the caller is responsible for filtering to LIVE/FINISHED/OCCUPIED courts.
   */
  save(tournamentCourts: PersistedCourt[], clubCourts: PersistedClubCourt[]): void {
    const persisted: PersistedStateV3 = {
      version: PERSISTENCE_VERSION,
      savedAt: Date.now(),
      tournamentCourts,
      clubCourts,
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
   * Load persisted state from disk.
   * Auto-migrates v1→v2→v3 in-memory (disk file is not rewritten).
   * Returns `null` if the file is missing, empty, or contains invalid JSON.
   */
  load(): PersistedStateV3 | null {
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

      // Chain migration: v1 → v2 → v3
      let state: PersistedStateV3;

      if (parsed.version >= 3) {
        // v3 — validate structure and return as-is
        if (!Array.isArray(parsed.tournamentCourts) || !Array.isArray(parsed.clubCourts)) {
          logger.warn('StateStore: invalid v3 format, returning null');
          return null;
        }
        state = parsed as PersistedStateV3;
      } else {
        // v1 or v2 — must have tables array
        if (!Array.isArray(parsed.tables)) {
          logger.warn('StateStore: invalid state format (no tables array), returning null');
          return null;
        }

        // v1 → v2
        const v2 = migrateV1toV2(parsed as PersistedState);

        // v2 → v3
        state = migrateV2toV3(v2);
      }

      return state;
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
