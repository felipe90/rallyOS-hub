import { CourtRecord, INVENTORY_STATUS, SPORT } from '../../../../shared/types';
import { InventoryManager } from './InventoryManager';
import { CourtNumberCounter } from './CourtNumberCounter';
import type { ICourtInventoryStore } from '../ports/ICourtInventoryStore';
// ── Fake in-memory ICourtInventoryStore ────────────────────────────────

function makeFakeStore(initial: CourtRecord[] = []): ICourtInventoryStore & { courts: CourtRecord[] } {
  let courts: CourtRecord[] = [...initial];
  return {
    courts,
    save(c: CourtRecord[]): void {
      courts = [...c];
    },
    load(): CourtRecord[] | null {
      return [...courts];
    },
  };
}

function record(courtId: string, number: number, overrides: Partial<CourtRecord> = {}): CourtRecord {
  return {
    courtId,
    number,
    name: `Mesa ${number}`,
    inventoryStatus: INVENTORY_STATUS.ACTIVE,
    ...overrides,
  };
}

describe('InventoryManager', () => {
  describe('add (INV-2, INV-3, MP-2)', () => {
    it('assigns the next monotonic number and ACTIVE status, with the sport-aware default name', () => {
      const store = makeFakeStore();
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      const court = manager.add();

      expect(court.number).toBe(1);
      expect(court.inventoryStatus).toBe(INVENTORY_STATUS.ACTIVE);
      expect(court.name).toBe('Mesa 1'); // TT → "Mesa {n}" (MP-2)
      expect(court.courtId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('uses "Cancha {n}" default when the club sport is padel (MP-2)', () => {
      const store = makeFakeStore();
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.PADEL });

      const court = manager.add();

      expect(court.name).toBe('Cancha 1');
    });

    it('honors an admin-supplied suggested name (INVENTORY_ADD {name})', () => {
      const store = makeFakeStore();
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      const court = manager.add('Cancha VIP');

      expect(court.name).toBe('Cancha VIP');
    });

    it('writes synchronously — the catalog reflects the add immediately (PERS-3)', () => {
      const store = makeFakeStore();
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      manager.add();

      expect(store.load()).toHaveLength(1);
      expect(manager.list()).toHaveLength(1);
    });

    it('REUSES an archived number — archive is terminal, the number is freed (product decision)', () => {
      const store = makeFakeStore([record('c1', 1, { inventoryStatus: INVENTORY_STATUS.ARCHIVED }), record('c2', 2)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      const court = manager.add();

      expect(court.number).toBe(1); // lowest free — archived 1 is freed
      expect(court.name).toBe('Mesa 1');
    });

    it('re-seeds from the LIVE catalog — a runtime archive frees its number immediately', () => {
      const store = makeFakeStore([record('c1', 1), record('c2', 2)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      // Mesa 2 dies → its number 2 is freed for the next add.
      manager.archive('c2');
      const court = manager.add();

      expect(court.number).toBe(2);
      expect(court.name).toBe('Mesa 2');
    });

    it('seeds the counter from the loaded catalog when none is injected', () => {
      const store = makeFakeStore([record('c1', 1), record('c2', 2)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      expect(manager.add().number).toBe(3);
    });

    it('uses an injected counter when provided (compat — index.ts does not inject one)', () => {
      const store = makeFakeStore([record('c1', 1), record('c2', 2)]);
      const counter = new CourtNumberCounter([record('c1', 1), record('c2', 2), record('c3', 5)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS, counter });

      expect(manager.add().number).toBe(3); // lowest free among {1,2,5} — respects the injected counter
    });
  });

  describe('rename (E7 — stable identity, name is display only)', () => {
    it('updates the display name while keeping courtId and number stable', () => {
      const store = makeFakeStore([record('c1', 1, { name: 'Mesa 1' })]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      const renamed = manager.rename('c1', 'Mesa Principal');

      expect(renamed).not.toBeNull();
      expect(renamed!.courtId).toBe('c1');
      expect(renamed!.number).toBe(1);
      expect(renamed!.name).toBe('Mesa Principal');
      expect(manager.get('c1')!.name).toBe('Mesa Principal');
    });

    it('returns null for an unknown courtId', () => {
      const manager = new InventoryManager(makeFakeStore(), { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(manager.rename('nope', 'X')).toBeNull();
    });
  });

  describe('setMaintenance (INV-2 status axis)', () => {
    it('toggles ACTIVE ↔ MAINTENANCE', () => {
      const store = makeFakeStore([record('c1', 1)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      expect(manager.setMaintenance('c1', true)!.inventoryStatus).toBe(INVENTORY_STATUS.MAINTENANCE);
      expect(manager.setMaintenance('c1', false)!.inventoryStatus).toBe(INVENTORY_STATUS.ACTIVE);
    });

    it('is blocked while the court is BUSY (canArchive guard)', () => {
      const store = makeFakeStore([record('c1', 1)]);
      const manager = new InventoryManager(store, {
        resolveCourtSport: () => SPORT.TABLE_TENNIS,
        canArchive: (c) => c.courtId !== 'c1', // c1 is BUSY → cannot mutate
      });

      expect(manager.setMaintenance('c1', true)).toBeNull();
      expect(manager.get('c1')!.inventoryStatus).toBe(INVENTORY_STATUS.ACTIVE);
    });

    it('returns null for an unknown courtId', () => {
      const manager = new InventoryManager(makeFakeStore(), { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(manager.setMaintenance('nope', true)).toBeNull();
    });
  });

  describe('archive (INV-3, INV-5-lite — archive-only, no hard delete)', () => {
    it('archives the court — the record stays in the catalog (no hard delete)', () => {
      const store = makeFakeStore([record('c1', 1)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      const archived = manager.archive('c1');

      expect(archived!.inventoryStatus).toBe(INVENTORY_STATUS.ARCHIVED);
      // No DELETE — the record is still listed, just retired.
      expect(manager.list().map((c) => c.courtId)).toContain('c1');
      expect(store.load()!.map((c) => c.courtId)).toContain('c1');
    });

    it('is blocked while the court is BUSY (canArchive-only — force-end first, then archive)', () => {
      const store = makeFakeStore([record('c1', 1)]);
      const manager = new InventoryManager(store, {
        resolveCourtSport: () => SPORT.TABLE_TENNIS,
        canArchive: (c) => c.courtId !== 'c1', // BUSY court → archive refused
      });

      expect(manager.archive('c1')).toBeNull();
      expect(manager.get('c1')!.inventoryStatus).toBe(INVENTORY_STATUS.ACTIVE);
    });

    it('returns null for an unknown courtId', () => {
      const manager = new InventoryManager(makeFakeStore(), { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(manager.archive('nope')).toBeNull();
    });
  });

  describe('clearCatalog (CLUB_RESET_SETUP factory state)', () => {
    it('wipes the entire catalog so the first-run wizard starts clean', () => {
      const store = makeFakeStore([record('c1', 1), record('c2', 2)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });

      manager.clearCatalog();

      expect(manager.list()).toHaveLength(0);
      expect(store.load()).toHaveLength(0);
      // The next add starts at the lowest free number again (Mesa 1).
      expect(manager.add().number).toBe(1);
    });
  });

  describe('hasActive (TCS-4 strict cold-start gate)', () => {
    it('is true when at least one ACTIVE court exists', () => {
      const store = makeFakeStore([
        record('c1', 1, { inventoryStatus: INVENTORY_STATUS.ARCHIVED }),
        record('c2', 2),
      ]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(manager.hasActive()).toBe(true);
    });

    it('is false when no ACTIVE court exists (empty catalog → no tournament mode)', () => {
      const manager = new InventoryManager(makeFakeStore(), { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(manager.hasActive()).toBe(false);

      const onlyMaintenance = makeFakeStore([record('c1', 1, { inventoryStatus: INVENTORY_STATUS.MAINTENANCE })]);
      const m2 = new InventoryManager(onlyMaintenance, { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(m2.hasActive()).toBe(false);
    });
  });

  describe('list / get', () => {
    it('returns the full catalog from list()', () => {
      const store = makeFakeStore([record('c1', 1), record('c2', 2)]);
      const manager = new InventoryManager(store, { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(manager.list()).toHaveLength(2);
    });

    it('returns undefined from get() for an unknown courtId', () => {
      const manager = new InventoryManager(makeFakeStore(), { resolveCourtSport: () => SPORT.TABLE_TENNIS });
      expect(manager.get('nope')).toBeUndefined();
    });
  });
});
