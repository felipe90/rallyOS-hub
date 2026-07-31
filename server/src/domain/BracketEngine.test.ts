/**
 * BracketEngine — pure domain logic tests (Tier 2, TDD).
 *
 * The engine is a zero-Socket.IO, synchronous domain object. Every spec
 * scenario from R1–R6 and R9 is exercised here with no mocks — the engine
 * mutates its own `bracket` state and the tests read it back directly.
 *
 * RED until T2.1 (server/src/domain/BracketEngine.ts) is implemented.
 */

import {
  BracketEngine,
  BracketError,
} from './BracketEngine';
import {
  BRACKET_STATUS,
  BRACKET_MATCH_STATUS,
  TournamentBracket,
} from '../../../shared/types';

// ── Helpers ────────────────────────────────────────────────────────────

/** Returns the match for an id, throwing a helpful error if missing. */
function match(b: TournamentBracket, id: string) {
  const m = b.matches.find((x) => x.id === id) ?? (b.thirdPlaceMatch?.id === id ? b.thirdPlaceMatch : null);
  if (!m) throw new Error(`match ${id} not found in bracket`);
  return m;
}

// ── Round naming ───────────────────────────────────────────────────────

describe('createBracket — round generation & naming', () => {
  test('4 slots: 2 rounds — Semis + Final (3 matches total)', () => {
    const e = new BracketEngine();
    const b = e.create('T', 4, false);
    const rounds = e.getRounds();
    expect(rounds).toHaveLength(2);
    expect(rounds[0].name).toBe('Semis');
    expect(rounds[1].name).toBe('Final');
    expect(b.matches).toHaveLength(3); // 2 semis + 1 final
    expect(b.numSlots).toBe(4);
    expect(b.includeThirdPlace).toBe(false);
    expect(b.thirdPlaceMatch).toBeNull();
  });

  test('8 slots: 3 rounds — Cuartos + Semis + Final (7 matches)', () => {
    const e = new BracketEngine();
    const b = e.create('T', 8, false);
    const rounds = e.getRounds();
    expect(rounds.map((r) => r.name)).toEqual(['Cuartos', 'Semis', 'Final']);
    expect(b.matches).toHaveLength(7); // 4 + 2 + 1
  });

  test('16 slots: 4 rounds — R16 + Cuartos + Semis + Final (15 matches)', () => {
    const e = new BracketEngine();
    const b = e.create('T', 16, false);
    const rounds = e.getRounds();
    expect(rounds.map((r) => r.name)).toEqual(['R16', 'Cuartos', 'Semis', 'Final']);
    expect(b.matches).toHaveLength(15);
  });

  test('32 slots: 5 rounds — R32 + R16 + Cuartos + Semis + Final (31 matches)', () => {
    const e = new BracketEngine();
    const b = e.create('T', 32, false);
    const rounds = e.getRounds();
    expect(rounds.map((r) => r.name)).toEqual(['R32', 'R16', 'Cuartos', 'Semis', 'Final']);
    expect(b.matches).toHaveLength(31);
  });

  test('every freshly-created match is PENDING with null players/winner/court', () => {
    const e = new BracketEngine();
    const b = e.create('T', 4, false);
    for (const m of b.matches) {
      expect(m.playerA).toBeNull();
      expect(m.playerB).toBeNull();
      expect(m.winner).toBeNull();
      expect(m.courtId).toBeNull();
      expect(m.status).toBe(BRACKET_MATCH_STATUS.PENDING);
    }
    expect(b.status).toBe(BRACKET_STATUS.SETUP);
  });

  test('match ids follow R{round}-M{position+1} form', () => {
    const e = new BracketEngine();
    const b = e.create('T', 4, false);
    expect(b.matches.map((m) => m.id)).toEqual(['R1-M1', 'R1-M2', 'R2-M1']);
  });
});

// ── Invalid size (R1) ──────────────────────────────────────────────────

describe('createBracket — invalid size rejected', () => {
  test.each([6, 3, 64, 2, 0, -8])('rejects numSlots=%i with INVALID_SIZE', (n) => {
    const e = new BracketEngine();
    expect(() => e.create('T', n, false)).toThrow(BracketError);
    expect(() => e.create('T', n, false)).toThrow(/INVALID_SIZE/);
  });
});

