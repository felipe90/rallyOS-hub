/**
 * BracketEngine — pure single-elimination bracket domain (Tier 2).
 *
 * Zero Socket.IO dependency: every mutation is a synchronous pure-ish
 * operation on the engine's own `bracket` state and returns the (mutated)
 * reference so handlers can emit it directly. This matches the `CourtManager`
 * pattern (see design "BracketEngine as pure domain") and keeps all spec
 * scenarios from R1–R6 and R9 fully testable with no mocks.
 *
 * Round naming is derived from the number of players remaining in a round
 * (`numSlots / 2^(r-1)`):
 *   - 2 players  → "Final"
 *   - 4 players  → "Semis"
 *   - 8 players  → "Cuartos"
 *   - ≥16 players → "R{N}" (e.g. R16, R32)
 *
 * Byes are COMPUTED, never persisted: a match is a bye when exactly one slot
 * is occupied (R5). Winner advancement uses `floor(position / 2)` to find the
 * downstream match and `position % 2` for the slot (P even → playerA,
 * P odd → playerB). The third-place match (R9) is terminal — it never
 * advances and never blocks final completion. Undo (R4) is a recursive
 * cascade capped at the final round.
 */

import {
  BRACKET_STATUS,
  BRACKET_MATCH_STATUS,
  type BracketMatch,
  type BracketMatchStatus,
  type BracketRound,
  type Player,
  type TournamentBracket,
} from '../../../shared/types';

/** Allowed bracket sizes — powers of two from 4 to 32 (spec R1). */
export const VALID_BRACKET_SLOTS = [4, 8, 16, 32] as const;
export type BracketNumSlots = 4 | 8 | 16 | 32;

/** Maximum player-name length (spec R2: "Max 50 chars"). */
const MAX_PLAYER_NAME_LEN = 50;

/**
 * BracketError — thrown by the engine for every spec-defined error code.
 * `message` equals the `code` so `expect(() => ...).toThrow(/CODE/)` matches.
 */
export class BracketError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'BracketError';
    this.code = code;
  }
}

export class BracketEngine {
  /** Internal mutable bracket; `null` after `create` until reset/restore. */
  private _bracket: TournamentBracket | null = null;

  /** Current bracket (read-only access for handlers/views). */
  get bracket(): TournamentBracket | null {
    return this._bracket;
  }

  // ── create (R1) ────────────────────────────────────────────────────────

  /**
   * Create a new bracket, replacing any existing one.
   * @throws {@link BracketError} `INVALID_SIZE` when numSlots ∉ {4,8,16,32}.
   */
  create(name: string, numSlots: number, includeThirdPlace: boolean): TournamentBracket {
    if (!(VALID_BRACKET_SLOTS as readonly number[]).includes(numSlots)) {
      throw new BracketError('INVALID_SIZE');
    }

    const totalRounds = Math.log2(numSlots);
    const matches: BracketMatch[] = [];
    let matchesThisRound = numSlots / 2;
    for (let r = 1; r <= totalRounds; r++) {
      for (let pos = 0; pos < matchesThisRound; pos++) {
        matches.push(this.newMatch(`R${r}-M${pos + 1}`, r, pos));
      }
      matchesThisRound = Math.floor(matchesThisRound / 2);
    }

    this._bracket = {
      name,
      numSlots: numSlots as BracketNumSlots,
      includeThirdPlace,
      matches,
      thirdPlaceMatch: includeThirdPlace
        ? this.newMatch('TP-M1', totalRounds + 1, 0)
        : null,
      status: BRACKET_STATUS.SETUP,
      createdAt: Date.now(),
    };
    return this._bracket;
  }

  // ── getRounds (view helper) ─────────────────────────────────────────────

  /** Group the bracket's flat `matches` into named rounds for rendering. */
  getRounds(): BracketRound[] {
    const b = this._bracket;
    if (!b) return [];
    const totalRounds = Math.log2(b.numSlots);
    const rounds: BracketRound[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      rounds.push({
        round: r,
        name: this.roundName(b.numSlots, r),
        matches: b.matches
          .filter((m) => m.round === r)
          .sort((a, c) => a.position - c.position),
      });
    }
    return rounds;
  }

  // ── assignPlayer (R2) ───────────────────────────────────────────────────

