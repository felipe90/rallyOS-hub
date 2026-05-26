/**
 * MatchOrchestrator - Match lifecycle management
 *
 * Responsibility: Configure, start, score, and reset matches.
 */

import { Court, MatchEvent, SPORT } from '../../domain/types';
import { MatchEngine, Player, MatchConfig, MatchStateExtended } from '../../domain/matchEngine';
import { logger } from '../../utils/logger';

export class MatchOrchestrator {
  configureMatch(table: Court, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    if (config.playerNames) {
      table.playerNames = config.playerNames;
      table.sportRules.setPlayerNames(config.playerNames);
    }

    if (config.matchConfig) {
      const tblId = table.id;
      const tblName = table.name;

      table.sportRules = new MatchEngine(config.matchConfig);
      table.sportRules.setTableId(tblId, tblName);
      table.sportRules.setPlayerNames(table.playerNames);
      table.sportRules.setEventCallback((event: MatchEvent) => {
        if (table.onMatchEvent) {
          table.onMatchEvent(event);
        }
      });
    }

    table.status = 'CONFIGURING';
  }

  startMatch(table: Court, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null {
    logger.info({ tableId: table.id, config }, 'startMatch called');

    const playerNames = {
      a: config?.playerNameA || table.playerNames.a || 'Player A',
      b: config?.playerNameB || table.playerNames.b || 'Player B',
    };

    if (config) {
      logger.debug({ tableId: table.id }, 'Creating new MatchEngine with config');
      const tblId = table.id;
      const tblName = table.name;

      // Default to table tennis config for backward compat
      const engineConfig = config.sport === SPORT.TABLE_TENNIS || !config.sport
        ? {
            sport: SPORT.TABLE_TENNIS,
            pointsPerSet: (config as any).pointsPerSet || 11,
            bestOf: config.bestOf || 3,
            minDifference: (config as any).minDifference ?? 2,
            handicapA: (config as any).handicapA || 0,
            handicapB: (config as any).handicapB || 0,
          }
        : {
            sport: SPORT.PADEL,
            bestOf: config.bestOf || 3,
            tiebreakPoints: (config as any).tiebreakPoints ?? 7,
            gamesPerSet: (config as any).gamesPerSet ?? 6,
            goldenPoint: (config as any).goldenPoint ?? false,
          };

      table.sportRules = new MatchEngine(engineConfig);

      table.sportRules.setTableId(tblId, tblName);
      table.sportRules.setPlayerNames(playerNames);
      table.sportRules.setEventCallback((event: MatchEvent) => {
        if (table.onMatchEvent) {
          table.onMatchEvent(event);
        }
      });
    }

    if (config?.playerNameA || config?.playerNameB) {
      table.playerNames = playerNames;
    }

    table.status = 'LIVE';
    const state = table.sportRules.startMatch();
    logger.debug({ tableId: table.id, status: state?.status }, 'After startMatch, state status');

    return state;
  }

  recordPoint(table: Court, player: Player): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    const state = table.sportRules.recordPoint(player);
    if (state) {
      table.status = state.status;
    }
    return state;
  }

  subtractPoint(table: Court, player: Player): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.sportRules.subtractPoint(player);
  }

  undoLast(table: Court): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.sportRules.undoLast();
  }

  setServer(table: Court, player: Player): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.sportRules.setServer(player);
  }

  swapSides(table: Court): MatchStateExtended | null {
    if (table.status !== 'LIVE') return null;

    return table.sportRules.swapSides();
  }

  resetTable(table: Court, config?: MatchConfig): void {
    table.sportRules = new MatchEngine(config);
    table.sportRules.setTableId(table.id, table.name);
    table.sportRules.setEventCallback((event: MatchEvent) => {
      if (table.onMatchEvent) {
        table.onMatchEvent(event);
      }
    });

    table.status = 'WAITING';
  }

  getMatchState(table: Court): MatchStateExtended | null {
    return table.sportRules.getState();
  }
}
