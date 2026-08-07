import { CourtRecord, INVENTORY_STATUS } from '../../../../shared/types';
import { CourtNumberCounter } from './CourtNumberCounter';

function record(number: number, over: Partial<CourtRecord> = {}): CourtRecord {
  return { courtId: `court-${number}`, number, name: `Mesa ${number}`, inventoryStatus: INVENTORY_STATUS.ACTIVE, ...over };
}

describe('CourtNumberCounter', () => {
  it('starts at 1 when the catalog is empty', () => {
    const counter = new CourtNumberCounter([]);
    expect(counter.next()).toBe(1);
  });

  it('returns the lowest free number with a contiguous ACTIVE catalog', () => {
    const counter = new CourtNumberCounter([record(1), record(2), record(3)]);
    expect(counter.next()).toBe(4);
  });

  it('REUSES an archived number — archive is terminal, the number is freed (product decision)', () => {
    // Mesa 1 archived, Mesa 2 still ACTIVE → the next add is Mesa 1 again.
    const counter = new CourtNumberCounter([
      record(1, { inventoryStatus: INVENTORY_STATUS.ARCHIVED }),
      record(2),
    ]);
    expect(counter.next()).toBe(1);
    expect(counter.next()).toBe(3);
  });

  it('fills the lowest gap among ACTIVE courts, ignoring archived numbers entirely', () => {
    // Mesa 2 archived; ACTIVE: 1, 4 → next add should be 2 (freed), then 3.
    const counter = new CourtNumberCounter([
      record(1),
      record(2, { inventoryStatus: INVENTORY_STATUS.ARCHIVED }),
      record(4),
    ]);
    expect(counter.next()).toBe(2);
    expect(counter.next()).toBe(3);
    expect(counter.next()).toBe(5);
  });

  it('treats MAINTENANCE as still in use (not freed)', () => {
    const counter = new CourtNumberCounter([record(1), record(2, { inventoryStatus: INVENTORY_STATUS.MAINTENANCE })]);
    expect(counter.next()).toBe(3);
  });
});
