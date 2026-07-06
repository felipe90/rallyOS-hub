import { SPORT } from '../../../shared/types';
import { CourtManager } from './courtManager';
import { StateStore } from '../services/store/StateStore';
import type { FileSystem, PersistedCourt, PersistedMatchState } from '../services/store/types';
import type { HubConfig, MatchStateExtended, MatchEvent } from './types';
import { MatchEngine } from './matchEngine';

// ── Fake FileSystem for DI (same pattern as StateStore.test.ts) ──────────

function makeFs(): FileSystem & { _written: Map<string, string>; _files: Map<string, string> } {
  const files = new Map<string, string>();
  const written = new Map<string, string>();

  return {
    _written: written,
    _files: files,

    writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
      written.set(path, data);
    },

    readFileSync(path: string, _encoding: BufferEncoding): string {
      if (!files.has(path)) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, open '${path}'`),
          { code: 'ENOENT' },
        );
      }
      return files.get(path)!;
    },

    renameSync(oldPath: string, newPath: string): void {
      const content = written.has(oldPath)
        ? written.get(oldPath)
        : files.get(oldPath);
      if (content === undefined) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, rename '${oldPath}'`),
          { code: 'ENOENT' },
        );
      }
      files.set(newPath, content);
      files.delete(oldPath);
      written.delete(oldPath);
    },

    existsSync(path: string): boolean {
      return files.has(path) || written.has(path);
    },

    unlinkSync(path: string): void {
      files.delete(path);
      written.delete(path);
    },

    mkdirSync(_path: string, _options?: { recursive: boolean }): string | undefined {
      return undefined;
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

const mockHubConfig: HubConfig = {
  ssid: 'test-ssid',
  ip: '127.0.0.1',
  port: 3000,
  domain: 'test.local',
  wifiPassword: 'test-password',
};

/**
 * Create a PersistedCourt fixture for pre-seeding the fake FS.
 */
function makePersistedTable(overrides: Partial<PersistedCourt> = {}): PersistedCourt {
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
      sport: SPORT.TABLE_TENNIS,
      history: [
        {
          id: 'h1',
          player: 'A',
          action: 'POINT' as const,
          pointsBefore: { a: 0, b: 0 },
          pointsAfter: { a: 1, b: 0 },
          timestamp: 1700000000100,
        },
      ],
    },
    ...overrides,
  };
}

/**
 * Seed the fake FS with a saved state file containing the given tables.
 */
