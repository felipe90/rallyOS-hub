import type { Score } from '../../../shared/types';

export interface ScoreDisplayProps {
  score: number;
  player: 'A' | 'B';
  meta?: string;
  serving?: boolean;
  winner?: boolean;
}

export interface ScorePairProps {
  score: Score;
  serving: 'A' | 'B';
  playerNames: { a: string; b: string };
}