/**
 * MatchOrchestrator - Match lifecycle management
 *
 * Responsibility: Configure, start, score, and reset matches.
 *
 * Phase 2: Receives IMatchEngineFactory to decouple from direct
 * MatchEngine construction. Replaces `(court as any).status` patterns
 * with type-safe isMatchActive / setMatchStatus helpers.
 *
 * Backward-compatible constructor: accepts either IMatchEngineFactory
 * (new) or SportRegistry (old) as the first argument.
 */

import { Court, MatchEvent, Player, SPORT } from '../../domain/types';
import { MatchEngine, MatchConfig, MatchStateExtended } from '../../domain/matchEngine';
import { logger } from '../../utils/logger';
import { SportRegistry } from '../../domain/sports/sport.registry';
import { DefaultMatchEngineFactory } from '../../domain/ports';
import type { IMatchEngineFactory, IMatchOrchestrator } from '../../domain/ports';
import { isMatchActive, setMatchStatus } from '../../domain/ports/match-guards';

export class MatchOrchestrator implements IMatchOrchestrator {
  private engineFactory: IMatchEngineFactory;
  private registry: SportRegistry;

  /**
   * @param engineFactoryOrRegistry IMatchEngineFactory (new) or SportRegistry (old, backward-compat)
   * @param registry SportRegistry — only used when first arg is IMatchEngineFactory
   */
  constructor(
    engineFactoryOrRegistry?: IMatchEngineFactory | SportRegistry,
    registry?: SportRegistry,
  ) {
    if (engineFactoryOrRegistry && 'createMatchEngine' in engineFactoryOrRegistry) {
      // New-style: first arg is IMatchEngineFactory
      this.engineFactory = engineFactoryOrRegistry;
      this.registry = registry || new SportRegistry();
    } else {
      // Old-style: first arg was SportRegistry (or undefined)
      this.registry = (engineFactoryOrRegistry as SportRegistry) || new SportRegistry();
      this.engineFactory = new DefaultMatchEngineFactory(this.registry);
    }
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
    const engine = this.engineFactory.createMatchEngine(sport || SPORT.TABLE_TENNIS, config);
    engine.setCourtId(court.id, court.name);
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

    setMatchStatus(court, 'CONFIGURING');
  }

  prepareCourt(
    court: Court,
    config: { matchConfig: MatchConfig; playerNames: { a: string; b: string } },
  ): MatchStateExtended | null {
    const engineConfig = { ...config.matchConfig };
    court.sportRules = this.createEngine(court, engineConfig, config.playerNames);
    court.playerNames = { ...config.playerNames };
    // Do NOT call startMatch — engine stays in WAITING status so the client
    // can show the mode selector (ClubSessionConfig) before choosing free
    // or match mode. The match starts when the user picks a mode:
    //   - CLUB_START_FREE → sets sessionMode='free', no match engine change
    //   - CLUB_NEW_MATCH  → calls startMatch to set LIVE
    return court.sportRules.getState();
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

    setMatchStatus(court, 'LIVE');
    const state = court.sportRules.startMatch();
    logger.debug({ courtId: court.id, status: state?.status }, 'After startMatch, state status');

    return state;
  }

  recordPoint(court: Court, player: Player): MatchStateExtended | null {
    if (!isMatchActive(court)) return null;

    const state = court.sportRules.recordPoint(player);
    if (state) {
      setMatchStatus(court, state.status);
    }
    return state;
  }

  subtractPoint(court: Court, player: Player): MatchStateExtended | null {
    if (!isMatchActive(court)) return null;

    return court.sportRules.subtractPoint(player);
  }

  undoLast(court: Court): MatchStateExtended | null {
    if (!isMatchActive(court)) return null;

    return court.sportRules.undoLast();
  }

  setServer(court: Court, player: Player): MatchStateExtended | null {
    if (!isMatchActive(court)) return null;

    return court.sportRules.setServer(player);
  }

  swapSides(court: Court): MatchStateExtended | null {
    if (!isMatchActive(court)) return null;

    return court.sportRules.swapSides();
  }

  resetTable(court: Court, config?: MatchConfig): void {
    const resolvedConfig = config || { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 } as MatchConfig;
    court.sportRules = this.createEngine(court, resolvedConfig, court.playerNames);
    setMatchStatus(court, 'WAITING');
  }

  getMatchState(court: Court): MatchStateExtended | null {
    return court.sportRules.getState();
  }
}
