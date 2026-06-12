/**
 * KioskScoreboard — Scoreboard for the kiosk fullscreen spotlight.
 *
 * Uses the same flex chain pattern as ScoreboardMain but simplified
 * (no referee controls). Works inside flex-1 containers by using a
 * flex-col wrapper with min-h-0 to prevent height collapse.
 */

import { useMatchDisplay } from '../../../hooks/useMatchDisplay';
import { useSportAdapter } from '../../../hooks/useSportAdapter/useSportAdapter';
import type { MatchStateExtended } from '@shared/types';
import { ScoreboardBar } from '../ScoreboardMain/components/ScoreboardBar';
import { SportDisplaySelector } from '../../molecules/SportDisplaySelector/SportDisplaySelector';
import { useI18n } from '@/i18n';

export interface KioskScoreboardProps {
  match: MatchStateExtended;
  className?: string;
}

export function KioskScoreboard({ match, className = '' }: KioskScoreboardProps) {
  const { i18nText } = useI18n();
  const adapter = useSportAdapter(match);

  const {
    totalSets,
    leftName,
    rightName,
    leftServing,
    rightServing,
    leftSets,
    rightSets,
  } = useMatchDisplay(match);

  const formattedSets = adapter.formatSetHistory(match.setHistory || []);

  return (
    <div className={`flex-1 flex flex-col ${className}`}>
      <ScoreboardBar
        courtName={match.courtName}
        isConnected={true}
        status={match.status}
        formattedSets={formattedSets}
      />
      <div className="flex-1 flex items-center justify-center p-4 bg-surface min-h-0">
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
    </div>
  );
}
