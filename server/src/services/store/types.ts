/**
 * Store Types — backward-compat re-exports from domain/ports/persistence-types.
 *
 * Persistence types have moved to domain/ports/persistence-types.ts to
 * enforce Dependency Inversion. This file re-exports those types for
 * backward compatibility so existing imports continue to work.
 *
 * Store-specific types (PersistedState, PersistedStateV3, PERSISTENCE_VERSION)
 * remain here as they belong to the storage layer.
 */

import type {
  PersistedCourt as DomainPersistedCourt,
  PersistedClubCourt as DomainPersistedClubCourt,
} from '../../domain/ports/persistence-types';
export type {
  PersistedMatchState,
  PersistedCourt,
  PersistedTable,
  PersistedClubCourt,
  PersistedStateV3,
  MatchExporter,
  FileSystem,
} from '../../domain/ports/persistence-types';

/**
 * Current persistence schema version.
 * - Version 1: Pre-multi-sport (no sport field in matchState).
 * - Version 2: Multi-sport support (sport field in matchState).
 * - Version 3: Split tournamentCourts[] and clubCourts[] arrays.
 */
export const PERSISTENCE_VERSION = 3;

/**
 * Top-level persistence wrapper written to disk.
 */
export interface PersistedState {
  version: number;
  savedAt: number;
  tables: DomainPersistedCourt[];
}

// PersistedStateV3 re-exported from domain/ports/persistence-types.ts
