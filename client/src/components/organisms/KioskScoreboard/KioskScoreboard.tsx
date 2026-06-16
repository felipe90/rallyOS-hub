/**
 * KioskScoreboard — Scoreboard for the kiosk fullscreen spotlight.
 *
 * Uses the same flex chain pattern as ScoreboardMain but simplified
 * (no referee controls). Works inside flex-1 containers by using a
 * flex-col wrapper with min-h-0 to prevent height collapse.
 */

import { useMatchDisplay } from '../../../hooks/useMatchDisplay';
import type { MatchStateExtended } from '@shared/types';
import { KioskPointDisplay } from '../../molecules/KioskPointDisplay/KioskPointDisplay';
import { useI18n } from '@/i18n';

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
    <div className={`flex-1 flex flex-col ${className}`}>
      <KioskPointDisplay
        match={match}
        leftName={leftName || i18nText('commonPlayerA')}
        rightName={rightName || i18nText('commonPlayerB')}
        leftSets={leftSets}
        rightSets={rightSets}
        totalSets={totalSets}
        leftServing={leftServing}
        rightServing={rightServing}
      />
    </div>
  );
}
