/**
 * CsvExporter unit tests.
 *
 * Tests CSV generation for finished tables.
 * CsvExporter is a pure function: takes PersistedTable[], returns string.
 */

import { CsvExporter } from './CsvExporter';
import type { PersistedTable } from './types';

// ── Helpers ───────────────────────────────────────────────────────────

function makeFinishedTable(overrides: Partial<PersistedTable> = {}): PersistedTable {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'FINISHED',
    pin: '4821',
    playerNames: { a: 'Jorge', b: 'Carlos' },
    createdAt: 1700000000000,
    matchState: {
      config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: { sets: { a: 3, b: 1 }, currentSet: { a: 11, b: 7 }, serving: 'A' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [
        { a: 11, b: 9 },
        { a: 8, b: 11 },
        { a: 11, b: 5 },
        { a: 11, b: 7 },
      ],
      status: 'FINISHED',
      winner: 'A',
      history: [],
    },
    ...overrides,
  };
}

function makeLiveTable(overrides: Partial<PersistedTable> = {}): PersistedTable {
  return {
    id: 'table-live-1',
    number: 99,
    name: 'Mesa Live',
    status: 'LIVE',
    pin: '1111',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
    matchState: {
      config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'B' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      history: [],
    },
    ...overrides,
  };
}

const CSV_HEADER = 'table_number,table_name,player_a,player_b,sets_won_a,sets_won_b,set_scores,winner';

// ── Tests ──────────────────────────────────────────────────────────────

