import crypto from 'crypto';
import { CourtRecord, INVENTORY_STATUS, SPORT, Sport } from '../../../../shared/types';
import type { ICourtInventoryStore } from '../ports/ICourtInventoryStore';
import { CourtNumberCounter } from './CourtNumberCounter';

/**
 * InventoryManager — the ONLY authority over court EXISTENCE (D3).
 *
 * Existence is admin-owned and durable via the injected ICourtInventoryStore
 * (CourtInventoryStore → data/court-inventory.json). Every mutation is written
 * synchronously/immediately (PERS-3 — low frequency, no debounce).
 *
 * - `add` uses the monotonic CourtNumberCounter (INV-3 — numbers never reused
 *   after archive) and suggests a sport-aware default name (MP-2: "Mesa {n}"
 *   table tennis / "Cancha {n}" padel), which the admin may override.
 * - `archive` is the ONLY removal path: no hard delete (INV-3/E13) — the
 *   record stays in the catalog retired as ARCHIVED.
 * - `canArchive` guard: while a court is BUSY (live flow) or HELD (open
 *   booking, future) it cannot be archived or moved to maintenance (INV-5/R7).
 *   Slice-1 bridge: the guard is injected by the caller (defaults to allow);
 *   slice 2 wires the FlowModeRegistry canArchive so BUSY is derived from the
 *   active flow.
 */
export class InventoryManager {
  private readonly store: ICourtInventoryStore;
  private readonly counter: CourtNumberCounter;
  private readonly resolveCourtSport: () => Sport;
  private readonly canArchive: (court: CourtRecord) => boolean;

  constructor(
    store: ICourtInventoryStore,
    opts: {
      resolveCourtSport: () => Sport;
      /** Monotonic counter; defaults to one seeded from the loaded catalog. */
      counter?: CourtNumberCounter;
      /** Guard: false while the court is BUSY/HELD — blocks archive/maintenance (INV-5). */
      canArchive?: (court: CourtRecord) => boolean;
    },
  ) {
    this.store = store;
    this.resolveCourtSport = opts.resolveCourtSport;
    this.counter = opts.counter ?? new CourtNumberCounter(this.store.load() ?? []);
    this.canArchive = opts.canArchive ?? (() => true);
  }

  /** Full catalog (copy — callers must not mutate the stored records). */
  list(): CourtRecord[] {
    return [...(this.store.load() ?? [])];
  }

  /** Look up a catalog record by stable courtId. */
  get(courtId: string): CourtRecord | undefined {
    return this.list().find((c) => c.courtId === courtId);
  }

  /**
   * Add a court to the catalog. number = counter.next() (monotonic, no reuse,
   * INV-3); name = suggestedName ?? sport-aware default (MP-2). Sync write.
   */
  add(suggestedName?: string): CourtRecord {
    const number = this.counter.next();
    const court: CourtRecord = {
      courtId: crypto.randomUUID(),
      number,
      name: suggestedName ?? this.defaultCourtName(number),
      inventoryStatus: INVENTORY_STATUS.ACTIVE,
    };
    this.persist((courts) => [...courts, court]);
    return court;
  }

  /** Rename over the stable courtId (E7 — identity never changes). */
  rename(courtId: string, name: string): CourtRecord | null {
    const court = this.get(courtId);
    if (!court) return null;
    const updated = { ...court, name };
    this.persist((courts) => courts.map((c) => (c.courtId === courtId ? updated : c)));
    return updated;
  }

  /** Toggle ACTIVE ↔ MAINTENANCE. Requires !BUSY (canArchive guard). */
  setMaintenance(courtId: string, maintenance: boolean): CourtRecord | null {
    const court = this.get(courtId);
    if (!court || !this.canArchive(court)) return null;
    const updated = {
      ...court,
      inventoryStatus: maintenance ? INVENTORY_STATUS.MAINTENANCE : INVENTORY_STATUS.ACTIVE,
    };
    this.persist((courts) => courts.map((c) => (c.courtId === courtId ? updated : c)));
    return updated;
  }

  /**
   * Archive a court — archive-only, NO hard delete (INV-3/E13). Requires
   * canArchive (flow empty / not BUSY — INV-5): force-end the session first,
   * then archive. The record stays in the catalog as ARCHIVED.
   */
  archive(courtId: string): CourtRecord | null {
    const court = this.get(courtId);
    if (!court || !this.canArchive(court)) return null;
    const updated = { ...court, inventoryStatus: INVENTORY_STATUS.ARCHIVED };
    this.persist((courts) => courts.map((c) => (c.courtId === courtId ? updated : c)));
    return updated;
  }

  /** Strict cold-start gate (TCS-4): true when at least one ACTIVE court exists. */
  hasActive(): boolean {
    return this.list().some((c) => c.inventoryStatus === INVENTORY_STATUS.ACTIVE);
  }

  // ── Private ──────────────────────────────────────────────────────────

  /** MP-1/MP-2 — sport-aware default name: "Cancha {n}" padel, "Mesa {n}" TT. */
  private defaultCourtName(n: number): string {
    return this.resolveCourtSport() === SPORT.PADEL ? `Cancha ${n}` : `Mesa ${n}`;
  }

  /** Synchronous catalog write (PERS-3) — every mutation persists immediately. */
  private persist(transform: (courts: CourtRecord[]) => CourtRecord[]): void {
    this.store.save(transform(this.list()));
  }
}
