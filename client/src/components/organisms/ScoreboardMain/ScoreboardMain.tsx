import { useMatchDisplay } from '../../../hooks/useMatchDisplay';
import type { MatchStateExtended } from '../../../shared/types';
import { MatchConfigPanel } from '../MatchConfigPanel';
import { ScoreboardSidebar } from './components/ScoreboardSidebar';
import { ScoreboardHeader } from './components/ScoreboardHeader';
import { PlayerScoreArea } from './components/PlayerScoreArea';
import { VSDivider, BackgroundDecor } from './components/ScoreDecorations';

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
      flex flex-col h-full
      landscape:flex-row landscape:gap-0
      ${className}
    `}>
      <ScoreboardSidebar 
        tableName={match.tableName}
        isConnected={isConnected}
        status={status}
        score={match.score}
        setHistory={match.setHistory}
        hasHistory={hasHistory}
        onHistoryClick={onHistoryClick}
        onSettingsClick={onSettingsClick}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col landscape:min-h-screen relative">
        <ScoreboardHeader 
          isConnected={isConnected}
          setsA={setsA}
          setsB={setsB}
          hasHistory={hasHistory}
          onHistoryClick={onHistoryClick}
          onSettingsClick={onSettingsClick}
          onBackClick={onBackClick}
        />

        {/* Main Score Display */}
        <div className="
          flex-1 flex items-center justify-center 
          p-4 landscape:p-8 bg-surface
          min-h-0
        ">
          <div className="flex w-full h-full landscape:flex-row">
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