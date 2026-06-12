/**
 * CourtFormatter - Transform Table to TableInfo
 *
 * Responsibility: Format tables for public/owner consumption.
 */

import { Court, TableInfo, TableInfoWithPin } from '../../domain/types';

export class CourtFormatter {
  toPublicInfo(table: Court): TableInfo {
    const state = table.sportRules.getState();
    const s = state as any;
    // Handle discriminated union: TT has score.currentSet/sets, padel has games/sets top-level
    const currentScore = s.score?.currentSet ?? s.games ?? { a: 0, b: 0 };
    const currentSets = s.score?.sets ?? s.sets ?? { a: 0, b: 0 };
    return {
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
