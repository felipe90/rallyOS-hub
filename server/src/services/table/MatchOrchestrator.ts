/**
 * MatchOrchestrator - Match lifecycle management
 *
 * Responsibility: Configure, start, score, and reset matches.
 * Phase 5: Accepts SportRegistry to resolve sport-specific rules
 * when creating MatchEngine instances. Defaults to TableTennisRules
 * when no sport is specified (backward-compatible).
 */

import { Court, MatchEvent, SPORT } from '../../domain/types';
import { MatchEngine, Player, MatchConfig, MatchStateExtended } from '../../domain/matchEngine';
import { logger } from '../../utils/logger';
import { SportRegistry } from '../../domain/sports/sport.registry';
import type { SportRules } from '../../domain/sports/types';

export class MatchOrchestrator {
  private registry: SportRegistry;

  constructor(registry?: SportRegistry) {
    this.registry = registry || new SportRegistry();
  }

  /**
   * Resolve the correct SportRules for the given sport.
   * Defaults to table tennis when sport is absent (backward-compatible).
   */
  private resolveRules(sport?: string): SportRules {
    if (sport && sport === SPORT.PADEL) {
      return this.registry.getRules(SPORT.PADEL);
    }
    return this.registry.getRules(SPORT.TABLE_TENNIS);
  }

  /**
   * Create a new MatchEngine and wire callbacks for a court.
   */
  private createEngine(
    table: Court,
    config: MatchConfig,
    playerNames?: { a: string; b: string },
  ): MatchEngine {
    const sport = (config as any).sport;
    const rules = this.resolveRules(sport);
    const engine = new MatchEngine(config, rules);
    engine.setTableId(table.id, table.name);
    if (playerNames) {
      engine.setPlayerNames(playerNames);
    }
    engine.setEventCallback((event: MatchEvent) => {
      if (table.onMatchEvent) {
        table.onMatchEvent(event);
      }
    });
    return engine;
  }
  configureMatch(table: Court, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    if (config.playerNames) {
      table.playerNames = config.playerNames;
      table.sportRules.setPlayerNames(config.playerNames);
    }

    if (config.matchConfig) {
      table.sportRules = this.createEngine(table, config.matchConfig, table.playerNames);
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

      // Resolve full config: default to table tennis for backward compat
      const sport = (config as any).sport;
      const engineConfig: MatchConfig = sport === SPORT.PADEL
        ? {
            sport: SPORT.PADEL,
            bestOf: config.bestOf || 3,
            tiebreakPoints: (config as any).tiebreakPoints ?? 7,
            gamesPerSet: (config as any).gamesPerSet ?? 6,
            goldenPoint: (config as any).goldenPoint ?? false,
          } as MatchConfig
        : {
            sport: SPORT.TABLE_TENNIS,
            pointsPerSet: (config as any).pointsPerSet || 11,
            bestOf: config.bestOf || 3,
            minDifference: (config as any).minDifference ?? 2,
            handicapA: (config as any).handicapA || 0,
            handicapB: (config as any).handicapB || 0,
          } as MatchConfig;

      table.sportRules = this.createEngine(table, engineConfig, playerNames);
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
    const resolvedConfig = config || { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 } as MatchConfig;
    table.sportRules = this.createEngine(table, resolvedConfig, table.playerNames);
    table.status = 'WAITING';
  }

  getMatchState(table: Court): MatchStateExtended | null {
    return table.sportRules.getState();
  }
}
