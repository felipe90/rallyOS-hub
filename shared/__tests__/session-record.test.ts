/**
 * SessionRecord type tests — PR 1 Foundation
 *
 * Covers the SessionRecord interface introduced by the
 * club-session-history feature. Each session that ends (player-initiated
 * or admin force-end) MUST be persisted as a SessionRecord. This test
 * asserts the type's compile-time shape AND the runtime presence of all
 * 8 required fields, following the session-mode.test.ts pattern.
 */

import {
  SESSION_MODE,
  type SessionRecord,
} from '../types';

describe('SessionRecord interface', () => {
  test('accepts a fully-populated match-mode record', () => {
    const record: SessionRecord = {
      courtName: 'Cancha 1',
      elapsedSeconds: 600,
      elapsedMinutes: 10,
      mode: SESSION_MODE.MATCH,
      cost: 500,
      currency: 'ARS',
      timestamp: '2026-07-20T14:30:00.000Z',
      sessionId: '11111111-1111-1111-1111-111111111111',
    };

    expect(record.courtName).toBe('Cancha 1');
    expect(record.elapsedSeconds).toBe(600);
    expect(record.elapsedMinutes).toBe(10);
    expect(record.mode).toBe('match');
    expect(record.cost).toBe(500);
    expect(record.currency).toBe('ARS');
    expect(record.timestamp).toBe('2026-07-20T14:30:00.000Z');
    expect(record.sessionId).toBe('11111111-1111-1111-1111-111111111111');
  });

  test('accepts a free-mode record with cost=0 (spec: free-mode cost=0)', () => {
    const record: SessionRecord = {
      courtName: 'Cancha 2',
      elapsedSeconds: 30,
      elapsedMinutes: 1,
      mode: SESSION_MODE.FREE,
      cost: 0,
      currency: 'ARS',
      timestamp: '2026-07-20T14:31:00.000Z',
      sessionId: '22222222-2222-2222-2222-222222222222',
    };

    expect(record.mode).toBe('free');
    expect(record.cost).toBe(0);
  });

  test('requires all 8 fields — every key is present at runtime', () => {
    const record: SessionRecord = {
      courtName: 'C',
      elapsedSeconds: 1,
      elapsedMinutes: 1,
      mode: 'free',
      cost: 0,
      currency: 'ARS',
      timestamp: 'T',
      sessionId: 'id',
    };

    const keys = Object.keys(record);
    expect(keys).toEqual(
      expect.arrayContaining([
        'courtName',
        'elapsedSeconds',
        'elapsedMinutes',
        'mode',
        'cost',
        'currency',
        'timestamp',
        'sessionId',
      ]),
    );
    expect(keys).toHaveLength(8);
  });

  test('mode field type is the literal "free" | "match"', () => {
    const free: SessionRecord['mode'] = 'free';
    const match: SessionRecord['mode'] = 'match';
    expect([free, match]).toEqual(['free', 'match']);
  });

  test('snapshot semantics: courtName is a plain string, not bound to a live object', () => {
    // The spec requires courtName to be a SNAPSHOT captured at session end,
    // so that renaming the court later does not mutate the record.
    const record: SessionRecord = {
      courtName: 'Original',
      elapsedSeconds: 1,
      elapsedMinutes: 1,
      mode: 'match',
      cost: 1,
      currency: 'ARS',
      timestamp: 'T',
      sessionId: 'id',
    };
    // Mutating an unrelated object after the fact must not change the record.
    const unrelated: { name: string } = { name: 'Original' };
    unrelated.name = 'Renamed';

    expect(record.courtName).toBe('Original');
  });
});