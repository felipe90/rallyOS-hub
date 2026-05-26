/**
 * PadelRules — SportRules implementation for padel (15-30-40-AD, games, sets, tiebreak).
 *
 * Scoring hierarchy:
 *   Points (0→15→30→40→AD) → Game → Set (6 games, 2 lead) → Match (best of 3)
 *
 * Stateless pure logic: each method takes a GameState and returns a new one
 * without side effects. MatchEngine owns history, callbacks, and state lifecycle.
 *
 * Key rules:
 * - Deuce/advantage: at 40-40, 2pt lead required to win game
 * - Golden point: if enabled, sudden death at deuce (next point wins)
 * - Tiebreak at 6-6 games, first to 7 (or 10 for super tiebreak) with 2pt lead
 * - Serve rotates every game; in tiebreak, alternating every 2 points
 * - Side swap every odd total games; every 6 points in tiebreak
 */

import crypto from 'crypto';
import { Player, MatchEvent, SportConfig, PadelPoint, MatchWonEvent, Score, PadelMatchConfig, SPORT } from '../../../../shared/types';
import type { GameState, SportRules, ScoreResult } from './types';

// ── Constants ──────────────────────────────────────────────────────────

const POINT_ORDER: PadelPoint[] = [0, 15, 30, 40];
const DEFAULT_CONFIG: SportConfig = {
  sport: SPORT.PADEL,
  bestOf: 3,
  tiebreakPoints: 7,
  gamesPerSet: 6,
  goldenPoint: false,
};

// ── Internal State ─────────────────────────────────────────────────────

/**
 * Pure padel game state — internal model independent of MatchState shape.
 * Encoded/decoded to/from GameState (MatchState) for MatchEngine compatibility.
 */
interface PadelGameState {
  points: [PadelPoint, PadelPoint];
  games: [number, number];
  sets: [number, number];
  isTiebreak: boolean;
  tiebreakPoints: [number, number];
  serving: Player;
  goldenPoint: boolean;
  bestOf: number;
  tiebreakTarget: 7 | 10;
  gamesPerSet: number;
}

// ── State Encoding / Decoding ──────────────────────────────────────────

function padelConfig(config: import('../../../../shared/types').MatchConfig): PadelMatchConfig {
  return config as PadelMatchConfig;
}

function decodeState(state: GameState): PadelGameState {
  const cfg = padelConfig(state.config);
  return {
    points: [
      (state.padelPoints?.a ?? 0) as PadelPoint,
      (state.padelPoints?.b ?? 0) as PadelPoint,
    ],
    games: [state.score.currentSet.a, state.score.currentSet.b],
    sets: [state.score.sets.a, state.score.sets.b],
    isTiebreak: state.isTiebreak ?? false,
    tiebreakPoints: [
      state.tiebreakPoints?.a ?? 0,
      state.tiebreakPoints?.b ?? 0,
    ],
    serving: state.score.serving,
    goldenPoint: cfg.goldenPoint ?? state.goldenPoint ?? false,
    bestOf: cfg.bestOf,
    tiebreakTarget: (cfg.tiebreakPoints ?? 7) as 7 | 10,
    gamesPerSet: cfg.gamesPerSet ?? 6,
  };
}

function encodeState(state: GameState, ps: PadelGameState): void {
  state.padelPoints = { a: ps.points[0], b: ps.points[1] };
  state.score.currentSet.a = ps.games[0];
  state.score.currentSet.b = ps.games[1];
  state.score.sets.a = ps.sets[0];
  state.score.sets.b = ps.sets[1];
  state.isTiebreak = ps.isTiebreak;
  state.tiebreakPoints = { a: ps.tiebreakPoints[0], b: ps.tiebreakPoints[1] };
  state.score.serving = ps.serving;
}

// ── Helpers ────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Get the next point in progression (0→15→30→40), or null if at 40 */
function getNextPoint(current: PadelPoint): PadelPoint | null {
  if (current === 'AD') return null;
  const idx = POINT_ORDER.indexOf(current);
  if (idx < 0 || idx >= POINT_ORDER.length - 1) return null;
  return POINT_ORDER[idx + 1];
}

/** Get the previous point (reverse progression: 40→30→15→0) */
function getPrevPoint(current: PadelPoint): PadelPoint {
  if (current === 'AD') return 40;
  const idx = POINT_ORDER.indexOf(current);
  if (idx <= 0) return 0;
  return POINT_ORDER[idx - 1];
}

