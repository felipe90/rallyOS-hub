/**
 * IClubConfigRepository — domain port for club configuration persistence.
 *
 * Defines the storage contract for club configuration data (name, sport,
 * pricing, admin PIN). The domain layer depends on this abstraction;
 * concrete implementations (e.g., ClubConfigStore) provide the actual I/O.
 *
 * Methods are synchronous to match the current ClubConfigStore implementation.
 * Following the pattern of all port interfaces in domain/ports/:
 * single-interface file, exported via barrel.
 */

import type { ClubConfig } from '../../../../shared/types';

export interface IClubConfigRepository {
  /**
   * Load club configuration from storage.
   * Returns null if no config file exists or deserialization fails.
   */
  load(): ClubConfig | null;

  /**
   * Persist club configuration to storage atomically.
   */
  save(clubConfig: ClubConfig): void;

  /**
   * Check whether a club configuration file exists in storage.
   */
  checkExists(): boolean;

  /**
   * Delete the club configuration from storage.
   * No-op if no config exists. Must never throw.
   */
  clear(): void;
}
