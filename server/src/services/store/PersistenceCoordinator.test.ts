/**
 * PersistenceCoordinator — single-writer persistence coordinator (slice 6).
 *
 * Spec: persistence PERS-4 (fixes R2). ALL writes to `rallyos-state.json`
 * (court sessions + bracket) flow through ONE coordinator that re-serializes
 * the FULL document from an in-memory source of truth at flush time. No
 * second writer on the file, and neither writer ever reads the file —
 * the read-modify-write torn-write is structurally impossible.
 *
 * RED until `server/src/services/store/PersistenceCoordinator.ts` exists.
 */

import { StateStore } from './StateStore';
import { PersistenceCoordinator } from './PersistenceCoordinator';
import { FileSystem, PersistedFlowSession, PersistedStateV4 } from './types';
import { SPORT, TournamentBracket, BRACKET_STATUS, BRACKET_MATCH_STATUS } from '../../../../shared/types';

// ── Fake FileSystem (counts writes/renames so "ONE atomic write" is provable) ──

interface FsStats {
  writes: number;
  renames: number;
  reads: number;
}
function makeFs(): FileSystem & { _files: Map<string, string>; _stats: FsStats } {
  const files = new Map<string, string>();
  const stats: FsStats = { writes: 0, renames: 0, reads: 0 };
  const written = new Map<string, string>();

  return {
    _files: files,
    _stats: stats,

    writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
      stats.writes++;
      written.set(path, data);
    },

    readFileSync(path: string, _encoding: BufferEncoding): string {
      stats.reads++;
      if (!files.has(path)) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' });
      }
      return files.get(path)!;
    },

    renameSync(oldPath: string, newPath: string): void {
      stats.renames++;
      const content = written.has(oldPath) ? written.get(oldPath) : files.get(oldPath);
      if (content === undefined) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, rename '${oldPath}'`), { code: 'ENOENT' });
      }
      files.set(newPath, content);
      files.delete(oldPath);
      written.delete(oldPath);
    },

    existsSync(path: string): boolean {
      return files.has(path) || written.has(path);
    },

    unlinkSync(path: string): void {
      files.delete(path);
      written.delete(path);
    },

    mkdirSync(_path: string, _options?: { recursive: boolean }): string | undefined {
      return undefined;
    },
  };
}

// ── v4 fixtures ────────────────────────────────────────────────────────

function makeTournamentSession(courtId = 't1'): PersistedFlowSession {
  return {
    courtId,
    flow: { mode: 'tournament', state: 'LIVE', startedAt: 1700000000000 },
    matchState: {
      config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'B' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
      history: [],
    },
    number: 1,
    name: 'Mesa 1',
    pin: '4821',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
  };
}

function makeBracket(overrides: Partial<TournamentBracket> = {}): TournamentBracket {
  return {
    name: 'Torneo',
    numSlots: 4,
    includeThirdPlace: false,
    matches: [
      {
        id: 'R1-M1', round: 1, position: 0,
        playerA: 'Juan', playerB: null, winner: null,
        status: BRACKET_MATCH_STATUS.READY, courtId: null,
      },
    ],
    thirdPlaceMatch: null,
    status: BRACKET_STATUS.SETUP,
    createdAt: 1700000000000,
    ...overrides,
  };
}

function makeEmptySnapshot(): PersistedStateV4 {
  return { version: 4, savedAt: 0, liveSessions: [], bracket: null };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('PersistenceCoordinator', () => {
  let fs: ReturnType<typeof makeFs>;
  let store: StateStore;
  let coordinator: PersistenceCoordinator;

  beforeEach(() => {
    fs = makeFs();
    store = new StateStore(fs, 'data/rallyos-state.json');
    coordinator = new PersistenceCoordinator(store, makeEmptySnapshot());
  });

  describe('mutate (writers NEVER touch disk)', () => {
    it('applies the mutation to the in-memory snapshot without any I/O', () => {
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
      });

      expect(fs._stats.writes).toBe(0);
      expect(fs._stats.renames).toBe(0);
      expect(fs._stats.reads).toBe(0);
      expect(coordinator.getSnapshot().liveSessions).toHaveLength(1);
      expect(coordinator.getSnapshot().liveSessions[0].courtId).toBe('t1');
    });

    it('mutations accumulate on the same snapshot across writers', () => {
      // CourtManager writes sessions…
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
      });
      // BracketHandler writes the bracket…
      coordinator.mutate((s) => {
        s.bracket = makeBracket();
      });

      const snapshot = coordinator.getSnapshot();
      expect(snapshot.liveSessions).toHaveLength(1);
      expect(snapshot.bracket!.name).toBe('Torneo');
    });
  });

  describe('flush (ONE serialization + atomic tmp+rename of the FULL document)', () => {
    it('performs exactly ONE write + ONE rename for the whole document', () => {
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
        s.bracket = makeBracket();
      });

      coordinator.flush();

      expect(fs._stats.writes).toBe(1);
      expect(fs._stats.renames).toBe(1);
      // tmp file must be gone after the atomic rename
      expect(fs._files.has('data/rallyos-state.json.tmp')).toBe(false);
    });

    it('persists the full document (liveSessions AND bracket) — round-trips via load', () => {
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
        s.bracket = makeBracket({ name: 'Torneo Copa' });
      });
      coordinator.flush();

      const loaded = store.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.liveSessions).toHaveLength(1);
      expect(loaded!.liveSessions[0].courtId).toBe('t1');
      expect(loaded!.bracket!.name).toBe('Torneo Copa');
    });

    it('flush reads NOTHING from disk — the snapshot is the source of truth (R2 fixed)', () => {
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
      });
      coordinator.flush();

      // No read-modify-write: a flush after a flush still never reads the file.
      fs._stats.reads = 0;
      coordinator.flush();
      expect(fs._stats.reads).toBe(0);
      expect(fs._stats.writes).toBe(2);
    });
  });

  describe('PERS-4 torn-write interleave (concurrent session debounce + bracket write)', () => {
    it('session mutation + bracket mutation land in ONE atomic write — neither lost', () => {
      // Interleave A: CourtManager's 600ms session debounce mutates first,
      // BracketHandler's write mutates second, then ONE flush fires.
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
      });
      coordinator.mutate((s) => {
        s.bracket = makeBracket();
      });
      coordinator.flush();

      expect(fs._stats.writes).toBe(1);
      const loaded = store.load();
      expect(loaded!.liveSessions[0].courtId).toBe('t1');
      expect(loaded!.bracket!.name).toBe('Torneo');
    });

    it('interleave B: bracket written first, session debounce re-arms, flush → both present', () => {
      coordinator.mutate((s) => {
        s.bracket = makeBracket();
      });
      // Session debounce fires (again) after the bracket write…
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
      });
      coordinator.flush();

      const loaded = store.load();
      expect(loaded!.bracket!.name).toBe('Torneo');
      expect(loaded!.liveSessions).toHaveLength(1);
      expect(loaded!.liveSessions[0].courtId).toBe('t1');
    });

    it('a session-only flush AFTER a bracket mutation keeps the bracket (no lost update)', () => {
      // The old R2 failure: CourtManager.persistState re-serialized its OWN
      // stale view (no bracket) and clobbered BracketHandler's write. With the
      // coordinator the snapshot carries the bracket, so the session flush
      // re-serializes BOTH.
      coordinator.mutate((s) => {
        s.bracket = makeBracket();
      });
      // CourtManager flush (session-only mutation)…
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
      });
      coordinator.flush();

      const loaded = store.load();
      expect(loaded!.liveSessions).toHaveLength(1);
      expect(loaded!.bracket!.name).toBe('Torneo');
    });
  });

  describe('BracketStoreSeam (bracket cache lives in the coordinator snapshot)', () => {
    it('setBracket mutates the snapshot only; flush() persists it', () => {
      coordinator.setBracket(makeBracket());

      expect(fs._stats.writes).toBe(0); // no disk I/O on mutate
      expect(coordinator.getBracket()!.name).toBe('Torneo');

      coordinator.flush();
      const loaded = store.load();
      expect(loaded!.bracket!.name).toBe('Torneo');
    });

    it('setBracket(null) clears the bracket in the snapshot and on disk after flush', () => {
      coordinator.setBracket(makeBracket());
      coordinator.setBracket(null);
      coordinator.flush();

      expect(coordinator.getBracket()).toBeNull();
      expect(store.load()!.bracket).toBeNull();
    });

    it('hydrates the snapshot bracket at construction (R10 restore path)', () => {
      // A persisted file (with bracket) seeds the coordinator snapshot the same
      // way BracketHandler hydrates its engine on startup.
      const seedingFs = makeFs();
      const seedingStore = new StateStore(seedingFs, 'data/rallyos-state.json');
      const seed = makeEmptySnapshot();
      seed.liveSessions = [makeTournamentSession('t1')];
      seed.bracket = makeBracket({ name: 'OnDisk' });
      seedingStore.save(seed);

      const freshStore = new StateStore(seedingFs, 'data/rallyos-state.json');
      const persisted = freshStore.load();
      const restored = new PersistenceCoordinator(freshStore, persisted ?? makeEmptySnapshot());

      expect(restored.getBracket()!.name).toBe('OnDisk');
      expect(restored.getSnapshot().liveSessions).toHaveLength(1);
    });
  });

  describe('v4 round-trip restore (boot smoke: restart restores from ONE file)', () => {
    it('a flushed document restores liveSessions + bracket identically on a fresh coordinator', () => {
      coordinator.mutate((s) => {
        s.liveSessions = [makeTournamentSession('t1')];
        s.bracket = makeBracket();
      });
      coordinator.flush();

      const persisted = store.load();
      const fresh = new PersistenceCoordinator(store, persisted ?? makeEmptySnapshot());

      const snapshot = fresh.getSnapshot();
      expect(snapshot.liveSessions[0].courtId).toBe('t1');
      expect(snapshot.liveSessions[0].flow).toEqual({ mode: 'tournament', state: 'LIVE', startedAt: 1700000000000 });
      expect(snapshot.bracket!.matches).toHaveLength(1);
      expect(snapshot.bracket!.matches[0].id).toBe('R1-M1');
    });
  });
});
