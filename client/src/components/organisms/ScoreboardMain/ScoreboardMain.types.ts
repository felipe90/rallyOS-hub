import type { MatchStateExtended, Player } from '@shared/types';

export interface ScoreboardMainProps {
  match: MatchStateExtended;
  onScorePoint: (player: Player) => void;
  onSubtractPoint?: (player: Player) => void;
  onUndo?: () => void;
  onSwapSides?: () => void;
  isReferee?: boolean;
  isConnected?: boolean;
  isLandscape?: boolean;
  onOrientationToggle?: () => void;
  className?: string;
}

export type MatchStatus = 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
