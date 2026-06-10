/**
 * TableFormatter Tests
 *
 * Verifies the TableFormatter properly maps Court → CourtInfo,
 * including the featured field.
 */

import { TableFormatter } from './TableFormatter';
import { Court } from '../../domain/types';

function createMockCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
    number: 1,
    name: 'Cancha 1',
    status: 'LIVE',
    pin: '1234',
    sportRules: {
      getState: () => ({
        status: 'LIVE',
        config: { sport: 'tableTennis', pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        winner: null,
        swappedSides: false,
        midSetSwapped: false,
      }),
      getConfig: jest.fn(),
      setPlayerNames: jest.fn(),
      setEventCallback: jest.fn(),
      setTableId: jest.fn(),
      startMatch: jest.fn(),
      recordPoint: jest.fn(),
      undoLast: jest.fn(),
      setServer: jest.fn(),
      swapSides: jest.fn(),
      getStateWithHistory: jest.fn(),
      reset: jest.fn(),
    } as any,
    playerNames: { a: 'Player A', b: 'Player B' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
    ...overrides,
  };
}

describe('TableFormatter', () => {
  let formatter: TableFormatter;

  beforeEach(() => {
    formatter = new TableFormatter();
  });

  describe('toPublicInfo', () => {
    it('should include featured: true when court is featured', () => {
      const court = createMockCourt({ featured: true });
      const result = formatter.toPublicInfo(court);
      expect(result.featured).toBe(true);
    });

    it('should include featured: false when court is not featured', () => {
      const court = createMockCourt({ featured: false });
      const result = formatter.toPublicInfo(court);
      expect(result.featured).toBe(false);
    });

    it('should preserve all other fields when adding featured', () => {
      const court = createMockCourt({ featured: true });
      const result = formatter.toPublicInfo(court);
      expect(result.id).toBe('court-1');
      expect(result.number).toBe(1);
      expect(result.name).toBe('Cancha 1');
      expect(result.status).toBe('LIVE');
      expect(result.playerCount).toBe(0);
    });
  });

  describe('toInfoWithPin', () => {
    it('should include featured field when court is featured', () => {
      const court = createMockCourt({ featured: true });
      const result = formatter.toInfoWithPin(court);
      expect(result.featured).toBe(true);
      expect(result.pin).toBe('1234');
    });

    it('should include featured field when court is not featured', () => {
      const court = createMockCourt({ featured: false });
      const result = formatter.toInfoWithPin(court);
      expect(result.featured).toBe(false);
    });
  });

  describe('toPublicList', () => {
    it('should include featured field for all courts', () => {
      const court1 = createMockCourt({ id: 'court-1', featured: true });
      const court2 = createMockCourt({ id: 'court-2', featured: false });
      const result = formatter.toPublicList([court1, court2]);
      expect(result).toHaveLength(2);
      expect(result[0].featured).toBe(true);
      expect(result[1].featured).toBe(false);
    });
  });

  describe('toListWithPins', () => {
    it('should include featured field for all courts with pins', () => {
      const court1 = createMockCourt({ id: 'court-1', featured: true });
      const court2 = createMockCourt({ id: 'court-2', featured: false });
      const result = formatter.toListWithPins([court1, court2]);
      expect(result).toHaveLength(2);
      expect(result[0].featured).toBe(true);
      expect(result[1].featured).toBe(false);
    });
  });
});
