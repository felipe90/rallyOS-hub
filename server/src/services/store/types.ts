/**
 * Store Types — backward-compat re-exports from domain/ports/persistence-types.
 *
 * Persistence types (and PERSISTENCE_VERSION, the domain-owned schema
 * constant) have moved to domain/ports/persistence-types.ts to enforce
 * Dependency Inversion. This file re-exports them for backward compatibility
 * so existing imports continue to work.
 */

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
export { PERSISTENCE_VERSION } from '../../domain/ports/persistence-types';
