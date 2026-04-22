/**
 * TableFormatter - Transform Table to TableInfo
 *
 * Responsibility: Format tables for public/owner consumption.
 */

import { Table, TableInfo, TableInfoWithPin } from '../../types';

export class TableFormatter {
  toPublicInfo(table: Table): TableInfo {
    const state = table.matchEngine.getState();
    return {
      id: table.id,
      number: table.number,
      name: table.name,
      status: state.status,
      playerCount: table.players.length,
      playerNames: state.playerNames,
      currentScore: state.score.currentSet,
      currentSets: state.score.sets,
      winner: state.winner
    };
  }

  toInfoWithPin(table: Table): TableInfoWithPin {
    const publicInfo = this.toPublicInfo(table);
    return {
      ...publicInfo,
      pin: table.pin
    };
  }

  toPublicList(tables: Table[]): TableInfo[] {
    return tables.map(t => this.toPublicInfo(t));
  }

  toListWithPins(tables: Table[]): TableInfoWithPin[] {
    return tables.map(t => this.toInfoWithPin(t));
  }
}