  /**
   * Assign (`name` non-empty) or clear (`name === ''`) a slot. A cleared slot
   * reverts the match to PENDING when both slots end up empty. Clearing is NOT
   * allowed on a COMPLETED match — use `undoMatch` first.
   * @throws {@link BracketError} `NO_BRACKET` | `MATCH_NOT_FOUND` | `NAME_TOO_LONG`.
   */
  assignPlayer(matchId: string, slot: Player, name: string): TournamentBracket {
    const b = this.requireBracket();
    const m = this.findMatch(b, matchId);
    if (typeof name !== 'string') throw new BracketError('NAME_TOO_LONG');
    if (name.length > MAX_PLAYER_NAME_LEN) throw new BracketError('NAME_TOO_LONG');
    if (slot !== 'A' && slot !== 'B') throw new BracketError('INVALID_SLOT');

    const value = name === '' ? null : name;
    if (slot === 'A') m.playerA = value;
    else m.playerB = value;

    // Keep COMPLETED matches untouched — re-assigning a slot on a decided
    // match is a no-op for status; the owner must undo first.
    if (m.status !== BRACKET_MATCH_STATUS.COMPLETED) {
      m.status = this.computeStatus(m);
    }
    return b;
  }

  // ── isBye (R5) ──────────────────────────────────────────────────────────

  /** A match is a bye when exactly one slot is occupied (and not completed). */
  isBye(m: BracketMatch): boolean {
    if (m.status === BRACKET_MATCH_STATUS.COMPLETED) return false;
    const a = !!m.playerA;
    const b = !!m.playerB;
    return (a && !b) || (!a && b);
  }

  // ── setWinner (R3, R5) ──────────────────────────────────────────────────

  /**
   * Declare a winner on a READY match and advance the winner to the next
   * round. Byes auto-advance (the occupied slot must be the declared winner).
   * Declaring the winner of the final match sets bracket status COMPLETED.
   * @throws {@link BracketError} `NO_BRACKET` | `MATCH_NOT_FOUND` |
   *   `MATCH_NOT_READY` | `INVALID_WINNER`.
   */
  setWinner(matchId: string, winner: Player): TournamentBracket {
    const b = this.requireBracket();
    const m = this.findMatch(b, matchId);

    if (m.status !== BRACKET_MATCH_STATUS.READY) {
      throw new BracketError('MATCH_NOT_READY');
    }
    if (winner !== 'A' && winner !== 'B') throw new BracketError('INVALID_WINNER');
    // For a bye the declared winner must be the occupied slot.
    const occupied = winner === 'A' ? !!m.playerA : !!m.playerB;
    if (!occupied) throw new BracketError('INVALID_WINNER');

    m.winner = winner;
    m.status = BRACKET_MATCH_STATUS.COMPLETED;
    this.advanceWinner(b, m);
    this.recomputeBracketStatus(b);
    return b;
  }

  // ── undoMatch cascade (R4) ──────────────────────────────────────────────

  /**
   * Revert a match's winner and recursively clear all downstream winners.
   * Base case: the final round and the third-place match have no downstream.
   * Bracket status is recomputed (may downgrade COMPLETED → ACTIVE).
   * @throws {@link BracketError} `NO_BRACKET` | `MATCH_NOT_FOUND`.
   */
  undoMatch(matchId: string): void {
    const b = this.requireBracket();
    const m = this.findMatch(b, matchId);
    this.cascadeUndo(b, m);
    this.recomputeBracketStatus(b);
  }

  // ── assignCourt (R6) ────────────────────────────────────────────────────

  /** Assign (`courtId` non-null) or nullify (`null`) a match's court. */
  assignCourt(matchId: string, courtId: string | null): TournamentBracket {
    const b = this.requireBracket();
    const m = this.findMatch(b, matchId);
    m.courtId = courtId;
    return b;
  }

  // ── reset & restore (R10) ───────────────────────────────────────────────

  /** Clear the bracket entirely (used by the confirmed 2-step reset). */
  reset(): void {
    this._bracket = null;
  }

