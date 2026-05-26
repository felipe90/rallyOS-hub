/**
 * Sport Rules Types
 *
 * Defines the SportRules interface that all sport implementations must
 * satisfy. Uses Strategy pattern to isolate sport-specific scoring logic.
 *
 * Phase 2: SportRules interface + GameState alias for MatchState.
 * Phase 3: GameState becomes a true discriminated union.
 */

import {
  Sport,
  Player,
  SportConfig,
  SportDisplayScore,
  MatchState,
  MatchEvent,
  Score,
  TableStatus,
} from '../../../../shared/types';

/**
 * The sport-specific portion of match state.
 *
 * Phase 2: Alias for MatchState to keep extraction backward-compatible.
 * Phase 3: Becomes `TableTennisGameState | PadelGameState` discriminated union.
 */
export type GameState = MatchState;

/**
 * The result of calling recordScore.
 * Contains the updated state and any events emitted during scoring.
 */
export interface ScoreResult {
  state: GameState;
  events: MatchEvent[];
}

/**
 * SportRules Interface — Strategy pattern for sport-specific scoring.
 *
 * Every sport implementation (table tennis, padel, etc.) MUST implement
 * this interface. The MatchEngine delegates all scoring, serving, and
 * side-swap decisions to the active SportRules instance.
 */
export interface SportRules {
  /** Sport identifier — used as discriminator */
  readonly sport: Sport;

  /**
   * Validate that the provided config is valid for this sport.
   * Returns false if config contains invalid or unexpected fields.
   */
  validateConfig(config: SportConfig): boolean;

  /**
   * Record a point for the given player.
   * Returns the updated state and any events emitted (set won, match won, etc.).
   */
  recordScore(state: GameState, player: Player): ScoreResult;

  /**
   * Subtract (undo) a point for the given player.
   * Returns the updated state without events (pure undo).
   */
  subtractScore(state: GameState, player: Player): GameState;

  /**
   * Check if the current set/game is complete.
   * A set is complete when a player reaches the required points with the
   * required minimum difference.
   */
  isSetComplete(state: GameState): boolean;

  /**
   * Check if the match is complete.
   * A match is complete when a player wins the required number of sets.
   */
  isMatchComplete(state: GameState): boolean;

  /**
   * Determine the next server after a point is scored.
   * Returns 'A' or 'B' based on the sport's serving rotation rules.
   */
  updateServing(state: GameState): Player;

  /**
   * Check if sides should be swapped.
   * Returns true if the sport's side-swap conditions are met (e.g.,
   * decisive set midpoint in table tennis).
   */
  checkSideSwap(state: GameState): boolean;

  /**
   * Format the current state into a UI-ready display score.
   * Returns a SportDisplayScore discriminated union.
   */
  formatDisplayScore(state: GameState): SportDisplayScore;

  /**
   * Get the default configuration for this sport.
   */
  getDefaultConfig(): SportConfig;

  /**
   * Whether this sport supports handicap scoring.
   * Table tennis supports handicaps; padel typically does not.
   */
  needsHandicap(): boolean;
}

/**
 * Score-related type re-exports for convenience.
 */
export type { Sport, Player, SportConfig, SportDisplayScore, MatchState, MatchEvent, Score, TableStatus };
