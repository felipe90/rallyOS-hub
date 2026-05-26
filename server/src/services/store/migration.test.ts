/**
 * Migration tests: v1 → v2 state transformation.
 *
 * Tests cover:
 * - Normal v1→v2 migration (adds sport field)
 * - v2 state passes through unchanged (idempotency)
 * - Corrupt table handling (skip + warn)
 * - Edge cases: missing matchState, empty tables, all tables corrupt
 * - Sport field defaults to 'tableTennis'
 */

import { migrateV1toV2 } from './migration';
import type { PersistedState, PersistedTable } from './types';

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Create a v1-style table (no sport field in matchState).
 * Uses 'as any' casts because v1 data intentionally lacks the required
 * PersistedMatchState.sport field — that's what migration fixes.
 */
function makeV1Table(overrides: Partial<PersistedTable> = {}): PersistedTable {
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

function makeV1State(tables: PersistedTable[] = [makeV1Table()]): PersistedState {
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
      expect(result.tables[0].matchState.sport).toBe('tableTennis');
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
            config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
            score: { sets: { a: 1, b: 0 }, currentSet: { a: 11, b: 9 }, serving: 'A' },
            swappedSides: false,
            midSetSwapped: false,
            setHistory: [{ a: 11, b: 9 }],
            status: 'FINISHED',
            winner: 'A',
            sport: 'tableTennis',
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
      expect(twice.tables[0].matchState.sport).toBe('tableTennis');
      expect(twice.tables[1].matchState.sport).toBe('tableTennis');
    });
  });

  describe('field migration', () => {
    it('should set sport to tableTennis for v1 tables without sport field', () => {
      const state = makeV1State();
      const result = migrateV1toV2(state);

      expect(result.tables[0].matchState.sport).toBe('tableTennis');
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
            config: { sport: 'tableTennis', pointsPerSet: 11, bestOf: 3, minDifference: 2 },
            score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
            swappedSides: false,
            midSetSwapped: false,
            setHistory: [],
            status: 'WAITING',
            winner: null,
            sport: 'tableTennis',
            history: [],
          },
        }],
      };

      const result = migrateV1toV2(v2State);
      expect(result.tables[0].matchState.sport).toBe('tableTennis');
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
      expect(result.tables[0].matchState.sport).toBe('tableTennis');
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
      expect(result.tables[0].matchState.sport).toBe('tableTennis');
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
      expect(t1.matchState.sport).toBe('tableTennis');
      expect(t3.matchState.sport).toBe('tableTennis');
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

      expect(result.tables[0].matchState.sport).toBe('tableTennis');
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

      expect(result.tables[0].matchState.sport).toBe('tableTennis');
      expect(result.tables[0].matchState.status).toBe('WAITING');
    });
  });
});
