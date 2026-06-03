/**
 * SportRegistry — Maps sport identifiers to SportRules implementations.
 *
 * Uses the Registry pattern: sports register a factory function that
 * creates their SportRules instance. The registry caches the instance
 * (singleton per sport) so factory functions are called only once.
 *
 * Default registrations:
 * - SPORT.TABLE_TENNIS → TableTennisRules (always available)
 *
 * Usage:
 *   const registry = new SportRegistry();
 *   const rules = registry.getRules(SPORT.TABLE_TENNIS);
 *   registry.registerRules(SPORT.PADEL, () => new PadelRules());
 *
 * Phase 3: Basic registry with TT default.
 * Phase 4: Register PadelRules.
 * Phase 5: MatchOrchestrator uses registry to resolve rules.
 */

import { TableTennisRules } from './tableTennis.rules';
import { PadelRules } from './padel.rules';
import type { SportRules } from './types';
import { Sport, SPORT } from '../../../../shared/types';

export class SportRegistry {
  /** Internal map: sport → cached SportRules instance */
  private instances = new Map<Sport, SportRules>();
  /** Factory functions: sport → () => SportRules */
  private factories = new Map<Sport, () => SportRules>();

  constructor() {
    // Register table tennis by default
    this.registerRules(SPORT.TABLE_TENNIS, () => new TableTennisRules());
    // Register padel
    this.registerRules(SPORT.PADEL, () => new PadelRules());
  }

  /**
   * Get the SportRules implementation for a given sport.
   * Lazily instantiates via the factory on first call, then caches.
   * Throws if the sport is not registered.
   */
  getRules(sport: Sport): SportRules {
    const cached = this.instances.get(sport);
    if (cached) return cached;

    const factory = this.factories.get(sport);
    if (!factory) {
      throw new Error(`Unknown sport: ${sport}`);
    }

    const instance = factory();
    this.instances.set(sport, instance);
    return instance;
  }

  /**
   * Register (or override) a sport with its factory function.
   * Clears any cached instance so the new factory is used next time.
   */
  registerRules(sport: Sport, factory: () => SportRules): void {
    this.factories.set(sport, factory);
    // Clear cached instance so next getRules() calls the new factory
    this.instances.delete(sport);
  }
}
