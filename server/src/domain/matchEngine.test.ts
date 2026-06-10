import { MatchEngine } from './matchEngine';
import { MatchStateExtended, SPORT } from './types';
import { ScoreChange } from './types';
import type { SportRules } from './sports/types';
import type { GameState, ScoreResult } from './sports/types';
import type { Player, MatchEvent, SportConfig } from '../../../shared/types';

// ── Mock SportRules for delegation testing ─────────────────────────────

function createMockRules(): jest.Mocked<SportRules> {
  const baseState: GameState = {
    config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
    score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
    swappedSides: false,
    midSetSwapped: false,
    setHistory: [],
    status: 'LIVE',
    winner: null,
    sport: SPORT.TABLE_TENNIS,
  };

  return {
    sport: SPORT.TABLE_TENNIS,
    validateConfig: jest.fn().mockReturnValue(true),
    recordScore: jest.fn().mockImplementation((_state: GameState, player: Player): ScoreResult => {
      const newState = JSON.parse(JSON.stringify(_state));
      if (player === 'A') newState.score.currentSet.a++;
      else newState.score.currentSet.b++;
      return { state: newState, events: [] };
    }),
    subtractScore: jest.fn().mockImplementation((_state: GameState, player: Player): GameState => {
      const newState = JSON.parse(JSON.stringify(_state));
      const p = player.toLowerCase() as 'a' | 'b';
      newState.score.currentSet[p]--;
      return newState;
    }),
    isSetComplete: jest.fn().mockReturnValue(false),
    isMatchComplete: jest.fn().mockReturnValue(false),
    updateServing: jest.fn().mockReturnValue('B' as Player),
    checkSideSwap: jest.fn().mockReturnValue(false),
    formatDisplayScore: jest.fn().mockReturnValue({
      type: SPORT.TABLE_TENNIS,
      leftScore: 0,
      rightScore: 0,
      leftSets: 0,
      rightSets: 0,
    }),
    getDefaultConfig: jest.fn().mockReturnValue({
    sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    }),
    needsHandicap: jest.fn().mockReturnValue(false),
  };
}

// ── Delegation ─────────────────────────────────────────────────────────

describe('MatchEngine delegation', () => {
  it('should accept SportRules in constructor and delegate recordPoint', () => {
    const mockRules = createMockRules();
    const engine = new MatchEngine({}, mockRules);
    engine.startMatch();
    engine.recordPoint('A');

    expect(mockRules.recordScore).toHaveBeenCalledTimes(1);
    expect(mockRules.recordScore).toHaveBeenCalledWith(
      expect.objectContaining({ sport: SPORT.TABLE_TENNIS }),
      'A',
    );
  });

  it('should delegate subtractPoint to rules.subtractScore', () => {
    const mockRules = createMockRules();
    const engine = new MatchEngine({}, mockRules);
    engine.startMatch();
    engine.subtractPoint('A');

    expect(mockRules.subtractScore).toHaveBeenCalledTimes(1);
    expect(mockRules.subtractScore).toHaveBeenCalledWith(
      expect.objectContaining({ sport: SPORT.TABLE_TENNIS }),
      'A',
    );
  });

    it('should keep history tracking in MatchEngine (not delegated)', () => {
    const rules = new (require('./sports/tableTennis.rules').TableTennisRules)();
    const engine = new MatchEngine({}, rules);
    engine.startMatch();
    engine.recordPoint('B');
    engine.recordPoint('A');

    const state = engine.getState() as any;
    expect(state.history).toHaveLength(2);
    expect(state.history[0].action).toBe('POINT');
    expect(state.history[0].player).toBe('B');
    expect(state.history[1].action).toBe('POINT');
    expect(state.history[1].player).toBe('A');
  });

  it('should emit events returned by rules.recordScore through callback', () => {
    const mockRules = createMockRules();
    const events: MatchEvent[] = [];
    const engine = new MatchEngine({}, mockRules);
    engine.setEventCallback((e: MatchEvent) => { events.push(e); });
    engine.startMatch();

    // Make recordScore return an event
    const event: MatchEvent = { type: 'SET_WON', winner: 'A', score: { a: 11, b: 0 }, setNumber: 1 };
    mockRules.recordScore.mockReturnValueOnce({
      state: {
        config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 } as any,
        score: { sets: { a: 1, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'B' },
        swappedSides: true,
        midSetSwapped: false,
        setHistory: [{ a: 11, b: 0 }],
        status: 'LIVE',
        winner: null,
        sport: SPORT.TABLE_TENNIS,
      } as any,
      events: [event],
    });

    engine.recordPoint('A');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });
});

describe('MatchEngine.fromState', () => {
  // ── Helpers ──────────────────────────────────────────────────────────

  function makeBasicState(overrides: Partial<MatchStateExtended> = {}): any {
    return {
      config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
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
      sport: SPORT.TABLE_TENNIS,
      courtId: '',
      courtName: '',
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
      const original = engine.getState() as any;
      const restored = MatchEngine.fromState(original);
      const result = restored.getState() as any;

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

      const original = engine.getState() as any;
      const restored = MatchEngine.fromState(original);
      const result = restored.getState() as any;

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
        config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
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
        courtId: 'table-xyz',
        courtName: 'Final Match',
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
      const result = restored.getState() as any;

      expect(result.status).toBe('FINISHED');
      expect(result.winner).toBe('A');
      expect(result.score.sets.a).toBe(2);
      expect(result.score.sets.b).toBe(0);
      expect(result.courtId).toBe('table-xyz');
      expect(result.courtName).toBe('Final Match');
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
      const newState = restored.getState() as any;

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

      const undone = restored.undoLast() as any;
      expect(undone.score.currentSet.a).toBe(1);
      expect(undone.score.currentSet.b).toBe(1);
      expect(undone.history.length).toBe(2);

      // Should still be able to undo again
      expect(restored.canUndo()).toBe(true);
      restored.undoLast();
      const s = restored.getState() as any;
      expect(s.score.currentSet.a).toBe(1);
      expect(s.score.currentSet.b).toBe(0);
      expect(s.history.length).toBe(1);
    });

    it('restored engine should handle subtractPoint', () => {
      const engine = new MatchEngine();
      engine.startMatch();
      engine.recordPoint('A');
      engine.recordPoint('A');

      const state = engine.getState();
      const restored = MatchEngine.fromState(state);

      restored.subtractPoint('A');
      const newState = restored.getState() as any;

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
      const result = restored.recordPoint('A') as any;

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
