/**
 * FlowModeContract surface + availabilityOf pure function tests.
 *
 * availabilityOf(record, flow, binding) is the INV-4 derived availability:
 * a PURE function over (inventoryStatus, active flow, bracket binding) →
 * IDLE | BUSY. Availability is NEVER persisted — there is no availability
 * field on CourtRecord (E12). usable = ACTIVE && IDLE.
 */
import { availabilityOf } from './FlowModeContract';
import {
  INVENTORY_STATUS,
  AVAILABILITY,
  type CourtRecord,
  type BracketMatch,
} from '../../../../shared/types';
import type { FlowSlot } from '../types';

function record(inventoryStatus: CourtRecord['inventoryStatus']): CourtRecord {
  return { courtId: 'c1', number: 1, name: 'Mesa 1', inventoryStatus };
}

function binding(id = 'R1-M1'): BracketMatch {
  return {
    id,
    round: 1,
    position: 0,
    playerA: 'A',
    playerB: 'B',
    winner: null,
    status: 'READY',
    courtId: 'c1',
  };
}

function clubFlow(overrides: Partial<Extract<FlowSlot, { mode: 'club' }>> = {}): FlowSlot {
  return {
    mode: 'club',
    state: 'OCCUPIED',
    sessionMode: 'free',
    occupiedAt: Date.now(),
    playerName: null,
    phone: null,
    adminId: null,
    ...overrides,
  };
}

function tournamentFlow(): FlowSlot {
  return { mode: 'tournament', state: 'LIVE', startedAt: Date.now() };
}

describe('availabilityOf (INV-4 — pure derived, never stored)', () => {
  it('returns IDLE for an ACTIVE court with no flow and no binding', () => {
    expect(availabilityOf(record(INVENTORY_STATUS.ACTIVE), null, null)).toBe(AVAILABILITY.IDLE);
  });

  it('returns BUSY when a club flow occupies the court', () => {
    expect(availabilityOf(record(INVENTORY_STATUS.ACTIVE), clubFlow(), null)).toBe(AVAILABILITY.BUSY);
  });

  it('returns BUSY when a tournament flow is live on the court', () => {
    expect(availabilityOf(record(INVENTORY_STATUS.ACTIVE), tournamentFlow(), null)).toBe(AVAILABILITY.BUSY);
  });

  it('returns BUSY when a bracket match is bound to the court even with no active flow', () => {
    expect(availabilityOf(record(INVENTORY_STATUS.ACTIVE), null, binding())).toBe(AVAILABILITY.BUSY);
  });

  it('excludes MAINTENANCE courts from the usable pool — IDLE even with a binding', () => {
    expect(availabilityOf(record(INVENTORY_STATUS.MAINTENANCE), null, binding())).toBe(AVAILABILITY.IDLE);
  });

  it('excludes ARCHIVED courts — IDLE even with an active flow', () => {
    expect(availabilityOf(record(INVENTORY_STATUS.ARCHIVED), clubFlow(), null)).toBe(AVAILABILITY.IDLE);
  });

  it('derives from (record, flow, binding) only — the record carries no stored availability field', () => {
    const rec = record(INVENTORY_STATUS.ACTIVE) as CourtRecord & { availability?: unknown };
    // INV-4: no stored availability axis exists on the durable record.
    expect('availability' in rec).toBe(false);
    // And the function still derives the answer from the inputs alone.
    expect(availabilityOf(rec, null, null)).toBe(AVAILABILITY.IDLE);
    expect(availabilityOf(rec, clubFlow(), null)).toBe(AVAILABILITY.BUSY);
  });
});
