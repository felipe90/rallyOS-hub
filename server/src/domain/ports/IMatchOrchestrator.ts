/**
 * IMatchOrchestrator — Match lifecycle management contract.
 *
 * Domain-level contract for configuring, starting, scoring, and resetting
 * matches. Decoupled from concrete MatchEngine creation via IMatchEngineFactory.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { RuntimeCourt, Player } from '../types';
import type { MatchConfig, MatchStateExtended } from '../types';

export interface IMatchOrchestrator {
  /**
   * Configure a match: set player names and/or replace the match engine
   * with a new config without starting the match.
   */
  configureMatch(court: RuntimeCourt, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void;

  /**
   * Prepare a court for play without starting the match: create the engine
   * with the given config and leave the match state in WAITING status.
   * Used by club courts on player join so the client can show the mode
   * selector (ClubSessionConfig) before choosing free or match mode.
   */
  prepareCourt(court: RuntimeCourt, config: { matchConfig: MatchConfig; playerNames: { a: string; b: string } }): MatchStateExtended | null;

  /**
   * Start a match on the given court. Optionally accepts a partial config
   * and player names. Returns the initial match state, or null if the
   * match could not be started.
   */
  startMatch(court: RuntimeCourt, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null;

  /**
   * Record a point for the given player.
   * Returns the updated match state, or null if the match is not LIVE.
   */
  recordPoint(court: RuntimeCourt, player: Player): MatchStateExtended | null;

  /**
   * Subtract (undo) a point for the given player.
   * Returns the updated match state, or null if the match is not LIVE.
   */
  subtractPoint(court: RuntimeCourt, player: Player): MatchStateExtended | null;

  /**
   * Undo the last scoring action.
   * Returns the restored match state, or null if the match is not LIVE.
   */
  undoLast(court: RuntimeCourt): MatchStateExtended | null;

  /**
   * Set the current server.
   * Returns the updated match state, or null if the match is not LIVE.
   */
  setServer(court: RuntimeCourt, player: Player): MatchStateExtended | null;

  /**
   * Swap sides (end change).
   * Returns the updated match state, or null if the match is not LIVE.
   */
  swapSides(court: RuntimeCourt): MatchStateExtended | null;

  /**
   * Reset a court's match engine to a fresh state (WAITING).
   * Optionally accepts a new config.
   */
  resetTable(court: RuntimeCourt, config?: MatchConfig): void;

  /**
   * Get the current match state for a court.
   * Returns null if the court has no active sportRules.
   */
  getMatchState(court: RuntimeCourt): MatchStateExtended | null;
}
