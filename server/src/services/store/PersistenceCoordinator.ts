/**
 * PersistenceCoordinator — single-writer persistence coordinator (slice 6).
 *
 * Spec: persistence PERS-4 (fixes R2). ALL writes to `rallyos-state.json`
 * (court sessions + bracket) flow through ONE coordinator that re-serializes
 * the FULL document from an in-memory source of truth at flush time:
 *
 *   - `mutate(fn)`   — writers mutate the in-memory snapshot; they NEVER
 *                      touch disk and NEVER read the file.
 *   - `flush()`      — ONE serialization + atomic tmp+rename of the FULL
 *                      document (StateStore.save(snapshot)).
 *
 * Because both writers (CourtManager sessions, BracketHandler bracket) mutate
 * the SAME snapshot, any flush re-serializes both slices. The old torn-write
 * (two read-modify-write transactions on one file, last-writer-wins losing an
 * update) is structurally impossible.
 *
 * The coordinator also satisfies the BracketHandler store seam
 * (getBracket/setBracket/flush): the bracket cache lives in the snapshot, so
 * a CourtManager session flush can never clobber a bracket write (the old
 * StateStore bracket-cache workaround is gone).
 */

import { StateStore } from './StateStore';
import type { PersistedStateV4 } from '../../domain/ports/persistence-types';
import type { TournamentBracket } from '../../../../shared/types';

export class PersistenceCoordinator {
  private readonly store: StateStore;
  private readonly snapshot: PersistedStateV4;

  /**
   * @param store     The StateStore adapter that performs the atomic I/O.
   * @param initial   The in-memory source of truth — seeded from
   *                  `StateStore.load()` at boot (or a fresh empty v4 doc).
   */
  constructor(store: StateStore, initial: PersistedStateV4) {
    this.store = store;
    this.snapshot = initial;
  }

  /** Read access to the in-memory source of truth (restore/hydration). */
  getSnapshot(): PersistedStateV4 {
    return this.snapshot;
  }

  /**
   * Mutate the in-memory snapshot. Writers NEVER touch disk here — a write
   * only becomes durable when `flush()` runs. Cheap enough to call on every
   * debounced mutation (the 600ms/2s debounce governs flush, not mutate).
   */
  mutate(fn: (s: PersistedStateV4) => void): void {
    fn(this.snapshot);
  }

  /**
   * ONE serialization + atomic tmp+rename of the FULL document. Every flush
   * re-serializes the entire snapshot, so concurrent session + bracket
   * mutations land in a single atomic write — neither is lost (PERS-4).
   */
  flush(): void {
    this.store.save(this.snapshot);
  }

  // ── BracketStoreSeam (BracketHandler) — bracket cache lives in the snapshot ──

  /** Read the current bracket from the snapshot (null when absent/cleared). */
  getBracket(): TournamentBracket | null {
    return this.snapshot.bracket ?? null;
  }

  /**
   * Mutate the snapshot bracket (in-memory only). Call `flush()` to persist.
   * BracketHandler calls this immediately on every mutation so a concurrent
   * CourtManager flush serializes the LATEST bracket.
   */
  setBracket(bracket: TournamentBracket | null): void {
    this.snapshot.bracket = bracket;
  }
}
