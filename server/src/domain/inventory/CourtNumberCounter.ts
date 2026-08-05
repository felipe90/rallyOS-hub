/**
 * CourtNumberCounter — monotonic court numbering (INV-3).
 *
 * Numbers are NEVER reused after archive/use: `next()` always returns
 * max(number)+1. This replaces the old `getNextTableNumber()` which returned
 * the LOWEST free number and therefore re-issued archived numbers, corrupting
 * session-history/cost attribution.
 */
export class CourtNumberCounter {
  private nextNumber: number;

  /**
   * @param courts  Existing courts to seed from (only `number` is read).
   *                Accepts CourtRecord[] (inventory) or any shape carrying a
   *                `number` (slice-1 bridge: runtime courts).
   */
  constructor(courts: ReadonlyArray<{ number: number }> = []) {
    this.nextNumber = Math.max(0, ...courts.map((c) => c.number)) + 1;
  }

  /** Reserve the next display number. Archived numbers are never re-issued. */
  next(): number {
    return this.nextNumber++;
  }
}
