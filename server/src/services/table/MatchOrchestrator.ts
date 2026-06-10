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
    court: Court,
    config: MatchConfig,
    playerNames?: { a: string; b: string },
  ): MatchEngine {
    const sport = (config as any).sport;
    const rules = this.resolveRules(sport);
    const engine = new MatchEngine(config, rules);
    engine.setTableId(court.id, court.name);
    if (playerNames) {
      engine.setPlayerNames(playerNames);
    }
    engine.setEventCallback((event: MatchEvent) => {
      if (court.onMatchEvent) {
        court.onMatchEvent(event);
      }
    });
    return engine;
  }
  configureMatch(court: Court, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    if (config.playerNames) {
      court.playerNames = config.playerNames;
      court.sportRules.setPlayerNames(config.playerNames);
    }

    if (config.matchConfig) {
      court.sportRules = this.createEngine(court, config.matchConfig, court.playerNames);
    }

    court.status = 'CONFIGURING';
  }

  startMatch(court: Court, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null {
    logger.info({ courtId: court.id, config }, 'startMatch called');

    const playerNames = {
      a: config?.playerNameA || court.playerNames.a || 'Player A',
      b: config?.playerNameB || court.playerNames.b || 'Player B',
    };

    if (config) {
      logger.debug({ courtId: court.id }, 'Creating new MatchEngine with config');

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

      court.sportRules = this.createEngine(court, engineConfig, playerNames);
    }

    if (config?.playerNameA || config?.playerNameB) {
      court.playerNames = playerNames;
    }

    court.status = 'LIVE';
    const state = court.sportRules.startMatch();
    logger.debug({ courtId: court.id, status: state?.status }, 'After startMatch, state status');

    return state;
  }

  recordPoint(court: Court, player: Player): MatchStateExtended | null {
    if (court.status !== 'LIVE') return null;

    const state = court.sportRules.recordPoint(player);
    if (state) {
      court.status = state.status;
    }
    return state;
  }

  subtractPoint(court: Court, player: Player): MatchStateExtended | null {
    if (court.status !== 'LIVE') return null;

    return court.sportRules.subtractPoint(player);
  }

  undoLast(court: Court): MatchStateExtended | null {
    if (court.status !== 'LIVE') return null;

    return court.sportRules.undoLast();
  }

  setServer(court: Court, player: Player): MatchStateExtended | null {
    if (court.status !== 'LIVE') return null;

    return court.sportRules.setServer(player);
  }

  swapSides(court: Court): MatchStateExtended | null {
    if (court.status !== 'LIVE') return null;

    return court.sportRules.swapSides();
  }

  resetTable(court: Court, config?: MatchConfig): void {
    const resolvedConfig = config || { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 } as MatchConfig;
    court.sportRules = this.createEngine(court, resolvedConfig, court.playerNames);
    court.status = 'WAITING';
  }

  getMatchState(court: Court): MatchStateExtended | null {
    return court.sportRules.getState();
  }
}
