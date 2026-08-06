/**
 * CourtRepository - Runtime court store (single map)
 *
 * Task 1.6 (SDD admin-court-inventory): the two parallel maps
 * (tournamentCourts/clubCourts) are merged into ONE map — one physical court
 * is one entity regardless of which flow runs on it (E11/D1). Kind is no
 * longer a storage discriminator: create/get/getAll/delete are unified, and
 * numbering moved out to CourtNumberCounter (INV-3, replaces getNextTableNumber).
 *
 * clear() = tournament-flow release (design 1.6): removes tournament-mode
 * runtime entries only — club courts survive (finishTournament contract).
 * Slice-5 bridge reversal: the repository stores `RuntimeCourt` (the single
 * runtime court type — the legacy Court union is removed).
 */

import type { RuntimeCourt } from '../../domain/types';
import type { ICourtRepository } from '../../domain/ports';

export class CourtRepository implements ICourtRepository {
  private courts: Map<string, RuntimeCourt> = new Map();

  /** Store a court (unified — no kind dispatch). Returns the stored court. */
  create(court: RuntimeCourt): RuntimeCourt {
    this.courts.set(court.id, court);
    return court;
  }

  /** Look up a court by ID. */
  get(id: string): RuntimeCourt | undefined {
    return this.courts.get(id);
  }

  /** All runtime courts (tournament + club, one catalog). */
  getAll(): RuntimeCourt[] {
    return Array.from(this.courts.values());
  }

  /** Delete a court by ID. Returns true if a court was actually removed. */
  delete(id: string): boolean {
    return this.courts.delete(id);
  }

  /**
   * Tournament-flow release (design 1.6): removes tournament-mode runtime
   * entries ONLY — club courts survive (finishTournament bug fix preserved).
   * Slice-1 bridge: the kind filter lives here until slice-2 releaseAll()
   * releases tournament flows against the inventory model.
   */
  clear(): void {
    for (const [id, court] of this.courts) {
      if (court.mode === 'tournament') {
        this.courts.delete(id);
      }
    }
  }

  /** Clear everything — tournament AND club runtime entries. */
  clearAll(): void {
    this.courts.clear();
  }
}
/** @deprecated Use CourtRepository instead */
export type TableRepository = CourtRepository;
/** @deprecated Use CourtRepository instead */
export const TableRepository = CourtRepository;
