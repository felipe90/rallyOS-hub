import { MatchEngine } from './matchEngine';
import type { MatchStateExtended } from './types';
import { ScoreChange } from './types';

describe('MatchEngine.fromState', () => {
  // ── Helpers ──────────────────────────────────────────────────────────

  function makeBasicState(overrides: Partial<MatchStateExtended> = {}): MatchStateExtended {
    return {
      config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { a: 0, b: 0 },
        serving: 'A',
      },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'WAITING',
      winner: null,
      tableId: '',
      tableName: '',
      playerNames: { a: 'Player A', b: 'Player B' },
      history: [],
      undoAvailable: false,
      ...overrides,
    };
  }

  // ── Round-trip ──────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('should produce identical getState() after fromState() for clean state', () => {
      const engine = new MatchEngine();
      const original = engine.getState();
      const restored = MatchEngine.fromState(original);
      const result = restored.getState();

      expect(result.config).toEqual(original.config);
      expect(result.score).toEqual(original.score);
      expect(result.swappedSides).toBe(original.swappedSides);
      expect(result.midSetSwapped).toBe(original.midSetSwapped);
      expect(result.setHistory).toEqual(original.setHistory);
      expect(result.status).toBe(original.status);
      expect(result.winner).toBe(original.winner);
      expect(result.history).toEqual(original.history);
      expect(result.undoAvailable).toBe(original.undoAvailable);
    });

    it('should produce identical getState() after fromState() for LIVE state with points', () => {
      const engine = new MatchEngine();
      engine.startMatch();
      engine.recordPoint('A');
      engine.recordPoint('B');
      engine.recordPoint('A');

      const original = engine.getState();
      const restored = MatchEngine.fromState(original);
      const result = restored.getState();

      expect(result.config).toEqual(original.config);
      expect(result.score).toEqual(original.score);
      expect(result.swappedSides).toBe(original.swappedSides);
      expect(result.setHistory).toEqual(original.setHistory);
      expect(result.status).toBe(original.status);
      expect(result.winner).toBe(original.winner);
      // History entries should be preserved with their timestamps
      expect(result.history).toHaveLength(original.history.length);
      expect(result.history[0].player).toBe(original.history[0].player);
      expect(result.history[0].action).toBe(original.history[0].action);
      expect(result.history[0].timestamp).toBe(original.history[0].timestamp);
      expect(result.undoAvailable).toBe(original.undoAvailable);
    });

    it('should produce identical getState() for FINISHED state with winner', () => {
      const finishedState = makeBasicState({
        config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        score: {
          sets: { a: 2, b: 0 },
          currentSet: { a: 11, b: 3 },
          serving: 'A',
        },
        setHistory: [
          { a: 11, b: 5 },
          { a: 11, b: 3 },
        ],
        status: 'FINISHED',
        winner: 'A',
        tableId: 'table-xyz',
        tableName: 'Final Match',
        playerNames: { a: 'Champion', b: 'Runner-up' },
        history: [
          {
            id: 'h1',
            player: 'A',
            action: 'SET_WON',
            pointsBefore: { a: 10, b: 5 },
            pointsAfter: { a: 11, b: 5 },
            setNumber: 1,
            timestamp: 1700000000000,
          },
        ],
        undoAvailable: true,
      });

      const restored = MatchEngine.fromState(finishedState);
      const result = restored.getState();

      expect(result.status).toBe('FINISHED');
      expect(result.winner).toBe('A');
      expect(result.score.sets.a).toBe(2);
      expect(result.score.sets.b).toBe(0);
      expect(result.tableId).toBe('table-xyz');
      expect(result.tableName).toBe('Final Match');
      expect(result.playerNames.a).toBe('Champion');
      expect(result.playerNames.b).toBe('Runner-up');
      expect(result.setHistory).toEqual([
        { a: 11, b: 5 },
        { a: 11, b: 3 },
      ]);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].id).toBe('h1');
      expect(result.history[0].action).toBe('SET_WON');
      expect(result.undoAvailable).toBe(true);
    });
  });

  // ── Behavior after restoration ───────────────────────────────────────

  describe('behavior after restoration', () => {
    it('restored engine should recordPoint correctly', () => {
      const engine = new MatchEngine();
      engine.startMatch();
      engine.recordPoint('A');

      const state = engine.getState();
      const restored = MatchEngine.fromState(state);

      // Restored engine should be LIVE and accept points
      restored.recordPoint('B');
      const newState = restored.getState();

      expect(newState.score.currentSet.a).toBe(1);
      expect(newState.score.currentSet.b).toBe(1);
      expect(newState.history.length).toBe(2); // original + new
    });

    it('restored engine should undo correctly', () => {
      const engine = new MatchEngine();
      engine.startMatch();
      engine.recordPoint('A');
      engine.recordPoint('B');
      engine.recordPoint('A');

      const state = engine.getState();
      const restored = MatchEngine.fromState(state);

      expect(restored.canUndo()).toBe(true);

      const undone = restored.undoLast();
      expect(undone.score.currentSet.a).toBe(1);
      expect(undone.score.currentSet.b).toBe(1);
      expect(undone.history.length).toBe(2);

      // Should still be able to undo again
      expect(restored.canUndo()).toBe(true);
      restored.undoLast();
      expect(restored.getState().score.currentSet.a).toBe(1);
      expect(restored.getState().score.currentSet.b).toBe(0);
      expect(restored.getState().history.length).toBe(1);
    });

    it('restored engine should handle subtractPoint', () => {
      const engine = new MatchEngine();
      engine.startMatch();
      engine.recordPoint('A');
      engine.recordPoint('A');

      const state = engine.getState();
      const restored = MatchEngine.fromState(state);

      restored.subtractPoint('A');
      const newState = restored.getState();

      expect(newState.score.currentSet.a).toBe(1);
      expect(newState.history.length).toBe(3); // original 2 + correction
    });

    it('restored engine should not accept recordPoint when FINISHED', () => {
      const finishedState = makeBasicState({
        status: 'FINISHED',
        winner: 'A',
        score: {
          sets: { a: 2, b: 0 },
          currentSet: { a: 11, b: 3 },
          serving: 'A',
        },
      });

      const restored = MatchEngine.fromState(finishedState);
      const result = restored.recordPoint('A');

      // Should return state unchanged since match is finished
      expect(result.score.currentSet.a).toBe(11);
      expect(result.score.currentSet.b).toBe(3);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should default history to empty array when undefined', () => {
      // Simulate a state that comes from PersistedMatchState (no history field)
      const raw = makeBasicState();
      const stateWithoutHistory = { ...raw, history: undefined as any };

      const restored = MatchEngine.fromState(stateWithoutHistory);
      const result = restored.getState();

      expect(result.history).toEqual([]);
      expect(result.undoAvailable).toBe(false);
    });

    it('should recalculate undoAvailable from history length', () => {
      const state = makeBasicState({
        status: 'LIVE',
        history: [
          {
            id: 'h1',
            player: 'A',
            action: 'POINT' as const,
            pointsBefore: { a: 0, b: 0 },
            pointsAfter: { a: 1, b: 0 },
            timestamp: Date.now(),
          },
        ],
        // Intentionally wrong:
        undoAvailable: false,
      });

      const restored = MatchEngine.fromState(state);
      const result = restored.getState();

      // undoAvailable must be recalculated from history, ignoring what was passed
      expect(result.undoAvailable).toBe(true);
    });

    it('should handle swapped sides correctly', () => {
      const state = makeBasicState({
        status: 'LIVE',
        swappedSides: true,
        midSetSwapped: true,
      });

      const restored = MatchEngine.fromState(state);
      const result = restored.getState();

      expect(result.swappedSides).toBe(true);
      expect(result.midSetSwapped).toBe(true);
    });

    it('should preserve default playerNames when undefined', () => {
      const state = makeBasicState();
      const stateWithoutNames = { ...state, playerNames: undefined as any };

      const restored = MatchEngine.fromState(stateWithoutNames);
      const result = restored.getState();

      expect(result.playerNames).toEqual({ a: 'Player A', b: 'Player B' });
    });

    it('should create independent copy — mutations do not affect source state', () => {
      const originalState = makeBasicState({
        status: 'LIVE',
        history: [
          {
            id: 'h1',
            player: 'A',
            action: 'POINT' as const,
            pointsBefore: { a: 0, b: 0 },
            pointsAfter: { a: 1, b: 0 },
            timestamp: Date.now(),
          },
        ],
        undoAvailable: true,
      });

      const restored = MatchEngine.fromState(originalState);
      restored.recordPoint('B');

      // originalState should be unmodified
      expect(originalState.score.currentSet.a).toBe(0);
      expect(originalState.score.currentSet.b).toBe(0);
      expect(originalState.history).toHaveLength(1);
    });
  });
});