// ── PadelRules ─────────────────────────────────────────────────────────

export class PadelRules implements SportRules {
  readonly sport = SPORT.PADEL;

  getDefaultConfig(): SportConfig {
    return { ...DEFAULT_CONFIG };
  }

  needsHandicap(): boolean {
    return false;
  }

  validateConfig(config: SportConfig): boolean {
    if (config.sport !== SPORT.PADEL) return false;
    if (typeof config.bestOf !== 'number' || config.bestOf < 1 || config.bestOf % 2 !== 1) return false;
    if (config.tiebreakPoints !== 7 && config.tiebreakPoints !== 10) return false;
    if (typeof config.gamesPerSet !== 'number' || config.gamesPerSet < 1) return false;
    return true;
  }

  // ── Scoring ───────────────────────────────────────────────────────

  recordScore(state: GameState, player: Player): ScoreResult {
    const newState = deepClone(state);
    const ps = decodeState(newState);
    const events: MatchEvent[] = [];

    if (ps.isTiebreak) {
      this.recordTiebreakPoint(ps, player, events);
    } else {
      this.recordRegularPoint(ps, player, events);
    }

    encodeState(newState, ps);

    // Handle set history and match state updates from events
    this.applyStateFromEvents(newState, events);

    return { state: newState, events };
  }

  subtractScore(state: GameState, player: Player): GameState {
    const newState = deepClone(state);
    const ps = decodeState(newState);

    if (ps.isTiebreak) {
      this.subtractTiebreakPoint(ps, player);
    } else {
      this.subtractRegularPoint(ps, player, newState);
    }

    encodeState(newState, ps);
    return newState;
  }

  // ── Regular (non-tiebreak) scoring ────────────────────────────────

  private recordRegularPoint(ps: PadelGameState, player: Player, events: MatchEvent[]): void {
    // Check if tiebreak should start: both at gamesPerSet games, no points played yet
    if (ps.games[0] === ps.gamesPerSet && ps.games[1] === ps.gamesPerSet
        && ps.points[0] === 0 && ps.points[1] === 0) {
      ps.isTiebreak = true;
      ps.tiebreakPoints = [0, 0];
      events.push({
        type: 'TIEBREAK_START',
        targetPoints: ps.tiebreakTarget,
      });
      // Delegate to tiebreak scoring for this point
      this.recordTiebreakPoint(ps, player, events);
      return;
    }

    const pIdx = player === 'A' ? 0 : 1;
    const oIdx = player === 'A' ? 1 : 0;
    const pPoint = ps.points[pIdx];
    const oPoint = ps.points[oIdx];

    // Golden point: sudden death at deuce
    if (ps.goldenPoint && pPoint === 40 && oPoint === 40) {
      this.winGame(ps, player, events);
      return;
    }

    // Player has advantage → win game
    if (pPoint === 'AD') {
      this.winGame(ps, player, events);
      return;
    }

    // Opponent has advantage → back to deuce
    if (oPoint === 'AD') {
      ps.points[pIdx] = 40;
      ps.points[oIdx] = 40;
      events.push({ type: 'DEUCE' });
      return;
    }

    // Normal point progression
    const next = getNextPoint(pPoint);

    if (next !== null) {
      // Player advances to next level (0→15, 15→30, 30→40)
      ps.points[pIdx] = next;

      // Check if this creates deuce (both at 40)
      if (next === 40 && ps.points[oIdx] === 40) {
        events.push({ type: 'DEUCE' });
      }
      return;
    }

    // Player was at 40 — outcome depends on opponent
    if (oPoint < 40) {
      // Player at 40, opponent below 40 → game won (e.g., 40-30 → Game)
      this.winGame(ps, player, events);
    } else {
      // Both at 40 → scorer gets advantage
      ps.points[pIdx] = 'AD';
    }
  }

