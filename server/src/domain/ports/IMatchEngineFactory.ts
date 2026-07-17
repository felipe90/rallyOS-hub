/**
 * IMatchEngineFactory — Creates MatchEngine instances by sport.
 *
 * Decouples MatchOrchestrator from direct MatchEngine construction,
 * enabling testability and sport-specific resolution strategies.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { MatchConfig, Sport } from '../../../../shared/types';
import { SPORT } from '../../../../shared/types';
import { MatchEngine } from '../matchEngine';
import { SportRegistry } from '../sports/sport.registry';

export interface IMatchEngineFactory {
  /**
   * Create a MatchEngine for the given sport and configuration.
   * The factory resolves sport-specific SportRules internally.
   */
  createMatchEngine(sport: string, config: MatchConfig): MatchEngine;
}

/**
 * Default implementation of IMatchEngineFactory.
 * Resolves sport-specific SportRules from the SportRegistry and
 * delegates to `new MatchEngine(config, rules)`.
 */
export class DefaultMatchEngineFactory implements IMatchEngineFactory {
  private registry: SportRegistry;

  constructor(registry?: SportRegistry) {
    this.registry = registry || new SportRegistry();
  }

  createMatchEngine(sport: string, config: MatchConfig): MatchEngine {
    const rules = this.registry.getRules((sport as Sport) || SPORT.TABLE_TENNIS);
    const engine = new MatchEngine(config, rules);
    return engine;
  }
}
