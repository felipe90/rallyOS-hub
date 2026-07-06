/**
 * CourtFormatter - Transform Table to TableInfo
 *
 * Responsibility: Format tables for public/owner consumption.
 */

import { Court, TableInfo, TableInfoWithPin, CourtStatus, COURT_MODE } from '../../domain/types';

export class CourtFormatter {
  toPublicInfo(table: Court): TableInfo {
    const state = table.sportRules.getState();
    const s = state as any;
    // Handle discriminated union: TT has score.currentSet/sets, padel has games/sets top-level
    const currentScore = s.score?.currentSet ?? s.games ?? { a: 0, b: 0 };
    const currentSets = s.score?.sets ?? s.sets ?? { a: 0, b: 0 };

    const base: TableInfo = {
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
    };

    // Club courts: expose clubStatus as the public status, pass through mode and clubStatus
    // Cast status to CourtStatus — the client-side UI for club mode reads clubStatus directly
    if (table.mode === COURT_MODE.CLUB) {
      return {
        ...base,
        status: (table.clubStatus ?? base.status) as CourtStatus,
        mode: table.mode,
        clubStatus: table.clubStatus,
      };
    }

    return base;
  }

  toInfoWithPin(table: Court): TableInfoWithPin {
    const publicInfo = this.toPublicInfo(table);
    return {
      ...publicInfo,
      pin: table.pin
    };
  }

  toPublicList(tables: Court[]): TableInfo[] {
    return tables.map(t => this.toPublicInfo(t));
  }

  toListWithPins(tables: Court[]): TableInfoWithPin[] {
    return tables.map(t => this.toInfoWithPin(t));
  }
}
/** @deprecated Use CourtFormatter instead */
export type TableFormatter = CourtFormatter;
/** @deprecated Use CourtFormatter instead */
export const TableFormatter = CourtFormatter;
