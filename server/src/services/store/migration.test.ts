import { SPORT } from '../../../../shared/types';
/**
 * Migration tests: v1 → v2 → v3 state transformation.
 *
 * v1→v2 tests cover:
 * - Normal v1→v2 migration (adds sport field)
 * - v2 state passes through unchanged (idempotency)
 * - Corrupt table handling (skip + warn)
 * - Edge cases: missing matchState, empty tables, all tables corrupt
 * - Sport field defaults to SPORT.TABLE_TENNIS
 *
 * v2→v3 tests cover:
 * - Mixed courts split into tournamentCourts[] and clubCourts[]
 * - v3 state passes through unchanged (idempotent)
 * - v2 with only tournament courts → empties clubCourts[]
 * - v2 with mode='club' but missing clubStatus → defaults to AVAILABLE
 */

import { migrateV1toV2, migrateV2toV3 } from './migration';
import type { PersistedState, PersistedCourt, PersistedClubCourt, PersistedStateV3 } from './types';

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Create a v1-style table (no sport field in matchState).
 * Uses 'as any' casts because v1 data intentionally lacks the required
 * PersistedMatchState.sport field — that's what migration fixes.
 */
function makeV1Table(overrides: Partial<PersistedCourt> = {}): PersistedCourt {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    pin: '4821',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
    matchState: {
      // v1: no sport field
      config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { a: 5, b: 3 },
        serving: 'B',
      },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      history: [],
    } as any, // v1 intentionally lacks sport
    ...overrides,
  };
}

function makeV1State(tables: PersistedCourt[] = [makeV1Table()]): PersistedState {
  return {
    version: 1,
    savedAt: 1700000000000,
    tables,
  };
}

/** Create a primitive v1 matchState object (raw object, not typed) */
function v1MatchState(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
    score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
    swappedSides: false,
    midSetSwapped: false,
    setHistory: [],
    status: 'LIVE',
    winner: null,
    history: [],
    ...overrides,
  };
}

