/**
 * MatchEngine — Thin orchestrator that delegates sport-specific scoring
 * to a SportRules implementation (Strategy pattern).
 *
 * MatchEngine owns:
 * - State container (InternalMatchState)
 * - History/undo tracking
 * - Event callbacks
 * - Player identity (names, table IDs)
 *
 * SportRules own:
 * - Scoring logic (recordScore, subtractScore)
 * - Set/Match completion detection
 * - Serving rotation
 * - Side-swap decisions
 *
 * Phase 3: Refactored to thin delegator. Constructor accepts optional
 * SportRules (defaults to TableTennisRules for backward compat).
 */

import crypto from 'crypto';
import {
  Player,
  Score,
  MatchConfig,
  TableTennisMatchConfig,
  PadelMatchConfig,
  MatchConfigExtended,
  MatchState,
  MatchStateExtended,
  ScoreChange,
  MatchEvent,
  TableStatus,
  PadelPoint,
  SPORT,
} from './types';
import type { SportRules, GameState, ScoreResult } from './sports/types';
import { TableTennisRules } from './sports/tableTennis.rules';

export type { Player, Score, MatchConfig, MatchConfigExtended, MatchState, MatchStateExtended };

export const INITIAL_CONFIG: TableTennisMatchConfig = {
  sport: SPORT.TABLE_TENNIS,
  pointsPerSet: 11,
  bestOf: 3,
  minDifference: 2,
};

/**
 * Internal match state — flat superset interface used for runtime state.
 * Conversion to the discriminated union MatchStateExtended happens in getState().
 */
interface InternalMatchState {
  config: MatchConfig;
  score: { sets: Score; currentSet: Score; serving: Player };
  swappedSides: boolean;
  midSetSwapped: boolean;
  setHistory: Score[];
  status: TableStatus;
  winner: Player | null;
  sport: import('./types').Sport;
  /** Padel-specific: current point values (0, 15, 30, 40, AD) */
  padelPoints?: { a: PadelPoint; b: PadelPoint };
  /** Padel-specific: whether current game is a tiebreak */
  isTiebreak?: boolean;
  /** Padel-specific: current tiebreak point counts */
  tiebreakPoints?: { a: number; b: number };
  /** Padel-specific: golden point / sudden death enabled */
  goldenPoint?: boolean;
  tableId?: string;
  tableName?: string;
  playerNames: { a: string; b: string };
  history: ScoreChange[];
  undoAvailable: boolean;
}

export class MatchEngine {
  private state: InternalMatchState;
  private rules: SportRules;
  private onMatchEvent?: (event: MatchEvent) => void;

  constructor(config: Partial<MatchConfig> = {}, rules?: SportRules) {
    this.rules = rules || new TableTennisRules();
    const resolvedConfig = this.resolveConfig(config);
    this.state = this.getInitialState(resolvedConfig);
  }

  /**
   * Resolve a partial config into a full MatchConfig discriminated union.
   * Defaults to table tennis when sport is absent or unrecognized.
   */
  private resolveConfig(config: Partial<MatchConfig>): MatchConfig {
    const sport = config.sport || this.rules.sport || SPORT.TABLE_TENNIS;
    if (sport === SPORT.PADEL) {
      return {
        sport: SPORT.PADEL,
        bestOf: config.bestOf ?? 3,
        tiebreakPoints: (config as any).tiebreakPoints ?? 7,
        gamesPerSet: (config as any).gamesPerSet ?? 6,
        goldenPoint: (config as any).goldenPoint ?? false,
        initialScore: config.initialScore,
        initialServer: config.initialServer,
      } as PadelMatchConfig;
    }
    return {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: (config as any).pointsPerSet ?? 11,
      bestOf: config.bestOf ?? 3,
      minDifference: (config as any).minDifference ?? 2,
      handicapA: (config as any).handicapA,
      handicapB: (config as any).handicapB,
      initialScore: config.initialScore,
      initialServer: config.initialServer,
    } as TableTennisMatchConfig;
  }

