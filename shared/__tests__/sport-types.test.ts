/**
 * Sport type system tests — Phase 1
 *
 * Covers: Sport union, PadelPoint, SportConfig discriminated union,
 * SportDisplayScore discriminated union, and MatchConfig/MatchState/Score extensions.
 */

import {
  Sport,
  PadelPoint,
  SportConfig,
  TableTennisConfig,
  PadelConfig,
  TableTennisMatchConfig,
  PadelMatchConfig,
  SportDisplayScore,
  TTPointDisplay,
  PadelPointDisplay,
  MatchConfig,
  Score,
  MatchState,
  TableTennisMatchState,
  PadelMatchState,
  isTableTennisConfig,
  isPadelConfig,
  isTableTennisState,
  isPadelState,
  SPORT,
} from '../types';

// ── Sport ────────────────────────────────────────────────────────────

describe('Sport (literal union)', () => {
  test('accepts SPORT.TABLE_TENNIS', () => {
    const s: Sport = SPORT.TABLE_TENNIS;
    expect(s).toBe(SPORT.TABLE_TENNIS);
  });

  test('accepts SPORT.PADEL', () => {
    const s: Sport = SPORT.PADEL;
    expect(s).toBe(SPORT.PADEL);
  });
});

// ── PadelPoint ───────────────────────────────────────────────────────

describe('PadelPoint (union literal)', () => {
  test('accepts 0', () => {
    const p: PadelPoint = 0;
    expect(p).toBe(0);
  });

  test('accepts 15', () => {
    const p: PadelPoint = 15;
    expect(p).toBe(15);
  });

  test('accepts 30', () => {
    const p: PadelPoint = 30;
    expect(p).toBe(30);
  });

  test('accepts 40', () => {
    const p: PadelPoint = 40;
    expect(p).toBe(40);
  });

  test('accepts "AD"', () => {
    const p: PadelPoint = 'AD';
    expect(p).toBe('AD');
  });
});

// ── SportConfig (discriminated union) ────────────────────────────────