// ── Player assignment (R2) ─────────────────────────────────────────────

describe('assignPlayer (R2)', () => {
  test('assigns a player to slot A and updates state to READY', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    const b = e.assignPlayer('R1-M1', 'A', 'Juan');
    expect(match(b, 'R1-M1').playerA).toBe('Juan');
    // only one slot filled → implicit bye → READY
    expect(match(b, 'R1-M1').status).toBe(BRACKET_MATCH_STATUS.READY);
  });

  test('assigns a player to slot B', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    const b = e.assignPlayer('R1-M1', 'B', 'Maria');
    expect(match(b, 'R1-M1').playerB).toBe('Maria');
    expect(match(b, 'R1-M1').status).toBe(BRACKET_MATCH_STATUS.READY);
  });

  test('both slots filled → READY (not a bye)', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    const b = e.assignPlayer('R1-M1', 'B', 'Maria');
    expect(match(b, 'R1-M1').status).toBe(BRACKET_MATCH_STATUS.READY);
  });

  test('clearing a slot with name="" reverts to PENDING when both empty', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    const b = e.assignPlayer('R1-M1', 'A', '');
    expect(match(b, 'R1-M1').playerA).toBeNull();
    expect(match(b, 'R1-M1').status).toBe(BRACKET_MATCH_STATUS.PENDING);
  });

  test('rejects name longer than 50 chars with NAME_TOO_LONG', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    expect(() => e.assignPlayer('R1-M1', 'A', 'a'.repeat(51))).toThrow(/NAME_TOO_LONG/);
  });

  test('rejects unknown matchId with MATCH_NOT_FOUND', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    expect(() => e.assignPlayer('R9-M9', 'A', 'Juan')).toThrow(/MATCH_NOT_FOUND/);
  });

  test('rejects when no bracket exists with NO_BRACKET', () => {
    const e = new BracketEngine();
    expect(() => e.assignPlayer('R1-M1', 'A', 'Juan')).toThrow(/NO_BRACKET/);
  });
});

// ── Bye detection (R5) ─────────────────────────────────────────────────

describe('isBye (R5)', () => {
  test('one occupied + one empty = bye', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    expect(e.isBye(match(e.bracket!, 'R1-M1'))).toBe(true);
  });

  test('both occupied = not a bye', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    expect(e.isBye(match(e.bracket!, 'R1-M1'))).toBe(false);
  });

  test('both empty = not a bye (PENDING, not ready)', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    expect(e.isBye(match(e.bracket!, 'R1-M1'))).toBe(false);
    expect(match(e.bracket!, 'R1-M1').status).toBe(BRACKET_MATCH_STATUS.PENDING);
  });
});

// ── Set winner & advancement (R3, R5) ──────────────────────────────────

describe('setWinner (R3, R5)', () => {
  test('declares winner on a READY match → COMPLETED, advances to next round', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    // R1-M1 is position 0 in round 1 → feeds final (R2-M1) slot A (P even → A)
    const b = e.setWinner('R1-M1', 'A');
    expect(match(b, 'R1-M1').winner).toBe('A');
    expect(match(b, 'R1-M1').status).toBe(BRACKET_MATCH_STATUS.COMPLETED);
    expect(match(b, 'R2-M1').playerA).toBe('Juan'); // winner A advanced
  });

  test('R1-M2 (position 1) feeds final slot B (P odd → B)', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M2', 'A', 'Ana');
    e.assignPlayer('R1-M2', 'B', 'Luis');
    const b = e.setWinner('R1-M2', 'B');
    expect(match(b, 'R2-M1').playerB).toBe('Luis'); // winner B advanced to slot B
  });

  test('rejects setWinner on a PENDING match (both empty) with MATCH_NOT_READY', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    expect(() => e.setWinner('R1-M2', 'A')).toThrow(/MATCH_NOT_READY/);
  });

  test('bye auto-advance: occupied slot only, declaring the occupied winner advances', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan'); // playerB empty → bye
    const b = e.setWinner('R1-M1', 'A');
    expect(match(b, 'R1-M1').winner).toBe('A');
    expect(match(b, 'R2-M1').playerA).toBe('Juan');
  });

  test('rejects declaring winner on the empty slot of a bye with INVALID_WINNER', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan'); // B empty
    expect(() => e.setWinner('R1-M1', 'B')).toThrow(/INVALID_WINNER/);
  });

  test('final match winner → bracket status COMPLETED, no advancement', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A');
    e.assignPlayer('R1-M2', 'A', 'Ana');
    e.assignPlayer('R1-M2', 'B', 'Luis');
    e.setWinner('R1-M2', 'A');
    // final R2-M1 now has both players
    const b = e.setWinner('R2-M1', 'A');
    expect(match(b, 'R2-M1').status).toBe(BRACKET_MATCH_STATUS.COMPLETED);
    expect(b.status).toBe(BRACKET_STATUS.COMPLETED);
  });

  test('bracket status becomes ACTIVE once any match is completed', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    const b = e.setWinner('R1-M1', 'A');
    expect(b.status).toBe(BRACKET_STATUS.ACTIVE);
  });
});

