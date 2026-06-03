import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import type { PadelPointDisplay as PadelPointDisplayData } from '@shared/types';

export interface PadelPointDisplayProps {
  sportDisplay: PadelPointDisplayData;
  leftPlayerName: string;
  rightPlayerName: string;
  totalSets: number;
  leftServing?: boolean;
  rightServing?: boolean;
  isReferee?: boolean;
  onScorePoint?: (side: 'A' | 'B') => void;
  onSubtractPoint?: (side: 'A' | 'B') => void;
}

function PadelPlayerSide({
  side,
  playerName,
  point,
  games,
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
  point: string;
  games: number;
  setsWon: number;
  totalSets: number;
  isServing: boolean;
  isReferee: boolean;
  isLeft: boolean;
  onScorePoint?: (side: 'A' | 'B') => void;
  onSubtractPoint?: (side: 'A' | 'B') => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [displayPoint, setDisplayPoint] = useState(point);
  const prevPointRef = useRef(point);

  useEffect(() => {
    if (point !== prevPointRef.current) {
      setDisplayPoint(point);
      prevPointRef.current = point;
    }
  }, [point]);

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

          {/* Point Display — smaller than TT for padel with games/sets context */}
          <div className="font-heading font-bold text-[clamp(8rem,18vw,16rem)] leading-none text-white tracking-tighter">
            {shouldReduceMotion ? (
              point
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayPoint}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="inline-block"
                >
                  {displayPoint}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Games Indicator */}
          <div className="mt-2 text-2xl text-white/60 font-heading font-bold">
            Games: {games}
          </div>

          {/* Sets Won Indicators */}
          {isReferee && (
            <div className="flex gap-3 mt-4">
              {Array.from({ length: totalSets }).map((_, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full ${i < setsWon ? 'bg-amber' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
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

export function PadelPointDisplay({
  sportDisplay,
  leftPlayerName,
  rightPlayerName,
  totalSets,
  leftServing = false,
  rightServing = false,
  isReferee = false,
  onScorePoint,
  onSubtractPoint,
}: PadelPointDisplayProps) {
  return (
    <div className="flex w-full h-full">
      <PadelPlayerSide
        side="A"
        playerName={leftPlayerName}
        point={sportDisplay.leftPoint}
        games={sportDisplay.leftGames}
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
        {/* Games counter in VS divider for padel */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[44px] text-white/40 text-sm font-heading">
          {sportDisplay.leftGames}-{sportDisplay.rightGames}
        </div>
      </div>

      <PadelPlayerSide
        side="B"
        playerName={rightPlayerName}
        point={sportDisplay.rightPoint}
        games={sportDisplay.rightGames}
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
