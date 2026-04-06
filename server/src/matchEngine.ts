export type Player = 'A' | 'B';

export interface Score {
  a: number;
  b: number;
}

export interface MatchConfig {
  pointsPerSet: number;
  bestOf: number;
  minDifference: number;
  initialScore?: Score;
}

export interface MatchState {
  config: MatchConfig;
  score: {
    sets: Score;
    currentSet: Score;
    serving: Player;
  };
  setHistory: Score[];
  status: 'WAITING' | 'LIVE' | 'FINISHED';
  winner: Player | null;
}

export const INITIAL_CONFIG: MatchConfig = {
  pointsPerSet: 11,
  bestOf: 3,
  minDifference: 2,
};

export class MatchEngine {
  private state: MatchState;

  constructor(config: MatchConfig = INITIAL_CONFIG) {
    this.state = this.getInitialState(config);
  }

  private getInitialState(config: MatchConfig): MatchState {
    return {
      config,
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { 
          a: config.initialScore?.a || 0, 
          b: config.initialScore?.b || 0 
        },
        serving: 'A',
      },
      setHistory: [],
      status: 'WAITING',
      winner: null,
    };
  }

  public startMatch() {
    this.state.status = 'LIVE';
    return this.getState();
  }

  public recordPoint(player: Player): MatchState {
    if (this.state.status !== 'LIVE') return this.state;

    if (player === 'A') this.state.score.currentSet.a++;
    else this.state.score.currentSet.b++;

    this.checkSetWin();
    this.updateServing(); // Note: Keeping serving logic as it's common for many racket sports, but could be toggled.

    return this.getState();
  }

  public subtractPoint(player: Player): MatchState {
    if (this.state.status !== 'LIVE') return this.state;

    const p = player.toLowerCase() as 'a' | 'b';
    this.state.score.currentSet[p]--;

    // After subtracting, we should still update serving to stay in sync
    this.updateServing();

    return this.getState();
  }

  private updateServing() {
    const totalPoints = this.state.score.currentSet.a + this.state.score.currentSet.b;
    const isDeuce = this.state.score.currentSet.a >= 10 && this.state.score.currentSet.b >= 10;

    // Standard: Alternates every 2 points
    // Deuce: Alternates every 1 point
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
      // Set Won
      const winner = a > b ? 'A' : 'B';
      if (winner === 'A') this.state.score.sets.a++;
      else this.state.score.sets.b++;

      this.state.setHistory.push({ a, b });
      this.state.score.currentSet = { a: 0, b: 0 };

      this.checkMatchWin();
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
  }

  public setServer(player: Player): MatchState {
    this.state.score.serving = player;
    return this.getState();
  }

  public getState(): MatchState {
    return JSON.parse(JSON.stringify(this.state)); // Deep clone
  }
}
