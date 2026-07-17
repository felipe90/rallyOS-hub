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

import type { PersistedCourt, PersistedClubCourt, PersistedStateV3 } from './persistence-types';

export interface ICourtPersistence {
  /**
   * Persist tournament and club courts to storage.
   * Only the caller is responsible for filtering to relevant states
   * (LIVE/FINISHED/OCCUPIED). The implementation handles atomic I/O.
   */
  save(tournamentCourts: PersistedCourt[], clubCourts: PersistedClubCourt[]): void;

  /**
   * Load persisted state from storage.
   * Returns null if no state exists or deserialization fails.
   * Implementations should handle migration from older formats.
   */
  load(): PersistedStateV3 | null;

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
