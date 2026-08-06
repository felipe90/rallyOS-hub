/**
 * IPlayerService — Player join, leave, and referee management contract.
 *
 * Domain-level contract for managing player connections to courts.
 * Depends on IPinService for PIN-gated operations (joinCourt with PIN,
 * setReferee). The setRefereeDirect method bypasses PIN validation for
 * club-mode courts where the joining player IS the referee.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { RuntimeCourt, Player } from '../types';

export interface IPlayerService {
  /**
   * Join a court. When a PIN is provided, validates it first.
   * Returns true on success, false on invalid PIN.
   */
  joinCourt(court: RuntimeCourt, socketId: string, name: string, pin?: string): boolean;

  /**
   * Remove a player from a court by socket ID.
   * No-op if the socket is not on the court.
   */
  leaveCourt(court: RuntimeCourt, socketId: string): void;

  /**
   * Set a socket as referee, authenticated by PIN.
   * Replaces any existing referee.
   * Returns true on successful PIN validation.
   */
  setReferee(court: RuntimeCourt, socketId: string, pin: string): boolean;

  /**
   * Set a socket as referee without PIN validation.
   * Used by club-mode courts where the joining player IS the referee.
   * Returns the old referee's socketId if one was displaced, null otherwise.
   */
  setRefereeDirect(court: RuntimeCourt, socketId: string, name: string): string | null;

  /** Check if a socket is the current referee for a court. */
  isReferee(court: RuntimeCourt, socketId: string): boolean;

  /** Get the socket ID of the current referee, or null if none. */
  getRefereeSocketId(court: RuntimeCourt): string | null;
}
