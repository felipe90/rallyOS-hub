/**
 * Persistence Migration — v1 → v2
 *
 * Version 1: Pre-multi-sport. No `sport` field on matchState.
 * Version 2: Multi-sport support. Each matchState has a `sport` field.
 *
 * Migration strategy:
 * - In-memory only (disk file is NOT rewritten on load).
 * - If state is already v2, return unchanged.
 * - Iterate all tables, detect missing `sport` → default to 'tableTennis'.
 * - Per-table error handling: if a table's matchState is corrupt/malformed,
 *   skip it with a warning and continue with remaining tables.
 * - Full state object is cloned to avoid mutating the input.
 *
 * @param state  The loaded PersistedState (v1 or v2).
 * @returns A migrated PersistedState (always v2).
 */

import type { PersistedState, PersistedTable } from './types';
import { PERSISTENCE_VERSION } from './types';
import { logger } from '../../utils/logger';

export function migrateV1toV2(state: PersistedState): PersistedState {
  // Already at current version — return as-is
  if (state.version >= PERSISTENCE_VERSION) {
    return state;
  }

  // Deep-clone to avoid mutating the input
  const cloned: PersistedState = JSON.parse(JSON.stringify(state));

  const migratedTables: PersistedTable[] = [];

  for (const table of cloned.tables) {
    try {
      if (!table.matchState || typeof table.matchState !== 'object') {
        logger.warn({ tableId: table.id }, 'Migration: skipping table with invalid matchState');
        migratedTables.push(table);
        continue;
      }

      // If sport is already present (e.g. partial migration), keep it
      if (!(table.matchState as any).sport) {
        (table.matchState as any).sport = 'tableTennis';
      }

      migratedTables.push(table);
    } catch (err) {
      logger.warn({ tableId: table.id, err }, 'Migration: error migrating table, skipping');
      migratedTables.push(table);
    }
  }

  return {
    version: PERSISTENCE_VERSION,
    savedAt: cloned.savedAt,
    tables: migratedTables,
  };
}