  /** Hydrate the engine from a persisted snapshot (R10 restore-on-restart). */
  restore(snapshot: TournamentBracket): void {
    this._bracket = this.clone(snapshot);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private newMatch(id: string, round: number, position: number): BracketMatch {
    return {
      id,
      round,
      position,
      playerA: null,
      playerB: null,
      winner: null,
      status: BRACKET_MATCH_STATUS.PENDING,
      courtId: null,
    };
  }

  /** Round display name from the player count remaining in that round. */
  private roundName(numSlots: BracketNumSlots, r: number): string {
    const playersInRound = numSlots / Math.pow(2, r - 1);
    if (playersInRound === 2) return 'Final';
    if (playersInRound === 4) return 'Semis';
    if (playersInRound === 8) return 'Cuartos';
    return `R${playersInRound}`;
  }

  private requireBracket(): TournamentBracket {
    if (!this._bracket) throw new BracketError('NO_BRACKET');
    return this._bracket;
  }

  /** Find a match by id across main matches and the (optional) third place. */
  private findMatch(b: TournamentBracket, id: string): BracketMatch {
    if (b.thirdPlaceMatch && b.thirdPlaceMatch.id === id) return b.thirdPlaceMatch;
    const m = b.matches.find((x) => x.id === id);
    if (!m) throw new BracketError('MATCH_NOT_FOUND');
    return m;
  }

  /** Recompute a non-completed match's status from its slots. */
  private computeStatus(m: BracketMatch): BracketMatchStatus {
    const a = !!m.playerA;
    const b = !!m.playerB;
    if (!a && !b) return BRACKET_MATCH_STATUS.PENDING;
    return BRACKET_MATCH_STATUS.READY;
  }

  /** Advance a completed match's winner into its downstream slot (R3/R5). */
  private advanceWinner(b: TournamentBracket, m: BracketMatch): void {
    if (this.isThirdPlace(b, m)) return; // terminal
    const totalRounds = Math.log2(b.numSlots);
    if (m.round >= totalRounds) return; // final → no advancement

    const next = this.downstream(b, m);
    if (!next) return;
    const winnerPlayer = m.winner === 'A' ? m.playerA : m.playerB;
    const slot: Player = m.position % 2 === 0 ? 'A' : 'B';
    if (slot === 'A') next.playerA = winnerPlayer;
    else next.playerB = winnerPlayer;
    if (next.status !== BRACKET_MATCH_STATUS.COMPLETED) {
      next.status = this.computeStatus(next);
    }
  }

  /** Recursive undo cascade: revert `m`, clear its downstream slot, recurse. */
  private cascadeUndo(b: TournamentBracket, m: BracketMatch): void {
    m.winner = null;
    m.status = this.computeStatus(m);

    if (this.isThirdPlace(b, m) || this.isFinal(b, m)) return; // base case

    const next = this.downstream(b, m);
    if (!next) return;
    const wasCompleted = next.status === BRACKET_MATCH_STATUS.COMPLETED;
    const slot: Player = m.position % 2 === 0 ? 'A' : 'B';
    if (slot === 'A') next.playerA = null;
    else next.playerB = null;
    next.status = this.computeStatus(next);
    if (wasCompleted) this.cascadeUndo(b, next);
  }

  /** The downstream match fed by `m` (next round, position floor(P/2)). */
  private downstream(b: TournamentBracket, m: BracketMatch): BracketMatch | null {
    const nextRound = m.round + 1;
    const nextPos = Math.floor(m.position / 2);
    return (
      b.matches.find((x) => x.round === nextRound && x.position === nextPos) ??
      null
    );
  }

  private isThirdPlace(b: TournamentBracket, m: BracketMatch): boolean {
    return b.thirdPlaceMatch === m;
  }

  private isFinal(b: TournamentBracket, m: BracketMatch): boolean {
    return Math.log2(b.numSlots) === m.round;
  }

  /**
   * Recompute bracket lifecycle status. COMPLETED iff the final match is
   * decided (third place never blocks completion — spec R9). ACTIVE iff any
   * match (main or third place) has a winner. Otherwise SETUP.
   */
  private recomputeBracketStatus(b: TournamentBracket): void {
    const totalRounds = Math.log2(b.numSlots);
    const finalMatch = b.matches.find(
      (m) => m.round === totalRounds && m.position === 0,
    );
    if (finalMatch?.status === BRACKET_MATCH_STATUS.COMPLETED) {
      b.status = BRACKET_STATUS.COMPLETED;
      return;
    }
    const anyCompleted =
      b.matches.some((m) => m.status === BRACKET_MATCH_STATUS.COMPLETED) ||
      b.thirdPlaceMatch?.status === BRACKET_MATCH_STATUS.COMPLETED;
    b.status = anyCompleted ? BRACKET_STATUS.ACTIVE : BRACKET_STATUS.SETUP;
  }

  /** Structured clone (deep) — isolates restored snapshots from callers. */
  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}