/**
 * Sport Rules Types
 *
 * Defines the SportRules interface that all sport implementations must
 * satisfy. Uses Strategy pattern to isolate sport-specific scoring logic.
 *
 * InternalGameState is a flat superset interface used internally by
 * SportRules. It is decoupled from the discriminated-union MatchState
 * (shared wire type) to keep rule implementations simple.
 *
 * MatchEngine converts between InternalGameState (for rules) and
 * MatchState / MatchStateExtended (for wire format).
 */

import {
  Sport,
  Player,
  SportConfig,
  SportDisplayScore,
  MatchEvent,
  Score,
  TableStatus,
  MatchConfig,
  PadelPoint,
  MatchState,
  MatchStateExtended,
  TableTennisMatchConfig,
  PadelMatchConfig,
  SPORT,
} from '../../../../shared/types';

/**
 * Internal game state — flat superset interface used by SportRules.
 *
 * Contains ALL fields for all sports as optionals. This is intentional:
 * the SportRules implementations (TableTennisRules, PadelRules) are
 * stateless pure functions that operate on this flat state. The
 * discriminated union MatchState is created at the MatchEngine boundary
 * when sending state to the client.
 */
export interface InternalGameState {
  config: MatchConfig;
  score: {
    sets: Score;
    currentSet: Score;
    serving: Player;
  };
  swappedSides: boolean;
  midSetSwapped: boolean;
  setHistory: Score[];
  status: TableStatus;
  winner: Player | null;
  sport: Sport;
  /** Padel-specific: current point values (0, 15, 30, 40, AD) */
  padelPoints?: { a: PadelPoint; b: PadelPoint };
  /** Padel-specific: whether current game is a tiebreak */
  isTiebreak?: boolean;
  /** Padel-specific: current tiebreak point counts */
  tiebreakPoints?: { a: number; b: number };
  /** Padel-specific: golden point / sudden death enabled */
  goldenPoint?: boolean;
}

export type GameState = InternalGameState;

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
export type {
  Sport,
  Player,
  SportConfig,
  SportDisplayScore,
  MatchState,
  MatchStateExtended,
  MatchEvent,
  Score,
  TableStatus,
  MatchConfig,
  PadelPoint,
  TableTennisMatchConfig,
  PadelMatchConfig,
};

export { SPORT };
