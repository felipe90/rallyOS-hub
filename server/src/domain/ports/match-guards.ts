/**
 * match-guards — Type-safe helpers for court match status.
 *
 * Slice-5 bridge reversal (admin-court-inventory): the legacy Court union and
 * kind guards are removed. The FLOW slot is the source of truth for the match
 * lifecycle; `status`/`clubStatus` are the projection fields kept in sync by
 * CourtManager at every flow mutation (single writer).
 *
 * - `isMatchActive`: a court has an active match when its flow is LIVE
 *   (tournament) or OCCUPIED (club).
 * - `setMatchStatus('LIVE')`: writes the tournament flow (LIVE) — a club flow
 *   is never touched (the club lifecycle is managed by the club contract).
 * - `setMatchStatus('WAITING')`: clears a tournament flow (→ IDLE); a club
 *   flow is left alone (club reset manages it explicitly).
 */

import type { RuntimeCourt, TournamentStatus } from '../types';

/**
 * Check whether a court has an active (LIVE) match — flow-derived.
 */
export function isMatchActive(court: RuntimeCourt): boolean {
  return court.flow?.mode === 'tournament'
    ? court.flow.state === 'LIVE'
    : court.flow?.mode === 'club'
      ? court.flow.state === 'OCCUPIED'
      : false;
}

/**
 * Set the match status on a court (flow + projection, single writer).
 * Club flows are never overwritten here — their lifecycle is managed by the
 * club flow contract (occupy/end/forceEnd).
 */
export function setMatchStatus(court: RuntimeCourt, status: TournamentStatus): void {
  if (status === 'LIVE') {
    // Tournament match start — flow LIVE → BUSY. Club flow untouched.
    if (court.flow?.mode !== 'club') {
      court.flow = { mode: 'tournament', state: 'LIVE', startedAt: Date.now() };
      court.mode = 'tournament';
    }
    court.status = 'LIVE';
    return;
  }
  if (status === 'WAITING') {
    // Tournament reset/teardown — clear the flow → IDLE. Club flow untouched
    // (club reset clears it explicitly).
    if (court.flow?.mode === 'tournament') {
      court.flow = null;
    }
    court.status = 'WAITING';
    return;
  }
  // CONFIGURING / FINISHED — projection only; the flow stays as-is
  // (a FINISHED tournament match keeps the court BUSY until releaseAll).
  court.status = status;
}