// ── Undo cascade (R4) ──────────────────────────────────────────────────

describe('undoMatch cascade (R4)', () => {
  test('undo reverts target match AND clears downstream winner + recurses', () => {
    const e = new BracketEngine();
    e.create('T', 8, false); // rounds: Cuartos(1) Semis(2) Final(3)
    // Fill all 4 quarterfinals and complete them so the final gets populated.
    const qfs = ['R1-M1', 'R1-M2', 'R1-M3', 'R1-M4'];
    qfs.forEach((id, i) => {
      e.assignPlayer(id, 'A', `P${i * 2}`);
      e.assignPlayer(id, 'B', `P${i * 2 + 1}`);
      e.setWinner(id, 'A');
    });
    // Both semis are now ready (advanced from QFs); complete them.
    e.setWinner('R2-M1', 'A'); // SF1
    e.setWinner('R2-M2', 'A'); // SF2
    // Final now has both SF winners; complete it.
    e.setWinner('R3-M1', 'A'); // final completed

    expect(e.bracket!.status).toBe(BRACKET_STATUS.COMPLETED);

    // Undo SF1 (R2-M1): should revert SF1, clear the final slot it fed, AND
    // recurse to clear the final's winner (final was completed).
    e.undoMatch('R2-M1');
    expect(match(e.bracket!, 'R2-M1').winner).toBeNull();
    expect(match(e.bracket!, 'R2-M1').status).toBe(BRACKET_MATCH_STATUS.READY);
    expect(match(e.bracket!, 'R3-M1').winner).toBeNull();
    expect(match(e.bracket!, 'R3-M1').status).toBe(BRACKET_MATCH_STATUS.READY);
  });

  test('undo a quarterfinal reverts it and clears downstream semi, recurses to final', () => {
    const e = new BracketEngine();
    e.create('T', 8, false);
    const qfs = ['R1-M1', 'R1-M2', 'R1-M3', 'R1-M4'];
    qfs.forEach((id, i) => {
      e.assignPlayer(id, 'A', `P${i * 2}`);
      e.assignPlayer(id, 'B', `P${i * 2 + 1}`);
      e.setWinner(id, 'A');
    });
    e.setWinner('R2-M1', 'A');
    e.setWinner('R2-M2', 'A');
    e.setWinner('R3-M1', 'A'); // final completed

    // Undo QF1 (R1-M1): cascade should clear SF1, then final, recursively.
    e.undoMatch('R1-M1');
    expect(match(e.bracket!, 'R1-M1').winner).toBeNull();
    expect(match(e.bracket!, 'R2-M1').winner).toBeNull();
    expect(match(e.bracket!, 'R2-M1').playerA).toBeNull(); // advanced player cleared
    expect(match(e.bracket!, 'R3-M1').winner).toBeNull(); // final cascade-cleared
  });

  test('undo on final (no downstream) is the base case — only reverts itself', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.assignPlayer('R1-M2', 'A', 'Ana');
    e.assignPlayer('R1-M2', 'B', 'Luis');
    e.setWinner('R1-M1', 'A');
    e.setWinner('R1-M2', 'A');
    e.setWinner('R2-M1', 'A'); // final completed

    e.undoMatch('R2-M1');
    expect(match(e.bracket!, 'R2-M1').winner).toBeNull();
    expect(match(e.bracket!, 'R2-M1').status).toBe(BRACKET_MATCH_STATUS.READY);
    // upstream semis untouched
    expect(match(e.bracket!, 'R1-M1').winner).toBe('A');
  });

  test('undo with no bracket → NO_BRACKET', () => {
    const e = new BracketEngine();
    expect(() => e.undoMatch('R1-M1')).toThrow(/NO_BRACKET/);
  });
});

