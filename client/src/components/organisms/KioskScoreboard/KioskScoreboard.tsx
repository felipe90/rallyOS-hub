/**
 * KioskScoreboard — Simplified scoreboard for the kiosk fullscreen spotlight.
 *
 * Unlike ScoreboardMain (designed for referee/view pages with h-dvh viewport),
 * this component is designed for flex-1 containers (fills available space).
 * It renders the sport display selector directly without the complex flex chain
 * that caused blank scores in the kiosk context.
 */

import { useMatchDisplay } from '../../../hooks/useMatchDisplay';
import { SportDisplaySelector } from '../../molecules/SportDisplaySelector/SportDisplaySelector';
import { useI18n } from '@/i18n';
import type { MatchStateExtended } from '@shared/types';

export interface KioskScoreboardProps {
  match: MatchStateExtended;
  className?: string;
}

export function KioskScoreboard({ match, className = '' }: KioskScoreboardProps) {
  const { i18nText } = useI18n();

  const {
    totalSets,
    leftName,
    rightName,
    leftServing,
    rightServing,
    leftSets,
    rightSets,
  } = useMatchDisplay(match);

  return (
    <div className={`flex-1 w-full h-full ${className}`}>
      <SportDisplaySelector
        match={match}
        leftPlayerName={leftName || i18nText('commonPlayerA')}
        rightPlayerName={rightName || i18nText('commonPlayerB')}
        totalSets={totalSets}
        leftServing={leftServing}
        rightServing={rightServing}
        leftSets={leftSets}
        rightSets={rightSets}
        isReferee={false}
      />
    </div>
  );
}