describe('SportConfig (discriminated union)', () => {
  test('TableTennisConfig has required fields', () => {
    const config: TableTennisConfig = {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    };
    expect(config.sport).toBe(SPORT.TABLE_TENNIS);
    expect(config.pointsPerSet).toBe(11);
    expect(config.bestOf).toBe(3);
    expect(config.minDifference).toBe(2);
  });

  test('TableTennisConfig accepts optional handicap', () => {
    const config: TableTennisConfig = {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 5,
      minDifference: 2,
      handicapA: 2,
      handicapB: 0,
    };
    expect(config.handicapA).toBe(2);
    expect(config.handicapB).toBe(0);
  });

  test('PadelConfig has required fields', () => {
    const config: PadelConfig = {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    expect(config.sport).toBe(SPORT.PADEL);
    expect(config.bestOf).toBe(3);
    expect(config.tiebreakPoints).toBe(7);
    expect(config.gamesPerSet).toBe(6);
  });

  test('PadelConfig accepts optional goldenPoint', () => {
    const config: PadelConfig = {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 10,
      gamesPerSet: 6,
      goldenPoint: true,
    };
    expect(config.goldenPoint).toBe(true);
  });

  test('SportConfig discriminates TableTennisConfig', () => {
    const config: SportConfig = {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    };
    if (config.sport === SPORT.TABLE_TENNIS) {
      expect(config.pointsPerSet).toBe(11);
    }
  });

  test('SportConfig discriminates PadelConfig', () => {
    const config: SportConfig = {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    if (config.sport === SPORT.PADEL) {
      expect(config.gamesPerSet).toBe(6);
    }
  });
});

// ── SportDisplayScore (discriminated union) ──────────────────────────

describe('SportDisplayScore (discriminated union)', () => {
  test('TTPointDisplay has correct shape', () => {
    const display: TTPointDisplay = {
      type: SPORT.TABLE_TENNIS,
      leftScore: 11,
      rightScore: 8,
      leftSets: 1,
      rightSets: 0,
    };
    expect(display.type).toBe(SPORT.TABLE_TENNIS);
    expect(display.leftScore).toBe(11);
    expect(display.rightScore).toBe(8);
    expect(display.leftSets).toBe(1);
    expect(display.rightSets).toBe(0);
  });

  test('PadelPointDisplay has correct shape', () => {
    const display: PadelPointDisplay = {
      type: SPORT.PADEL,
      leftPoint: '30',
      rightPoint: '40',
      leftGames: 3,
      rightGames: 2,
      leftSets: 0,
      rightSets: 1,
    };
    expect(display.type).toBe(SPORT.PADEL);
    expect(display.leftPoint).toBe('30');
    expect(display.rightPoint).toBe('40');
    expect(display.leftGames).toBe(3);
    expect(display.rightGames).toBe(2);
    expect(display.leftSets).toBe(0);
    expect(display.rightSets).toBe(1);
  });

  test('SportDisplayScore discriminates TTPointDisplay', () => {
    const display: SportDisplayScore = {
      type: SPORT.TABLE_TENNIS,
      leftScore: 11,
      rightScore: 8,
      leftSets: 0,
      rightSets: 0,
    };
    if (display.type === SPORT.TABLE_TENNIS) {
      expect(display.leftScore).toBe(11);
    }
  });

  test('SportDisplayScore discriminates PadelPointDisplay', () => {
    const display: SportDisplayScore = {
      type: SPORT.PADEL,
      leftPoint: '15',
      rightPoint: '0',
      leftGames: 1,
      rightGames: 0,
      leftSets: 0,
      rightSets: 0,
    };
    if (display.type === SPORT.PADEL) {
      expect(display.leftPoint).toBe('15');
    }
  });
});

// ── MatchConfig (Discriminated Union) ─────────────────────────────────

describe('MatchConfig (discriminated union)', () => {
  test('TableTennisMatchConfig has sport=SPORT.TABLE_TENNIS', () => {
    const config: TableTennisMatchConfig = {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    };
    expect(config.sport).toBe(SPORT.TABLE_TENNIS);
    expect(config.pointsPerSet).toBe(11);
  });

  test('PadelMatchConfig has sport=SPORT.PADEL', () => {
    const config: PadelMatchConfig = {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    expect(config.sport).toBe(SPORT.PADEL);
    expect(config.tiebreakPoints).toBe(7);
  });

  test('MatchConfig discriminates to TT after narrow', () => {
    const config: MatchConfig = {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    };
    if (isTableTennisConfig(config)) {
      expect(config.pointsPerSet).toBe(11);
    }
  });

  test('MatchConfig discriminates to padel after narrow', () => {
    const config: MatchConfig = {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    if (isPadelConfig(config)) {
      expect(config.tiebreakPoints).toBe(7);
    }
  });

  test('isTableTennisConfig defaults to true when sport absent', () => {
    const config = { pointsPerSet: 11, bestOf: 3, minDifference: 2 };
    expect(isTableTennisConfig(config)).toBe(true);
  });

  test('isPadelConfig returns true only when sport is padel', () => {
    const config: MatchConfig = { sport: SPORT.PADEL, bestOf: 3, tiebreakPoints: 7, gamesPerSet: 6 };
    expect(isPadelConfig(config)).toBe(true);
    const ttConfig: MatchConfig = { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 };
    expect(isPadelConfig(ttConfig)).toBe(false);
  });
});

// ── Score.detailScore ────────────────────────────────────────────────

describe('Score.detailScore', () => {
  test('Score with detailScore for padel', () => {
    const score: Score = {
      a: 0,
      b: 0,
      detailScore: {
        type: SPORT.PADEL,
        leftPoint: '0',
        rightPoint: '0',
        leftGames: 0,
        rightGames: 0,
        leftSets: 0,
        rightSets: 0,
      },
    };
    expect(score.a).toBe(0);
    expect(score.b).toBe(0);
    expect(score.detailScore).toBeDefined();
    if (score.detailScore?.type === SPORT.PADEL) {
      expect(score.detailScore.leftPoint).toBe('0');
    }
  });

  test('Score without detailScore (backward compat)', () => {
    const score: Score = { a: 5, b: 3 };
    expect(score.a).toBe(5);
    expect(score.b).toBe(3);
    expect(score.detailScore).toBeUndefined();
  });
});

// ── MatchState (Discriminated Union) ─────────────────────────────────

describe('MatchState (discriminated union)', () => {
  const ttConfig: TableTennisMatchConfig = {
    sport: SPORT.TABLE_TENNIS,
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
  };

  test('TableTennisMatchState has correct shape', () => {
    const state: TableTennisMatchState = {
      config: ttConfig,
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
    };
    expect(state.sport).toBe(SPORT.TABLE_TENNIS);
    expect(state.score.currentSet.a).toBe(0);
  });

  test('PadelMatchState has correct shape', () => {
    const pConfig: PadelMatchConfig = {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    const state: PadelMatchState = {
      config: pConfig,
      padelPoints: { a: 0, b: 0 },
      games: { a: 0, b: 0 },
      sets: { a: 0, b: 0 },
      isTiebreak: false,
      tiebreakPoints: { a: 0, b: 0 },
      tiebreakTarget: 7,
      goldenPoint: false,
      serving: 'A',
      setHistory: [],
      swappedSides: false,
      midSetSwapped: false,
      status: 'LIVE',
      winner: null,
      sport: SPORT.PADEL,
    };
    expect(state.sport).toBe(SPORT.PADEL);
    expect(state.padelPoints.a).toBe(0);
  });

  test('MatchState discriminates via type guard', () => {
    const state: MatchState = {
      config: ttConfig,
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 11, b: 5 }, serving: 'A' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
    };
    if (isTableTennisState(state)) {
      expect(state.score.currentSet.a).toBe(11);
    }
    expect(isPadelState(state)).toBe(false);
  });

  test('isTableTennisState returns true for TT state', () => {
    const state: MatchState = {
      config: ttConfig,
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
    };
    expect(isTableTennisState(state)).toBe(true);
    expect(isPadelState(state)).toBe(false);
  });

  test('isPadelState returns true for padel state', () => {
    const pConfig: PadelMatchConfig = {
      sport: SPORT.PADEL,
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    const state: PadelMatchState = {
      config: pConfig,
      padelPoints: { a: 0, b: 0 },
      games: { a: 0, b: 0 },
      sets: { a: 0, b: 0 },
      isTiebreak: false,
      tiebreakPoints: { a: 0, b: 0 },
      tiebreakTarget: 7,
      goldenPoint: false,
      serving: 'A',
      setHistory: [],
      swappedSides: false,
      midSetSwapped: false,
      status: 'LIVE',
      winner: null,
      sport: SPORT.PADEL,
    };
    expect(isPadelState(state)).toBe(true);
    expect(isTableTennisState(state)).toBe(false);
  });
});
