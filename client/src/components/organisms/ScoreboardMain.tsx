import { motion } from 'framer-motion';
import type { MatchStateExtended, TableStatus } from '../../../../shared/types';
import { ScorePair } from '../molecules/ScoreDisplay';
import { MatchContext, SetScore } from '../molecules/MatchContext';
import { ScoreButton } from '../atoms/Button';
import { Undo2, History, Settings } from 'lucide-react';
import { Body } from '../atoms/Typography';

/* ScoreboardMain Organism - Landscape referee/viewer scoreboard */
export interface ScoreboardMainProps {
  match: MatchStateExtended;
  onScorePoint: (player: 'A' | 'B') => void;
  onUndo?: () => void;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  isReferee?: boolean;
  className?: string;
}

export function ScoreboardMain({
  match,
  onScorePoint,
  onUndo,
  onHistoryClick,
  onSettingsClick,
  isReferee = false,
  className = '',
}: ScoreboardMainProps) {
  const { score, status, playerNames, history } = match;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-surface-low">
        <div className="flex items-center gap-2">
          <Body className="font-medium text-text-h">{match.tableName}</Body>
        </div>
        
        <div className="flex gap-2">
          {history && history.length > 0 && onHistoryClick && (
            <motion.button
              className="p-2 rounded-[--radius-md] bg-surface hover:bg-surface-high transition-colors"
              onClick={onHistoryClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="History"
            >
              <History size={20} />
            </motion.button>
          )}
          {onSettingsClick && (
            <motion.button
              className="p-2 rounded-[--radius-md] bg-surface hover:bg-surface-high transition-colors"
              onClick={onSettingsClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Settings"
            >
              <Settings size={20} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Match Phase */}
      <div className="p-4 bg-surface">
        <MatchContext
          phase={status === 'FINISHED' ? 'final' : 'quarterfinal'}
          status={status}
        />
      </div>

      {/* Sets History */}
      {match.setHistory && match.setHistory.length > 0 && (
        <div className="px-4 py-2 bg-surface-low">
          <div className="flex gap-2">
            {match.setHistory.map((set, i) => (
              <SetScore
                key={i}
                setNumber={i + 1}
                scoreA={set.a}
                scoreB={set.b}
                isCurrentSet={false}
                isComplete={true}
              />
            ))}
            {status === 'LIVE' && (
              <SetScore
                setNumber={match.setHistory.length + 1}
                scoreA={score.currentSet.a}
                scoreB={score.currentSet.b}
                isCurrentSet={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Score Display */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface">
        <ScorePair
          score={score.currentSet}
          serving={score.serving}
          playerNames={playerNames}
        />
      </div>

      {/* Referee Controls */}
      {isReferee && status === 'LIVE' && (
        <div className="flex gap-4 p-4 bg-surface">
          <motion.button
            className={`
              flex-1 aspect-[4/5] rounded-[--radius-lg]
              flex flex-col items-center justify-center gap-2
              shadow-md hover:shadow-lg
              transition-all
              ${history && history.length > 0 ? 'bg-surface-low' : 'bg-surface-low opacity-50'}
            `}
            onClick={onUndo}
            disabled={!history || history.length === 0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Undo2 size={24} />
            <Body className="text-sm">Deshacer</Body>
          </motion.button>
          
          <ScoreButton side="A" onClick={() => onScorePoint('A')} disabled={false} />
          <ScoreButton side="B" onClick={() => onScorePoint('B')} disabled={false} />
        </div>
      )}
    </div>
  );
}

/* MatchConfigPanel - Configuration before match starts */
export interface MatchConfigPanelProps {
  defaultConfig?: {
    pointsPerSet: number;
    bestOf: number;
  };
  onStart: (config: { pointsPerSet: number; bestOf: number }) => void;
  onCancel: () => void;
}

export function MatchConfigPanel({
  defaultConfig = { pointsPerSet: 21, bestOf: 3 },
  onStart,
  onCancel,
}: MatchConfigPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-surface">
      <Body className="text-xl mb-8">Configurar Partido</Body>
      
      <div className="flex flex-col gap-4 w-full max-w-md">
        <div className="flex flex-col gap-2">
          <Body className="font-medium">Puntos por set</Body>
          <div className="flex gap-2">
            {[11, 15, 21].map((points) => (
              <button
                key={points}
                className={`
                  flex-1 p-4 rounded-[--radius-md]
                  font-heading text-lg font-medium
                  ${points === defaultConfig.pointsPerSet 
                    ? 'bg-primary text-white' 
                    : 'bg-surface-low hover:bg-surface-high'}
                  transition-colors
                `}
                onClick={() => onStart({ ...defaultConfig, pointsPerSet: points })}
              >
                {points}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <Body className="font-medium">Mejor de</Body>
          <div className="flex gap-2">
            {[1, 3, 5].map((bo) => (
              <button
                key={bo}
                className={`
                  flex-1 p-4 rounded-[--radius-md]
                  font-heading text-lg font-medium
                  ${bo === defaultConfig.bestOf 
                    ? 'bg-primary text-white' 
                    : 'bg-surface-low hover:bg-surface-high'}
                  transition-colors
                `}
                onClick={() => onStart({ ...defaultConfig, bestOf: bo })}
              >
                {bo}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}