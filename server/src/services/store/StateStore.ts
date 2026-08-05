import * as fs from 'fs';
import * as path from 'path';
import { FileSystem, PersistedCourt, PersistedClubCourt, PersistedStateV3, PERSISTENCE_VERSION } from './types';
import { logger } from '../../utils/logger';
import type { ICourtPersistence } from '../../domain/ports/ICourtPersistence';
import type { TournamentBracket } from '../../../../shared/types';

const DEFAULT_PATH = 'data/rallyos-state.json';

export class StateStore implements ICourtPersistence {
  private readonly fs: FileSystem;
  private readonly filePath: string;

  /**
   * In-memory cache of the persisted bracket (P2). Avoids re-reading the
   * entire state file on every `save()` just to carry the bracket forward.
   * The disk is the source of truth on first load; afterwards the cache is
   * authoritative for the process lifetime. Invalidated by clear()/archive().
   */
  private bracketCache: TournamentBracket | null = null;
  private bracketCacheLoaded = false;

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
   * Writes PERSISTENCE_VERSION (4) with separate tournament and club arrays.
   * Only the caller is responsible for filtering to LIVE/FINISHED/OCCUPIED courts.
   */
  save(tournamentCourts: PersistedCourt[], clubCourts: PersistedClubCourt[], bracket?: TournamentBracket | null): void {
    const persisted: PersistedStateV3 = {
      version: PERSISTENCE_VERSION,
      savedAt: Date.now(),
      tournamentCourts,
      clubCourts,
      // If the caller provides a bracket, use it; otherwise carry forward the
      // cached bracket (loaded once from disk) so CourtManager.persistState
      // (which doesn't own the bracket) never wipes it. Spec R10: bracket
      // survives court saves.
      bracket: bracket !== undefined ? bracket : this.getCachedBracket(),
    };

    if (bracket !== undefined) {
      this.bracketCache = bracket;
      this.bracketCacheLoaded = true;
    }

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

      // PERS-1 WIPE — any version other than 4 is discarded (no migration).
      if (parsed.version !== PERSISTENCE_VERSION) {
        logger.warn(
          { version: parsed.version, current: PERSISTENCE_VERSION },
          'StateStore: persistence wiped (version mismatch) — returning null',
        );
        return null;
      }

      // v4 — validate structure and return as-is.
      if (!Array.isArray(parsed.tournamentCourts) || !Array.isArray(parsed.clubCourts)) {
        logger.warn('StateStore: invalid v4 format, returning null');
        return null;
      }

      return parsed as PersistedStateV3;
    } catch (err) {
      logger.warn({ err }, 'StateStore: failed to load state, returning null');
      return null;
    }
  }

  /** Check whether the state file exists on disk. */
  checkExists(): boolean {
    return this.fs.existsSync(this.filePath);
  }

  /**
   * Read the persisted bracket (R10). Returns `null` when the file is absent,
   * has no `bracket` key (legacy v4 files), or the bracket was explicitly
   * cleared (`bracket: null`).
   */
  getBracket(): TournamentBracket | null {
    return this.load()?.bracket ?? null;
  }

  /**
   * Persist the bracket independently of the court arrays. Reads the current
   * state file (preserving tournament/club courts) and writes a fresh v4
   * document with the supplied bracket. Pass `null` to clear. Used by
   * BracketHandler (which owns the bracket) without coupling CourtManager to
   * the bracket domain.
   *
   * MVP note: bracket and court saves both do an atomic tmp+rename on the same
   * file. The single-owner Raspberry Pi target makes a torn write between the
   * two writers extremely unlikely; a future revision can route both through
   * one atomic writer.
   */
  setBracket(bracket: TournamentBracket | null): void {
    try {
      const existing = this.load() ?? {
        version: PERSISTENCE_VERSION,
        savedAt: Date.now(),
        tournamentCourts: [] as PersistedCourt[],
        clubCourts: [] as PersistedClubCourt[],
      };
      this.save(existing.tournamentCourts, existing.clubCourts, bracket);
    } catch (err) {
      logger.error({ err }, 'StateStore: setBracket failed');
    }
  }

  /**
   * Read ONLY the bracket field from disk (best-effort), without running the
   * full migration pipeline. Used to seed the in-memory bracket cache on
   * first access so `save()` never re-reads the whole file per point (P2).
   */
  private readBracketFromDisk(): TournamentBracket | null {
    try {
      if (!this.fs.existsSync(this.filePath)) return null;
      const raw = this.fs.readFileSync(this.filePath, 'utf-8');
      if (!raw || raw.trim().length === 0) return null;
      const parsed = JSON.parse(raw) as { bracket?: TournamentBracket | null };
      return parsed?.bracket ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Return the current bracket without hitting the filesystem after the first
   * load (P2). First call reads from disk; afterwards the in-memory cache is
   * authoritative. `null` is a legitimate cached value (no bracket persisted).
   */
  private getCachedBracket(): TournamentBracket | null {
    if (!this.bracketCacheLoaded) {
      this.bracketCache = this.readBracketFromDisk();
      this.bracketCacheLoaded = true;
    }
    return this.bracketCache;
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
    this.bracketCache = null;
    this.bracketCacheLoaded = false;
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

    // File moved — the in-memory bracket cache no longer reflects disk.
    this.bracketCache = null;
    this.bracketCacheLoaded = false;

    return archivePath;
  }
}
