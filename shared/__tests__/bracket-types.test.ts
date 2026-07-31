/**
 * Bracket tournament shared types & events — Phase 2 (Tier 1)
 *
 * Verifies the const-object enums (BRACKET_STATUS, BRACKET_MATCH_STATUS,
 * BRACKET_SLOT) and the bracket interfaces (TournamentBracket, BracketMatch,
 * BracketRound) exist and follow the same const-object pattern as
 * CLUB_STATUS / COURT_MODE. Also verifies every BRACKET_* socket event is
 * registered in the CLIENT and SERVER namespaces.
 *
 * These tests are RED until T1.1 (shared/types.ts) and T1.2 (shared/events.ts)
 * add the bracket symbols.
 */

import {
  BRACKET_STATUS,
  BracketStatus,
  BRACKET_MATCH_STATUS,
  BracketMatchStatus,
  BRACKET_SLOT,
  BracketSlot,
  Player,
  TournamentBracket,
  BracketMatch,
  BracketRound,
} from '../types';
import { SocketEvents } from '../events';

// ── BRACKET_STATUS (bracket lifecycle) ────────────────────────────────

describe('BRACKET_STATUS const-object enum', () => {
  test('exposes SETUP, ACTIVE, COMPLETED members', () => {
    expect(BRACKET_STATUS.SETUP).toBe('SETUP');
    expect(BRACKET_STATUS.ACTIVE).toBe('ACTIVE');
    expect(BRACKET_STATUS.COMPLETED).toBe('COMPLETED');
  });

  test('BracketStatus type covers all members', () => {
    const s: BracketStatus = BRACKET_STATUS.SETUP;
    const a: BracketStatus = BRACKET_STATUS.ACTIVE;
    const c: BracketStatus = BRACKET_STATUS.COMPLETED;
    expect([s, a, c]).toHaveLength(3);
  });
});

// ── BRACKET_MATCH_STATUS (per-match status) ───────────────────────────

describe('BRACKET_MATCH_STATUS const-object enum', () => {
  test('exposes PENDING, READY, COMPLETED members', () => {
    expect(BRACKET_MATCH_STATUS.PENDING).toBe('PENDING');
    expect(BRACKET_MATCH_STATUS.READY).toBe('READY');
    expect(BRACKET_MATCH_STATUS.COMPLETED).toBe('COMPLETED');
  });

  test('BracketMatchStatus type covers all members', () => {
    const p: BracketMatchStatus = BRACKET_MATCH_STATUS.PENDING;
    const r: BracketMatchStatus = BRACKET_MATCH_STATUS.READY;
    const c: BracketMatchStatus = BRACKET_MATCH_STATUS.COMPLETED;
    expect([p, r, c]).toHaveLength(3);
  });
});

// ── BRACKET_SLOT ──────────────────────────────────────────────────────

describe('BRACKET_SLOT const-object enum', () => {
  test('exposes A and B members', () => {
    expect(BRACKET_SLOT.A).toBe('A');
    expect(BRACKET_SLOT.B).toBe('B');
  });

  test('BracketSlot type is A | B (matches Player)', () => {
    const a: BracketSlot = BRACKET_SLOT.A;
    const b: BracketSlot = BRACKET_SLOT.B;
    // Player is already 'A' | 'B' in the codebase — BracketSlot must be
    // structurally identical so winner assignments are interchangeable.
    const asPlayer: Player = a;
    const asPlayer2: Player = b;
    expect([asPlayer, asPlayer2]).toEqual(['A', 'B']);
  });
});

// ── BracketMatch interface shape ──────────────────────────────────────

describe('BracketMatch interface', () => {
  test('accepts a fully-populated match with id/round/position/players/winner/status/courtId', () => {
    const m: BracketMatch = {
      id: 'R1-M1',
      round: 1,
      position: 0,
      playerA: 'Juan',
      playerB: 'Maria',
      winner: null,
      status: BRACKET_MATCH_STATUS.READY,
      courtId: null,
    };
    expect(m.id).toBe('R1-M1');
    expect(m.round).toBe(1);
    expect(m.position).toBe(0);
    expect(m.playerA).toBe('Juan');
    expect(m.playerB).toBe('Maria');
    expect(m.winner).toBeNull();
    expect(m.status).toBe(BRACKET_MATCH_STATUS.READY);
    expect(m.courtId).toBeNull();
  });

  test('accepts nullable players and winner (empty slots)', () => {
    const m: BracketMatch = {
      id: 'R2-M1',
      round: 2,
      position: 0,
      playerA: null,
      playerB: null,
      winner: null,
      status: BRACKET_MATCH_STATUS.PENDING,
      courtId: null,
    };
    expect(m.playerA).toBeNull();
    expect(m.playerB).toBeNull();
  });
});

