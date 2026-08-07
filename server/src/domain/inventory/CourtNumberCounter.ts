/**
 * CourtNumberCounter — lowest-free court numbering (product decision 2026-08:
 * archive is TERMINAL — the court dies, its display number/name is released).
 *
 * `next()` returns the LOWEST free number among NON-archived courts. An
 * archived court releases its number, so a new court can reuse it (e.g. after
 * archiving "Mesa 1", the next add is "Mesa 1" again). This reverts the
 * earlier INV-3 monotonic rule (never reuse) which assumed archived courts
 * could return — the product instead treats archive as permanent removal.
 *
 * Note: session-history records `courtName` only (no courtId), so sessions
 * from a dead court and its namesake successor share the display name in the
 * history view — accepted product trade-off.
 */
export class CourtNumberCounter {
  private used: Set<number>;

  /**
   * @param courts  Existing courts to seed from. Only `number` is read;
   *                ARCHIVED courts are EXCLUDED so their numbers are freed.
   *                Accepts CourtRecord[] (inventory) or any shape carrying
   *                `number` + optional `inventoryStatus`.
   */
  constructor(courts: ReadonlyArray<{ number: number; inventoryStatus?: string }> = []) {
    this.used = new Set(
      courts
        .filter((c) => c.inventoryStatus !== 'ARCHIVED')
        .map((c) => c.number),
    );
  }

  /** Reserve the lowest free display number. Archived numbers are re-issued. */
  next(): number {
    let n = 1;
    while (this.used.has(n)) n++;
    this.used.add(n);
    return n;
  }
}
