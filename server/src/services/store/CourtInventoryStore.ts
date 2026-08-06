import * as fs from 'fs';
import * as path from 'path';
import type { CourtRecord } from '../../../../shared/types';
import type { ICourtInventoryStore } from '../../domain/ports/ICourtInventoryStore';
import type { FileSystem } from '../../domain/ports/persistence-types';
import { logger } from '../../utils/logger';

const DEFAULT_PATH = 'data/court-inventory.json';
const STORE_VERSION = 1;

interface InventoryFile {
  version: number;
  savedAt: number;
  courts: CourtRecord[];
}

/**
 * CourtInventoryStore — durable admin catalog at data/court-inventory.json.
 * Synchronous atomic write (tmp+rename) on EVERY admin mutation, no debounce
 * (PERS-3): admin mutations are low-frequency, so immediacy beats batching.
 * A point burst never touches this file (PERS-2) — only admin mutations do.
 */
export class CourtInventoryStore implements ICourtInventoryStore {
  private readonly fs: FileSystem;
  private readonly filePath: string;

  constructor(fsImpl?: FileSystem, filePath?: string) {
    this.fs = fsImpl ?? (fs as unknown as FileSystem);
    this.filePath = filePath ?? DEFAULT_PATH;
  }

  save(courts: CourtRecord[]): void {
    const dir = path.dirname(this.filePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }
    const payload: InventoryFile = { version: STORE_VERSION, savedAt: Date.now(), courts };
    const tmpPath = this.filePath + '.tmp';
    this.fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
    this.fs.renameSync(tmpPath, this.filePath);
  }

  load(): CourtRecord[] | null {
    try {
      if (!this.fs.existsSync(this.filePath)) return null;
      const raw = this.fs.readFileSync(this.filePath, 'utf-8');
      if (!raw || raw.trim().length === 0) return null;
      const parsed = JSON.parse(raw) as Partial<InventoryFile>;
      if (!parsed || typeof parsed !== 'object' || parsed.version !== STORE_VERSION || !Array.isArray(parsed.courts)) {
        logger.warn('CourtInventoryStore: invalid file, returning null');
        return null;
      }
      return parsed.courts;
    } catch (err) {
      logger.warn({ err }, 'CourtInventoryStore: failed to load, returning null');
      return null;
    }
  }
}