// ── BracketRound interface shape ──────────────────────────────────────

describe('BracketRound interface', () => {
  test('groups matches by round with a name', () => {
    const r: BracketRound = {
      round: 1,
      name: 'Semis',
      matches: [],
    };
    expect(r.round).toBe(1);
    expect(r.name).toBe('Semis');
    expect(r.matches).toEqual([]);
  });
});

// ── TournamentBracket interface shape ────────────────────────────────

describe('TournamentBracket interface', () => {
  test('accepts a full bracket with matches and thirdPlaceMatch', () => {
    const b: TournamentBracket = {
      name: 'Torneo',
      numSlots: 8,
      includeThirdPlace: true,
      matches: [],
      thirdPlaceMatch: null,
      status: BRACKET_STATUS.SETUP,
      createdAt: 1700000000000,
    };
    expect(b.name).toBe('Torneo');
    expect(b.numSlots).toBe(8);
    expect(b.includeThirdPlace).toBe(true);
    expect(b.matches).toEqual([]);
    expect(b.thirdPlaceMatch).toBeNull();
    expect(b.status).toBe(BRACKET_STATUS.SETUP);
  });

  test('numSlots accepts all valid sizes (4, 8, 16, 32)', () => {
    const sizes: Array<TournamentBracket['numSlots']> = [4, 8, 16, 32];
    expect(sizes).toEqual([4, 8, 16, 32]);
  });
});

// ── Socket events — CLIENT namespace ──────────────────────────────────

describe('BRACKET_* client→server events', () => {
  test('all bracket client events are registered', () => {
    expect(SocketEvents.CLIENT.BRACKET_CREATE).toBe('BRACKET_CREATE');
    expect(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER).toBe('BRACKET_ASSIGN_PLAYER');
    expect(SocketEvents.CLIENT.BRACKET_SET_WINNER).toBe('BRACKET_SET_WINNER');
    expect(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT).toBe('BRACKET_ASSIGN_COURT');
    expect(SocketEvents.CLIENT.BRACKET_UNDO_MATCH).toBe('BRACKET_UNDO_MATCH');
    expect(SocketEvents.CLIENT.BRACKET_GET).toBe('BRACKET_GET');
    expect(SocketEvents.CLIENT.BRACKET_RESET).toBe('BRACKET_RESET');
  });
});

// ── Socket events — SERVER namespace ───────────────────────────────────

describe('BRACKET_* server→client events', () => {
  test('all bracket server events are registered', () => {
    expect(SocketEvents.SERVER.BRACKET_STATE).toBe('BRACKET_STATE');
    expect(SocketEvents.SERVER.BRACKET_ERROR).toBe('BRACKET_ERROR');
    expect(SocketEvents.SERVER.BRACKET_RESET_CONFIRM).toBe('BRACKET_RESET_CONFIRM');
  });
});

// ── Event uniqueness ──────────────────────────────────────────────────

describe('BRACKET_* event uniqueness', () => {
  test('every bracket event is unique across the whole dictionary', () => {
    const allValues = [
      ...Object.values(SocketEvents.CLIENT),
      ...Object.values(SocketEvents.SERVER),
    ];
    const bracketEvents = [
      SocketEvents.CLIENT.BRACKET_CREATE,
      SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER,
      SocketEvents.CLIENT.BRACKET_SET_WINNER,
      SocketEvents.CLIENT.BRACKET_ASSIGN_COURT,
      SocketEvents.CLIENT.BRACKET_UNDO_MATCH,
      SocketEvents.CLIENT.BRACKET_GET,
      SocketEvents.CLIENT.BRACKET_RESET,
      SocketEvents.SERVER.BRACKET_STATE,
      SocketEvents.SERVER.BRACKET_ERROR,
      SocketEvents.SERVER.BRACKET_RESET_CONFIRM,
    ];
    for (const ev of bracketEvents) {
      const occurrences = allValues.filter((v) => v === ev).length;
      expect(occurrences).toBe(1);
    }
  });

  test('BRACKET_STATE is distinct from BRACKET_ERROR and COURT_UPDATE', () => {
    expect(SocketEvents.SERVER.BRACKET_STATE).not.toBe(SocketEvents.SERVER.BRACKET_ERROR);
    expect(SocketEvents.SERVER.BRACKET_STATE).not.toBe(SocketEvents.SERVER.COURT_UPDATE);
  });
});