// ── assignCourt (R6) ───────────────────────────────────────────────────

describe('assignCourt (R6)', () => {
  test('assigns a court id to a match', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    const b = e.assignCourt('R1-M1', 'court-1');
    expect(match(b, 'R1-M1').courtId).toBe('court-1');
  });

  test('clears court id with null', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignCourt('R1-M1', 'court-1');
    const b = e.assignCourt('R1-M1', null);
    expect(match(b, 'R1-M1').courtId).toBeNull();
  });
});

// ── Third place (R9) ───────────────────────────────────────────────────

describe('third place (R9)', () => {
  test('generated when includeThirdPlace=true, distinct from matches', () => {
    const e = new BracketEngine();
    const b = e.create('T', 4, true);
    expect(b.includeThirdPlace).toBe(true);
    expect(b.thirdPlaceMatch).not.toBeNull();
    expect(b.thirdPlaceMatch!.id).toBe('TP-M1');
    // main matches count unchanged (still 3 for 4 slots)
    expect(b.matches).toHaveLength(3);
  });

  test('not generated when includeThirdPlace=false', () => {
    const e = new BracketEngine();
    const b = e.create('T', 4, false);
    expect(b.thirdPlaceMatch).toBeNull();
  });

  test('third place is terminal — setWinner does NOT advance', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('TP-M1', 'A', 'Loser SF1');
    e.assignPlayer('TP-M1', 'B', 'Loser SF2');
    const b = e.setWinner('TP-M1', 'A');
    // No downstream match exists — winner set, status COMPLETED, no advance.
    expect(match(b, 'TP-M1').winner).toBe('A');
    expect(match(b, 'TP-M1').status).toBe(BRACKET_MATCH_STATUS.COMPLETED);
  });

  test('owner can manually assign third-place players', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    const b = e.assignPlayer('TP-M1', 'A', 'Perdedor SF1');
    expect(match(b, 'TP-M1').playerA).toBe('Perdedor SF1');
  });

  test('third place does not block final completion', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.assignPlayer('R1-M2', 'A', 'Ana');
    e.assignPlayer('R1-M2', 'B', 'Luis');
    e.setWinner('R1-M1', 'A');
    e.setWinner('R1-M2', 'A');
    const b = e.setWinner('R2-M1', 'A'); // final winner decided
    expect(b.status).toBe(BRACKET_STATUS.COMPLETED); // even though 3rd place pending
  });
});

// ── setThirdPlaceLoser (Option 2 bracket↔court integration) ─────────────

