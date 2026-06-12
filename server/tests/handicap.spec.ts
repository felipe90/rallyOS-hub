/**
 * Handicap Integration Tests
 *
 * Verifies that CourtManager.getAllHistories() populates the handicap field
 * from the match configuration when handicap is set.
 */

import { CourtManager } from '../src/domain/courtManager';
import type { Court } from '../src/domain/types';

describe('getAllHistories — handicap', () => {
  let manager: CourtManager;

  beforeEach(() => {
    manager = new CourtManager({ ssid: 'TestHub', ip: '127.0.0.1', port: 3000, domain: 'localhost', wifiPassword: 'test123' });
  });

  it('includes handicap in payload when config has handicapA and handicapB', () => {
    const court = manager.createCourt('Mesa Test') as Court;

    // Set config with handicap via sportRules.getConfig() → mutate state
    const sportRules = court.sportRules;
    (sportRules as any).state.config.handicapA = 2;
    (sportRules as any).state.config.handicapB = 0;

    const histories = manager.getAllHistories();
    expect(histories).toHaveLength(1);
    expect(histories[0].handicap).toEqual({ a: 2, b: 0 });
  });

  it('does NOT include handicap when config has no handicap fields', () => {
    const court = manager.createCourt('Mesa Sin Handicap') as Court;

    const histories = manager.getAllHistories();
    expect(histories).toHaveLength(1);
    expect(histories[0].handicap).toBeUndefined();
  });

  it('handles partial handicap (handicapA without handicapB)', () => {
    const court = manager.createCourt('Mesa Partial') as Court;

    const sportRules = court.sportRules;
    (sportRules as any).state.config.handicapA = 3;

    const histories = manager.getAllHistories();
    expect(histories).toHaveLength(1);
    expect(histories[0].handicap).toEqual({ a: 3 });
  });
});
