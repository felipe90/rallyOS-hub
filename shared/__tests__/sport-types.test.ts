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
  SportDisplayScore,
  TTPointDisplay,
  PadelPointDisplay,
  MatchConfig,
  Score,
  MatchState,
} from '../types';

// ── Sport ────────────────────────────────────────────────────────────

describe('Sport (literal union)', () => {
  test('accepts "tableTennis"', () => {
    const s: Sport = 'tableTennis';
    expect(s).toBe('tableTennis');
  });

  test('accepts "padel"', () => {
    const s: Sport = 'padel';
    expect(s).toBe('padel');
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
      sport: 'tableTennis',
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    };
    expect(config.sport).toBe('tableTennis');
    expect(config.pointsPerSet).toBe(11);
    expect(config.bestOf).toBe(3);
    expect(config.minDifference).toBe(2);
  });

  test('TableTennisConfig accepts optional handicap', () => {
    const config: TableTennisConfig = {
      sport: 'tableTennis',
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
      sport: 'padel',
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    expect(config.sport).toBe('padel');
    expect(config.bestOf).toBe(3);
    expect(config.tiebreakPoints).toBe(7);
    expect(config.gamesPerSet).toBe(6);
  });

  test('PadelConfig accepts optional goldenPoint', () => {
    const config: PadelConfig = {
      sport: 'padel',
      bestOf: 3,
      tiebreakPoints: 10,
      gamesPerSet: 6,
      goldenPoint: true,
    };
    expect(config.goldenPoint).toBe(true);
  });

  test('SportConfig discriminates TableTennisConfig', () => {
    const config: SportConfig = {
      sport: 'tableTennis',
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    };
    if (config.sport === 'tableTennis') {
      expect(config.pointsPerSet).toBe(11);
    }
  });

  test('SportConfig discriminates PadelConfig', () => {
    const config: SportConfig = {
      sport: 'padel',
      bestOf: 3,
      tiebreakPoints: 7,
      gamesPerSet: 6,
    };
    if (config.sport === 'padel') {
      expect(config.gamesPerSet).toBe(6);
    }
  });
});

// ── SportDisplayScore (discriminated union) ──────────────────────────

describe('SportDisplayScore (discriminated union)', () => {
  test('TTPointDisplay has correct shape', () => {
    const display: TTPointDisplay = {
      type: 'tableTennis',
      leftScore: 11,
      rightScore: 8,
      leftSets: 1,
      rightSets: 0,
    };
    expect(display.type).toBe('tableTennis');
    expect(display.leftScore).toBe(11);
    expect(display.rightScore).toBe(8);
    expect(display.leftSets).toBe(1);
    expect(display.rightSets).toBe(0);
  });

  test('PadelPointDisplay has correct shape', () => {
    const display: PadelPointDisplay = {
      type: 'padel',
      leftPoint: '30',
      rightPoint: '40',
      leftGames: 3,
      rightGames: 2,
      leftSets: 0,
      rightSets: 1,
    };
    expect(display.type).toBe('padel');
    expect(display.leftPoint).toBe('30');
    expect(display.rightPoint).toBe('40');
    expect(display.leftGames).toBe(3);
    expect(display.rightGames).toBe(2);
    expect(display.leftSets).toBe(0);
    expect(display.rightSets).toBe(1);
  });

  test('SportDisplayScore discriminates TTPointDisplay', () => {
    const display: SportDisplayScore = {
      type: 'tableTennis',
      leftScore: 11,
      rightScore: 8,
      leftSets: 0,
      rightSets: 0,
    };
    if (display.type === 'tableTennis') {
      expect(display.leftScore).toBe(11);
    }
  });

  test('SportDisplayScore discriminates PadelPointDisplay', () => {
    const display: SportDisplayScore = {
      type: 'padel',
      leftPoint: '15',
      rightPoint: '0',
      leftGames: 1,
      rightGames: 0,
      leftSets: 0,
      rightSets: 0,
    };
    if (display.type === 'padel') {
      expect(display.leftPoint).toBe('15');
    }
  });
});

// ── MatchConfig extended ─────────────────────────────────────────────

describe('MatchConfig.sport (optional)', () => {
  test('MatchConfig accepts sport field', () => {
    const config: MatchConfig = {
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
      sport: 'padel',
    };
    expect(config.sport).toBe('padel');
  });

  test('MatchConfig without sport defaults to undefined', () => {
    const config: MatchConfig = {
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    };
    expect(config.sport).toBeUndefined();
  });
});

// ── Score.detailScore ────────────────────────────────────────────────

describe('Score.detailScore', () => {
  test('Score with detailScore for padel', () => {
    const score: Score = {
      a: 0,
      b: 0,
      detailScore: {
        type: 'padel',
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
    if (score.detailScore?.type === 'padel') {
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

// ── MatchState.sport ─────────────────────────────────────────────────

describe('MatchState.sport', () => {
  const baseConfig: MatchConfig = {
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
  };

  test('MatchState with sport field', () => {
    const state: MatchState = {
      config: baseConfig,
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { a: 0, b: 0 },
        serving: 'A',
      },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: 'tableTennis',
    };
    expect(state.sport).toBe('tableTennis');
  });
});
