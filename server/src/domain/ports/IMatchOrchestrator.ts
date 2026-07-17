/**
 * IMatchOrchestrator — Match lifecycle management contract.
 *
 * Domain-level contract for configuring, starting, scoring, and resetting
 * matches. Decoupled from concrete MatchEngine creation via IMatchEngineFactory.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { Court, Player } from '../types';
import type { MatchConfig, MatchStateExtended } from '../types';

export interface IMatchOrchestrator {
  /**
   * Configure a match: set player names and/or replace the match engine
   * with a new config without starting the match.
   */
  configureMatch(court: Court, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void;

  /**
   * Start a match on the given court. Optionally accepts a partial config
   * and player names. Returns the initial match state, or null if the
   * match could not be started.
   */
  startMatch(court: Court, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null;

  /**
   * Record a point for the given player.
   * Returns the updated match state, or null if the match is not LIVE.
   */
  recordPoint(court: Court, player: Player): MatchStateExtended | null;

  /**
   * Subtract (undo) a point for the given player.
   * Returns the updated match state, or null if the match is not LIVE.
   */
  subtractPoint(court: Court, player: Player): MatchStateExtended | null;

  /**
   * Undo the last scoring action.
   * Returns the restored match state, or null if the match is not LIVE.
   */
  undoLast(court: Court): MatchStateExtended | null;

  /**
   * Set the current server.
   * Returns the updated match state, or null if the match is not LIVE.
   */
  setServer(court: Court, player: Player): MatchStateExtended | null;

  /**
   * Swap sides (end change).
   * Returns the updated match state, or null if the match is not LIVE.
   */
  swapSides(court: Court): MatchStateExtended | null;

  /**
   * Reset a court's match engine to a fresh state (WAITING).
   * Optionally accepts a new config.
   */
  resetTable(court: Court, config?: MatchConfig): void;

  /**
   * Get the current match state for a court.
   * Returns null if the court has no active sportRules.
   */
  getMatchState(court: Court): MatchStateExtended | null;
}