describe('setThirdPlaceLoser (Option 2)', () => {
  /** 4-slot bracket: R1-M1 (SF1, pos 0) and R1-M2 (SF2, pos 1) are the semis. */
  function semiWinner(e: BracketEngine, id: string, winner: 'A' | 'B'): void {
    e.assignPlayer(id, 'A', `A-${id}`);
    e.assignPlayer(id, 'B', `B-${id}`);
    e.setWinner(id, winner);
  }

  test('semifinal position 0 loser feeds TP slot A', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A'); // winner Juan, loser Maria
    const b = e.setThirdPlaceLoser('R1-M1', 'B');
    expect(b.thirdPlaceMatch!.playerA).toBe('Maria');
    expect(b.thirdPlaceMatch!.playerB).toBeNull();
    expect(b.thirdPlaceMatch!.status).toBe(BRACKET_MATCH_STATUS.READY);
  });

  test('semifinal position 1 loser feeds TP slot B', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('R1-M2', 'A', 'Ana');
    e.assignPlayer('R1-M2', 'B', 'Luis');
    e.setWinner('R1-M2', 'B'); // winner Luis, loser Ana
    const b = e.setThirdPlaceLoser('R1-M2', 'A');
    expect(b.thirdPlaceMatch!.playerB).toBe('Ana');
    expect(b.thirdPlaceMatch!.playerA).toBeNull();
  });

  test('TP becomes READY when both losers feed it, but is NOT COMPLETED', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A');
    e.setThirdPlaceLoser('R1-M1', 'B');
    e.assignPlayer('R1-M2', 'A', 'Ana');
    e.assignPlayer('R1-M2', 'B', 'Luis');
    e.setWinner('R1-M2', 'A');
    const b = e.setThirdPlaceLoser('R1-M2', 'B');
    expect(b.thirdPlaceMatch!.playerA).toBe('Maria');
    expect(b.thirdPlaceMatch!.playerB).toBe('Luis');
    expect(b.thirdPlaceMatch!.status).toBe(BRACKET_MATCH_STATUS.READY);
    expect(b.thirdPlaceMatch!.winner).toBeNull();
  });

  test('throws NO_THIRD_PLACE when third place is not enabled', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A');
    expect(() => e.setThirdPlaceLoser('R1-M1', 'B')).toThrow(/NO_THIRD_PLACE/);
  });

  test('throws NOT_SEMIFINAL for a non-semifinal source match', () => {
    const e = new BracketEngine();
    e.create('T', 8, true); // semis are round 2; R1 is a quarterfinal
    e.assignPlayer('R1-M1', 'A', 'P0');
    e.assignPlayer('R1-M1', 'B', 'P1');
    e.setWinner('R1-M1', 'A');
    expect(() => e.setThirdPlaceLoser('R1-M1', 'B')).toThrow(/NOT_SEMIFINAL/);
  });

  test('throws MATCH_NOT_READY when the source semifinal is not completed', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    expect(() => e.setThirdPlaceLoser('R1-M1', 'B')).toThrow(/MATCH_NOT_READY/);
  });

  test('throws INVALID_WINNER when the loser slot is the declared winner slot', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A');
    expect(() => e.setThirdPlaceLoser('R1-M1', 'A')).toThrow(/INVALID_WINNER/);
  });

  test('bye semifinal (empty loser slot) feeds nothing — no-op', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('R1-M1', 'A', 'Juan'); // B empty → bye
    e.setWinner('R1-M1', 'A');
    const b = e.setThirdPlaceLoser('R1-M1', 'B');
    expect(b.thirdPlaceMatch!.playerA).toBeNull();
    expect(b.thirdPlaceMatch!.status).toBe(BRACKET_MATCH_STATUS.PENDING);
  });

  test('never overwrites an occupied TP slot (owner manual override survives)', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('TP-M1', 'A', 'Manual Player'); // owner pre-assigned
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A');
    const b = e.setThirdPlaceLoser('R1-M1', 'B');
    expect(b.thirdPlaceMatch!.playerA).toBe('Manual Player');
  });

  test('never feeds a TP match that is already COMPLETED', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    e.assignPlayer('TP-M1', 'A', 'Loser1');
    e.assignPlayer('TP-M1', 'B', 'Loser2');
    e.setWinner('TP-M1', 'A'); // TP decided on its own court
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A');
    const b = e.setThirdPlaceLoser('R1-M1', 'B');
    expect(b.thirdPlaceMatch!.winner).toBe('A');
    expect(b.thirdPlaceMatch!.playerA).toBe('Loser1');
    expect(b.thirdPlaceMatch!.status).toBe(BRACKET_MATCH_STATUS.COMPLETED);
  });
});

// ── Undo cascade + third place (Option 2) ───────────────────────────────

