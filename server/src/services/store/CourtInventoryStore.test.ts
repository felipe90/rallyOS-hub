import { CourtRecord, INVENTORY_STATUS } from '../../../../shared/types';
import { CourtInventoryStore } from './CourtInventoryStore';
import { StateStore } from './StateStore';
import type { FileSystem } from '../../domain/ports/persistence-types';

function makeFs(): FileSystem & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    writeFileSync(p: string, data: string): void { files.set(p, data); },
    readFileSync(p: string): string {
      if (!files.has(p)) throw Object.assign(new Error(`ENOENT ${p}`), { code: 'ENOENT' });
      return files.get(p)!;
    },
    renameSync(oldP: string, newP: string): void {
      if (!files.has(oldP)) throw Object.assign(new Error(`ENOENT ${oldP}`), { code: 'ENOENT' });
      files.set(newP, files.get(oldP)!);
      files.delete(oldP);
    },
    existsSync(p: string): boolean { return files.has(p); },
    unlinkSync(p: string): void { files.delete(p); },
    mkdirSync(): string | undefined { return undefined; },
  };
}

function record(courtId: string, number: number): CourtRecord {
  return { courtId, number, name: `Mesa ${number}`, inventoryStatus: INVENTORY_STATUS.ACTIVE };
}

describe('CourtInventoryStore', () => {
  it('writes synchronously and immediately — each mutation is readable at once, no debounce (PERS-3)', () => {
    const fs = makeFs();
    const store = new CourtInventoryStore(fs, 'data/court-inventory.json');
    store.save([record('c1', 1)]);
    expect(store.load()).toEqual([record('c1', 1)]);
    store.save([record('c1', 1), record('c2', 2)]);
    expect(store.load()).toEqual([record('c1', 1), record('c2', 2)]);
  });

  it('commits via atomic tmp+rename — no .tmp left behind', () => {
    const fs = makeFs();
    const store = new CourtInventoryStore(fs, 'data/court-inventory.json');
    store.save([record('c1', 1)]);
    expect(fs.files.has('data/court-inventory.json.tmp')).toBe(false);
    expect(fs.files.has('data/court-inventory.json')).toBe(true);
  });

  it('returns null when the file is missing', () => {
    const store = new CourtInventoryStore(makeFs(), 'data/missing.json');
    expect(store.load()).toBeNull();
  });

  it('returns null for a wrong-version file', () => {
    const fs = makeFs();
    fs.files.set('data/court-inventory.json', JSON.stringify({ version: 3, courts: [] }));
    const store = new CourtInventoryStore(fs, 'data/court-inventory.json');
    expect(store.load()).toBeNull();
  });

  it('a point burst of session-state saves leaves court-inventory.json untouched (PERS-2)', () => {
    const fs = makeFs();
    const inventoryStore = new CourtInventoryStore(fs, 'data/court-inventory.json');
    const stateStore = new StateStore(fs, 'data/rallyos-state.json');

    // Admin mutation writes the catalog once.
    inventoryStore.save([record('c1', 1)]);
    const before = fs.files.get('data/court-inventory.json');
    expect(before).toBeDefined();

    // Point burst: many session-state saves (debounced session writes).
    const session = {
      courtId: 't1',
      flow: { mode: 'tournament' as const, state: 'LIVE' as const, startedAt: 1 },
      matchState: null as never,
    };
    stateStore.save({ version: 4, savedAt: 0, liveSessions: [session] });
    stateStore.save({ version: 4, savedAt: 0, liveSessions: [session] });

    // The catalog file is byte-identical — sessions never rewrite it.
    expect(fs.files.get('data/court-inventory.json')).toBe(before);
    expect(fs.files.has('data/rallyos-state.json')).toBe(true);
  });
});
