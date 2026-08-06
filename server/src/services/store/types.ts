/**
 * Store Types — backward-compat re-exports from domain/ports/persistence-types.
 *
 * Persistence types have moved to domain/ports/persistence-types.ts to
 * enforce Dependency Inversion. This file re-exports those types for
 * backward compatibility so existing imports continue to work.
 *
 * Store-specific types (PersistedStateV3, PERSISTENCE_VERSION) remain here
 * as they belong to the storage layer.
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
  PersistedStateV4,
  PersistedFlowSession,
  MatchExporter,
  FileSystem,
} from '../../domain/ports/persistence-types';

/**
 * Current persistence schema version.
 * - Version 1: Pre-multi-sport (no sport field in matchState).
 * - Version 2: Multi-sport support (sport field in matchState).
 * - Version 3: Split tournamentCourts[] and clubCourts[] arrays.
 * - Version 4 (admin-court-inventory, PERS-1): persistence WIPE. `load()`
 *   discards any file whose version !== 4 (no v3→v4 data migration — one-way
 *   door, never ship after commercial launch). The v1→v2→v3 migration chain
 *   is removed. The v4 document carries the transient `liveSessions[]`
 *   (PersistedFlowSession) rows ONLY — the legacy tournamentCourts[]/
 *   clubCourts[] arrays are dropped (slice-5 bridge reversal; PERS-2).
 */
export const PERSISTENCE_VERSION = 4;
