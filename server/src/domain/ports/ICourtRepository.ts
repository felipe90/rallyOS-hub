/**
 * ICourtRepository — Domain-level runtime court CRUD contract.
 *
 * Defines the storage abstraction for Court objects. Implementations manage
 * two separate maps (tournament courts and club courts) with discriminated
 * clear behavior: clear() only wipes tournament courts (for finishTournament);
 * clearAll() wipes both.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { Court } from '../types';

export interface ICourtRepository {
  /**
   * Get the next available table number by finding the lowest
   * positive integer not already in use across all courts.
   */
  getNextTableNumber(): number;

  /**
   * Store a court, dispatching to the correct internal map by kind.
   * Returns the stored court.
   */
  create(court: Court): Court;

  /**
   * Look up a court by ID — tournament first, then club.
   * Returns undefined if not found.
   */
  get(id: string): Court | undefined;

  /** Return all courts across both maps. */
  getAll(): Court[];

  /**
   * Delete a court from whichever map contains it.
   * Returns true if a court was actually removed.
   */
  delete(id: string): boolean;

  /**
   * Clear tournament courts ONLY.
   * Club courts survive — used by finishTournament.
   */
  clear(): void;

  /** Clear everything — tournament AND club courts. */
  clearAll(): void;
}