describe('undoMatch cascade with third place (Option 2)', () => {
  /** 4-slot bracket with third place; R1-M1 (SF1) and R1-M2 (SF2) completed. */
  function completedSemisWithTp(e: BracketEngine): void {
    e.assignPlayer('R1-M1', 'A', 'Juan');
    e.assignPlayer('R1-M1', 'B', 'Maria');
    e.setWinner('R1-M1', 'A'); // loser Maria → TP A
    e.setThirdPlaceLoser('R1-M1', 'B');
    e.assignPlayer('R1-M2', 'A', 'Ana');
    e.assignPlayer('R1-M2', 'B', 'Luis');
    e.setWinner('R1-M2', 'B'); // loser Ana → TP B
    e.setThirdPlaceLoser('R1-M2', 'A');
  }

  test('undoing a semifinal clears its own TP slot and keeps the other semi TP slot', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    completedSemisWithTp(e);
    expect(e.bracket!.thirdPlaceMatch!.playerA).toBe('Maria');
    expect(e.bracket!.thirdPlaceMatch!.playerB).toBe('Ana');

    e.undoMatch('R1-M1');
    const b = e.bracket!;
    expect(b.thirdPlaceMatch!.playerA).toBeNull(); // SF1's slot cleared
    expect(b.thirdPlaceMatch!.playerB).toBe('Ana'); // SF2's slot untouched
    expect(b.thirdPlaceMatch!.status).toBe(BRACKET_MATCH_STATUS.READY);
  });

  test('undoing a quarterfinal cascades and clears the TP slot fed by its semi', () => {
    const e = new BracketEngine();
    e.create('T', 8, true); // R1 = QF, R2 = semis, R3 = final
    const qfs = ['R1-M1', 'R1-M2'];
    qfs.forEach((id, i) => {
      e.assignPlayer(id, 'A', `QF${i}A`);
      e.assignPlayer(id, 'B', `QF${i}B`);
      e.setWinner(id, 'A');
    });
    // SF1 (R2-M1) is fed by QF1/QF2; complete it and feed TP.
    e.assignPlayer('R2-M1', 'A', 'SF1A');
    e.assignPlayer('R2-M1', 'B', 'SF1B');
    e.setWinner('R2-M1', 'A');
    e.setThirdPlaceLoser('R2-M1', 'B');
    expect(e.bracket!.thirdPlaceMatch!.playerA).toBe('SF1B');

    // Undo QF1 → cascade clears SF1 (and its downstream final slot) → TP A too.
    e.undoMatch('R1-M1');
    expect(match(e.bracket!, 'R2-M1').winner).toBeNull();
    expect(e.bracket!.thirdPlaceMatch!.playerA).toBeNull();
  });

  test('undoing a semifinal does NOT clear a manually-overridden TP slot', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    completedSemisWithTp(e);
    // Owner manually edits TP slot A AFTER the auto-feed.
    e.assignPlayer('TP-M1', 'A', 'Manual Sub');
    expect(e.bracket!.thirdPlaceMatch!.playerA).toBe('Manual Sub');

    e.undoMatch('R1-M1');
    expect(e.bracket!.thirdPlaceMatch!.playerA).toBe('Manual Sub'); // survives
    expect(e.bracket!.thirdPlaceMatch!.playerB).toBe('Ana');
  });

  test('re-feeding after undo restores the TP loser', () => {
    const e = new BracketEngine();
    e.create('T', 4, true);
    completedSemisWithTp(e);
    e.undoMatch('R1-M1');
    expect(e.bracket!.thirdPlaceMatch!.playerA).toBeNull();

    // Re-declare the winner and re-feed the loser.
    e.setWinner('R1-M1', 'A');
    const b = e.setThirdPlaceLoser('R1-M1', 'B');
    expect(b.thirdPlaceMatch!.playerA).toBe('Maria');
    expect(b.thirdPlaceMatch!.status).toBe(BRACKET_MATCH_STATUS.READY);
  });
});

// ── reset & restore (R10) ──────────────────────────────────────────────

describe('reset & restore (R10)', () => {
  test('reset clears the bracket to null', () => {
    const e = new BracketEngine();
    e.create('T', 4, false);
    e.reset();
    expect(e.bracket).toBeNull();
  });

  test('restore hydrates the engine from persisted state', () => {
    const e = new BracketEngine();
    e.create('Persisted', 8, true);
    const snapshot = e.bracket!;
    e.reset();
    expect(e.bracket).toBeNull();

    const e2 = new BracketEngine();
    e2.restore(snapshot);
    expect(e2.bracket).not.toBeNull();
    expect(e2.bracket!.name).toBe('Persisted');
    expect(e2.bracket!.matches).toHaveLength(7);
  });
});