  private getInitialState(config: MatchConfig): InternalMatchState {
    const sport = config.sport || SPORT.TABLE_TENNIS;
    
    // Extract handicap/initial score based on sport
    let initialScoreA = config.initialScore?.a || 0;
    let initialScoreB = config.initialScore?.b || 0;
    
    if (sport === SPORT.TABLE_TENNIS) {
      const ttConfig = config as TableTennisMatchConfig;
      initialScoreA = initialScoreA || ttConfig.handicapA || 0;
      initialScoreB = initialScoreB || ttConfig.handicapB || 0;
    }
    
    return {
      config,
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { 
          a: initialScoreA, 
          b: initialScoreB 
        },
        serving: config.initialServer || 'A',
      },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'WAITING' as TableStatus,
      winner: null,
      sport,
      tableId: '',
      tableName: '',
      playerNames: { a: 'Player A', b: 'Player B' },
      history: [],
      undoAvailable: false,
    };
  }

  /**
   * Extract the GameState portion (shared state) from the full InternalMatchState.
   * This is what gets passed to SportRules methods.
   */
  private extractGameState(): GameState {
    return {
      config: this.state.config,
      score: {
        sets: { ...this.state.score.sets },
        currentSet: { ...this.state.score.currentSet },
        serving: this.state.score.serving,
      },
      swappedSides: this.state.swappedSides,
      midSetSwapped: this.state.midSetSwapped,
      setHistory: this.state.setHistory.map(s => ({ ...s })),
      status: this.state.status,
      winner: this.state.winner,
      sport: this.state.sport,
      // Pass through padel-specific fields for SportRules
      padelPoints: this.state.padelPoints ? { ...this.state.padelPoints } : undefined,
      isTiebreak: this.state.isTiebreak,
      tiebreakPoints: this.state.tiebreakPoints ? { ...this.state.tiebreakPoints } : undefined,
      goldenPoint: this.state.goldenPoint,
    };
  }

  /**
   * Merge a GameState result back into InternalMatchState,
   * preserving runtime-only fields.
   */
  private mergeGameState(gameState: GameState): void {
    this.state.config = gameState.config;
    this.state.score = {
      sets: { ...gameState.score.sets },
      currentSet: { ...gameState.score.currentSet },
      serving: gameState.score.serving,
    };
    this.state.swappedSides = gameState.swappedSides;
    this.state.midSetSwapped = gameState.midSetSwapped;
    this.state.setHistory = gameState.setHistory.map(s => ({ ...s }));
    this.state.status = gameState.status;
    this.state.winner = gameState.winner;
    this.state.sport = gameState.sport;
    // Merge padel-specific fields
    this.state.padelPoints = gameState.padelPoints ? { ...gameState.padelPoints } : undefined;
    this.state.isTiebreak = gameState.isTiebreak;
    this.state.tiebreakPoints = gameState.tiebreakPoints ? { ...gameState.tiebreakPoints } : undefined;
    this.state.goldenPoint = gameState.goldenPoint;
  }

  public setEventCallback(cb: (event: MatchEvent) => void) {
    this.onMatchEvent = cb;
  }

  public reset(): void {
    // Reset to initial state with default player names
    this.state = this.getInitialState(INITIAL_CONFIG);
  }

  public setPlayerNames(names: { a: string; b: string }): MatchStateExtended {
    this.state.playerNames = names;
    return this.getState();
  }

  public setTableId(id: string, name: string): void {
    this.state.tableId = id;
    this.state.tableName = name;
  }

  private addToHistory(player: Player | undefined, action: 'POINT' | 'CORRECTION' | 'SET_WON', pointsBefore: Score, pointsAfter: Score, setNumber?: number): void {
    this.state.history.push({
      id: crypto.randomUUID(),
      player,
      action,
      pointsBefore: JSON.parse(JSON.stringify(pointsBefore)),
      pointsAfter: JSON.parse(JSON.stringify(pointsAfter)),
      setNumber,
      timestamp: Date.now(),
    });
    
    if (this.state.history.length > 20) {
      this.state.history.shift();
    }
    this.state.undoAvailable = this.state.history.length > 0;
  }

  public canUndo(): boolean {
    return this.state.history.length > 0 && this.state.status === 'LIVE';
  }

  public undoLast(): MatchStateExtended {
    
    const lastChange = this.state.history.pop()!;
    this.state.score.currentSet = { ...lastChange.pointsBefore };
    this.state.score.serving = this.rules.updateServing(this.extractGameState());
    this.state.undoAvailable = this.state.history.length > 0;
    
    return this.getState();
  }

  public startMatch() {
    this.state.status = 'LIVE';
    return this.getState();
  }

  public recordPoint(player: Player): MatchStateExtended {
    if (this.state.status !== 'LIVE') return this.getState();

    const pointsBefore = { ...this.state.score.currentSet };
    
    // Delegate scoring to sport rules
    const gameState = this.extractGameState();
    const result: ScoreResult = this.rules.recordScore(gameState, player);
    this.mergeGameState(result.state);

    // History tracking stays in MatchEngine (common to all sports)
    this.addToHistory(player, 'POINT', pointsBefore, { ...this.state.score.currentSet });
    
    // Emit any events from rules through the callback
    if (this.onMatchEvent) {
      for (const event of result.events) {
        this.onMatchEvent(event);
      }
    }

    return this.getState();
  }

  public subtractPoint(player: Player): MatchStateExtended {
    if (this.state.status !== 'LIVE') return this.getState();

    const pointsBefore = { ...this.state.score.currentSet };
    
    // Delegate to sport rules
    const gameState = this.extractGameState();
    const newState = this.rules.subtractScore(gameState, player);
    this.mergeGameState(newState);

    this.addToHistory(player, 'CORRECTION', pointsBefore, { ...this.state.score.currentSet });

    return this.getState();
  }

  public setServer(player: Player): MatchStateExtended {
    this.state.score.serving = player;
    return this.getState();
  }

  public swapSides(): MatchStateExtended {
    this.state.swappedSides = !this.state.swappedSides;
    return this.getState();
  }

  public getState(): MatchStateExtended {
    const base = JSON.parse(JSON.stringify(this.state));
    const common = {
      tableId: this.state.tableId || '',
      tableName: this.state.tableName || '',
      playerNames: this.state.playerNames || { a: 'Player A', b: 'Player B' },
      history: this.state.history,
      undoAvailable: this.state.undoAvailable,
    };

    // Build discriminated union based on sport
    if (this.state.sport === SPORT.PADEL) {
      return {
        config: base.config,
        status: base.status,
        winner: base.winner,
        swappedSides: base.swappedSides,
        midSetSwapped: base.midSetSwapped,
        sport: SPORT.PADEL,
        padelPoints: base.padelPoints ?? { a: 0, b: 0 },
        games: base.score?.currentSet ?? { a: 0, b: 0 },
        sets: base.score?.sets ?? { a: 0, b: 0 },
        isTiebreak: base.isTiebreak ?? false,
        tiebreakPoints: base.tiebreakPoints ?? { a: 0, b: 0 },
        tiebreakTarget: base.config?.tiebreakPoints ?? 7,
        goldenPoint: base.goldenPoint ?? false,
        serving: base.score?.serving ?? 'A',
        setHistory: base.setHistory ?? [],
        ...common,
      } as MatchStateExtended;
    }

    // Default: table tennis
    return {
      config: base.config,
      status: base.status,
      winner: base.winner,
      swappedSides: base.swappedSides,
      midSetSwapped: base.midSetSwapped,
      sport: SPORT.TABLE_TENNIS,
      score: base.score ?? { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
      setHistory: base.setHistory ?? [],
      ...common,
    } as MatchStateExtended;
  }

  public getConfig(): MatchConfig {
    return { ...this.state.config };
  }

  /**
   * Static factory: reconstruct a MatchEngine from a previously saved state.
   *
   * Creates a new MatchEngine instance and restores all internal state from
   * the provided MatchStateExtended. The engine is fully operational after
   * restoration — recordPoint, undo, etc. will work as expected.
   *
   * @param state  Serialized state (from getState() or PersistedMatchState).
   *               history[] defaults to empty array if absent.
   *               undoAvailable is recalculated from history length.
   * @param rules  Optional SportRules instance. If omitted, defaults to
   *               TableTennisRules (backward-compatible behavior).
   * @returns A new MatchEngine instance with restored state.
   */
  public static fromState(state: MatchStateExtended, rules?: SportRules): MatchEngine {
    const engine = new MatchEngine(state.config, rules);

    // Handle both discriminated union variants + legacy flat format
    const sport = state.sport || SPORT.TABLE_TENNIS;
    let score: { sets: Score; currentSet: Score; serving: Player };
    let padelExtras: Partial<InternalMatchState> = {};

    if (sport === SPORT.PADEL) {
      const ps = state as MatchStateExtended & { padelPoints?: any; games?: any; sets?: any; serving?: any; isTiebreak?: any; tiebreakPoints?: any; goldenPoint?: any };
      score = {
        sets: ps.sets ?? { a: 0, b: 0 },
        currentSet: ps.games ?? { a: 0, b: 0 },
        serving: ps.serving ?? 'A',
      };
      padelExtras = {
        padelPoints: ps.padelPoints ? { ...ps.padelPoints as any } : { a: 0 as any, b: 0 as any },
        isTiebreak: ps.isTiebreak ?? false,
        tiebreakPoints: ps.tiebreakPoints ? { ...ps.tiebreakPoints as any } : { a: 0, b: 0 },
        goldenPoint: ps.goldenPoint ?? false,
      };
    } else {
      score = JSON.parse(JSON.stringify((state as any).score ?? { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' }));
    }

    engine.state = {
      config: { ...state.config },
      score,
      swappedSides: state.swappedSides,
      midSetSwapped: state.midSetSwapped,
      setHistory: (state as any).setHistory ? (state as any).setHistory.map((s: any) => ({ ...s })) : [],
      status: state.status,
      winner: state.winner,
      sport,
      ...padelExtras,
      tableId: (state as any).tableId || '',
      tableName: (state as any).tableName || '',
      playerNames: (state as any).playerNames
        ? { ...(state as any).playerNames }
        : { a: 'Player A', b: 'Player B' },
      history: ((state as any).history || []).map((h: any) => ({
        ...h,
        pointsBefore: { ...h.pointsBefore },
        pointsAfter: { ...h.pointsAfter },
      })),
      undoAvailable: ((state as any).history || []).length > 0,
    };

    return engine;
  }
}
