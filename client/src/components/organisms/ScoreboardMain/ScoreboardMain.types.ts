import type { MatchStateExtended, Player } from '../../../shared/types';

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

export interface MatchConfigPanelProps {
  defaultConfig?: MatchConfigDefault;
  onStart: (config: MatchConfigValues) => void;
  onCancel: () => void;
}

export interface MatchConfigDefault {
  pointsPerSet: number;
  bestOf: number;
  handicapA?: number;
  handicapB?: number;
}

export interface MatchConfigValues {
  pointsPerSet: number;
  bestOf: number;
  handicapA?: number;
  handicapB?: number;
}

export type MatchStatus = 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
