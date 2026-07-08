/**
 * Persistence Migration — v1 → v2 → v3
 *
 * Version 1: Pre-multi-sport. No `sport` field on matchState.
 * Version 2: Multi-sport support. Each matchState has a `sport` field.
 * Version 3: Split tournamentCourts[] and clubCourts[] arrays.
 *
 * Migration strategy:
 * - In-memory only (disk file is NOT rewritten on load).
 * - v1→v2: detect missing `sport` → default to SPORT.TABLE_TENNIS.
 * - v2→v3: split old `tables[]` into `tournamentCourts[]` and `clubCourts[]`
 *   based on `mode === 'club'`.
 * - Per-table error handling: if a table's data is corrupt/malformed,
 *   skip it with a warning and continue with remaining tables.
 * - Full state object is cloned to avoid mutating the input.
 */

import type { PersistedState, PersistedCourt, PersistedClubCourt, PersistedStateV3 } from './types';
import { SPORT } from '../../../../shared/types';
import { logger } from '../../utils/logger';

export function migrateV1toV2(state: PersistedState): PersistedState {
  // Already at v2 or higher — return as-is
  if (state.version >= 2) {
    return state;
  }

  // Deep-clone to avoid mutating the input
  const cloned: PersistedState = JSON.parse(JSON.stringify(state));

  const migratedTables: PersistedCourt[] = [];

  for (const table of cloned.tables) {
    try {
      if (!table.matchState || typeof table.matchState !== 'object') {
        logger.warn({ tableId: table.id }, 'Migration: skipping table with invalid matchState');
        migratedTables.push(table);
        continue;
      }

      // If sport is already present (e.g. partial migration), keep it
      if (!(table.matchState as any).sport) {
        (table.matchState as any).sport = SPORT.TABLE_TENNIS;
      }

      migratedTables.push(table);
    } catch (err) {
      logger.warn({ tableId: table.id, err }, 'Migration: error migrating table, skipping');
      migratedTables.push(table);
    }
  }

  return {
    version: 2,
    savedAt: cloned.savedAt,
    tables: migratedTables,
  };
}

/**
 * Migrate v2 state to v3 format: split `tables[]` into `tournamentCourts[]`
 * and `clubCourts[]` based on `mode === 'club'`.
 *
 * - Tournament entries keep their existing shape (PersistedCourt).
 * - Club entries are converted to PersistedClubCourt with required
 *   clubStatus/occupiedAt and no status field.
 * - Entries without `mode === 'club'` are treated as tournament courts.
 *
 * @param state  The loaded PersistedState (v2).
 * @returns A migrated PersistedStateV3.
 */
export function migrateV2toV3(state: PersistedState): PersistedStateV3 {
  const tournamentCourts: PersistedCourt[] = [];
  const clubCourts: PersistedClubCourt[] = [];

  for (const table of state.tables) {
    const t = table as any;
    if (t.mode === 'club') {
      clubCourts.push({
        id: table.id,
        number: table.number,
        name: table.name,
        kind: 'club',
        clubStatus: t.clubStatus ?? 'AVAILABLE',
        occupiedAt: t.occupiedAt ?? null,
        pin: table.pin,
        playerNames: { ...table.playerNames },
        createdAt: table.createdAt,
        matchState: table.matchState,
        config: t.config ?? null,
        history: t.history ?? [],
      });
    } else {
      // Tournament courts — strip any club fields that may have leaked in
      const tc: PersistedCourt = {
        id: table.id,
        number: table.number,
        name: table.name,
        status: table.status,
        pin: table.pin,
        playerNames: { ...table.playerNames },
        createdAt: table.createdAt,
        matchState: table.matchState,
      };
      tournamentCourts.push(tc);
    }
  }

  return {
    version: 3,
    savedAt: Date.now(),
    tournamentCourts,
    clubCourts,
  };
}
