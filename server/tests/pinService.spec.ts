/**
 * PinService Tests
 */

import { PinService } from '../src/services/security/PinService';
import { Table } from '../src/domain/types';
import { MatchEngine } from '../src/domain/matchEngine';

function createMockTable(pin: string): Table {
  return {
    id: 'test-table',
    number: 1,
    name: 'Test Table',
    status: 'WAITING',
    pin,
    sportRules: new MatchEngine(),
    playerNames: { a: 'Player A', b: 'Player B' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
  };
}

describe('PinService', () => {
  const pinService = new PinService();

  describe('validatePin', () => {
    test('returns true for matching PIN', () => {
      const table = createMockTable('1234');
      expect(pinService.validatePin(table, '1234')).toBe(true);
    });

    test('returns false for wrong PIN', () => {
      const table = createMockTable('1234');
      expect(pinService.validatePin(table, '5678')).toBe(false);
    });

    test('returns false for different length PIN', () => {
      const table = createMockTable('1234');
      expect(pinService.validatePin(table, '12345')).toBe(false);
    });
  });
});