describe('CsvExporter', () => {
  const exporter = new CsvExporter();

  describe('export', () => {
    it('should return only the header when given an empty array', () => {
      const result = exporter.export([]);

      expect(result).toBe(CSV_HEADER + '\n');
    });

    it('should produce a valid CSV row matching the spec example (Jorge vs Carlos)', () => {
      const table = makeFinishedTable();
      const result = exporter.export([table]);

      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(2); // header + 1 data row
      expect(lines[0]).toBe(CSV_HEADER);
      expect(lines[1]).toBe('1,Mesa 1,Jorge,Carlos,3,1,11-9/8-11/11-5/11-7,Jorge');
    });

    it('should exclude LIVE tables and only include FINISHED tables', () => {
      const finished1 = makeFinishedTable({ id: 't1', number: 1, name: 'Mesa 1' });
      const live = makeLiveTable({ id: 'live', number: 2, name: 'Mesa Live' });
      const finished2 = makeFinishedTable({
        id: 't2',
        number: 3,
        name: 'Mesa 3',
        playerNames: { a: 'Ana', b: 'Luis' },
        matchState: {
          ...makeFinishedTable().matchState,
          setHistory: [
            { a: 11, b: 3 },
            { a: 11, b: 8 },
            { a: 11, b: 4 },
          ],
          score: { sets: { a: 3, b: 0 }, currentSet: { a: 11, b: 4 }, serving: 'A' },
        },
      });

      const result = exporter.export([finished1, live, finished2]);

      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(3); // header + 2 data rows (LIVE excluded)
      expect(lines[0]).toBe(CSV_HEADER);
      // LIVE table (number 2) should NOT appear
      expect(result).not.toContain('Mesa Live');
      // FINISHED tables should both appear
      expect(lines[1]).toContain('Mesa 1');
      expect(lines[2]).toContain('Mesa 3');
    });

    it('should return header-only CSV when all tables are LIVE', () => {
      const live = makeLiveTable();
      const result = exporter.export([live]);

      expect(result).toBe(CSV_HEADER + '\n');
    });

    it('should return header-only CSV when no FINISHED tables', () => {
      const live1 = makeLiveTable({ id: 'l1' });
      const live2 = makeLiveTable({ id: 'l2' });
      const result = exporter.export([live1, live2]);

      expect(result).toBe(CSV_HEADER + '\n');
    });

    it('should handle empty player names gracefully (empty string in column)', () => {
      const table = makeFinishedTable({
        playerNames: { a: '', b: '' },
      });

      const result = exporter.export([table]);

      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(2);
      // player_a and player_b should be empty, winner should also be empty
      const columns = lines[1].split(',');
      expect(columns[2]).toBe(''); // player_a
      expect(columns[3]).toBe(''); // player_b
      expect(columns[7]).toBe(''); // winner (tie when both 0 sets won and names empty)
    });

    it('should handle empty setHistory (empty string for set_scores)', () => {
      const table = makeFinishedTable({
        matchState: {
          ...makeFinishedTable().matchState,
          setHistory: [],
          score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
        },
      });

      const result = exporter.export([table]);

      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(2);
      const columns = lines[1].split(',');
      // set_scores column (index 6)
      expect(columns[6]).toBe('');
      // sets_won columns should be 0
      expect(columns[4]).toBe('0');
      expect(columns[5]).toBe('0');
    });

    it('should declare player_a as winner when they won more sets', () => {
      const table = makeFinishedTable({
        playerNames: { a: 'Player A', b: 'Player B' },
        matchState: {
          ...makeFinishedTable().matchState,
          setHistory: [
            { a: 11, b: 5 },
            { a: 11, b: 9 },
            { a: 11, b: 6 },
          ],
          score: { sets: { a: 3, b: 0 }, currentSet: { a: 11, b: 6 }, serving: 'A' },
        },
      });

      const result = exporter.export([table]);

      const lines = result.trim().split('\n');
      const columns = lines[1].split(',');
      expect(columns[7]).toBe('Player A'); // winner
      expect(columns[4]).toBe('3'); // sets_won_a
      expect(columns[5]).toBe('0'); // sets_won_b
    });

    it('should declare player_b as winner when they won more sets', () => {
      const table = makeFinishedTable({
        playerNames: { a: 'Alice', b: 'Bob' },
        matchState: {
          ...makeFinishedTable().matchState,
          setHistory: [
            { a: 9, b: 11 },
            { a: 8, b: 11 },
            { a: 11, b: 4 },
            { a: 7, b: 11 },
          ],
          score: { sets: { a: 1, b: 3 }, currentSet: { a: 7, b: 11 }, serving: 'B' },
        },
      });

      const result = exporter.export([table]);

      const lines = result.trim().split('\n');
      const columns = lines[1].split(',');
      expect(columns[7]).toBe('Bob'); // winner is player_b
      expect(columns[4]).toBe('1'); // sets_won_a
      expect(columns[5]).toBe('3'); // sets_won_b
    });

    it('should produce multiple rows in table number order', () => {
      const t1 = makeFinishedTable({ id: 't1', number: 3, name: 'Mesa 3' });
      const t2 = makeFinishedTable({ id: 't2', number: 1, name: 'Mesa 1' });
      const t3 = makeFinishedTable({ id: 't3', number: 2, name: 'Mesa 2' });

      const result = exporter.export([t1, t2, t3]);

      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(4); // header + 3 rows
      expect(lines[1]).toContain('Mesa 1');
      expect(lines[2]).toContain('Mesa 2');
      expect(lines[3]).toContain('Mesa 3');
    });

    it('should handle a single-set match (best of 1)', () => {
      const table = makeFinishedTable({
        playerNames: { a: 'Fast', b: 'Furious' },
        matchState: {
          ...makeFinishedTable().matchState,
          setHistory: [{ a: 11, b: 9 }],
          score: { sets: { a: 1, b: 0 }, currentSet: { a: 11, b: 9 }, serving: 'A' },
        },
      });

      const result = exporter.export([table]);

      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(2);
      const columns = lines[1].split(',');
      expect(columns[6]).toBe('11-9'); // single set score
      expect(columns[4]).toBe('1');
      expect(columns[5]).toBe('0');
      expect(columns[7]).toBe('Fast');
    });

    it('should handle a partial player_a name (empty player_b)', () => {
      const table = makeFinishedTable({
        playerNames: { a: 'Solo Player', b: '' },
        matchState: {
          ...makeFinishedTable().matchState,
          setHistory: [
            { a: 11, b: 0 },
            { a: 11, b: 0 },
            { a: 11, b: 0 },
          ],
          score: { sets: { a: 3, b: 0 }, currentSet: { a: 11, b: 0 }, serving: 'A' },
        },
      });

      const result = exporter.export([table]);

      const lines = result.trim().split('\n');
      const columns = lines[1].split(',');
      expect(columns[2]).toBe('Solo Player'); // player_a
      expect(columns[3]).toBe(''); // player_b empty
      expect(columns[7]).toBe('Solo Player'); // winner
    });
  });
});
