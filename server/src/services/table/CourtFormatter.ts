/**
 * CourtFormatter - Transform Table to CourtInfo
 *
 * Responsibility: Format tables for public/owner consumption.
 */

import { Court, ClubCourt, CourtInfo, CourtInfoWithPin, CourtStatus, TournamentStatus, ClubStatus, COURT_MODE, isClubCourt } from '../../domain/types';

export class CourtFormatter {
  toPublicInfo(table: Court): CourtInfo {
    // Courts without an active match (AVAILABLE club court) have null sportRules
    if (!table.sportRules) {
      const isClub = isClubCourt(table);
      return {
        id: table.id,
        number: table.number,
        name: table.name,
        status: isClub ? (table as ClubCourt).clubStatus : 'WAITING' as TournamentStatus | ClubStatus,
        playerCount: 0,
        playerNames: { a: 'Player A', b: 'Player B' },
        currentScore: { a: 0, b: 0 },
        currentSets: { a: 0, b: 0 },
        winner: null,
        featured: table.featured,
        mode: isClub ? COURT_MODE.CLUB : COURT_MODE.TOURNAMENT,
        ...(isClub ? { clubStatus: (table as ClubCourt).clubStatus } : {}),
      };
    }

    const state = table.sportRules.getState();
    const s = state as any;
    // Handle discriminated union: TT has score.currentSet/sets, padel has games/sets top-level
    const currentScore = s.score?.currentSet ?? s.games ?? { a: 0, b: 0 };
    const currentSets = s.score?.sets ?? s.sets ?? { a: 0, b: 0 };

    const base: CourtInfo = {
      id: table.id,
      number: table.number,
      name: table.name,
      status: state.status,
      playerCount: table.players.length,
      playerNames: s.playerNames ?? { a: 'Player A', b: 'Player B' },
      currentScore,
      currentSets,
      winner: state.winner,
      featured: table.featured,
      mode: COURT_MODE.TOURNAMENT,
    };

    // Club courts: expose clubStatus as the public status, pass through mode and clubStatus
    // status is TournamentStatus | ClubStatus — no cast needed
    if (isClubCourt(table)) {
      return {
        ...base,
        status: table.clubStatus ?? base.status,
        mode: COURT_MODE.CLUB,
        clubStatus: table.clubStatus,
      };
    }

    return base;
  }

  toInfoWithPin(table: Court): CourtInfoWithPin {
    const publicInfo = this.toPublicInfo(table);
    return {
      ...publicInfo,
      pin: table.pin
    };
  }

  toPublicList(tables: Court[]): CourtInfo[] {
    return tables.map(t => this.toPublicInfo(t));
  }

  toListWithPins(tables: Court[]): CourtInfoWithPin[] {
    return tables.map(t => this.toInfoWithPin(t));
  }
}
/** @deprecated Use CourtFormatter instead */
export type TableFormatter = CourtFormatter;
/** @deprecated Use CourtFormatter instead */
export const TableFormatter = CourtFormatter;
