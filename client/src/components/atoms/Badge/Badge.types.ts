import type { ReactNode } from 'react';

export type BadgeStatus = 'waiting' | 'configuring' | 'live' | 'finished' | 'default';

export interface BadgeProps {
  status?: BadgeStatus;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export interface WaitingBadgeProps {
  className?: string;
}

export interface ConfiguringBadgeProps {
  className?: string;
}

export interface LiveBadgeProps {
  className?: string;
}

export interface FinishedBadgeProps {
  className?: string;
}