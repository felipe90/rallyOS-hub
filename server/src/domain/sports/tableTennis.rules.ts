/**
 * TableTennisRules — SportRules implementation for table tennis (11pt, best-of-n).
 *
 * Stateless pure logic: each method takes a GameState and returns a new one
 * without side effects. MatchEngine owns history, callbacks, and state lifecycle.
 *
 * Scoring (current Phase 3+):
 * - Standard game: first to `pointsPerSet` with `minDifference` lead.
 * - No deuce/advantage like tennis — just extended play at 10-10 until 2pt lead.
 * - Best of N sets (default 3).
 * - Handicap support: initial score offset per set.
 * - Side swap at decisive set midpoint (first to 5 in final set).
 * - Server swaps every 2 points normally, every 1 point during deuce (>=10-10).
 */

import crypto from 'crypto';
import { Player, MatchEvent, SetWonEvent, MatchWonEvent, Score, SportConfig, TableTennisMatchConfig, SPORT } from '../../../../shared/types';
import type { GameState, SportRules, ScoreResult } from './types';
import { logger } from '../../utils/logger';

/** Default table tennis configuration */
const DEFAULT_CONFIG: SportConfig = {
  sport: SPORT.TABLE_TENNIS,
  pointsPerSet: 11,
  bestOf: 3,
  minDifference: 2,
};

/**
 * Deep-clone helper using JSON round-trip.
 * Safe for plain objects, arrays, primitives — not for classes/Date/etc.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export class TableTennisRules implements SportRules {
  readonly sport = SPORT.TABLE_TENNIS;

  getDefaultConfig(): SportConfig {
    return { ...DEFAULT_CONFIG };
  }

  needsHandicap(): boolean {
    return true;
  }

  validateConfig(config: SportConfig): boolean {
    if (config.sport !== SPORT.TABLE_TENNIS) return false;
    if (typeof config.pointsPerSet !== 'number' || config.pointsPerSet < 1) return false;
    if (typeof config.bestOf !== 'number' || config.bestOf < 1 || config.bestOf % 2 !== 1) return false;
    if (typeof config.minDifference !== 'number' || config.minDifference < 1) return false;
    return true;
  }

  recordScore(state: GameState, player: Player): ScoreResult {
    const newState = deepClone(state);
    const events: MatchEvent[] = [];

    // Increment the current set score
    if (player === 'A') newState.score.currentSet.a++;
    else newState.score.currentSet.b++;

    // Check set win (may update sets, setHistory, currentSet, swappedSides, midSetSwapped, status, winner)
    this.applySetWinCheck(newState, events);

    // Check side swap (decisive set midpoint)
    if (this.checkSideSwap(newState)) {
      newState.swappedSides = !newState.swappedSides;
      newState.midSetSwapped = true;
    }

    // Update serving
    newState.score.serving = this.updateServing(newState);

    return { state: newState, events };
  }

  subtractScore(state: GameState, player: Player): GameState {
    const newState = deepClone(state);
    const p = player.toLowerCase() as 'a' | 'b';
    newState.score.currentSet[p]--;
    newState.score.serving = this.updateServing(newState);
    return newState;
  }

  /** Cast config to TT-specific type (safe — this rules instance is only called with TT config) */
  private ttConfig(config: import('../../../../shared/types').MatchConfig): TableTennisMatchConfig {
    return config as TableTennisMatchConfig;
  }

  isSetComplete(state: GameState): boolean {
    const { a, b } = state.score.currentSet;
    const { pointsPerSet, minDifference } = this.ttConfig(state.config);

    const hasReachedLimit = a >= pointsPerSet || b >= pointsPerSet;
    const hasDifference = Math.abs(a - b) >= minDifference;

    return hasReachedLimit && hasDifference;
  }

  isMatchComplete(state: GameState): boolean {
    const { a, b } = state.score.sets;
    const setsNeeded = Math.ceil(this.ttConfig(state.config).bestOf / 2);
    return a >= setsNeeded || b >= setsNeeded;
  }

  updateServing(state: GameState): Player {
    const totalPoints = state.score.currentSet.a + state.score.currentSet.b;
    const isDeuce = state.score.currentSet.a >= 10 && state.score.currentSet.b >= 10;
    const changeInterval = isDeuce ? 1 : 2;

    if (totalPoints % changeInterval === 0) {
      return state.score.serving === 'A' ? 'B' : 'A';
    }
    return state.score.serving;
  }

  checkSideSwap(state: GameState): boolean {
    const { a, b } = state.score.sets;
    const isFinalSet = (a + b) === (this.ttConfig(state.config).bestOf - 1);

    if (isFinalSet && !state.midSetSwapped) {
      const { a: scoreA, b: scoreB } = state.score.currentSet;
      return scoreA >= 5 || scoreB >= 5;
    }
    return false;
  }

  formatDisplayScore(state: GameState): import('../../../../shared/types').TTPointDisplay {
    return {
      type: SPORT.TABLE_TENNIS,
      leftScore: state.score.currentSet.a,
      rightScore: state.score.currentSet.b,
      leftSets: state.score.sets.a,
      rightSets: state.score.sets.b,
    };
  }

  /**
   * Internal: check if current set is won, mutate state accordingly.
   * If set is won: increments sets, pushes to setHistory, resets currentSet,
   * swaps sides for next set, and checks match win.
   * Pushes events to the events array instead of calling callbacks.
   */
  private applySetWinCheck(newState: GameState, events: MatchEvent[]): void {
    const { a, b } = newState.score.currentSet;
    const cfg = this.ttConfig(newState.config);
    const { pointsPerSet, minDifference } = cfg;

    const hasReachedLimit = a >= pointsPerSet || b >= pointsPerSet;
    const hasDifference = Math.abs(a - b) >= minDifference;

    if (!hasReachedLimit || !hasDifference) return;

    const winner = a > b ? 'A' : 'B';
    if (winner === 'A') newState.score.sets.a++;
    else newState.score.sets.b++;

    newState.setHistory.push({ a, b });

    // Push SET_WON event
    const setNumber = newState.score.sets.a + newState.score.sets.b;
    events.push({
      type: 'SET_WON',
      winner: winner as Player,
      score: { a, b },
      setNumber,
    });

    // Check match win
    const setsNeeded = Math.ceil(cfg.bestOf / 2);
    if (newState.score.sets.a >= setsNeeded) {
      newState.status = 'FINISHED';
      newState.winner = 'A';
    } else if (newState.score.sets.b >= setsNeeded) {
      newState.status = 'FINISHED';
      newState.winner = 'B';
    }

    // Emit MATCH_WON if finished
    if (newState.status === 'FINISHED') {
      events.push({
        type: 'MATCH_WON',
        winner: newState.winner as Player,
        finalScore: [...newState.setHistory, { a, b }],
        sets: { ...newState.score.sets },
      });
    }

    // If match continues, reset current set with handicap and swap sides
    if (newState.status !== 'FINISHED') {
      const handicapA = cfg.handicapA || 0;
      const handicapB = cfg.handicapB || 0;
      newState.score.currentSet = { a: handicapA, b: handicapB };
      newState.swappedSides = !newState.swappedSides;
      newState.midSetSwapped = false;
    }
  }
}
