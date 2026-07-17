/**
 * match-guards — Type-safe helpers for court match status.
 *
 * Replaces scattered `(court as any).status` patterns with proper
 * discriminated-union-aware accessors.
 *
 * For TournamentCourt: `status` is TournamentStatus ('LIVE', 'WAITING',
 * 'CONFIGURING', 'FINISHED').
 *
 * For ClubCourt: `clubStatus` maps to match lifecycle — 'OCCUPIED'
 * corresponds to 'LIVE' for match engine purposes. setMatchStatus is
 * a no-op for club courts because their lifecycle is managed via
 * clubStatus transitions, not TournamentStatus.
 */

import { isTournamentCourt, isClubCourt } from '../types';
import type { Court, TournamentCourt, ClubStatus, TournamentStatus } from '../types';

/**
 * Check whether a court has an active (LIVE) match.
 *
 * TournamentCourt: `status === 'LIVE'`
 * ClubCourt: `clubStatus === 'OCCUPIED'`
 *
 * This replaces the unsafe `(court as any).status === 'LIVE'` pattern
 * that silently reads wrong fields on ClubCourt.
 */
export function isMatchActive(court: Court): boolean {
  if (isTournamentCourt(court)) return court.status === 'LIVE';
  if (isClubCourt(court)) return court.clubStatus === 'OCCUPIED';
  return false;
}

/**
 * Set the match status on a court.
 *
 * TournamentCourt: writes `status` directly.
 * ClubCourt: no-op — match lifecycle is managed via clubStatus transitions,
 * not TournamentStatus. ClubCourt's 'OCCUPIED' already maps to 'LIVE'.
 */
export function setMatchStatus(court: Court, status: TournamentStatus): void {
  if (isTournamentCourt(court)) {
    (court as TournamentCourt).status = status;
  }
  // ClubCourt: no-op — lifecycle managed via clubStatus transitions
}
