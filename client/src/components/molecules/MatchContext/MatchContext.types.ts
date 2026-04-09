import type { TableStatus } from '../../../shared/types';

export interface MatchContextProps {
  phase: 'quarterfinal' | 'semifinal' | 'final';
  status: TableStatus;
  matchNumber?: number;
  totalMatches?: number;
  bestOf?: number;
  pointsPerSet?: number;
}

export interface SetScoreProps {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  isCurrentSet?: boolean;
  isComplete?: boolean;
}