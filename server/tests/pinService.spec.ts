/**
 * PinService Tests
 */

import { PinService } from '../src/services/security/PinService';
import type { RuntimeCourt } from '../src/domain/types';
import { MatchEngine } from '../src/domain/matchEngine';

function createMockTable(pin: string): RuntimeCourt {
  return {
    record: { courtId: 'test-table', number: 1, name: 'Test RuntimeCourt', inventoryStatus: 'ACTIVE' },
    flow: null,
    reserved: false,
    mode: 'tournament',
    id: 'test-table',
    number: 1,
    name: 'Test RuntimeCourt',
    status: 'WAITING',
    clubStatus: 'AVAILABLE',
    pin,
    sportRules: new MatchEngine(),
    playerNames: { a: 'Player A', b: 'Player B' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
    occupiedAt: null,
    sessionMode: null,
    playerName: null,
    phone: null,
    adminId: null,
  } as RuntimeCourt;
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
