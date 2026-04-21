import { useMatchDisplay } from '../../../hooks/useMatchDisplay';
import type { MatchStateExtended } from '../../../shared/types';
import { MatchConfigPanel } from '../MatchConfigPanel';
import { ScoreboardBar } from './components/ScoreboardBar';
import { ScoreboardHeader } from './components/ScoreboardHeader';
import { PlayerScoreArea } from './components/PlayerScoreArea';
import { VSDivider, BackgroundDecor } from './components/ScoreDecorations';
import { ToggleButton } from '../../atoms/Button/ToggleButton';
import { Maximize2, Minimize2 } from 'lucide-react';

export interface ScoreboardMainProps {
  match: MatchStateExtended;
  onScorePoint: (player: 'A' | 'B') => void;
  onSubtractPoint?: (player: 'A' | 'B') => void;
  onUndo?: () => void;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  onBackClick?: () => void;
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
  onHistoryClick,
  onSettingsClick,
  onBackClick,
  isReferee = false,
  isConnected = true,
  isLandscape = false,
  onOrientationToggle,
  className = '',
}: ScoreboardMainProps) {
  const { status, history, config } = match;
  
  const {
    setsA,
    setsB,
    totalSets,
    leftPlayer,
    rightPlayer,
    leftName,
    rightName,
    leftScore,
    rightScore,
    leftSets,
    rightSets,
    leftHandicap,
    rightHandicap,
    leftServing,
    rightServing,
  } = useMatchDisplay(match);

  const hasHistory = Boolean(history && history.length > 0);

  // If not LIVE and referee, show config panel
  if (isReferee && status !== 'LIVE' && status !== 'FINISHED') {
    return (
      <div className="flex flex-col h-full">
        <MatchConfigPanel
          defaultConfig={{
            pointsPerSet: config?.pointsPerSet || 11,
            bestOf: config?.bestOf || 3,
            handicapA: config?.handicapA || 0,
            handicapB: config?.handicapB || 0,
          }}
          onStart={(cfg) => {
            // This would be handled by parent component
            onScorePoint('A') // Placeholder - parent handles actual start
          }}
          onCancel={() => {}}
        />
      </div>
    );
  }

  return (
    <div className={`
      flex flex-col h-full relative
      ${isLandscape ? 'flex-row' : ''}
      ${className}
    `}>
      {/* ScoreboardBar - responsive based on orientation */}
      <ScoreboardBar 
        tableName={match.tableName}
        isConnected={isConnected}
        status={status}
        score={match.score}
        setHistory={match.setHistory}
        hasHistory={hasHistory}
        onHistoryClick={onHistoryClick}
        onSettingsClick={onSettingsClick}
        isLandscape={isLandscape}
      />

      {/* Main Content Area */}
      <div className={`
        flex-1 flex flex-col relative
        ${isLandscape ? 'min-h-screen' : ''}
      `}>
        {/* Header - hidden in landscape mode */}
        {!isLandscape && (
          <ScoreboardHeader 
            isConnected={isConnected}
            setsA={setsA}
            setsB={setsB}
            hasHistory={hasHistory}
            onHistoryClick={onHistoryClick}
            onSettingsClick={onSettingsClick}
            onBackClick={onBackClick}
          />
        )}

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
          <div className={`flex w-full h-full ${isLandscape ? 'flex-row' : ''}`}>
            <PlayerScoreArea
              isReferee={isReferee}
              side={leftPlayer}
              playerName={leftName || 'Player A'}
              score={leftScore}
              setsWon={leftSets}
              totalSets={totalSets}
              handicap={leftHandicap}
              isServing={leftServing}
              onScorePoint={onScorePoint}
              onSubtractPoint={onSubtractPoint}
              isLeft={true}
            />
            
            <VSDivider />
            
            <PlayerScoreArea
              isReferee={isReferee}
              side={rightPlayer}
              playerName={rightName || 'Player B'}
              score={rightScore}
              setsWon={rightSets}
              totalSets={totalSets}
              handicap={rightHandicap}
              isServing={rightServing}
              onScorePoint={onScorePoint}
              onSubtractPoint={onSubtractPoint}
              isLeft={false}
            />

            {isReferee && <BackgroundDecor />}
          </div>
        </div>
      </div>
    </div>
  );
}