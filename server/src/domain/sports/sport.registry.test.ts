/**
 * SportRegistry unit tests.
 *
 * Tests the sport registry: creation, lookup by sport, registration
 * of custom factories, and error handling for unknown sports.
 */

import { SportRegistry } from './sport.registry';
import { TableTennisRules } from './tableTennis.rules';
import { SportRules, SPORT } from './types';
import { Sport, Player, GameState, ScoreResult, SportConfig, SportDisplayScore, PadelMatchConfig } from './types';

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
      type: SPORT.TABLE_TENNIS,
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
      const rules = registry.getRules(SPORT.TABLE_TENNIS);
      expect(rules).toBeInstanceOf(TableTennisRules);
      expect(rules.sport).toBe(SPORT.TABLE_TENNIS);
    });

    it('should throw for unknown sport that is not registered', () => {
      expect(() => registry.getRules('unknown' as Sport)).toThrow(/unknown sport/i);
    });

    it('should throw for unknown sport with specific error message', () => {
      expect(() => registry.getRules('unknown' as Sport)).toThrow('Unknown sport: unknown');
    });
  });

  describe('registerRules', () => {
    it('should allow registering a new sport', () => {
      const mockRules = createMockRules(SPORT.PADEL as Sport);
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules(SPORT.PADEL as Sport, factory);
      const result = registry.getRules(SPORT.PADEL as Sport);

      expect(result).toBe(mockRules);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should not create new instance on every call (factory called once)', () => {
      const mockRules = createMockRules(SPORT.PADEL as Sport);
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules(SPORT.PADEL as Sport, factory);
      registry.getRules(SPORT.PADEL as Sport);
      registry.getRules(SPORT.PADEL as Sport);

      // Factory should only be called once — subsequent calls return cached instance
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should allow overriding an existing sport registration', () => {
      const mockRules = createMockRules(SPORT.TABLE_TENNIS as Sport);
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules(SPORT.TABLE_TENNIS, factory);
      const result = registry.getRules(SPORT.TABLE_TENNIS);

      expect(result).toBe(mockRules);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should cache the instance from the factory (singleton per sport)', () => {
      const mockRules = createMockRules(SPORT.TABLE_TENNIS);
      const factory = jest.fn().mockReturnValue(mockRules);

      registry.registerRules(SPORT.TABLE_TENNIS, factory);
      const first = registry.getRules(SPORT.TABLE_TENNIS);
      const second = registry.getRules(SPORT.TABLE_TENNIS);

      expect(first).toBe(second);
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('default registrations', () => {
    it('should have tableTennis registered by default', () => {
      const rules = registry.getRules(SPORT.TABLE_TENNIS);
      expect(rules.sport).toBe(SPORT.TABLE_TENNIS);
    });

    it('should have padel registered by default', () => {
      const rules = registry.getRules(SPORT.PADEL);
      expect(rules.sport).toBe(SPORT.PADEL);
    });

    it('should return a fresh default config via getDefaultConfig', () => {
      const rules = registry.getRules(SPORT.TABLE_TENNIS);
      const config = rules.getDefaultConfig();
      expect(config.sport).toBe(SPORT.TABLE_TENNIS);
      if (config.sport === SPORT.TABLE_TENNIS) {
        expect(config.pointsPerSet).toBe(11);
        expect(config.bestOf).toBe(3);
        expect(config.minDifference).toBe(2);
      }
    });

    it('should return padel default config via getDefaultConfig', () => {
      const rules = registry.getRules(SPORT.PADEL);
      const config = rules.getDefaultConfig() as PadelMatchConfig;
      expect(config.sport).toBe(SPORT.PADEL);
      expect(config.bestOf).toBe(3);
      expect(config.tiebreakPoints).toBe(7);
      expect(config.gamesPerSet).toBe(6);
      expect(config.goldenPoint).toBe(false);
    });
  });
});
