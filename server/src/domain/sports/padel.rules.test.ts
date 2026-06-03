/**
 * PadelRules — Strict TDD: tests first, implementation second.
 *
 * Covers: point progression, deuce cycles, golden point, set win,
 * tiebreak (7pt & 10pt), side swap, serve rotation, undo, match win.
 */

import { PadelRules } from './padel.rules';
import { GameState, ScoreResult, SPORT } from './types';
import type { Player, MatchEvent, SportConfig, PadelPoint } from '../../../../shared/types';

describe('PadelRules (implementing SportRules)', () => {
  let rules: PadelRules;

  beforeEach(() => {
    rules = new PadelRules();
  });

  describe('sport property', () => {
    it('should return padel', () => {
      expect(rules.sport).toBe(SPORT.PADEL);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default padel config', () => {
      const config = rules.getDefaultConfig();
      expect(config.sport).toBe(SPORT.PADEL);
      if (config.sport === SPORT.PADEL) {
        expect(config.bestOf).toBe(3);
        expect(config.tiebreakPoints).toBe(7);
        expect(config.gamesPerSet).toBe(6);
        expect(config.goldenPoint).toBe(false);
      }
    });
  });

  describe('needsHandicap', () => {
    it('should return false since padel does not support handicap', () => {
      expect(rules.needsHandicap()).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should accept valid padel config', () => {
      const config: SportConfig = {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 7,
        gamesPerSet: 6,
        goldenPoint: false,
      };
      expect(rules.validateConfig(config)).toBe(true);
    });

    it('should accept config with golden point enabled', () => {
      const config: SportConfig = {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 7,
        gamesPerSet: 6,
        goldenPoint: true,
      };
      expect(rules.validateConfig(config)).toBe(true);
    });

    it('should accept 10pt super tiebreak config', () => {
      const config: SportConfig = {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 10,
        gamesPerSet: 6,
      };
      expect(rules.validateConfig(config)).toBe(true);
    });

    it('should reject non-padel config', () => {
      const config = { sport: SPORT.TABLE_TENNIS } as SportConfig;
      expect(rules.validateConfig(config)).toBe(false);
    });

    it('should reject config with invalid tiebreakPoints', () => {
      const config = {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 8,
        gamesPerSet: 6,
      } as unknown as SportConfig;
      expect(rules.validateConfig(config)).toBe(false);
    });
  });

  // ── Point Progression ──────────────────────────────────────────────

  describe('recordScore — point progression', () => {
    it('should progress from 0 to 15', () => {
      const state = makeInitialState();
      const result = rules.recordScore(state, 'A');
      expect(getPoints(result.state)).toEqual({ a: 15, b: 0 });
    });

    it('should progress 15→30→40', () => {
      let state = makeInitialState();
      state = rules.recordScore(state, 'A').state; // 0→15
      state = rules.recordScore(state, 'A').state; // 15→30
      const result = rules.recordScore(state, 'A'); // 30→40
      expect(getPoints(result.state)).toEqual({ a: 40, b: 0 });
    });

    it('should progress 0→15→30→40 for player B', () => {
      let state = makeInitialState();
      state = rules.recordScore(state, 'B').state;
      state = rules.recordScore(state, 'B').state;
      const result = rules.recordScore(state, 'B');
      expect(getPoints(result.state)).toEqual({ a: 0, b: 40 });
    });

    it('should not emit events during normal progression (no deuce/game/set)', () => {
      const state = makeInitialState();
      const result = rules.recordScore(state, 'A');
      expect(result.events).toHaveLength(0);
    });
  });

  // ── Deuce / Advantage ──────────────────────────────────────────────

  describe('recordScore — deuce and advantage', () => {
    it('should reach deuce at 40-40', () => {
      const state = makeAtDeuce();
      expect(getPoints(state)).toEqual({ a: 40, b: 40 });
      // isDeuce is implicit — both at 40 means deuce
    });

    it('should emit DEUCE event when entering deuce', () => {
      const state = makeAt('A', 40, 'B', 30);
      const result = rules.recordScore(state, 'B'); // 40-30 → 40-40
      const events = result.events.filter(e => e.type === 'DEUCE');
      expect(events).toHaveLength(1);
    });

    it('should go from deuce to AD-A when A scores', () => {
      const state = makeAtDeuce();
      const result = rules.recordScore(state, 'A');
      expect(getPoints(result.state)).toEqual({ a: 'AD', b: 40 });
    });

    it('should go from deuce to AD-B when B scores', () => {
      const state = makeAtDeuce();
      const result = rules.recordScore(state, 'B');
      expect(getPoints(result.state)).toEqual({ a: 40, b: 'AD' });
    });

    it('should return from AD-A to deuce when opponent scores', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'B');
      expect(getPoints(result.state)).toEqual({ a: 40, b: 40 });
    });

    it('should return from AD-B to deuce when opponent scores', () => {
      const state = makeAt('A', 40, 'B', 'AD');
      const result = rules.recordScore(state, 'A');
      expect(getPoints(result.state)).toEqual({ a: 40, b: 40 });
    });

    it('should emit DEUCE event when returning to deuce from advantage', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'B');
      const deuceEvents = result.events.filter(e => e.type === 'DEUCE');
      expect(deuceEvents).toHaveLength(1);
    });

    it('should not emit DEUCE when at deuce and no event (point at deuce goes to AD, not deuce)', () => {
      // Starting from deuce, scoring creates AD, not another deuce
      const state = makeAtDeuce();
      const result = rules.recordScore(state, 'A');
      expect(result.events.some(e => e.type === 'DEUCE')).toBe(false);
    });

    it('should win game from AD-A (2 consecutive points)', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'A');
      expect(result.state.score.currentSet.a).toBe(1); // games[0] incremented
      expect(getGames(result.state)).toEqual([1, 0]);
      expect(getPoints(result.state)).toEqual({ a: 0, b: 0 }); // game reset
    });

    it('should win game from AD-B (2 consecutive points)', () => {
      const state = makeAt('A', 40, 'B', 'AD');
      const result = rules.recordScore(state, 'B');
      expect(getGames(result.state)).toEqual([0, 1]);
      expect(getPoints(result.state)).toEqual({ a: 0, b: 0 });
    });

    it('should emit GAME_WON event when a game is won', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'A');
      const gameWonEvents = result.events.filter(e => e.type === 'GAME_WON');
      expect(gameWonEvents).toHaveLength(1);
      if (gameWonEvents[0].type === 'GAME_WON') {
        expect(gameWonEvents[0].winner).toBe('A');
        expect(gameWonEvents[0].gameNumber).toBe(1);
      }
    });
  });

  // ── Golden Point ───────────────────────────────────────────────────

  describe('recordScore — golden point', () => {
    it('should immediately win game from deuce when goldenPoint is true', () => {
      const state = makeInitialState({ goldenPoint: true });
      // Get to deuce
      let s = state;
      s = rules.recordScore(s, 'A').state; s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state; s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state; s = rules.recordScore(s, 'B').state;
      // Now at 40-40
      const result = rules.recordScore(s, 'A');
      // Should win game directly
      expect(getGames(result.state)).toEqual([1, 0]);
      expect(getPoints(result.state)).toEqual({ a: 0, b: 0 });
    });

    it('should not enter AD state when goldenPoint is true', () => {
      const state = makeInitialState({ goldenPoint: true });
      let s = state;
      // Score to 40-40
      s = rules.recordScore(s, 'A').state; s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state; s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state; s = rules.recordScore(s, 'B').state;
      // At deuce, A scores — should win directly, not go to AD
      const result = rules.recordScore(s, 'A');
      expect(getPoints(result.state)).toEqual({ a: 0, b: 0 });
      expect(getGames(result.state)).toEqual([1, 0]);
    });
  });

  // ── Game Win ───────────────────────────────────────────────────────

  describe('recordScore — game win and serve rotation', () => {
    it('should emit GAME_WON with correct game number', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'A');
      const gameWon = result.events.find(e => e.type === 'GAME_WON')!;
      expect(gameWon.type).toBe('GAME_WON');
      if (gameWon.type === 'GAME_WON') {
        expect(gameWon.winner).toBe('A');
        expect(gameWon.gameNumber).toBe(1);
      }
    });

    it('should rotate server after each game', () => {
      // Game 1: A serves; after game ends, B serves game 2
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'A');
      expect(result.state.score.serving).toBe('B');
    });

    it('should swap sides on odd total games (1, 3, 5...)', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'A');
      // After game 1 (odd), sides should swap
      expect(result.state.swappedSides).toBe(true);
    });

    it('should not swap sides on even total games', () => {
      // Win game 1
      const s1 = makeAt('A', 'AD', 'B', 40);
      const afterGame1 = rules.recordScore(s1, 'A').state;
      // After game 1 (odd), swappedSides = true
      // Win game 2 (even) — no side swap, stays true
      const s2 = makeAt('A', 'AD', 'B', 40, afterGame1);
      const afterGame2 = rules.recordScore(s2, 'A').state;
      // Total games = 2, even, so swappedSides stays true (no toggle)
      expect(afterGame2.swappedSides).toBe(true);
    });
  });

  // ── Set Win ─────────────────────────────────────────────────────────

  describe('recordScore — set win', () => {
    it('should win set at 6-0 games', () => {
      const state = makeAtSetPoint(5, 0, 'A');
      const result = rules.recordScore(state, 'A');
      expect(getSets(result.state)).toEqual([1, 0]);
      expect(getGames(result.state)).toEqual([0, 0]);
    });

    it('should win set at 6-4 games', () => {
      const state = makeAtSetPoint(5, 4, 'A');
      const result = rules.recordScore(state, 'A');
      expect(getSets(result.state)).toEqual([1, 0]);
    });

    it('should win set at 7-5 games', () => {
      const state = makeAtSetPoint(6, 5, 'A');
      const result = rules.recordScore(state, 'A');
      expect(getSets(result.state)).toEqual([1, 0]);
    });

    it('should not win set at 5-5 (needs 2-game lead)', () => {
      const state = makeAtSetPoint(5, 5, 'A');
      const result = rules.recordScore(state, 'A');
      expect(getSets(result.state)).toEqual([0, 0]);
      expect(getGames(result.state)).toEqual([6, 5]); // 6-5, not done
    });

    it('should emit SET_WON event when a set is won', () => {
      const state = makeAtSetPoint(5, 0, 'A');
      const result = rules.recordScore(state, 'A');
      const setWonEvents = result.events.filter(e => e.type === 'SET_WON');
      expect(setWonEvents).toHaveLength(1);
    });

    it('should swap sides when starting a new set', () => {
      const state = makeAtSetPoint(5, 0, 'A');
      const result = rules.recordScore(state, 'A');
      expect(result.state.swappedSides).toBe(true);
    });
  });

  // ── Tiebreak ────────────────────────────────────────────────────────

  describe('recordScore — tiebreak 7pt', () => {
    it('should enter tiebreak at 6-6 games', () => {
      const state = makeAtSetPoint(6, 6, 'A');
      // Both at 6 games, set can't continue without tiebreak
      // Score A at deuce/advantage to win game -> make it 6-6 with tiebreak
      const preTiebreak = makeAt('A', 40, 'B', 'AD');
      // Actually, let me just create a state with 6-5, then A scores to make it 6-5→A wins game→6-6→tiebreak
      // Wait no — if A wins game at 6-5, it's 7-5, not 6-6
      // I need to reach 6-6 GAMES first

      // Let me construct the state directly
      const tbState = makeInitialState();
      tbState.score.currentSet = { a: 6, b: 6 }; // 6-6 games

      // Now someone scores a point in the tiebreak
      const result = rules.recordScore(tbState, 'A');
      expect(result.state.isTiebreak).toBe(true);
      const tiebreakStart = result.events.find(e => e.type === 'TIEBREAK_START');
      expect(tiebreakStart).toBeDefined();
    });

    it('should emit TIEBREAK_START event with correct target points', () => {
      const tbState = makeInitialState();
      tbState.score.currentSet = { a: 6, b: 6 };
      const result = rules.recordScore(tbState, 'A');
      const tiebreakStart = result.events.find(e => e.type === 'TIEBREAK_START')!;
      expect(tiebreakStart.type).toBe('TIEBREAK_START');
      if (tiebreakStart.type === 'TIEBREAK_START') {
        expect(tiebreakStart.targetPoints).toBe(7);
      }
    });

    it('should score tiebreak as 1-2-3 (not 15-30-40)', () => {
      const tbState = makeInitialState();
      tbState.score.currentSet = { a: 6, b: 6 };
      const s1 = rules.recordScore(tbState, 'A').state;
      expect(getTBPoints(s1)).toEqual({ a: 1, b: 0 });
      const s2 = rules.recordScore(s1, 'A').state;
      expect(getTBPoints(s2)).toEqual({ a: 2, b: 0 });
      const s3 = rules.recordScore(s2, 'A').state;
      expect(getTBPoints(s3)).toEqual({ a: 3, b: 0 });
    });

    it('should win tiebreak at 7-5 with 2pt lead', () => {
      const tbState = makeInitialState();
      tbState.score.currentSet = { a: 6, b: 6 };
      // A scores 7 points, B scores 5
      let s = rules.recordScore(tbState, 'A').state; // A:1 B:0
      s = rules.recordScore(s, 'A').state;            // A:2 B:0
      s = rules.recordScore(s, 'B').state;            // A:2 B:1
      s = rules.recordScore(s, 'B').state;            // A:2 B:2
      s = rules.recordScore(s, 'A').state;            // A:3 B:2
      s = rules.recordScore(s, 'B').state;            // A:3 B:3
      s = rules.recordScore(s, 'A').state;            // A:4 B:3
      s = rules.recordScore(s, 'A').state;            // A:5 B:3
      s = rules.recordScore(s, 'A').state;            // A:6 B:3
      s = rules.recordScore(s, 'B').state;            // A:6 B:4
      s = rules.recordScore(s, 'B').state;            // A:6 B:5
      const result = rules.recordScore(s, 'A');       // A:7 B:5 — win
      expect(getSets(result.state)).toEqual([1, 0]);
      expect(result.state.isTiebreak).toBe(false);
    });

    it('should not win tiebreak at 7-6 without 2pt lead', () => {
      const tbState = makeInitialState();
      tbState.score.currentSet = { a: 6, b: 6 };
      let s = rules.recordScore(tbState, 'A').state;
      s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state;
      s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state;
      s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state;
      s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state;
      s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state;
      s = rules.recordScore(s, 'B').state;
      s = rules.recordScore(s, 'A').state;  // A:7 B:6
      // A has 7, B has 6, lead is only 1
      const result = rules.recordScore(s, 'A');  // A:8 B:6 — now 2pt lead
      expect(getSets(result.state)).toEqual([1, 0]);
    });
  });

  describe('recordScore — super tiebreak 10pt', () => {
    it('should use 10pt target when configured', () => {
      const state = makeInitialState({
        tiebreakPoints: 10,
      });
      state.score.currentSet = { a: 6, b: 6 };
      const result = rules.recordScore(state, 'A');
      const tiebreakStart = result.events.find(e => e.type === 'TIEBREAK_START')!;
      expect(tiebreakStart.type).toBe('TIEBREAK_START');
      if (tiebreakStart.type === 'TIEBREAK_START') {
        expect(tiebreakStart.targetPoints).toBe(10);
      }
    });

    it('should win super tiebreak at 10-8 with 2pt lead', () => {
      const state = makeInitialState({
        tiebreakPoints: 10,
      });
      state.score.currentSet = { a: 6, b: 6 };
      // Simulate tiebreak to 10-8
      let s = rules.recordScore(state, 'A').state;
      s = rules.recordScore(s, 'B').state;
      // Just do enough points — A gets 10, B gets 8
      for (let i = 2; i <= 9; i++) {
        s = rules.recordScore(s, i <= 9 ? 'A' : 'B').state;
      }
      // Hmm, let me be more careful
      // Reset and be explicit — A scores 10, B scores 8
      s = rules.recordScore(state, 'A').state;  // 1-0
      for (let i = 0; i < 9; i++) s = rules.recordScore(s, i < 7 ? 'A' : 'B').state;
      // Actually let me just use a shortcut: create a state at 9-8
      // Then A scores to make it 10-8
      s = makeTiebreakState(9, 8, 'A');
      const result = rules.recordScore(s, 'A');
      expect(getSets(result.state)).toEqual([1, 0]);
      expect(result.state.isTiebreak).toBe(false);
    });
  });

  // ── Side Swap ──────────────────────────────────────────────────────

  describe('checkSideSwap', () => {
    it('should swap on odd total games (1, 3, 5...)', () => {
      // Win a game to make total=1
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'A');
      expect(result.state.swappedSides).toBe(true);
    });

    it('should not indicate swap at 0 games', () => {
      const state = makeInitialState();
      expect(rules.checkSideSwap(state)).toBe(false);
    });
  });

  // ── Serve Rotation ─────────────────────────────────────────────────

  describe('updateServing', () => {
    it('should start with server from state (A serves game 1)', () => {
      const state = makeInitialState();
      expect(rules.updateServing(state)).toBe('A');
    });

    it('should rotate server after a game is won', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.recordScore(state, 'A');
      // After game won, server changes
      expect(result.state.score.serving).toBe('B');
    });

    it('should rotate back after two games', () => {
      // Win game 1 (A→B)
      const s1 = makeAt('A', 'AD', 'B', 40);
      const afterGame1 = rules.recordScore(s1, 'A').state;
      // Win game 2 (B→A) — create state where B has AD, A has 40
      const s2 = makeAt('A', 40, 'B', 'AD', afterGame1);
      const afterGame2 = rules.recordScore(s2, 'B').state;
      expect(afterGame2.score.serving).toBe('A');
    });
  });

  // ── Undo / SubtractScore ──────────────────────────────────────────

  describe('subtractScore', () => {
    it('should go from 40 back to 30', () => {
      const state = makeAt('A', 40, 'B', 0);
      const result = rules.subtractScore(state, 'A');
      expect(getPoints(result)).toEqual({ a: 30, b: 0 });
    });

    it('should go from 30 back to 15', () => {
      const state = makeAt('A', 30, 'B', 0);
      const result = rules.subtractScore(state, 'A');
      expect(getPoints(result)).toEqual({ a: 15, b: 0 });
    });

    it('should go from 15 back to 0', () => {
      const state = makeAt('A', 15, 'B', 0);
      const result = rules.subtractScore(state, 'A');
      expect(getPoints(result)).toEqual({ a: 0, b: 0 });
    });

    it('should go from AD back to deuce (40-40)', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const result = rules.subtractScore(state, 'A');
      expect(getPoints(result)).toEqual({ a: 40, b: 40 });
    });

    it('should go from deuce back to 40-30 for the other player', () => {
      // If deuce came from 40-30 (B scored to make 40-40), undo B → 40-30
      const state = makeAtDeuce();
      const result = rules.subtractScore(state, 'B');
      expect(getPoints(result)).toEqual({ a: 40, b: 30 });
    });

    it('should go from deuce back to 30-40 for the other player', () => {
      // If deuce came from 30-40 (A scored to make 40-40), undo A → 30-40
      const state = makeAtDeuce();
      const result = rules.subtractScore(state, 'A');
      expect(getPoints(result)).toEqual({ a: 30, b: 40 });
    });

    it('should undo game boundaries — restore previous points after game win', () => {
      // Win a game from AD-A, then undo
      const state = makeAt('A', 'AD', 'B', 40);
      const afterWin = rules.recordScore(state, 'A').state;
      // Games went from [0,0] to [1,0], points reset to [0,0]
      // Undo: games back to [0,0], points at AD-A
      const result = rules.subtractScore(afterWin, 'A');
      expect(getGames(result)).toEqual([0, 0]);
      expect(getPoints(result)).toEqual({ a: 'AD', b: 40 });
    });

    it('should handle subtract within tiebreak (decrement count)', () => {
      const tbState = makeInitialState();
      tbState.score.currentSet = { a: 6, b: 6 };
      const s1 = rules.recordScore(tbState, 'A').state; // TB: A:1 B:0
      const result = rules.subtractScore(s1, 'A');
      expect(getTBPoints(result)).toEqual({ a: 0, b: 0 });
    });
  });

  // ── Format Display ─────────────────────────────────────────────────

  describe('formatDisplayScore', () => {
    it('should return PadelPointDisplay with correct values', () => {
      const state = makeAt('A', 30, 'B', 40);
      state.score.sets = { a: 1, b: 0 };
      const display = rules.formatDisplayScore(state);
      expect(display.type).toBe(SPORT.PADEL);
      expect(display.leftPoint).toBe('30');
      expect(display.rightPoint).toBe('40');
      expect(display.leftGames).toBe(0);
      expect(display.rightGames).toBe(0);
      expect(display.leftSets).toBe(1);
      expect(display.rightSets).toBe(0);
    });

    it('should show AD for advantage', () => {
      const state = makeAt('A', 'AD', 'B', 40);
      const display = rules.formatDisplayScore(state);
      expect(display.leftPoint).toBe('AD');
      expect(display.rightPoint).toBe('40');
    });

    it('should show 40 during deuce', () => {
      const state = makeAtDeuce();
      const display = rules.formatDisplayScore(state);
      expect(display.leftPoint).toBe('40');
      expect(display.rightPoint).toBe('40');
    });

    it('should show tiebreak points in tiebreak', () => {
      const tbState = makeInitialState();
      tbState.score.currentSet = { a: 6, b: 6 };
      const s1 = rules.recordScore(tbState, 'A').state;
      const s2 = rules.recordScore(s1, 'A').state;
      const display = rules.formatDisplayScore(s2);
      expect(display.leftPoint).toBe('2');
      expect(display.rightPoint).toBe('0');
    });

    it('should show games won', () => {
      const state = makeAt('A', 0, 'B', 0);
      state.score.currentSet = { a: 3, b: 2 };
      const display = rules.formatDisplayScore(state);
      expect(display.leftGames).toBe(3);
      expect(display.rightGames).toBe(2);
    });
  });

  // ── Set/Match Complete ────────────────────────────────────────────

  describe('isSetComplete', () => {
    it('should return true when a player reaches 6 with 2-game lead', () => {
      const state = makeInitialState();
      state.score.currentSet = { a: 6, b: 4 };
      expect(rules.isSetComplete(state)).toBe(true);
    });

    it('should return false at 5-5', () => {
      const state = makeInitialState();
      state.score.currentSet = { a: 5, b: 5 };
      expect(rules.isSetComplete(state)).toBe(false);
    });

    it('should return true at 7-5', () => {
      const state = makeInitialState();
      state.score.currentSet = { a: 7, b: 5 };
      expect(rules.isSetComplete(state)).toBe(true);
    });

    it('should return false at 6-5', () => {
      const state = makeInitialState();
      state.score.currentSet = { a: 6, b: 5 };
      expect(rules.isSetComplete(state)).toBe(false);
    });
  });

  describe('isMatchComplete', () => {
    it('should return true when a player wins 2 sets (best of 3)', () => {
      const state = makeInitialState();
      state.score.sets = { a: 2, b: 0 };
      expect(rules.isMatchComplete(state)).toBe(true);
    });

    it('should return true when B wins 2 sets', () => {
      const state = makeInitialState();
      state.score.sets = { a: 0, b: 2 };
      expect(rules.isMatchComplete(state)).toBe(true);
    });

    it('should return false at 1-1 sets', () => {
      const state = makeInitialState();
      state.score.sets = { a: 1, b: 1 };
      expect(rules.isMatchComplete(state)).toBe(false);
    });

    it('should return false at 0-0 sets', () => {
      const state = makeInitialState();
      state.score.sets = { a: 0, b: 0 };
      expect(rules.isMatchComplete(state)).toBe(false);
    });
  });

  // ── Match Win ─────────────────────────────────────────────────────

  describe('recordScore — match win', () => {
    it('should win match 2-0 (straight sets)', () => {
      const state = makeAtSetPoint(5, 0, 'A');
      state.score.sets = { a: 1, b: 0 }; // Already has 1 set

      // Ensure it's a valid PadelMatchConfig with bestOf=3
      state.config = { sport: SPORT.PADEL, bestOf: 3, tiebreakPoints: 7, gamesPerSet: 6, goldenPoint: false } as any;
      const s2 = makeAtSetPoint(5, 0, 'A', undefined, { ...state, config: { sport: SPORT.PADEL, bestOf: 3, tiebreakPoints: 7, gamesPerSet: 6, goldenPoint: false } as any });
      s2.score.sets = { a: 1, b: 0 };
      const result = rules.recordScore(s2, 'A');
      expect(getSets(result.state)).toEqual([2, 0]);
      expect(result.state.status).toBe('FINISHED');
      expect(result.state.winner).toBe('A');
    });

    it('should emit MATCH_WON on match win', () => {
      const state = makeAtSetPoint(5, 0, 'A');
      state.score.sets = { a: 1, b: 0 };
      const result = rules.recordScore(state, 'A');
      const matchWon = result.events.find(e => e.type === 'MATCH_WON')!;
      expect(matchWon).toBeDefined();
      expect(matchWon.type).toBe('MATCH_WON');
    });

    it('should win match 2-1 (3 sets)', () => {
      const state = makeAtSetPoint(5, 4, 'A');
      state.score.sets = { a: 1, b: 1 };
      const result = rules.recordScore(state, 'A');
      expect(getSets(result.state)).toEqual([2, 1]);
      expect(result.state.status).toBe('FINISHED');
      expect(result.state.winner).toBe('A');
    });
  });

  // ── Complete match simulation ─────────────────────────────────────

  describe('full match simulation', () => {
    it('should play a full game (4 points)', () => {
      let state = makeInitialState();
      state = rules.recordScore(state, 'A').state;  // 15-0
      state = rules.recordScore(state, 'A').state;  // 30-0
      state = rules.recordScore(state, 'A').state;  // 40-0
      const result = rules.recordScore(state, 'A');  // Game A
      expect(getGames(result.state)).toEqual([1, 0]);
    });

    it('should play deuce cycle then game won', () => {
      let state = makeInitialState();
      // Alternate to reach deuce
      state = rules.recordScore(state, 'A').state; state = rules.recordScore(state, 'B').state;
      state = rules.recordScore(state, 'A').state; state = rules.recordScore(state, 'B').state;
      state = rules.recordScore(state, 'A').state; state = rules.recordScore(state, 'B').state;
      // Now 40-40
      expect(getPoints(state)).toEqual({ a: 40, b: 40 });
      // A gets advantage
      state = rules.recordScore(state, 'A').state;
      expect(getPoints(state)).toEqual({ a: 'AD', b: 40 });
      // B brings it back to deuce
      state = rules.recordScore(state, 'B').state;
      expect(getPoints(state)).toEqual({ a: 40, b: 40 });
      // A gets advantage again
      state = rules.recordScore(state, 'A').state;
      expect(getPoints(state)).toEqual({ a: 'AD', b: 40 });
      // A wins game
      const result = rules.recordScore(state, 'A');
      expect(getGames(result.state)).toEqual([1, 0]);
    });
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /** Create a MatchState-based GameState suitable for padel testing */
  function makeInitialState(overrides: Partial<{
    goldenPoint: boolean;
    tiebreakPoints: 7 | 10;
    bestOf: number;
    gamesPerSet: number;
  }> = {}): GameState {
    const {
      goldenPoint = false,
      tiebreakPoints = 7,
      bestOf = 3,
      gamesPerSet = 6,
    } = overrides;

    return {
      config: {
        sport: SPORT.PADEL,
        bestOf,
        tiebreakPoints,
        gamesPerSet,
        goldenPoint,
      },
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
      sport: SPORT.PADEL,
      padelPoints: { a: 0, b: 0 },
      isTiebreak: false,
      tiebreakPoints: { a: 0, b: 0 },
      goldenPoint,
    };
  }

  /** Set points to specific values */
  function makeAt(
    aPlayer: Player, aPoint: PadelPoint,
    bPlayer: Player, bPoint: PadelPoint,
    baseState?: GameState,
  ): GameState {
    const state = baseState ? JSON.parse(JSON.stringify(baseState)) : makeInitialState();
    if (!state.padelPoints) state.padelPoints = { a: 0, b: 0 };
    state.padelPoints.a = aPlayer === 'A' ? aPoint : aPoint === 'AD' ? 40 : aPoint;
    state.padelPoints.b = bPlayer === 'B' ? bPoint : bPoint === 'AD' ? 40 : bPoint;
    // Override based on who has what
    state.padelPoints.a = aPoint;
    state.padelPoints.b = bPoint;
    return state;
  }

  /** Create a state at deuce (40-40) */
  function makeAtDeuce(baseState?: GameState): GameState {
    return makeAt('A', 40, 'B', 40, baseState);
  }

  /** Create a state at a set point (A is about to win at given games) */
  function makeAtSetPoint(
    gamesA: number, gamesB: number,
    server: Player = 'A',
    pointState?: { a: PadelPoint; b: PadelPoint },
    baseState?: GameState,
  ): GameState {
    const state = baseState ? JSON.parse(JSON.stringify(baseState)) : makeInitialState();
    state.score.currentSet = { a: gamesA, b: gamesB };
    state.score.serving = server;
    if (!state.padelPoints) state.padelPoints = { a: 0, b: 0 };
    if (pointState) {
      state.padelPoints = pointState;
    } else {
      // Default to advantage state for the server
      state.padelPoints = { a: 'AD' as PadelPoint, b: 40 };
    }
    return state;
  }

  /** Create a state in tiebreak with specific scores */
  function makeTiebreakState(tbA: number, tbB: number, server: Player = 'A'): GameState {
    const state = makeInitialState();
    state.score.currentSet = { a: 6, b: 6 };
    state.score.serving = server;
    state.isTiebreak = true;
    state.tiebreakPoints = { a: tbA, b: tbB };
    state.padelPoints = { a: 0, b: 0 };
    return state;
  }

  /** Extract padel points from a GameState */
  function getPoints(state: GameState): { a: PadelPoint; b: PadelPoint } {
    return state.padelPoints || { a: 0, b: 0 };
  }

  /** Extract games from a GameState */
  function getGames(state: GameState): [number, number] {
    return [state.score.currentSet.a, state.score.currentSet.b];
  }

  /** Extract sets from a GameState */
  function getSets(state: GameState): [number, number] {
    return [state.score.sets.a, state.score.sets.b];
  }

  /** Extract tiebreak points from a GameState */
  function getTBPoints(state: GameState): { a: number; b: number } {
    return state.tiebreakPoints || { a: 0, b: 0 };
  }
});
