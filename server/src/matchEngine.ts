import { 
  Player, 
  Score, 
  MatchConfig, 
  MatchState, 
  MatchConfigExtended,
  MatchStateExtended,
  ScoreChange,
  MatchEvent,
  SetWonEvent,
  MatchWonEvent,
  TableStatus
} from './types';

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
  private onMatchEvent?: (event: MatchEvent) => void;

  constructor(config: MatchConfig = INITIAL_CONFIG) {
    this.state = this.getInitialState(config);
  }

  private getInitialState(config: MatchConfig): InternalMatchState {
    return {
      config,
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { 
          a: config.initialScore?.a || 0, 
          b: config.initialScore?.b || 0 
        },
        serving: config.initialServer || 'A',
      },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'WAITING' as TableStatus,
      winner: null,
      tableId: '',
      tableName: '',
      playerNames: { a: 'Player A', b: 'Player B' },
      history: [],
      undoAvailable: false,
    };
  }

  public setEventCallback(cb: (event: MatchEvent) => void) {
    this.onMatchEvent = cb;
  }

  public setPlayerNames(names: { a: string; b: string }): MatchStateExtended {
    this.state.playerNames = names;
    return this.getState();
  }

  public setTableId(id: string, name: string): void {
    this.state.tableId = id;
    this.state.tableName = name;
  }

  private addToHistory(player: Player, action: 'POINT' | 'CORRECTION', pointsBefore: Score, pointsAfter: Score): void {
    const change: ScoreChange = {
      id: crypto.randomUUID(),
      player,
      action,
      pointsBefore: { ...pointsBefore },
      pointsAfter: { ...pointsAfter },
      timestamp: Date.now()
    };
    this.state.history.push(change);
    if (this.state.history.length > 20) {
      this.state.history.shift();
    }
    this.state.undoAvailable = this.state.history.length > 0;
  }

  public canUndo(): boolean {
    return this.state.history.length > 0 && this.state.status === 'LIVE';
  }

  public undoLast(): MatchStateExtended {
    if (!this.canUndo()) {
      return this.getState();
    }
    
    const lastChange = this.state.history.pop()!;
    this.state.score.currentSet = { ...lastChange.pointsBefore };
    this.updateServing();
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
    
    if (player === 'A') this.state.score.currentSet.a++;
    else this.state.score.currentSet.b++;

    this.addToHistory(player, 'POINT', pointsBefore, { ...this.state.score.currentSet });
    
    this.checkSideSwap();
    this.checkSetWin();
    this.updateServing();

    return this.getState();
  }

  private checkSideSwap() {
    const { a, b } = this.state.score.sets;
    const isFinalSet = (a + b) === (this.state.config.bestOf - 1);
    
    if (isFinalSet && !this.state.midSetSwapped) {
      const { a: scoreA, b: scoreB } = this.state.score.currentSet;
      if (scoreA >= 5 || scoreB >= 5) {
        this.state.swappedSides = !this.state.swappedSides;
        this.state.midSetSwapped = true;
        console.log('[Match] Decisive set midpoint reached: Swapping sides');
      }
    }
  }

  public subtractPoint(player: Player): MatchStateExtended {
    if (this.state.status !== 'LIVE') return this.getState();

    const p = player.toLowerCase() as 'a' | 'b';
    
    if (this.state.score.currentSet[p] <= 0) {
      return this.getState();
    }
    
    const pointsBefore = { ...this.state.score.currentSet };
    this.state.score.currentSet[p]--;
    this.addToHistory(player, 'CORRECTION', pointsBefore, { ...this.state.score.currentSet });
    this.updateServing();

    return this.getState();
  }

  private updateServing() {
    const totalPoints = this.state.score.currentSet.a + this.state.score.currentSet.b;
    const isDeuce = this.state.score.currentSet.a >= 10 && this.state.score.currentSet.b >= 10;
    const changeInterval = isDeuce ? 1 : 2;

    if (totalPoints % changeInterval === 0) {
      this.state.score.serving = this.state.score.serving === 'A' ? 'B' : 'A';
    }
  }

  private checkSetWin() {
    const { a, b } = this.state.score.currentSet;
    const { pointsPerSet, minDifference } = this.state.config;

    const hasReachedLimit = a >= pointsPerSet || b >= pointsPerSet;
    const hasDifference = Math.abs(a - b) >= minDifference;

    if (hasReachedLimit && hasDifference) {
      const winner = a > b ? 'A' : 'B';
      if (winner === 'A') this.state.score.sets.a++;
      else this.state.score.sets.b++;

      this.state.setHistory.push({ a, b });
      
      if (this.onMatchEvent) {
        const setNumber = this.state.score.sets.a + this.state.score.sets.b;
        const event: SetWonEvent = {
          type: 'SET_WON',
          winner,
          score: { a, b },
          setNumber
        };
        this.onMatchEvent(event);
      }

      this.checkMatchWin();

      if (this.state.status !== 'FINISHED') {
        this.state.score.currentSet = { a: 0, b: 0 };
      }

      if (this.state.status !== 'FINISHED') {
        const oldSide = this.state.swappedSides;
        this.state.swappedSides = !this.state.swappedSides;
        this.state.midSetSwapped = false;
        console.log(`[Match] Set finished. Swapping sides for next set: ${oldSide} -> ${this.state.swappedSides}`);
      } else {
        console.log(`[Match] Match finished. Keeping sides as is.`);
      }
    }
  }

  private checkMatchWin() {
    const { a, b } = this.state.score.sets;
    const setsNeeded = Math.ceil(this.state.config.bestOf / 2);

    if (a >= setsNeeded) {
      this.state.status = 'FINISHED';
      this.state.winner = 'A';
    } else if (b >= setsNeeded) {
      this.state.status = 'FINISHED';
      this.state.winner = 'B';
    }

    if (this.state.status === 'FINISHED' && this.onMatchEvent) {
      const event: MatchWonEvent = {
        type: 'MATCH_WON',
        winner: this.state.winner as Player,
        finalScore: [...this.state.setHistory, { a: this.state.score.currentSet.a, b: this.state.score.currentSet.b }],
        sets: { ...this.state.score.sets }
      };
      this.onMatchEvent(event);
    }
  }

  public setServer(player: Player): MatchStateExtended {
    this.state.score.serving = player;
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
}