  private recordTiebreakPoint(ps: PadelGameState, player: Player, events: MatchEvent[]): void {
    const pIdx = player === 'A' ? 0 : 1;
    const oIdx = player === 'A' ? 1 : 0;

    // Increment tiebreak point (1, 2, 3... not 15, 30, 40)
    ps.tiebreakPoints[pIdx]++;

    const [tbA, tbB] = ps.tiebreakPoints;
    const target = ps.tiebreakTarget;

    // Check tiebreak win: first to target with 2pt lead
    if ((tbA >= target || tbB >= target) && Math.abs(tbA - tbB) >= 2) {
      // Tiebreak won — award the set
      const winner = tbA > tbB ? 'A' : 'B';
      const wIdx = winner === 'A' ? 0 : 1;

      // Tiebreak set scores: winner gets 7, loser gets 6 (or adjusted)
      const setScore: Score = {
        a: tbA > tbB ? 7 : 6,
        b: tbB > tbA ? 7 : 6,
      };

      // Award set
      ps.sets[wIdx]++;
      ps.games = [0, 0];
      ps.isTiebreak = false;
      ps.tiebreakPoints = [0, 0];

      // Rotate server for next set
      ps.serving = ps.serving === 'A' ? 'B' : 'A';

      const setNumber = ps.sets[0] + ps.sets[1];

      events.push({
        type: 'SET_WON',
        winner,
        score: setScore,
        setNumber,
      });

      // Check match win
      this.checkMatchWin(ps, events);
      return;
    }

    // Serve rotation in tiebreak: serve first point, then alternate every 2 points
    const totalPoints = tbA + tbB;
    if (totalPoints > 0 && totalPoints % 2 === 0) {
      ps.serving = ps.serving === 'A' ? 'B' : 'A';
    }
  }

  // ── Game Win ──────────────────────────────────────────────────────

  private winGame(ps: PadelGameState, winner: Player, events: MatchEvent[]): void {
    const wIdx = winner === 'A' ? 0 : 1;
    ps.games[wIdx]++;

    // Total games played AFTER this game won
    const totalGames = ps.games[0] + ps.games[1];

    // Emit GAME_WON event
    events.push({
      type: 'GAME_WON',
      winner,
      score: { a: ps.points[0], b: ps.points[1] },
      gameNumber: totalGames,
    });

    // Reset points
    ps.points = [0, 0];

    // Rotate server
    ps.serving = ps.serving === 'A' ? 'B' : 'A';

    // Check set win (may trigger tiebreak)
    this.checkSetWin(ps, events);
  }

  // ── Set Win ───────────────────────────────────────────────────────

  private checkSetWin(ps: PadelGameState, events: MatchEvent[]): void {
    const [gA, gB] = ps.games;
    const diff = Math.abs(gA - gB);
    const maxGames = Math.max(gA, gB);

    // Check if set is won: >= gamesPerSet with 2pt lead, or exceptional case (7-5)
    const setWonByLead = maxGames >= ps.gamesPerSet && diff >= 2;
    const setWonBySeven = maxGames >= 7 && diff >= 1;

    if (setWonByLead || setWonBySeven) {
      const winner = gA > gB ? 'A' : 'B';
      const wIdx = winner === 'A' ? 0 : 1;

      const setScore: Score = { a: gA, b: gB };

      ps.sets[wIdx]++;
      ps.games = [0, 0];

      const setNumber = ps.sets[0] + ps.sets[1];

      events.push({
        type: 'SET_WON',
        winner,
        score: setScore,
        setNumber,
      });

      // Rotate server for new set
      ps.serving = ps.serving === 'A' ? 'B' : 'A';

      // Check match win
      this.checkMatchWin(ps, events);
      return;
    }

    // Check if tiebreak is triggered (both at gamesPerSet games)
    if (gA === ps.gamesPerSet && gB === ps.gamesPerSet) {
      ps.isTiebreak = true;
      ps.tiebreakPoints = [0, 0];
      events.push({
        type: 'TIEBREAK_START',
        targetPoints: ps.tiebreakTarget,
      });
      // Note: serving already rotated in winGame; tiebreak server = current serving player
    }
  }

  // ── Match Win ─────────────────────────────────────────────────────

  private checkMatchWin(ps: PadelGameState, events: MatchEvent[]): void {
    const setsNeeded = Math.ceil(ps.bestOf / 2);
    if (ps.sets[0] >= setsNeeded || ps.sets[1] >= setsNeeded) {
      const winner = ps.sets[0] > ps.sets[1] ? 'A' : 'B';
      events.push({
        type: 'MATCH_WON',
        winner,
        finalScore: [],
        sets: { a: ps.sets[0], b: ps.sets[1] },
      });
    }
  }

  // ── State Apply (after encoding) ──────────────────────────────────

