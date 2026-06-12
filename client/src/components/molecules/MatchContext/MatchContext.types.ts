import type { CourtStatus } from '@shared/types';

export interface MatchContextProps {
  phase: 'quarterfinal' | 'semifinal' | 'final';
  status: CourtStatus;
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