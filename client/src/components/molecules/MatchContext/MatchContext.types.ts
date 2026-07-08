import type { TournamentStatus } from '@shared/types';

export interface MatchContextProps {
  phase: 'quarterfinal' | 'semifinal' | 'final';
  status: TournamentStatus;
  matchNumber?: number;
  totalMatches?: number;
  bestOf?: number;
  pointsPerSet?: number;
  liveLabel?: string;
}

export interface SetScoreProps {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  isCurrentSet?: boolean;
  isComplete?: boolean;
}