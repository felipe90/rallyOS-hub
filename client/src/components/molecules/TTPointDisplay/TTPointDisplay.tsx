import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import { HoldToConfirmButton } from '../../atoms/Button/HoldToConfirmButton';
import type { TTPointDisplay as TTPointDisplayData } from '@shared/types';

export interface TTPointDisplayProps {
  sportDisplay: TTPointDisplayData;
  leftPlayerName: string;
  rightPlayerName: string;
  totalSets: number;
  leftServing: boolean;
  rightServing: boolean;
  isReferee?: boolean;
  onScorePoint?: (side: 'A' | 'B') => void;
  onSubtractPoint?: (side: 'A' | 'B') => void;
  onSwapSides?: () => void;
}

function PlayerSide({
  side,
  playerName,
  score,
  setsWon,
  totalSets,
  isServing,
  isReferee,
  isLeft,
  onScorePoint,
  onSubtractPoint,
}: {
  side: 'A' | 'B';
  playerName: string;
  score: number;
  setsWon: number;
  totalSets: number;
  isServing: boolean;
  isReferee: boolean;
  isLeft: boolean;
  onScorePoint?: (side: 'A' | 'B') => void;
  onSubtractPoint?: (side: 'A' | 'B') => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [displayScore, setDisplayScore] = useState(score);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (score !== prevScoreRef.current) {
      setDisplayScore(score);
      prevScoreRef.current = score;
    }
  }, [score]);

  const handleTap = () => {
    if (isReferee) {
      try { navigator.vibrate?.(10); } catch { /* Safari */ }
      onScorePoint?.(side);
    }
  };

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReferee) {
      try { navigator.vibrate?.(10); } catch { /* Safari */ }
      onSubtractPoint?.(side);
    }
  };

  const tapBgColor = isLeft ? 'bg-[var(--color-scoreboard-bg)]' : 'bg-[var(--color-scoreboard-bg-alt)]';

  return (
    <div className="flex-1 relative">
      <section
        className={`absolute inset-0 flex flex-col overflow-hidden ${tapBgColor} cursor-pointer select-none`}
        onClick={handleTap}
        aria-label={`Área de ${playerName}`}
      >
        {/* Serving Indicator */}
        {isServing && (
          <div
            className="absolute top-6 z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber/10 border border-amber/20 backdrop-blur-sm"
            style={{ [isLeft ? 'left' : 'right']: '1.5rem' }}
          >
            <div className="w-3 h-3 bg-amber rounded-full animate-pulse" />
            <span className="text-amber text-sm font-bold uppercase tracking-wider">Saque</span>
          </div>
        )}

        {/* Score Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="text-center mb-4">
            <span className="text-3xl text-[var(--color-score-muted)] font-bold tracking-tight">
              {playerName}
            </span>
          </div>

          <div className="font-heading font-bold text-[clamp(14rem,30vw,26rem)] leading-none text-white tracking-tighter tabular-nums drop-shadow-[0_0_25px_rgba(255,255,255,0.25)]">
            {shouldReduceMotion ? (
              score
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayScore}
                  initial={{ y: 20, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -20, opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="inline-block"
                >
                  {displayScore}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Sets Won Indicators */}
          <div className="flex gap-3 mt-4">
            {Array.from({ length: totalSets }).map((_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full ${i < setsWon ? 'bg-amber' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Undo Button */}
      {isReferee && (
        <div className={`absolute bottom-6 z-20 ${isLeft ? 'right-6' : 'left-6'}`}>
          <button
            onClick={handleUndo}
            className="size-20 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors duration-200 p-4"
            aria-label={`Undo point for Player ${side}`}
          >
            <Undo2 size={32} />
          </button>
        </div>
      )}
    </div>
  );
}

export function TTPointDisplay({
  sportDisplay,
  leftPlayerName,
  rightPlayerName,
  totalSets,
  leftServing,
  rightServing,
  isReferee = false,
  onScorePoint,
  onSubtractPoint,
  onSwapSides,
}: TTPointDisplayProps) {
  return (
    <div className="flex w-full h-full">
      <PlayerSide
        side="A"
        playerName={leftPlayerName}
        score={sportDisplay.leftScore}
        setsWon={sportDisplay.leftSets}
        totalSets={totalSets}
        isServing={leftServing}
        isReferee={isReferee}
        isLeft={true}
        onScorePoint={onScorePoint}
        onSubtractPoint={onSubtractPoint}
      />

      {/* VS Divider */}
      <div className="w-px bg-white/10 relative z-30 flex flex-col items-center justify-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
          <span className="font-heading font-bold text-base text-white/40 italic">VS</span>
        </div>
        {/* Swap sides button for referee — right below VS */}
        {onSwapSides && isReferee && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[44px]">
            <HoldToConfirmButton
              onConfirm={onSwapSides}
              holdDuration={1500}
              variant="neutral"
              ariaLabel="Intercambiar lados"
            />
          </div>
        )}
      </div>

      <PlayerSide
        side="B"
        playerName={rightPlayerName}
        score={sportDisplay.rightScore}
        setsWon={sportDisplay.rightSets}
        totalSets={totalSets}
        isServing={rightServing}
        isReferee={isReferee}
        isLeft={false}
        onScorePoint={onScorePoint}
        onSubtractPoint={onSubtractPoint}
      />
    </div>
  );
}
