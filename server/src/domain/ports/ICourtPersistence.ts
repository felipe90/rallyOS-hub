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

import type { PersistedFlowSession, PersistedStateV4 } from './persistence-types';
import type { TournamentBracket } from '../../../../shared/types';

export interface ICourtPersistence {
  /**
   * Persist the transient LIVE sessions (v4 `liveSessions` rows — PERS-2).
   * Only the caller is responsible for filtering to relevant flows
   * (tournament LIVE; club OCCUPIED/FINISHED). The implementation handles
   * atomic I/O. The optional bracket is carried on the same document.
   */
  save(sessions: PersistedFlowSession[], bracket?: TournamentBracket | null): void;

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
