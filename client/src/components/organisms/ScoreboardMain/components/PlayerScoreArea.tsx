import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import { ServingIndicator } from './ScoreDecorations';

export interface PlayerScoreAreaProps {
  isReferee: boolean;
  side: 'A' | 'B';
  playerName: string;
  score: number;
  setsWon: number;
  totalSets: number;
  handicap?: number;
  isServing: boolean;
  onScorePoint?: (side: 'A' | 'B') => void;
  onSubtractPoint?: (side: 'A' | 'B') => void;
  isLeft: boolean;
}

export function PlayerScoreArea({
  isReferee,
  side,
  playerName,
  score,
  setsWon,
  totalSets,
  handicap,
  isServing,
  onScorePoint,
  onSubtractPoint,
  isLeft,
}: PlayerScoreAreaProps) {
  const shouldReduceMotion = useReducedMotion();
  const [displayScore, setDisplayScore] = useState(score);
  const prevScoreRef = useRef(score);

  // Detect score changes to trigger flip animation
  useEffect(() => {
    if (score !== prevScoreRef.current) {
      setDisplayScore(score);
      prevScoreRef.current = score;
    }
  }, [score]);

  const handleTap = () => {
    if (isReferee) {
      onScorePoint?.(side);
    }
  };

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReferee) {
      onSubtractPoint?.(side);
    }
  };

  // Score animation variants
  const scoreVariants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  };

  const transition = {
    duration: 0.25,
    ease: 'easeOut' as const,
  };

  const tapBgColor = isLeft ? 'bg-[var(--color-scoreboard-bg)]' : 'bg-[var(--color-scoreboard-bg-alt)]';

  return (
    <motion.section
      className={`
        flex-1 flex flex-col relative overflow-hidden
        ${tapBgColor}
        cursor-pointer select-none
      `}
      onClick={handleTap}
      whileTap={isReferee ? { scale: 0.98, opacity: 0.9 } : undefined}
      aria-label={`Área de ${playerName || `Player ${side}`}`}
    >
      {/* Serving Indicator - Floating badge outside score flow */}
      {isServing && (
        <ServingIndicator side={side} />
      )}

      {/* Score Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <div className="text-center mb-2">
          <span className="text-sm text-[var(--color-score-muted)] font-medium tracking-tight">
            {playerName || `Player ${side}`}
          </span>
          {isReferee && handicap !== undefined && handicap !== 0 && (
            <span className={`
              inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase mt-1 ml-2
              ${handicap > 0 ? 'bg-white/10 text-[var(--color-score-positive)]' : 'bg-white/10 text-[var(--color-score-negative)]'}
            `}>
              {handicap > 0 ? `+${handicap}` : handicap} HCP
            </span>
          )}
        </div>

        {/* Responsive score font with clamp - bright crisp white */}
        <div className="font-heading font-bold text-[clamp(8rem,20vw,18rem)] leading-none text-white tracking-tighter">
          {shouldReduceMotion ? (
            score
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={displayScore}
                variants={scoreVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className="inline-block"
              >
                {displayScore}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Sets Won Indicators */}
        {isReferee && (
          <div className="flex gap-2 mt-2">
            {Array.from({ length: totalSets }).map((_, i) => (
              <div
                key={i}
                className={`
                  w-3 h-3 rounded-full
                  ${i < setsWon ? 'bg-amber' : 'bg-white/30'}
                `}
              />
            ))}
          </div>
        )}
      </div>

      {/* Undo Button - bottom inner-corner */}
      {isReferee && (
        <button
          onClick={handleUndo}
          className={`
            absolute bottom-6 z-20
            w-12 h-12 rounded-full
            flex items-center justify-center
            bg-white/5 hover:bg-white/10
            text-white/40 hover:text-white
            transition-colors duration-200
            pointer-events-auto
            ${isLeft ? 'right-6' : 'left-6'}
          `}
          aria-label={`Undo point for Player ${side}`}
        >
          <Undo2 size={20} />
        </button>
      )}
    </motion.section>
  );
}
