import { motion } from 'framer-motion';
import { useState } from 'react';
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
    <div className={`
      flex flex-col h-full
      landscape:flex-row landscape:gap-0
      ${className}
    `}>
      {/* Sidebar (hidden in landscape, shown in portrait) */}
      <div className="
        flex flex-col gap-2 p-4 bg-surface-low
        landscape:hidden landscape:w-0 landscape:overflow-hidden
      ">
        {/* Header */}
        <div className="flex items-center justify-between p-2 bg-surface rounded-lg">
          <div className="flex items-center gap-2">
            <Body className="font-medium text-text-h text-sm">{match.tableName}</Body>
          </div>
          
          <div className="flex gap-2">
            {history && history.length > 0 && onHistoryClick && (
              <motion.button
                className="p-1 rounded-[--radius-md] bg-surface-high hover:bg-surface transition-colors"
                onClick={onHistoryClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="History"
              >
                <History size={16} />
              </motion.button>
            )}
            {onSettingsClick && (
              <motion.button
                className="p-1 rounded-[--radius-md] bg-surface-high hover:bg-surface transition-colors"
                onClick={onSettingsClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Settings"
              >
                <Settings size={16} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Match Phase */}
        <div className="p-2 bg-surface rounded-lg">
          <MatchContext
            phase={status === 'FINISHED' ? 'final' : 'quarterfinal'}
            status={status}
          />
        </div>

        {/* Sets History - Compact */}
        {match.setHistory && match.setHistory.length > 0 && (
          <div className="px-2 py-1 bg-surface rounded-lg overflow-x-auto">
            <div className="flex gap-1">
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col landscape:min-h-screen landscape:justify-center">
        {/* Landscape Header - Only visible in landscape */}
        <div className="
          hidden landscape:flex items-center justify-between
          p-4 bg-surface-low h-20
          landscape:flex-row landscape:gap-4
        ">
          <div className="flex items-center gap-4">
            <Body className="font-heading font-bold text-lg">{match.tableName}</Body>
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
                <History size={24} />
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
                <Settings size={24} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Main Score Display - Responsive sizing */}
        <div className="
          flex-1 flex items-center justify-center 
          p-6 landscape:p-8 bg-surface
          landscape:h-full landscape:min-h-screen landscape:gap-8
        ">
          <ScorePair
            score={score.currentSet}
            serving={score.serving}
            playerNames={playerNames}
          />
        </div>
      </div>

      {/* Referee Controls - Bottom in portrait, right in landscape */}
      {isReferee && status === 'LIVE' && (
        <div className="
          flex gap-4 p-4 bg-surface
          landscape:flex-col landscape:w-32 landscape:h-full landscape:gap-2 landscape:p-3
        ">
          <motion.button
            className={`
              flex-1 aspect-[4/5] rounded-[--radius-lg]
              flex flex-col items-center justify-center gap-2
              shadow-md hover:shadow-lg
              transition-all text-xs landscape:text-[10px]
              ${history && history.length > 0 ? 'bg-surface-low' : 'bg-surface-low opacity-50'}
              landscape:aspect-auto landscape:h-20
            `}
            onClick={onUndo}
            disabled={!history || history.length === 0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Undo2 size={24} className="landscape:w-4 landscape:h-4" />
            <Body className="text-xs landscape:text-[10px]">Deshacer</Body>
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
    handicapA?: number;
    handicapB?: number;
  };
  onStart: (config: { pointsPerSet: number; bestOf: number; handicapA?: number; handicapB?: number }) => void;
  onCancel: () => void;
}

export function MatchConfigPanel({
  defaultConfig = { pointsPerSet: 11, bestOf: 3, handicapA: 0, handicapB: 0 },
  onStart,
  onCancel,
}: MatchConfigPanelProps) {
  const [pointsPerSet, setPointsPerSet] = useState(defaultConfig.pointsPerSet || 11);
  const [bestOf, setBestOf] = useState(defaultConfig.bestOf || 3);
  const [handicapA, setHandicapA] = useState(defaultConfig.handicapA || 0);
  const [handicapB, setHandicapB] = useState(defaultConfig.handicapB || 0);

  const handleStart = () => {
    onStart({ pointsPerSet, bestOf, handicapA, handicapB });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-surface">
      <Body className="text-2xl mb-8 font-heading">Configurar Partido</Body>
      
      <div className="flex flex-col gap-6 w-full max-w-md">
        
        {/* Puntos por set */}
        <div className="flex flex-col gap-2">
          <Body className="font-medium text-lg">Puntos por set</Body>
          <div className="flex gap-2">
            {[11, 15, 21].map((points) => (
              <button
                key={points}
                className={`
                  flex-1 p-4 rounded-[--radius-md]
                  font-heading text-lg font-medium transition-colors
                  ${pointsPerSet === points 
                    ? 'bg-primary text-white' 
                    : 'bg-surface-low hover:bg-surface-high'}
                `}
                onClick={() => setPointsPerSet(points)}
              >
                {points}
              </button>
            ))}
          </div>
        </div>
        
        {/* Mejor de */}
        <div className="flex flex-col gap-2">
          <Body className="font-medium text-lg">Mejor de</Body>
          <div className="flex gap-2">
            {[1, 3, 5].map((bo) => (
              <button
                key={bo}
                className={`
                  flex-1 p-4 rounded-[--radius-md]
                  font-heading text-lg font-medium transition-colors
                  ${bestOf === bo 
                    ? 'bg-primary text-white' 
                    : 'bg-surface-low hover:bg-surface-high'}
                `}
                onClick={() => setBestOf(bo)}
              >
                {bo}
              </button>
            ))}
          </div>
        </div>

        {/* Handicap */}
        <div className="flex flex-col gap-2 pt-4 border-t border-surface-high">
          <Body className="font-medium text-lg">Handicap</Body>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Equipo A</label>
              <input
                type="number"
                value={handicapA}
                onChange={(e) => setHandicapA(parseInt(e.target.value) || 0)}
                className="p-3 border border-surface-high rounded-[--radius-md] bg-surface-low text-center font-heading text-lg"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Equipo B</label>
              <input
                type="number"
                value={handicapB}
                onChange={(e) => setHandicapB(parseInt(e.target.value) || 0)}
                className="p-3 border border-surface-high rounded-[--radius-md] bg-surface-low text-center font-heading text-lg"
              />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 p-4 rounded-[--radius-md] bg-surface-low hover:bg-surface-high font-heading text-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            className="flex-1 p-4 rounded-[--radius-md] bg-primary hover:bg-primary-dark text-white font-heading text-lg font-medium transition-colors"
          >
            Iniciar
          </button>
        </div>
      </div>
    </div>
  );
}