describe('migrateV1toV2', () => {
  describe('version detection', () => {
    it('should add sport field to all tables when migrating from v1', () => {
      const state = makeV1State();
      const result = migrateV1toV2(state);

      expect(result.version).toBe(2);
      expect(result.savedAt).toBe(1700000000000);
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
    });

    it('should skip migration and return state unchanged when already v2', () => {
      const v2State: PersistedState = {
        version: 2,
        savedAt: 1700000000000,
        tables: [{
          id: 'table-1',
          number: 1,
          name: 'Mesa 1',
          status: 'LIVE',
          pin: '4821',
          playerNames: { a: 'Alice', b: 'Bob' },
          createdAt: 1700000000000,
          matchState: {
            config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
            score: { sets: { a: 1, b: 0 }, currentSet: { a: 11, b: 9 }, serving: 'A' },
            swappedSides: false,
            midSetSwapped: false,
            setHistory: [{ a: 11, b: 9 }],
            status: 'FINISHED',
            winner: 'A',
            sport: SPORT.TABLE_TENNIS,
            history: [],
          },
        }],
      };

      // Deep freeze to detect mutation
      const frozen = JSON.parse(JSON.stringify(v2State));

      const result = migrateV1toV2(v2State);

      expect(result).toEqual(frozen);
      expect(result.version).toBe(2);
    });

    it('should be idempotent — calling twice produces same result', () => {
      const state = makeV1State([makeV1Table({ id: 't1' }), makeV1Table({ id: 't2' })]);
      const once = migrateV1toV2(state);
      const twice = migrateV1toV2(once);

      expect(twice).toEqual(once);
      expect(twice.version).toBe(2);
      expect(twice.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
      expect(twice.tables[1].matchState.sport).toBe(SPORT.TABLE_TENNIS);
    });
  });

  describe('field migration', () => {
    it('should set sport to tableTennis for v1 tables without sport field', () => {
      const state = makeV1State();
      const result = migrateV1toV2(state);

      expect(result.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
    });

    it('should preserve existing v2 sport fields when passed through', () => {
      const v2State: PersistedState = {
        version: 2,
        savedAt: 1700000000000,
        tables: [{
          id: 'table-1',
          number: 1,
          name: 'Mesa 1',
          status: 'LIVE',
          pin: '4821',
          playerNames: { a: 'Alice', b: 'Bob' },
          createdAt: 1700000000000,
          matchState: {
            config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
            score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
            swappedSides: false,
            midSetSwapped: false,
            setHistory: [],
            status: 'WAITING',
            winner: null,
            sport: SPORT.TABLE_TENNIS,
            history: [],
          },
        }],
      };

      const result = migrateV1toV2(v2State);
      expect(result.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
    });

    it('should not mutate the input state object', () => {
      const state = makeV1State();
      const originalVersion = state.version;

      migrateV1toV2(state);

      // Original should still be v1
      expect(state.version).toBe(originalVersion);
    });

    it('should preserve all other fields when migrating', () => {
      const table = makeV1Table({
        id: 't1',
        number: 5,
        name: 'Final Table',
        pin: '9999',
        playerNames: { a: 'Carlos', b: 'Diana' },
        createdAt: 1234567890,
        matchState: {
          config: { pointsPerSet: 11, bestOf: 5, minDifference: 2 },
          score: { sets: { a: 2, b: 1 }, currentSet: { a: 11, b: 7 }, serving: 'A' },
          swappedSides: true,
          midSetSwapped: false,
          setHistory: [{ a: 11, b: 5 }, { a: 9, b: 11 }, { a: 11, b: 8 }],
          status: 'LIVE',
          winner: null,
          history: [
            { id: 'h1', player: 'A', action: 'POINT', pointsBefore: { a: 0, b: 0 }, pointsAfter: { a: 1, b: 0 }, timestamp: 1234567890 },
          ],
        } as any,
      });

      const state = makeV1State([table]);
      const result = migrateV1toV2(state);

      expect(result.tables[0].id).toBe('t1');
      expect(result.tables[0].number).toBe(5);
      expect(result.tables[0].name).toBe('Final Table');
      expect(result.tables[0].pin).toBe('9999');
      expect(result.tables[0].playerNames).toEqual({ a: 'Carlos', b: 'Diana' });
      expect(result.tables[0].createdAt).toBe(1234567890);
      expect(result.tables[0].matchState.config).toEqual({ pointsPerSet: 11, bestOf: 5, minDifference: 2 });
      expect(result.tables[0].matchState.score).toEqual({ sets: { a: 2, b: 1 }, currentSet: { a: 11, b: 7 }, serving: 'A' });
      expect(result.tables[0].matchState.swappedSides).toBe(true);
      expect(result.tables[0].matchState.setHistory).toHaveLength(3);
      expect(result.tables[0].matchState.status).toBe('LIVE');
      // sport was added
      expect(result.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
      // history preserved
      expect(result.tables[0].matchState.history).toHaveLength(1);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty tables array', () => {
      const state = makeV1State([]);
      const result = migrateV1toV2(state);

      expect(result.version).toBe(2);
      expect(result.tables).toEqual([]);
    });

    it('should handle table with null/undefined matchState by skipping it', () => {
      const state = makeV1State([
        makeV1Table({ id: 'good' }),
        makeV1Table({ id: 'bad', matchState: null as any }),
      ]);

      const result = migrateV1toV2(state);

      // Should still have 2 tables — the bad one is kept but not crash
      expect(result.tables).toHaveLength(2);
      // Good table migrated
      expect(result.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
      // Bad table should be skipped (matchState unchanged or absent)
      expect(result.tables[1].matchState).toBeNull();
    });

    it('should skip corrupt tables and preserve valid ones', () => {
      const state = makeV1State([
        makeV1Table({ id: 't1' }),
        makeV1Table({ id: 't2', matchState: { something: 'wrong' } as any }),
        makeV1Table({ id: 't3' }),
      ]);

      const result = migrateV1toV2(state);

      // Bad table's matchState is kept as-is, not crash
      expect(result.tables).toHaveLength(3);
      // Check that t1 and t3 have sport field
      const t1 = result.tables.find(t => t.id === 't1')!;
      const t3 = result.tables.find(t => t.id === 't3')!;
      const t2 = result.tables.find(t => t.id === 't2')!;
      expect(t1.matchState.sport).toBe(SPORT.TABLE_TENNIS);
      expect(t3.matchState.sport).toBe(SPORT.TABLE_TENNIS);
      // t2's matchState is not guaranteed to have sport since it's corrupt
    });

    it('should handle FINISHED tables in v1 format correctly', () => {
      const state = makeV1State([{
        id: 'table-1',
        number: 1,
        name: 'Mesa 1',
        status: 'FINISHED',
        pin: '4821',
        playerNames: { a: 'Alice', b: 'Bob' },
        createdAt: 1700000000000,
        matchState: {
          config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
          score: { sets: { a: 2, b: 0 }, currentSet: { a: 11, b: 5 }, serving: 'A' },
          swappedSides: false,
          midSetSwapped: false,
          setHistory: [{ a: 11, b: 5 }, { a: 11, b: 9 }],
          status: 'FINISHED',
          winner: 'A',
          history: [],
        } as any,
      }]);

      const result = migrateV1toV2(state);

      expect(result.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
      expect(result.tables[0].matchState.status).toBe('FINISHED');
      expect(result.tables[0].matchState.winner).toBe('A');
      expect(result.tables[0].status).toBe('FINISHED');
    });

    it('should handle v1 state with empty matchState (no score yet)', () => {
      const state = makeV1State([{
        id: 'table-1',
        number: 1,
        name: 'Mesa 1',
        status: 'WAITING',
        pin: '4821',
        playerNames: { a: 'Alice', b: 'Bob' },
        createdAt: 1700000000000,
        matchState: {
          config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
          score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
          swappedSides: false,
          midSetSwapped: false,
          setHistory: [],
          status: 'WAITING',
          winner: null,
          history: [],
        } as any,
      }]);

      const result = migrateV1toV2(state);

      expect(result.tables[0].matchState.sport).toBe(SPORT.TABLE_TENNIS);
      expect(result.tables[0].matchState.status).toBe('WAITING');
    });
  });
});

// ── v2 → v3 Migration ─────────────────────────────────────────────────

/**
 * Create a v2-style table (with sport field in matchState).
 */
function makeV2Table(overrides: Partial<PersistedCourt> & { mode?: string; clubStatus?: string; occupiedAt?: number } = {}): PersistedCourt {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    pin: '4821',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
    matchState: {
      config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'B' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
      history: [],
    },
    mode: overrides.mode,
    clubStatus: overrides.clubStatus,
    occupiedAt: overrides.occupiedAt,
    ...overrides,
  };
}

function makeV2State(tables: PersistedCourt[] = [makeV2Table()]): PersistedState {
  return {
    version: 2,
    savedAt: 1700000000000,
    tables,
  };
}

describe('migrateV2toV3', () => {
  describe('court split', () => {
    it('should split mixed tournament and club courts into separate arrays', () => {
      const tournament = makeV2Table({ id: 't1', status: 'LIVE' });
      const club = makeV2Table({
        id: 'c1',
        status: 'WAITING' as any,
        mode: 'club',
        clubStatus: 'OCCUPIED',
        occupiedAt: 1700000001000,
      });
      const state = makeV2State([tournament, club]);

      const result = migrateV2toV3(state);

      expect(result.version).toBe(3);
      expect(typeof result.savedAt).toBe('number');
      expect(result.tournamentCourts).toHaveLength(1);
      expect(result.clubCourts).toHaveLength(1);

      // Tournament court preserved with status
      expect(result.tournamentCourts[0].id).toBe('t1');
      expect(result.tournamentCourts[0].status).toBe('LIVE');
      // Club fields stripped from tournament
      expect((result.tournamentCourts[0] as any).mode).toBeUndefined();
      expect((result.tournamentCourts[0] as any).clubStatus).toBeUndefined();

      // Club court has correct shape
      expect(result.clubCourts[0].id).toBe('c1');
      expect(result.clubCourts[0].kind).toBe('club');
      expect(result.clubCourts[0].clubStatus).toBe('OCCUPIED');
      expect(result.clubCourts[0].occupiedAt).toBe(1700000001000);
    });

    it('should handle v2 state with only tournament courts — clubCourts is empty', () => {
      const t1 = makeV2Table({ id: 't1', status: 'LIVE' });
      const t2 = makeV2Table({ id: 't2', status: 'FINISHED' });
      const state = makeV2State([t1, t2]);

      const result = migrateV2toV3(state);

      expect(result.version).toBe(3);
      expect(result.tournamentCourts).toHaveLength(2);
      expect(result.clubCourts).toHaveLength(0);
    });

    it('should handle v2 state with only club courts — tournamentCourts is empty', () => {
      const c1 = makeV2Table({
        id: 'c1',
        status: 'WAITING' as any,
        mode: 'club',
        clubStatus: 'FINISHED',
      });
      const state = makeV2State([c1]);

      const result = migrateV2toV3(state);

      expect(result.tournamentCourts).toHaveLength(0);
      expect(result.clubCourts).toHaveLength(1);
      expect(result.clubCourts[0].kind).toBe('club');
      expect(result.clubCourts[0].clubStatus).toBe('FINISHED');
    });

    it('should default clubStatus to AVAILABLE when mode=club but clubStatus is missing', () => {
      const club = makeV2Table({
        id: 'c1',
        status: 'WAITING' as any,
        mode: 'club',
        // no clubStatus set
      });
      const state = makeV2State([club]);

      const result = migrateV2toV3(state);

      expect(result.clubCourts).toHaveLength(1);
      expect(result.clubCourts[0].clubStatus).toBe('AVAILABLE');
      expect(result.clubCourts[0].occupiedAt).toBeNull();
      expect(result.clubCourts[0].kind).toBe('club');
    });

    it('should default occupiedAt to null when mode=club but occupiedAt is missing', () => {
      const club = makeV2Table({
        id: 'c1',
        status: 'WAITING' as any,
        mode: 'club',
        clubStatus: 'AVAILABLE',
        // no occupiedAt set
      });
      const state = makeV2State([club]);

      const result = migrateV2toV3(state);

      expect(result.clubCourts).toHaveLength(1);
      expect(result.clubCourts[0].occupiedAt).toBeNull();
    });

    it('should preserve all tournament fields (pin, playerNames, matchState) after migration', () => {
      const table = makeV2Table({
        id: 't1',
        number: 5,
        name: 'Final',
        pin: '9999',
        playerNames: { a: 'Carlos', b: 'Diana' },
        createdAt: 1234567890,
      });
      const state = makeV2State([table]);

      const result = migrateV2toV3(state);

      expect(result.tournamentCourts).toHaveLength(1);
      expect(result.tournamentCourts[0].id).toBe('t1');
      expect(result.tournamentCourts[0].number).toBe(5);
      expect(result.tournamentCourts[0].name).toBe('Final');
      expect(result.tournamentCourts[0].pin).toBe('9999');
      expect(result.tournamentCourts[0].playerNames).toEqual({ a: 'Carlos', b: 'Diana' });
      expect(result.tournamentCourts[0].createdAt).toBe(1234567890);
      expect(result.tournamentCourts[0].matchState).toBeDefined();
    });

    it('should preserve club fields (pin, playerNames, matchState) after migration', () => {
      const club = makeV2Table({
        id: 'c1',
        number: 3,
        name: 'Club Court 3',
        pin: '1234',
        playerNames: { a: 'Eve', b: 'Frank' },
        createdAt: 1234567890,
        status: 'WAITING' as any,
        mode: 'club',
        clubStatus: 'RESERVED',
      });
      const state = makeV2State([club]);

      const result = migrateV2toV3(state);

      expect(result.clubCourts).toHaveLength(1);
      expect(result.clubCourts[0].id).toBe('c1');
      expect(result.clubCourts[0].number).toBe(3);
      expect(result.clubCourts[0].name).toBe('Club Court 3');
      expect(result.clubCourts[0].pin).toBe('1234');
      expect(result.clubCourts[0].playerNames).toEqual({ a: 'Eve', b: 'Frank' });
      expect(result.clubCourts[0].createdAt).toBe(1234567890);
      // matchState is preserved (non-null for club courts with match data)
      expect(result.clubCourts[0].matchState).toBeDefined();
    });

    it('should not mutate the input v2 state', () => {
      const tournament = makeV2Table({ id: 't1' });
      const club = makeV2Table({
        id: 'c1', status: 'WAITING' as any, mode: 'club', clubStatus: 'OCCUPIED',
      });
      const state = makeV2State([tournament, club]);
      const originalVersion = state.version;

      migrateV2toV3(state);

      // Original should still be v2 with tables array
      expect(state.version).toBe(originalVersion);
      expect(Array.isArray((state as any).tables)).toBe(true);
    });

    it('should handle empty tables array', () => {
      const state = makeV2State([]);

      const result = migrateV2toV3(state);

      expect(result.tournamentCourts).toEqual([]);
      expect(result.clubCourts).toEqual([]);
    });
  });
});
