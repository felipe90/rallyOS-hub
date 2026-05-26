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
  MatchState,
  MatchConfigExtended,
  MatchStateExtended,
  ScoreChange,
  MatchEvent,
  TableStatus
} from './types';
import type { SportRules, GameState, ScoreResult } from './sports/types';
import { TableTennisRules } from './sports/tableTennis.rules';

export type { Player, Score, MatchConfig, MatchState, MatchConfigExtended, MatchStateExtended };

export const INITIAL_CONFIG: MatchConfig = {
  pointsPerSet: 11,
  bestOf: 3,
  minDifference: 2,
};

interface InternalMatchState extends MatchState {
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
    const resolvedConfig: MatchConfig = {
      ...INITIAL_CONFIG,
      ...config,
      sport: config.sport || this.rules.sport,
    };
    this.state = this.getInitialState(resolvedConfig);
  }

  private getInitialState(config: MatchConfig): InternalMatchState {
    // Apply handicap as initial score if provided
    const initialScoreA = config.initialScore?.a || config.handicapA || 0;
    const initialScoreB = config.initialScore?.b || config.handicapB || 0;
    
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
      sport: config.sport || 'tableTennis',
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
    return {
      ...JSON.parse(JSON.stringify(this.state)),
      tableId: this.state.tableId || '',
      tableName: this.state.tableName || '',
      playerNames: this.state.playerNames || { a: 'Player A', b: 'Player B' },
      history: this.state.history,
      undoAvailable: this.state.undoAvailable
    };
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

    engine.state = {
      config: { ...state.config },
      score: JSON.parse(JSON.stringify(state.score)),
      swappedSides: state.swappedSides,
      midSetSwapped: state.midSetSwapped,
      setHistory: state.setHistory.map((s) => ({ ...s })),
      status: state.status,
      winner: state.winner,
      sport: state.sport || 'tableTennis',
      tableId: state.tableId || '',
      tableName: state.tableName || '',
      playerNames: state.playerNames
        ? { ...state.playerNames }
        : { a: 'Player A', b: 'Player B' },
      history: (state.history || []).map((h) => ({
        ...h,
        pointsBefore: { ...h.pointsBefore },
        pointsAfter: { ...h.pointsAfter },
      })),
      undoAvailable: (state.history || []).length > 0,
    };

    return engine;
  }
}
