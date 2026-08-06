import { CourtRecord, INVENTORY_STATUS } from '../../../../shared/types';
import { CourtNumberCounter } from './CourtNumberCounter';

function record(number: number): CourtRecord {
  return { courtId: `court-${number}`, number, name: `Mesa ${number}`, inventoryStatus: INVENTORY_STATUS.ACTIVE };
}

describe('CourtNumberCounter', () => {
  it('starts at 1 when the catalog is empty', () => {
    const counter = new CourtNumberCounter([]);
    expect(counter.next()).toBe(1);
  });

  it('seeds from max(number)+1 with a contiguous catalog', () => {
    const counter = new CourtNumberCounter([record(1), record(2), record(3)]);
    expect(counter.next()).toBe(4);
  });

  it('never re-issues an archived number (monotonic, INV-3)', () => {
    // 3 is archived; the old lowest-free logic would return 3 again.
    const counter = new CourtNumberCounter([record(1), record(2), record(3)]);
    expect(counter.next()).toBe(4);
    expect(counter.next()).toBe(5);
    expect(counter.next()).toBe(6);
  });

  it('skips gaps and never returns a freed lower number', () => {
    // Only 5 exists; numbers 1-4 were used and archived.
    const counter = new CourtNumberCounter([record(5)]);
    expect(counter.next()).toBe(6);
    expect(counter.next()).toBe(7);
  });
});
