/**
 * MatchOrchestrator - Match lifecycle management
 *
 * Responsibility: Configure, start, score, and reset matches.
 */

import { Table, MatchEvent } from '../../domain/types';
import { MatchEngine, Player, MatchConfig, MatchStateExtended } from '../../domain/matchEngine';
import { logger } from '../../utils/logger';

export class MatchOrchestrator {
  configureMatch(table: Table, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    if (config.playerNames) {
      table.playerNames = config.playerNames;
      table.matchEngine.setPlayerNames(config.playerNames);
    }

    if (config.matchConfig) {
      const tblId = table.id;
      const tblName = table.name;

      table.matchEngine = new MatchEngine(config.matchConfig);
      table.matchEngine.setTableId(tblId, tblName);
      table.matchEngine.setPlayerNames(table.playerNames);
      table.matchEngine.setEventCallback((event: MatchEvent) => {
        if (table.onMatchEvent) {
          table.onMatchEvent(event);
        }
      });
    }

    table.status = 'CONFIGURING';
  }

  startMatch(table: Table, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null {
    logger.info({ tableId: table.id, config }, 'startMatch called');

    const playerNames = {
      a: config?.playerNameA || table.playerNames.a || 'Player A',
      b: config?.playerNameB || table.playerNames.b || 'Player B',
    };

    if (config) {
      logger.debug({ tableId: table.id }, 'Creating new MatchEngine with config');
      const tblId = table.id;
      const tblName = table.name;

      table.matchEngine = new MatchEngine({
        pointsPerSet: config.pointsPerSet || 11,
        bestOf: config.bestOf || 3,
        minDifference: 2,
        handicapA: config.handicapA || 0,
        handicapB: config.handicapB || 0,
      });

      table.matchEngine.setTableId(tblId, tblName);
      table.matchEngine.setPlayerNames(playerNames);
      table.matchEngine.setEventCallback((event: MatchEvent) => {
        if (table.onMatchEvent) {
          table.onMatchEvent(event);
        }
      });
    }

    if (config?.playerNameA || config?.playerNameB) {
      table.playerNames = playerNames;
    }

    table.status = 'LIVE';
    const state = table.matchEngine.startMatch();
    logger.debug({ tableId: table.id, status: state?.status }, 'After startMatch, state status');

    return state;
  }

  recordPoint(table: Table, player: Player): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    const state = table.matchEngine.recordPoint(player);
    if (state) {
      table.status = state.status;
    }
    return state;
  }

  subtractPoint(table: Table, player: Player): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.matchEngine.subtractPoint(player);
  }

  undoLast(table: Table): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.matchEngine.undoLast();
  }

  setServer(table: Table, player: Player): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.matchEngine.setServer(player);
  }

  swapSides(table: Table): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.matchEngine.swapSides();
  }

  resetTable(table: Table, config?: MatchConfig): void {
    table.matchEngine = new MatchEngine(config);
    table.matchEngine.setTableId(table.id, table.name);
    table.matchEngine.setEventCallback((event: MatchEvent) => {
      if (table.onMatchEvent) {
        table.onMatchEvent(event);
      }
    });

    table.status = 'WAITING';
  }

  getMatchState(table: Table): MatchStateExtended | null {
    return table.matchEngine.getState();
  }
}
