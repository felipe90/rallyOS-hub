/**
 * CourtFormatter - Transform RuntimeCourt to CourtInfo
 *
 * Responsibility: Format courts for public/owner consumption.
 *
 * Slice-5 bridge reversal: operates on the single `RuntimeCourt` type (the
 * legacy Court union is removed). The mode/status come from the runtime flow
 * (kind derived from flow — D1/E11); the legacy projection fields (status /
 * clubStatus) kept in sync by CourtManager are used as the wire status.
 */

import { RuntimeCourt, CourtInfo, CourtInfoWithPin, COURT_MODE, isClubFlowCourt } from '../../domain/types';
import type { ICourtFormatter } from '../../domain/ports';

export class CourtFormatter implements ICourtFormatter {
  toPublicInfo(table: RuntimeCourt): CourtInfo {
    // Courts without an active match (AVAILABLE club court) have null sportRules
    if (!table.sportRules) {
      const isClub = isClubFlowCourt(table);
      return {
        id: table.record.courtId,
        number: table.record.number,
        name: table.record.name,
        status: isClub ? table.clubStatus : 'WAITING' as CourtInfo['status'],
        playerCount: 0,
        playerNames: { a: 'Player A', b: 'Player B' },
        currentScore: { a: 0, b: 0 },
        currentSets: { a: 0, b: 0 },
        winner: null,
        featured: table.featured,
        mode: isClub ? COURT_MODE.CLUB : COURT_MODE.TOURNAMENT,
        ...(isClub ? { clubStatus: table.clubStatus } : {}),
      };
    }

    const state = table.sportRules.getState();
    const s = state as any;
    // Handle discriminated union: TT has score.currentSet/sets, padel has games/sets top-level
    const currentScore = s.score?.currentSet ?? s.games ?? { a: 0, b: 0 };
    const currentSets = s.score?.sets ?? s.sets ?? { a: 0, b: 0 };

    const isClub = isClubFlowCourt(table);
    const base: CourtInfo = {
      id: table.record.courtId,
      number: table.record.number,
      name: table.record.name,
      status: state.status,
      playerCount: table.players.length,
      playerNames: s.playerNames ?? { a: 'Player A', b: 'Player B' },
      currentScore,
      currentSets,
      winner: state.winner,
      featured: table.featured,
      mode: isClub ? COURT_MODE.CLUB : COURT_MODE.TOURNAMENT,
    };

    // Club courts: expose clubStatus as the public status
    if (isClub) {
      return {
        ...base,
        status: table.clubStatus ?? base.status,
        mode: COURT_MODE.CLUB,
        clubStatus: table.clubStatus,
      };
    }

    return base;
  }

  toInfoWithPin(table: RuntimeCourt): CourtInfoWithPin {
    const publicInfo = this.toPublicInfo(table);
    return {
      ...publicInfo,
      pin: table.pin
    };
  }

  toPublicList(tables: RuntimeCourt[]): CourtInfo[] {
    return tables.map(t => this.toPublicInfo(t));
  }

  toListWithPins(tables: RuntimeCourt[]): CourtInfoWithPin[] {
    return tables.map(t => this.toInfoWithPin(t));
  }
}
/** @deprecated Use CourtFormatter instead */
export type TableFormatter = CourtFormatter;
/** @deprecated Use CourtFormatter instead */
export const TableFormatter = CourtFormatter;
