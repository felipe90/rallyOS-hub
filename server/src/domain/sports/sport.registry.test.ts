/**
 * SportRegistry unit tests.
 *
 * Tests the sport registry: creation, lookup by sport, registration
 * of custom factories, and error handling for unknown sports.
 */

import { SportRegistry } from './sport.registry';
import { TableTennisRules } from './tableTennis.rules';
import type { SportRules } from './types';
import type { Sport, Player, GameState, ScoreResult, SportConfig, SportDisplayScore } from './types';

// ── Mock rules for registration testing ───────────────────────────────

function createMockRules(sportId: Sport): jest.Mocked<SportRules> {
  return {
    sport: sportId,
    validateConfig: jest.fn().mockReturnValue(true),
    recordScore: jest.fn().mockReturnValue({
      state: {} as unknown as GameState,
      events: [],
    } as ScoreResult),
    subtractScore: jest.fn().mockReturnValue({} as GameState),
    isSetComplete: jest.fn().mockReturnValue(false),
    isMatchComplete: jest.fn().mockReturnValue(false),
    updateServing: jest.fn().mockReturnValue('A' as Player),
    checkSideSwap: jest.fn().mockReturnValue(false),
    formatDisplayScore: jest.fn().mockReturnValue({
      type: 'tableTennis',
      leftScore: 0,
      rightScore: 0,
      leftSets: 0,
      rightSets: 0,
    } as SportDisplayScore),
    getDefaultConfig: jest.fn().mockReturnValue({} as SportConfig),
    needsHandicap: jest.fn().mockReturnValue(false),
  };
}

describe('SportRegistry', () => {
  let registry: SportRegistry;

  beforeEach(() => {
    registry = new SportRegistry();
  });

  describe('getRules', () => {
    it('should return TableTennisRules for tableTennis sport', () => {
      const rules = registry.getRules('tableTennis');
      expect(rules).toBeInstanceOf(TableTennisRules);
      expect(rules.sport).toBe('tableTennis');
    });

    it('should throw for unknown sport that is not registered', () => {
      // 'padel' is not registered yet
      expect(() => registry.getRules('padel')).toThrow(/unknown sport/i);
    });

    it('should throw for unknown sport with specific error message', () => {
      expect(() => registry.getRules('padel' as Sport)).toThrow('Unknown sport: padel');
    });
  });

  describe('registerRules', () => {
    it('should allow registering a new sport', () => {
      const mockRules = createMockRules('padel' as Sport);
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules('padel' as Sport, factory);
      const result = registry.getRules('padel' as Sport);

      expect(result).toBe(mockRules);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should not create new instance on every call (factory called once)', () => {
      const mockRules = createMockRules('padel' as Sport);
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules('padel' as Sport, factory);
      registry.getRules('padel' as Sport);
      registry.getRules('padel' as Sport);

      // Factory should only be called once — subsequent calls return cached instance
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should allow overriding an existing sport registration', () => {
      const mockRules = createMockRules('tableTennis' as Sport);
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules('tableTennis', factory);
      const result = registry.getRules('tableTennis');

      expect(result).toBe(mockRules);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should cache the instance from the factory (singleton per sport)', () => {
      const mockRules = createMockRules('tableTennis');
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules('tableTennis', factory);
      const first = registry.getRules('tableTennis');
      const second = registry.getRules('tableTennis');

      expect(first).toBe(second);
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('default registrations', () => {
    it('should have tableTennis registered by default', () => {
      const rules = registry.getRules('tableTennis');
      expect(rules.sport).toBe('tableTennis');
    });

    it('should return a fresh default config via getDefaultConfig', () => {
      const rules = registry.getRules('tableTennis');
      const config = rules.getDefaultConfig();
      expect(config.sport).toBe('tableTennis');
      if (config.sport === 'tableTennis') {
        expect(config.pointsPerSet).toBe(11);
        expect(config.bestOf).toBe(3);
        expect(config.minDifference).toBe(2);
      }
    });
  });
});
