/**
 * ClubConfigStore — Atomic-write JSON persistence for ClubConfig
 *
 * Same pattern as StateStore: FileSystem DI for testability, atomic
 * tmp+rename writes, singleton responsibility for club config data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileSystem } from './types';
import type { ClubConfig } from '../../../../shared/types';
import type { IClubConfigRepository } from '../../domain/ports/IClubConfigRepository';

const DEFAULT_PATH = 'data/club-config.json';

export class ClubConfigStore implements IClubConfigRepository {
  private readonly fs: FileSystem;
  private readonly filePath: string;

  /**
   * @param fsImpl  Filesystem implementation (real `fs` in production; fake in tests).
   *                Defaults to the Node.js `fs` module.
   * @param filePath  Path to the config JSON file. Defaults to `data/club-config.json`.
   */
  constructor(fsImpl?: FileSystem, filePath?: string) {
    this.fs = fsImpl ?? (fs as unknown as FileSystem);
    this.filePath = filePath ?? DEFAULT_PATH;
  }

  /**
   * Persist ClubConfig to disk atomically (tmp + rename).
   */
  save(clubConfig: ClubConfig): void {
    const dir = path.dirname(this.filePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = this.filePath + '.tmp';
    const json = JSON.stringify(clubConfig, null, 2);

    this.fs.writeFileSync(tmpPath, json, 'utf-8');
    this.fs.renameSync(tmpPath, this.filePath);
  }

  /**
   * Load ClubConfig from disk.
   * Returns `null` if the file is missing, empty, or contains invalid JSON.
   */
  load(): ClubConfig | null {
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
        typeof parsed.clubName !== 'string' ||
        typeof parsed.sport !== 'string'
      ) {
        return null;
      }

      return {
        clubName: parsed.clubName,
        sport: parsed.sport,
        configured: parsed.configured === true,
        adminPinHash: parsed.adminPinHash || '',
        createdAt: parsed.createdAt || Date.now(),
        costPerMinute: typeof parsed.costPerMinute === 'number' ? parsed.costPerMinute : 0,
        currency: typeof parsed.currency === 'string' ? parsed.currency : 'ARS',
      };
    } catch {
      return null;
    }
  }

  /** Check whether the config file exists on disk. */
  checkExists(): boolean {
    return this.fs.existsSync(this.filePath);
  }

  /** Delete the config file. No-op if the file does not exist. */
  clear(): void {
    try {
      if (this.fs.existsSync(this.filePath)) {
        this.fs.unlinkSync(this.filePath);
      }
    } catch {
      // Silently ignore
    }
  }
}
