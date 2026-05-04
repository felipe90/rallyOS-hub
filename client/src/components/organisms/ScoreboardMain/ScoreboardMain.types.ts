import type { MatchStateExtended, Player } from '@shared/types';

export interface ScoreboardMainProps {
  match: MatchStateExtended;
  onScorePoint: (player: Player) => void;
  onSubtractPoint?: (player: Player) => void;
  onUndo?: () => void;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  isReferee?: boolean;
  isConnected?: boolean;
  className?: string;
}

export type MatchStatus = 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
