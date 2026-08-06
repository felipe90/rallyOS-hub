/**
 * ICourtRepository — Domain-level runtime court store contract.
 *
 * Defines the storage abstraction for runtime RuntimeCourt objects. One unified map
 * (no tournament/club kind dispatch — one physical court is one entity,
 * E11/D1). Numbering lives in CourtNumberCounter (INV-3), NOT here — the old
 * getNextTableNumber() was removed.
 *
 * clear() = tournament-flow release (finishTournament contract: club courts
 * survive); clearAll() = drop every runtime entry.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { RuntimeCourt } from '../types';

export interface ICourtRepository {
  /**
   * Store a court. Unified — no kind dispatch.
   * Returns the stored court.
   */
  create(court: RuntimeCourt): RuntimeCourt;

  /**
   * Look up a court by ID.
   * Returns undefined if not found.
   */
  get(id: string): RuntimeCourt | undefined;

  /** Return all runtime courts (tournament + club, one catalog). */
  getAll(): RuntimeCourt[];

  /**
   * Delete a court by ID.
   * Returns true if a court was actually removed.
   */
  delete(id: string): boolean;

  /**
   * Tournament-flow release: removes tournament-mode runtime entries ONLY.
   * Club courts survive — used by finishTournament.
   */
  clear(): void;

  /** Clear every runtime entry — tournament AND club. */
  clearAll(): void;
}
