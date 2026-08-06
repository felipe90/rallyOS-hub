/**
 * RuntimeCourt domain type tests — slice-5 bridge reversal
 *
 * Verifies the RuntimeCourt sessionMode projection field (the club flow's
 * session-mode view kept in sync by the flow contracts — single writer).
 */
import type {
  RuntimeCourt,
} from './types';
import { SESSION_MODE, INVENTORY_STATUS } from '../../../shared/types';
import { MatchEngine } from './matchEngine';

describe('RuntimeCourt.sessionMode', () => {
  test('RuntimeCourt accepts sessionMode = "free"', () => {
    const court = makeRuntimeCourt({ sessionMode: SESSION_MODE.FREE });
    expect(court.sessionMode).toBe('free');
  });

  test('RuntimeCourt accepts sessionMode = "match"', () => {
    const court = makeRuntimeCourt({ sessionMode: SESSION_MODE.MATCH });
    expect(court.sessionMode).toBe('match');
  });

  test('RuntimeCourt accepts sessionMode = null (unoccupied state)', () => {
    const court = makeRuntimeCourt({ sessionMode: null });
    expect(court.sessionMode).toBeNull();
  });

  test('sessionMode is mutable — a court can transition free -> match', () => {
    const court = makeRuntimeCourt({ sessionMode: SESSION_MODE.FREE });
    expect(court.sessionMode).toBe('free');

    court.sessionMode = SESSION_MODE.MATCH;
    expect(court.sessionMode).toBe('match');
  });

  test('runtime court identity mirrors the catalog record (one entity, E11)', () => {
    const court = makeRuntimeCourt();
    expect(court.id).toBe(court.record.courtId);
    expect(court.number).toBe(court.record.number);
    expect(court.name).toBe(court.record.name);
  });
});

// ── Helpers ────────────────────────────────────────────────────────────

function makeRuntimeCourt(overrides: Partial<RuntimeCourt> = {}): RuntimeCourt {
  const engine = new MatchEngine();
  engine.setCourtId('c-1', 'Mesa 1');
  return {
    record: { courtId: 'c-1', number: 1, name: 'Mesa 1', inventoryStatus: INVENTORY_STATUS.ACTIVE },
    flow: null,
    reserved: false,
    mode: 'club',
    id: 'c-1',
    number: 1,
    name: 'Mesa 1',
    clubStatus: 'OCCUPIED',
    status: 'WAITING',
    pin: '1234',
    sportRules: engine,
    playerNames: { a: 'Alice', b: 'Bob' },
    history: [],
    players: [],
    createdAt: 0,
    featured: false,
    occupiedAt: 1000,
    sessionMode: null,
    playerName: null,
    phone: null,
    adminId: null,
    ...overrides,
  };
}