  /**
   * After encoding the PadelGameState back to GameState, apply side effects
   * for events that the MatchEngine expects to see in state (status, winner, setHistory).
   */
  private applyStateFromEvents(newState: GameState, events: MatchEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'GAME_WON':
          // Side swap on odd game numbers (1, 3, 5...)
          if (event.gameNumber % 2 === 1) {
            newState.swappedSides = !newState.swappedSides;
          }
          break;
        case 'SET_WON':
          newState.setHistory.push(event.score);
          // Side swap when a new set starts
          newState.swappedSides = !newState.swappedSides;
          break;
        case 'MATCH_WON':
          newState.status = 'FINISHED';
          newState.winner = event.winner;
          break;
        case 'TIEBREAK_START':
          // No additional state changes
          break;
      }
    }
  }

  // ── Subtractions (Undo) ──────────────────────────────────────────

  private subtractRegularPoint(ps: PadelGameState, player: Player, currentState: GameState): void {
    const pIdx = player === 'A' ? 0 : 1;
    const oIdx = player === 'A' ? 1 : 0;
    const pPoint = ps.points[pIdx];
    const oPoint = ps.points[oIdx];

    // If both at 0-0 and games > 0, we need to undo a game win
    if (pPoint === 0 && oPoint === 0) {
      if ((player === 'A' && ps.games[0] > 0) || (player === 'B' && ps.games[1] > 0)) {
        // Undo the game win: decrement games, restore AD state
        if (player === 'A') ps.games[0]--;
        else ps.games[1]--;

        // Restore to AD for the scorer (the state before game was won)
        ps.points[pIdx] = 'AD' as PadelPoint;
        ps.points[oIdx] = 40;

        // Undo serve rotation
        ps.serving = ps.serving === 'A' ? 'B' : 'A';
        return;
      }
    }

    // Player has advantage → back to deuce
    if (pPoint === 'AD') {
      ps.points[pIdx] = 40;
      return;
    }

    // Both at 40 (deuce) — revert the player's point one step (40→30)
    if (pPoint === 40 && oPoint === 40) {
      ps.points[pIdx] = 30;
      return;
    }

    // Normal point subtraction
    ps.points[pIdx] = getPrevPoint(pPoint);
  }

  private subtractTiebreakPoint(ps: PadelGameState, player: Player): void {
    const pIdx = player === 'A' ? 0 : 1;
    ps.tiebreakPoints[pIdx] = Math.max(0, ps.tiebreakPoints[pIdx] - 1);
  }

  // ── Query Methods ─────────────────────────────────────────────────

  isSetComplete(state: GameState): boolean {
    const ps = decodeState(state);
    const [gA, gB] = ps.games;
    const diff = Math.abs(gA - gB);
    const maxGames = Math.max(gA, gB);

    const setWonByLead = maxGames >= ps.gamesPerSet && diff >= 2;
    const setWonBySeven = maxGames >= 7 && diff >= 1;

    return (setWonByLead || setWonBySeven) && !ps.isTiebreak;
  }

  isMatchComplete(state: GameState): boolean {
    const ps = decodeState(state);
    const setsNeeded = Math.ceil(ps.bestOf / 2);
    return ps.sets[0] >= setsNeeded || ps.sets[1] >= setsNeeded;
  }

  updateServing(state: GameState): Player {
    return state.score.serving;
  }

  checkSideSwap(state: GameState): boolean {
    const totalGames = state.score.currentSet.a + state.score.currentSet.b;
    return totalGames > 0 && totalGames % 2 === 1;
  }

  formatDisplayScore(state: GameState): import('../../../../shared/types').PadelPointDisplay {
    const ps = decodeState(state);

    let leftPoint: string;
    let rightPoint: string;

    if (ps.isTiebreak) {
      leftPoint = String(ps.tiebreakPoints[0]);
      rightPoint = String(ps.tiebreakPoints[1]);
    } else {
      leftPoint = ps.points[0] === 'AD' ? 'AD' : String(ps.points[0]);
      rightPoint = ps.points[1] === 'AD' ? 'AD' : String(ps.points[1]);
    }

    return {
      type: SPORT.PADEL,
      leftPoint,
      rightPoint,
      leftGames: ps.games[0],
      rightGames: ps.games[1],
      leftSets: ps.sets[0],
      rightSets: ps.sets[1],
    };
  }
}
