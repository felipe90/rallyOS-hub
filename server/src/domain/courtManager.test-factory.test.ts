/**
 * CourtManager Test Factory Tests
 *
 * Verifies that createTestCourtManager produces a fully-wired,
 * functional CourtManager with sensible defaults, and that
 * overrides correctly replace individual dependencies.
 */

import { createTestCourtManager } from './courtManager.test-factory';
import { CourtManager } from './courtManager';
import { CourtRepository } from '../services/table/CourtRepository';

describe('createTestCourtManager', () => {
  it('should create a CourtManager without throwing', () => {
    const cm = createTestCourtManager();
    expect(cm).toBeInstanceOf(CourtManager);
  });

  it('should create a functional CourtManager that can create courts', () => {
    const cm = createTestCourtManager();
    const court = cm.createCourt('Test Court');
    expect(court.id).toBeDefined();
    expect(court.name).toBe('Test Court');
    expect(court.number).toBe(1);
  });

  it('should allow overriding the repository', () => {
    const mockRepository = new CourtRepository();
    const cm = createTestCourtManager({ repository: mockRepository });

    const court = cm.createCourt('Override Test');
    const retrieved = cm.getCourt(court.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Override Test');
  });

  it('should work without persistence (no stateStore)', () => {
    const cm = createTestCourtManager({ persistence: undefined });
    const court = cm.createCourt('No Persist');
    expect(court).toBeDefined();

    // Should not throw when calling methods that use stateStore
    expect(() => cm.regeneratePin(court.id)).not.toThrow();
  });

  it('should create multiple instances independently', () => {
    const cm1 = createTestCourtManager();
    const cm2 = createTestCourtManager();

    const court1 = cm1.createCourt('Instance 1');
    const court2 = cm2.createCourt('Instance 2');

    expect(cm1.getAllCourts()).toHaveLength(1);
    expect(cm2.getAllCourts()).toHaveLength(1);
    expect(cm1.getCourt(court1.id)).toBeDefined();
    expect(cm2.getCourt(court2.id)).toBeDefined();
  });

  it('should support club court operations', () => {
    const cm = createTestCourtManager();
    const court = cm.createClubCourt('Club Test');
    expect(court.clubStatus).toBe('AVAILABLE');

    const activated = cm.activateCourt(court.id);
    expect(activated).not.toBeNull();
  });
});
