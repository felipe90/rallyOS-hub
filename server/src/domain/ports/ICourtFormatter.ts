/**
 * ICourtFormatter — Court to DTO transformation interface.
 *
 * Domain-level contract for formatting Court objects into
 * public-facing DTOs (CourtInfo, CourtInfoWithPin). Implementations
 * handle the Court → ClubCourt discrimination and extract match
 * state information (scores, sets, winner, player names) from
 * the MatchEngine's current game state.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { Court } from '../types';
import type { CourtInfo, CourtInfoWithPin } from '../types';

export interface ICourtFormatter {
  /** Format a single court into public-facing info (no PIN) */
  toPublicInfo(court: Court): CourtInfo;

  /** Format a single court into info that includes the PIN */
  toInfoWithPin(court: Court): CourtInfoWithPin;

  /** Format multiple courts into a public list (no PINs) */
  toPublicList(courts: Court[]): CourtInfo[];

  /** Format multiple courts into a list that includes PINs */
  toListWithPins(courts: Court[]): CourtInfoWithPin[];
}
