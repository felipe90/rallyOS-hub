/**
 * CourtRepository - Table CRUD operations
 *
 * Responsibility: Store and retrieve tables.
 * Two separate maps: tournamentCourts and clubCourts.
 * clear() only wipes tournament courts (fixes finishTournament bug).
 * clearAll() wipes both.
 */

import { Court, TournamentCourt, ClubCourt } from '../../domain/types';

export class CourtRepository {
  private tournamentCourts: Map<string, TournamentCourt> = new Map();
  private clubCourts: Map<string, ClubCourt> = new Map();

  // ── Unified create (dispatches by kind) ─────────────────────────────

  create(court: Court): Court {
    if (court.kind === 'tournament') {
      this.tournamentCourts.set(court.id, court);
    } else {
      this.clubCourts.set(court.id, court);
    }
    return court;
  }

  // ── Tournament methods ──────────────────────────────────────────────

  addTournament(court: TournamentCourt): TournamentCourt {
    this.tournamentCourts.set(court.id, court);
    return court;
  }

  getTournament(id: string): TournamentCourt | undefined {
    return this.tournamentCourts.get(id);
  }

  getAllTournament(): TournamentCourt[] {
    return Array.from(this.tournamentCourts.values());
  }

  removeTournament(id: string): boolean {
    return this.tournamentCourts.delete(id);
  }

  // ── Club methods ────────────────────────────────────────────────────

  addClub(court: ClubCourt): ClubCourt {
    this.clubCourts.set(court.id, court);
    return court;
  }

  getClub(id: string): ClubCourt | undefined {
    return this.clubCourts.get(id);
  }

  getAllClub(): ClubCourt[] {
    return Array.from(this.clubCourts.values());
  }

  removeClub(id: string): boolean {
    return this.clubCourts.delete(id);
  }

  // ── Unified ─────────────────────────────────────────────────────────

  /** Look up by ID across both maps — tournament first, then club */
  get(id: string): Court | undefined {
    return this.getTournament(id) ?? this.getClub(id);
  }

  /** All courts across both maps */
  getAll(): Court[] {
    return [...this.getAllTournament(), ...this.getAllClub()];
  }

  /** Delete from whichever map contains the ID */
  delete(id: string): boolean {
    return this.removeTournament(id) || this.removeClub(id);
  }

  getNextTableNumber(): number {
    const usedNumbers = new Set<number>();
    for (const court of this.tournamentCourts.values()) {
      usedNumbers.add(court.number);
    }
    for (const court of this.clubCourts.values()) {
      usedNumbers.add(court.number);
    }

    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }
    return nextNumber;
  }

  /**
   * Clear tournament courts ONLY (used by finishTournament).
   * Club courts survive — this is the critical bug fix.
   */
  clear(): void {
    this.tournamentCourts.clear();
  }

  /** Clear everything — tournament AND club courts */
  clearAll(): void {
    this.tournamentCourts.clear();
    this.clubCourts.clear();
  }
}
/** @deprecated Use CourtRepository instead */
export type TableRepository = CourtRepository;
/** @deprecated Use CourtRepository instead */
export const TableRepository = CourtRepository;
