import { TableTennisRules } from './tableTennis.rules';
import { GameState, ScoreResult, SPORT } from './types';
import type { Player, SportConfig } from '../../../../shared/types';

describe('TableTennisRules (implementing SportRules)', () => {
  let rules: TableTennisRules;

  beforeEach(() => {
    rules = new TableTennisRules();
  });

  describe('sport property', () => {
    it('should return tableTennis', () => {
      expect(rules.sport).toBe(SPORT.TABLE_TENNIS);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default TT config', () => {
      const config = rules.getDefaultConfig();
      expect(config.sport).toBe(SPORT.TABLE_TENNIS);
      if (config.sport === SPORT.TABLE_TENNIS) {
        expect(config.pointsPerSet).toBe(11);
        expect(config.bestOf).toBe(3);
        expect(config.minDifference).toBe(2);
      }
    });
  });

  describe('needsHandicap', () => {
    it('should return true since TT supports handicap', () => {
      expect(rules.needsHandicap()).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should accept valid TT config', () => {
      const config: SportConfig = {
        sport: SPORT.TABLE_TENNIS,
        pointsPerSet: 11,
        bestOf: 3,
        minDifference: 2,
      };
      expect(rules.validateConfig(config)).toBe(true);
    });
  });

  describe('recordScore', () => {
    it('should increment score for player A', () => {
      const state = makeInitialState();
      const result = rules.recordScore(state, 'A');
      expect(result.state.score.currentSet.a).toBe(1);
      expect(result.state.score.currentSet.b).toBe(0);
    });

    it('should increment score for player B', () => {
      const state = makeInitialState();
      const result = rules.recordScore(state, 'B');
      expect(result.state.score.currentSet.a).toBe(0);
      expect(result.state.score.currentSet.b).toBe(1);
    });

    it('should trigger set win at 11-0 with 2-point difference, resetting current set', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 10, b: 0 },
          serving: 'A',
        },
      });
      const result = rules.recordScore(state, 'A');
      // Set is won — sets incremented, currentSet reset for next set
      expect(result.state.score.sets.a).toBe(1);
      expect(result.state.score.sets.b).toBe(0);
      expect(result.state.score.currentSet.a).toBe(0);
      expect(result.state.score.currentSet.b).toBe(0);
      // On the returned state, the set is no longer "complete" because currentSet was reset
      expect(rules.isSetComplete(result.state)).toBe(false);
    });

    it('should NOT trigger set win at 10-0 (not enough points)', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 10, b: 0 },
          serving: 'A',
        },
      });
      expect(rules.isSetComplete(state)).toBe(false);
    });

    it('should NOT trigger set win at 11-10 (no 2-point difference)', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 11, b: 10 },
          serving: 'A',
        },
      });
      expect(rules.isSetComplete(state)).toBe(false);
    });

    it('should handle deuce: 12-10 win after extended play', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 12, b: 10 },
          serving: 'A',
        },
      });
      expect(rules.isSetComplete(state)).toBe(true);
    });

    it('should detect match win when bestOf sets reached', () => {
      // Player A has 1 set in bestOf-3 (needs 2), wins set 2 at 11-0
      const state = makeInitialState({
        score: {
          sets: { a: 1, b: 0 },
          currentSet: { a: 10, b: 0 },
          serving: 'A',
        },
      });
      const result = rules.recordScore(state, 'A');
      // Player A now has 2 sets — match complete
      expect(result.state.score.sets.a).toBe(2);
      expect(rules.isMatchComplete(result.state)).toBe(true);
      // State should be FINISHED
      expect(result.state.status).toBe('FINISHED');
      expect(result.state.winner).toBe('A');
    });

    it('should not detect match win before sets needed', () => {
      // Player A has 0 sets, wins first set at 11-0 (needs 2 for bestOf-3)
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 10, b: 0 },
          serving: 'A',
        },
      });
      const result = rules.recordScore(state, 'A');
      expect(result.state.score.sets.a).toBe(1);
      expect(result.state.status).toBe('LIVE');
      expect(rules.isMatchComplete(result.state)).toBe(false);
    });
  });

  describe('subtractScore', () => {
    it('should decrement score for player A', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
      });
      const result = rules.subtractScore(state, 'A');
      expect(result.score.currentSet.a).toBe(4);
      expect(result.score.currentSet.b).toBe(3);
    });

    it('should decrement score even into negative (handicap adjustment)', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 0, b: 0 },
          serving: 'A',
        },
      });
      const result = rules.subtractScore(state, 'A');
      expect(result.score.currentSet.a).toBe(-1);
    });
  });

  describe('updateServing', () => {
    it('should swap server every 2 points by default', () => {
      // At 0 total points, serving = 'A'
      const state = makeInitialState();
      const server = rules.updateServing(state);
      expect(server).toBe('B');
    });

    it('should swap back after 2 more points', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 2, b: 0 },
          serving: 'A',
        },
      });
      const server = rules.updateServing(state);
      expect(server).toBe('B');
    });
  });

  describe('checkSideSwap', () => {
    it('should not require side swap before decisive set midpoint', () => {
      const state = makeInitialState();
      expect(rules.checkSideSwap(state)).toBe(false);
    });

    it('should require side swap when in final set and score >= 5', () => {
      // bestOf=3, so final set is when sets=1-1
      const state = makeInitialState({
        config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        score: {
          sets: { a: 1, b: 1 },
          currentSet: { a: 5, b: 0 },
          serving: 'A',
        },
      });
      expect(rules.checkSideSwap(state)).toBe(true);
    });

    it('should not require side swap before 5 points in final set', () => {
      const state = makeInitialState({
        config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        score: {
          sets: { a: 1, b: 1 },
          currentSet: { a: 4, b: 0 },
          serving: 'A',
        },
      });
      expect(rules.checkSideSwap(state)).toBe(false);
    });
  });

  describe('formatDisplayScore', () => {
    it('should return TTPointDisplay with correct values', () => {
      const state = makeInitialState({
        score: {
          sets: { a: 2, b: 1 },
          currentSet: { a: 7, b: 5 },
          serving: 'A',
        },
      });
      const display = rules.formatDisplayScore(state);
      expect(display.type).toBe(SPORT.TABLE_TENNIS);
      expect(display.leftScore).toBe(7);
      expect(display.rightScore).toBe(5);
      expect(display.leftSets).toBe(2);
      expect(display.rightSets).toBe(1);
    });
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  function makeInitialState(overrides: Partial<GameState> = {}): GameState {
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
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
      ...overrides,
    };
  }
});
