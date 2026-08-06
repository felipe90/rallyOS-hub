/**
 * ICourtPersistence — domain port for court state persistence.
 *
 * Defines the storage contract for persisting and restoring tournament
 * and club court state. The domain layer depends on this abstraction;
 * concrete implementations (e.g., StateStore) provide the actual I/O.
 *
 * Methods are synchronous to match the current StateStore implementation.
 * Following the pattern of all port interfaces in domain/ports/:
 * single-interface file, exported via barrel.
 */

import type { PersistedStateV4 } from './persistence-types';

export interface ICourtPersistence {
  /**
   * Persist the FULL v4 document (PERS-4 single-writer contract). The caller
   * (PersistenceCoordinator) owns the in-memory snapshot — liveSessions rows
   * AND the bracket — and hands the whole document to save(); the
   * implementation performs atomic tmp+rename I/O only, never reading the
   * file first. There is deliberately NO bracket-arg overload: a second
   * writer on this file was the R2 torn-write source (removed in slice 6).
   */
  save(state: PersistedStateV4): void;

  /**
   * Load persisted state from storage (v4 shape, PERS-1 WIPE).
   * Returns null if no state exists, deserialization fails, or the file
   * version is not 4 (v1/v2/v3 files are discarded — one-way door).
   */
  load(): PersistedStateV4 | null;

  /**
   * Check whether persisted state exists in storage.
   */
  checkExists(): boolean;

  /**
   * Delete all persisted state from storage.
   * No-op if no state exists. Must never throw.
   */
  clear(): void;
}
