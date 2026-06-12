import { useMatchDisplay } from '../../../hooks/useMatchDisplay';
import type { MatchStateExtended } from '@shared/types';
import { SPORT } from '@shared/types';
import { ScoreboardBar } from './components/ScoreboardBar';
import { SportDisplaySelector } from '../../molecules/SportDisplaySelector/SportDisplaySelector';
import { ToggleButton } from '../../atoms/Button/ToggleButton';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useSportAdapter } from '../../../hooks/useSportAdapter/useSportAdapter';

export interface ScoreboardMainProps {
  match: MatchStateExtended;
  onScorePoint: (player: 'A' | 'B') => void;
  onSubtractPoint?: (player: 'A' | 'B') => void;
  onUndo?: () => void;
  onSwapSides?: () => void;
  isReferee?: boolean;
  isConnected?: boolean;
  isLandscape?: boolean;
  onOrientationToggle?: () => void;
  className?: string;
}

export function ScoreboardMain({
  match,
  onScorePoint,
  onSubtractPoint,
  onUndo,
  onSwapSides,
  isReferee = false,
  isConnected = true,
  isLandscape = false,
  onOrientationToggle,
  className = '',
}: ScoreboardMainProps) {
  const { i18nText } = useI18n();
  const adapter = useSportAdapter(match);
  const { status } = match;

  const {
    totalSets,
    leftName,
    rightName,
    leftServing,
    rightServing,
    leftSets,
    rightSets,
  } = useMatchDisplay(match);

  // Format set history via adapter (sport-appropriate display)
  const formattedSets = adapter.formatSetHistory(
    match.setHistory || []
  );

  return (
    <div className={`
      flex flex-col h-full relative
      ${isLandscape ? 'flex-row' : ''}
      ${className}
    `}>
      {/* ScoreboardBar - responsive based on orientation */}
      <ScoreboardBar 
        courtName={match.courtName}
        isConnected={isConnected}
        status={status}
        formattedSets={formattedSets}
        isLandscape={isLandscape}
      />

      {/* Main Content Area */}
      <div className={`
        flex-1 flex flex-col relative
        ${isLandscape ? 'min-h-dvh' : ''}
      `}>
        {/* Orientation Toggle Button - visible for all roles */}
        {onOrientationToggle && (
          <ToggleButton
            icon={isLandscape ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
            onClick={onOrientationToggle}
            active={isLandscape}
            position="bottom-right"
            size="md"
            className="z-50"
          />
        )}

        {/* Main Score Display */}
        <div className={`
          flex-1 flex items-center justify-center
          p-4 ${isLandscape ? 'py-2' : 'landscape:p-8'} bg-surface
          min-h-0
        `}>
          <SportDisplaySelector
            match={match}
            leftPlayerName={leftName || i18nText('commonPlayerA')}
            rightPlayerName={rightName || i18nText('commonPlayerB')}
            totalSets={totalSets}
            leftServing={leftServing}
            rightServing={rightServing}
            leftSets={leftSets}
            rightSets={rightSets}
            isReferee={isReferee}
            onScorePoint={onScorePoint}
            onSubtractPoint={onSubtractPoint}
            onSwapSides={match.sport !== SPORT.PADEL ? onSwapSides : undefined}
          />
        </div>
      </div>

    </div>
  );
}