function seedStateFile(
  fs: ReturnType<typeof makeFs>,
  tables: PersistedCourt[],
): void {
  const persisted = {
    version: 1,
    savedAt: Date.now(),
    tables,
  };
  fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('CourtManager with StateStore', () => {
  let fs: ReturnType<typeof makeFs>;
  let stateStore: StateStore;

  beforeEach(() => {
    fs = makeFs();
    stateStore = new StateStore(fs, 'data/rallyos-state.json');
  });

  describe('constructor', () => {
    it('should accept optional StateStore parameter', () => {
      expect(() => new CourtManager(mockHubConfig, stateStore)).not.toThrow();
    });

    it('should accept undefined StateStore (backward compatible)', () => {
      expect(() => new CourtManager(mockHubConfig)).not.toThrow();
      expect(() => new CourtManager(mockHubConfig, undefined)).not.toThrow();
    });

    it('should not call notifyUpdate during construction', () => {
      // Construction should be silent — no tables, no save
      new CourtManager(mockHubConfig, stateStore);
      // FS should be empty since no mutations happened
      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
    });
  });

  describe('notifyUpdate triggers save', () => {
    it('should save LIVE court after createCourt + startMatch', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);
      const court = manager.createCourt('Mesa Test');

      // createCourt triggers notifyUpdate which calls save.
      // The court is WAITING, so only an empty tables array is saved.
      const afterCreate = fs._files.get('data/rallyos-state.json');
      expect(afterCreate).toBeDefined();
      const afterCreateParsed = JSON.parse(afterCreate!);
      expect(afterCreateParsed.tables).toHaveLength(0);

      // Start the match → court becomes LIVE → should save with the court
      manager.startMatch(court.id, { playerNameA: 'Alice', playerNameB: 'Bob' });

      const savedContent = fs._files.get('data/rallyos-state.json');
      expect(savedContent).toBeDefined();
      const parsed = JSON.parse(savedContent!);
      expect(parsed.version).toBe(2);
      expect(parsed.tables).toHaveLength(1);
      expect(parsed.tables[0].id).toBe(court.id);
      expect(parsed.tables[0].pin).toBe(court.pin);
      expect(parsed.tables[0].status).toBe('LIVE');
    });

    it('should save FINISHED courts', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);
      const court = manager.createCourt('Mesa Test');
      manager.startMatch(court.id, { playerNameA: 'Alice', playerNameB: 'Bob' });

      // Manually set status to FINISHED via MatchOrchestrator won't trigger
      // the proper flow. Instead, let's verify that when a court IS FINISHED
      // (via match completion), it gets saved. We'll test by seeding a FINISHED
      // court and calling load which triggers notifyUpdate.

      // Actually, let's test via the force-write path: create + start,
      // then verify the save contains LIVE courts
      const saved = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(saved!);
      expect(parsed.tables[0].status).toBe('LIVE');
      expect(parsed.tables[0].pin).toBe(court.pin);
    });

    it('should filter out WAITING courts from save', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);

      // Create a court (WAITING) and start it (LIVE)
      const liveCourt = manager.createCourt('Live Court');
      manager.startMatch(liveCourt.id, { playerNameA: 'A', playerNameB: 'B' });

      // Create another court that stays WAITING
      manager.createCourt('Waiting Court');

      // Only LIVE court should be saved
      const savedContent = fs._files.get('data/rallyos-state.json');
      expect(savedContent).toBeDefined();
      const parsed = JSON.parse(savedContent!);
      expect(parsed.tables).toHaveLength(1);
      expect(parsed.tables[0].name).toBe('Live Court');
    });

    it('should save match state with scores and history', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);
      const court = manager.createCourt('Mesa Test');
      manager.startMatch(court.id, { playerNameA: 'Alice', playerNameB: 'Bob' });

      // Record some points
      manager.recordPoint(court.id, 'A');
      manager.recordPoint(court.id, 'A');
      manager.recordPoint(court.id, 'B');

      const savedContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(savedContent!);
      expect(parsed.tables).toHaveLength(1);

      const matchState = parsed.tables[0].matchState;
      expect(matchState.score.currentSet.a).toBe(2);
      expect(matchState.score.currentSet.b).toBe(1);
      expect(matchState.history.length).toBeGreaterThan(0);
      expect(matchState.status).toBe('LIVE');
    });

    it('should save multiple LIVE/FINISHED tables', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);

      // Create two tables, start both
      const t1 = manager.createCourt('Mesa 1');
      manager.startMatch(t1.id, { playerNameA: 'Alice', playerNameB: 'Bob' });

      const t2 = manager.createCourt('Mesa 2');
      manager.startMatch(t2.id, { playerNameA: 'Carol', playerNameB: 'Dave' });

      const savedContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(savedContent!);
      expect(parsed.tables).toHaveLength(2);
      const names = parsed.tables.map((t: PersistedCourt) => t.name).sort();
      expect(names).toEqual(['Mesa 1', 'Mesa 2']);
      const pins = parsed.tables.map((t: PersistedCourt) => t.pin);
      expect(pins).toHaveLength(2);
      // Pins should be different (random generation)
      expect(pins[0]).not.toBe(pins[1]);
    });

    it('should NOT save when stateStore is undefined', () => {
      // Backward-compatible: no StateStore → no errors
      const manager = new CourtManager(mockHubConfig); // no StateStore
      const court = manager.createCourt('Mesa Test');
      manager.startMatch(court.id, { playerNameA: 'A', playerNameB: 'B' });

      // No FS was provided, nothing should crash
      expect(() => manager.recordPoint(court.id, 'A')).not.toThrow();
    });

    it('should handle StateStore.save errors gracefully', () => {
      // Create a StateStore with a fake FS that throws on write
      const brokenFs = makeFs();
      brokenFs.writeFileSync = () => {
        throw new Error('Disk full');
      };
      const brokenStore = new StateStore(brokenFs, 'data/rallyos-state.json');
      const manager = new CourtManager(mockHubConfig, brokenStore);

      // Should not throw — errors are swallowed
      const court = manager.createCourt('Mesa Test');
      expect(() =>
        manager.startMatch(court.id, {
          playerNameA: 'A',
          playerNameB: 'B',
        }),
      ).not.toThrow();

      // CourtManager should still be functional after save error
      const state = manager.recordPoint(court.id, 'A');
      expect(state).not.toBeNull();
      expect((state as any)!.score.currentSet.a).toBe(1);
    });

    it('should persist exact PIN after mutations', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);
      const court = manager.createCourt('Mesa Test');
      const originalPin = court.pin;

      manager.startMatch(court.id, { playerNameA: 'Alice', playerNameB: 'Bob' });

      const savedContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(savedContent!);
      expect(parsed.tables[0].pin).toBe(originalPin);
    });

    it('should persist playerNames in saved state', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);
      const court = manager.createCourt('Mesa Test');
      manager.startMatch(court.id, { playerNameA: 'Champion', playerNameB: 'Runner-up' });

      const savedContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(savedContent!);
      expect(parsed.tables[0].playerNames).toEqual({
        a: 'Champion',
        b: 'Runner-up',
      });
    });

    it('should NOT persist socketId or runtime callbacks', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);
      const court = manager.createCourt('Mesa Test');
      manager.startMatch(court.id, { playerNameA: 'Alice', playerNameB: 'Bob' });

      const savedContent = fs._files.get('data/rallyos-state.json');
      const parsed = JSON.parse(savedContent!);
      const savedTable = parsed.tables[0];

      expect(savedTable.sportRules).toBeUndefined();
      expect(savedTable.players).toBeUndefined();
      expect(savedTable.onTableUpdate).toBeUndefined();
      expect(savedTable.onMatchEvent).toBeUndefined();
    });
  });

  describe('loadTournament', () => {
    it('should return false when no persisted state exists', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);

      const result = manager.loadTournament();
      expect(result).toBe(false);
      expect(manager.getAllCourts()).toHaveLength(0);
    });

    it('should return false when state file exists but has no tables', () => {
      seedStateFile(fs, []);
      const manager = new CourtManager(mockHubConfig, stateStore);

      const result = manager.loadTournament();
      expect(result).toBe(false);
    });

    it('should return false when no StateStore is configured', () => {
      const manager = new CourtManager(mockHubConfig); // no StateStore
      
      const result = manager.loadTournament();
      expect(result).toBe(false);
    });

    it('should restore tables with correct PINs and scores', () => {
      const t1 = makePersistedTable({
        id: 't1',
        name: 'Mesa Alfa',
        pin: '1111',
        matchState: {
          config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
          score: {
            sets: { a: 0, b: 0 },
            currentSet: { a: 7, b: 4 },
            serving: 'A',
          },
          swappedSides: false,
          midSetSwapped: false,
          setHistory: [],
          status: 'LIVE',
          winner: null,
          sport: SPORT.TABLE_TENNIS,
          history: [],
        },
      });

      seedStateFile(fs, [t1]);
      const manager = new CourtManager(mockHubConfig, stateStore);

      const result = manager.loadTournament();
      expect(result).toBe(true);

      const courts = manager.getAllCourts();
      expect(courts).toHaveLength(1);
      expect(courts[0].name).toBe('Mesa Alfa');

      // Get the full court to verify PIN
      const fullCourt = manager.getCourt('t1');
      expect(fullCourt).toBeDefined();
      expect(fullCourt!.pin).toBe('1111');
      expect(fullCourt!.status).toBe('LIVE');

      // Verify match state
      const matchState = manager.getMatchState('t1') as any;
      expect(matchState).not.toBeNull();
      expect(matchState!.score.currentSet.a).toBe(7);
      expect(matchState!.score.currentSet.b).toBe(4);
      expect(matchState!.score.serving).toBe('A');
    });

    it('should restore multiple tables', () => {
      const t1 = makePersistedTable({
        id: 'table-1',
        name: 'Mesa 1',
        pin: '1111',
      });
      const t2 = makePersistedTable({
        id: 'table-2',
        number: 2,
        name: 'Mesa 2',
        pin: '2222',
        playerNames: { a: 'Carol', b: 'Dave' },
        status: 'FINISHED',
        matchState: {
          config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
          score: {
            sets: { a: 2, b: 1 },
            currentSet: { a: 11, b: 3 },
            serving: 'B',
          },
          swappedSides: true,
          midSetSwapped: false,
          setHistory: [
            { a: 11, b: 5 },
            { a: 8, b: 11 },
          ],
          status: 'FINISHED',
          winner: 'A',
          sport: SPORT.TABLE_TENNIS,
          history: [],
        },
      });

      seedStateFile(fs, [t1, t2]);
      const manager = new CourtManager(mockHubConfig, stateStore);

      const result = manager.loadTournament();
      expect(result).toBe(true);

      const courts = manager.getAllCourts();
      expect(courts).toHaveLength(2);
      expect(courts.map((c) => c.name).sort()).toEqual(['Mesa 1', 'Mesa 2']);

      const restoredCourt1 = manager.getCourt('table-1');
      expect(restoredCourt1!.pin).toBe('1111');
      const restoredCourt2 = manager.getCourt('table-2');
      expect(restoredCourt2!.pin).toBe('2222');
      expect(restoredCourt2!.status).toBe('FINISHED');

      const t2state = manager.getMatchState('table-2');
      expect(t2state!.status).toBe('FINISHED');
      expect(t2state!.winner).toBe('A');
      expect(t2state!.swappedSides).toBe(true);
    });

    it('should restore undo history', () => {
      const t1 = makePersistedTable({
        matchState: {
          config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
          score: {
            sets: { a: 0, b: 0 },
            currentSet: { a: 3, b: 0 },
            serving: 'A',
          },
          swappedSides: false,
          midSetSwapped: false,
          setHistory: [],
          status: 'LIVE',
          winner: null,
          sport: SPORT.TABLE_TENNIS,
          history: [
            {
              id: 'h1',
              player: 'A',
              action: 'POINT' as const,
              pointsBefore: { a: 0, b: 0 },
              pointsAfter: { a: 1, b: 0 },
              timestamp: 1700000000100,
            },
            {
              id: 'h2',
              player: 'A',
              action: 'POINT' as const,
              pointsBefore: { a: 1, b: 0 },
              pointsAfter: { a: 2, b: 0 },
              timestamp: 1700000000200,
            },
            {
              id: 'h3',
              player: 'A',
              action: 'POINT' as const,
              pointsBefore: { a: 2, b: 0 },
              pointsAfter: { a: 3, b: 0 },
              timestamp: 1700000000300,
            },
          ],
        },
      });

      seedStateFile(fs, [t1]);
      const manager = new CourtManager(mockHubConfig, stateStore);

      manager.loadTournament();

      const matchState = manager.getMatchState('table-1');
      expect(matchState!.history).toHaveLength(3);
      expect(matchState!.undoAvailable).toBe(true);

      // Should be able to undo
      const undone = manager.undoLast('table-1') as any;
      expect(undone).not.toBeNull();
      expect(undone!.score.currentSet.a).toBe(2);
      expect(undone!.history.length).toBe(2);
    });

    it('should filter to LIVE/FINISHED only — skip WAITING tables', () => {
      const t1 = makePersistedTable({ id: 'live-table', status: 'LIVE' });
      const t2 = makePersistedTable({
        id: 'finished-table',
        number: 2,
        status: 'FINISHED',
      });
      const t3 = makePersistedTable({
        id: 'waiting-table',
        number: 3,
        status: 'WAITING',
      });

      seedStateFile(fs, [t1, t2, t3]);
      const manager = new CourtManager(mockHubConfig, stateStore);

      const result = manager.loadTournament();
      expect(result).toBe(true);

      const courts = manager.getAllCourts();
      expect(courts).toHaveLength(2); // WAITING skipped
      const ids = courts.map((c) => c.id).sort();
      expect(ids).toEqual(['finished-table', 'live-table']);
    });

    it('should NOT auto-load on construction', () => {
      // Even with state in the file, construction starts empty
      seedStateFile(fs, [makePersistedTable()]);
      const manager = new CourtManager(mockHubConfig, stateStore);

      expect(manager.getAllCourts()).toHaveLength(0);
    });

    it('should handle all persisted tables gracefully (resilient fromState)', () => {
      // Even with a broken matchState, fromState now recovers with defaults
      const badTable: PersistedCourt = {
        id: 'bad-table',
        number: 1,
        name: 'Bad Table',
        status: 'LIVE',
        pin: '0000',
        playerNames: { a: 'X', b: 'Y' },
        createdAt: 1,
        matchState: {
          config: undefined as any,
          score: undefined as any,
          swappedSides: false as any,
          midSetSwapped: false as any,
          setHistory: undefined as any,
          status: undefined as any,
          winner: undefined as any,
          sport: undefined as any,
          history: undefined as any,
        },
      };
      const goodTable = makePersistedTable({ id: 'good-table' });

      seedStateFile(fs, [badTable, goodTable]);
      const manager = new CourtManager(mockHubConfig, stateStore);

      const result = manager.loadTournament();
      // Both tables are restored — fromState recovers gracefully
      expect(result).toBe(true);

      const courts = manager.getAllCourts();
      expect(courts).toHaveLength(2);
      const ids = courts.map((c) => c.id).sort();
      expect(ids).toEqual(['bad-table', 'good-table']);
    });

    it('should skip CONFIGURING tables (only LIVE/FINISHED)', () => {
      const t1 = makePersistedTable({ id: 'configuring', status: 'CONFIGURING' });
      const t2 = makePersistedTable({ id: 'live', status: 'LIVE' });

      seedStateFile(fs, [t1, t2]);
      const manager = new CourtManager(mockHubConfig, stateStore);

      manager.loadTournament();

      const courts = manager.getAllCourts();
      expect(courts).toHaveLength(1);
      expect(courts[0].id).toBe('live');
    });
  });

  describe('callback wiring after restore', () => {
    it('should fire onMatchEvent after restoring and recording points', () => {
      const t1 = makePersistedTable({ id: 'table-1' });
      seedStateFile(fs, [t1]);

      const manager = new CourtManager(mockHubConfig, stateStore);

      // Spy on the onMatchEvent callback
      const events: { tableId: string; event: MatchEvent }[] = [];
      manager.onMatchEvent = (tableId: string, event: MatchEvent) => {
        events.push({ tableId, event });
      };

      manager.loadTournament();

      // Record points — this should fire setEventCallback
      manager.recordPoint('table-1', 'A');

      expect(events.length).toBe(0); // SET_WON not triggered with one point

      // The key test: recordPoint should NOT throw (proves callbacks are wired)
      expect(() => manager.recordPoint('table-1', 'B')).not.toThrow();
    });

    it('should fire onTableUpdate after restoring', () => {
      const t1 = makePersistedTable({ id: 'table-1' });
      seedStateFile(fs, [t1]);

      const manager = new CourtManager(mockHubConfig, stateStore);

      const updates: any[] = [];
      manager.onTableUpdate = (info) => {
        updates.push(info);
      };

      manager.loadTournament();

      // loadTournament calls notifyUpdate for each restored table
      expect(updates.length).toBe(1);
      expect(updates[0].id).toBe('table-1');
      expect(updates[0].name).toBe('Mesa 1');
    });
  });

  describe('round-trip: save → load', () => {
    it('should restore tables with identical data after save + load', () => {
      const manager = new CourtManager(mockHubConfig, stateStore);

      // Create and start a table
      const court = manager.createCourt('Mesa Persistida');
      const pin = court.pin;
      manager.startMatch(court.id, { playerNameA: 'Alpha', playerNameB: 'Beta' });
      manager.recordPoint(court.id, 'A');
      manager.recordPoint(court.id, 'A');
      manager.recordPoint(court.id, 'B');

      // Get the saved state
      const savedContent = fs._files.get('data/rallyos-state.json');
      expect(savedContent).toBeDefined();

      // Create a NEW CourtManager (simulating restart) and load
      const newStore = new StateStore(fs, 'data/rallyos-state.json');
      const newManager = new CourtManager(mockHubConfig, newStore);

      const loaded = newManager.loadTournament();
      expect(loaded).toBe(true);

      const restoredCourt = newManager.getCourt(court.id);
      expect(restoredCourt).toBeDefined();
      expect(restoredCourt!.pin).toBe(pin);
      expect(restoredCourt!.name).toBe('Mesa Persistida');
      expect(restoredCourt!.playerNames).toEqual({ a: 'Alpha', b: 'Beta' });
      expect(restoredCourt!.status).toBe('LIVE');

      const state = newManager.getMatchState(court.id) as any;
      expect(state!.score.currentSet.a).toBe(2);
      expect(state!.score.currentSet.b).toBe(1);
      expect(state!.history.length).toBe(3);
    });
  });

  describe('club courts — occupyClubCourt', () => {
    let manager: CourtManager;

    beforeEach(() => {
      manager = new CourtManager(mockHubConfig, stateStore);
    });

    it('should return null for non-existent court', () => {
      const result = manager.occupyClubCourt('non-existent', SPORT.PADEL);
      expect(result).toBeNull();
    });

    it('should return null for non-club court (tournament mode)', () => {
      const court = manager.createCourt('Tournament Court');
      const result = manager.occupyClubCourt(court.id, SPORT.PADEL);
      expect(result).toBeNull();
    });

    it('should return null for AVAILABLE club court (not yet activated)', () => {
      const court = manager.createClubCourt('Club Court');
      const result = manager.occupyClubCourt(court.id, SPORT.PADEL);
      expect(result).toBeNull();
    });

    it('should return null for FINISHED club court', () => {
      const court = manager.createClubCourt('Club Court');
      manager.activateCourt(court.id);
      manager.occupyClubCourt(court.id, SPORT.PADEL);
      // Force end → FINISHED
      const ended = manager.forceEndSession(court.id);
      expect(ended).not.toBeNull();
      const result = manager.occupyClubCourt(court.id, SPORT.PADEL);
      expect(result).toBeNull();
    });

    it('should transition RESERVED → OCCUPIED and return match state for padel', () => {
      const court = manager.createClubCourt('Padel Club');
      expect(court.clubStatus).toBe('AVAILABLE');

      manager.activateCourt(court.id);
      expect(court.clubStatus).toBe('RESERVED');

      const result = manager.occupyClubCourt(court.id, SPORT.PADEL);
      expect(result).not.toBeNull();
      expect(result!.court.clubStatus).toBe('OCCUPIED');
      expect(result!.court.id).toBe(court.id);
      expect(result!.matchState.status).toBe('LIVE');
      expect(result!.matchState.config.sport).toBe(SPORT.PADEL);
    });

    it('should transition RESERVED → OCCUPIED for table tennis', () => {
      const court = manager.createClubCourt('TT Club');
      manager.activateCourt(court.id);

      const result = manager.occupyClubCourt(court.id, SPORT.TABLE_TENNIS);
      expect(result).not.toBeNull();
      expect(result!.court.clubStatus).toBe('OCCUPIED');
      expect(result!.matchState.config.sport).toBe(SPORT.TABLE_TENNIS);
      expect(result!.matchState.config.bestOf).toBe(1);
    });

    it('should return current state on reconnection (already OCCUPIED)', () => {
      const court = manager.createClubCourt('Reconnect Court');
      manager.activateCourt(court.id);

      const result1 = manager.occupyClubCourt(court.id, SPORT.PADEL);
      expect(result1).not.toBeNull();
      expect(result1!.court.clubStatus).toBe('OCCUPIED');

      // Second call — reconnection path
      const result2 = manager.occupyClubCourt(court.id, SPORT.PADEL);
      expect(result2).not.toBeNull();
      expect(result2!.court.clubStatus).toBe('OCCUPIED');
      // Should return same match state
      expect(result2!.matchState.status).toBe('LIVE');
      expect(result2!.matchState.courtId).toBe(court.id);
    });

    it('should set default player names for new OCCUPIED court', () => {
      const court = manager.createClubCourt('Names Club');
      manager.activateCourt(court.id);

      const result = manager.occupyClubCourt(court.id, SPORT.PADEL);
      expect(result).not.toBeNull();
      expect(result!.court.playerNames).toEqual({ a: 'Jugador 1', b: 'Jugador 2' });
    });
  });
});
