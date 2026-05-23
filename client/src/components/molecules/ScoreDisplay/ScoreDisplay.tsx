import { motion, AnimatePresence } from 'framer-motion';
import type { Score } from '@shared/types';
import { Body } from '../../atoms/Typography';

/* ScoreDisplay Molecule - Giant score number + meta */
interface ScoreDisplayProps {
  score: number;
  player: 'A' | 'B';
  label?: string;
  meta?: string;
  serving?: boolean;
  winner?: boolean;
}

export function ScoreDisplay({ 
  score, 
  player, 
  label,
  meta, 
  serving = false,
  winner = false,
}: ScoreDisplayProps) {
  return (
    <motion.div
      className={`
        card flex flex-col items-center gap-2 p-6 rounded-[--radius-lg]
        ${serving ? 'bg-surface-high' : 'bg-surface'}
        ${winner ? 'ring-2 ring-amber' : 'shadow-md'}
        transition-all duration-300
      `}
      animate={winner ? { scale: [1, 1.05, 1] } : {}}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={score}
          className="font-heading text-[120px] font-bold leading-none text-text-h"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {score}
        </motion.span>
      </AnimatePresence>
      
      <div className="flex items-center gap-2">
        <span className="font-heading text-lg font-medium text-text-h">
          {label || `Player ${player}`}
        </span>
        {serving && (
          <span className="w-2 h-2 bg-amber rounded-full animate-pulse" />
        )}
      </div>
      
      {meta && (
        <Body className="text-text/70">{meta}</Body>
      )}
    </motion.div>
  );
}

/* ScorePair Molecule - Two scores side by side */
interface ScorePairProps {
  score: Score;
  serving: 'A' | 'B';
  playerNames: { a: string; b: string };
  labelA?: string;
  labelB?: string;
  vsLabel?: string;
}

export function ScorePair({ score, serving, playerNames, labelA, labelB, vsLabel }: ScorePairProps) {
  const currentPoints = score.a + score.b;
  
  return (
    <div className="flex items-center justify-center gap-8 landscape:gap-16">
      <ScoreDisplay 
        score={score.a} 
        player="A"
        label={labelA}
        meta={playerNames.a}
        serving={serving === 'A'}
      />
      
      <div className="flex flex-col items-center gap-1 px-4">
        <Body className="text-text/50 text-xl landscape:text-2xl">{vsLabel || 'vs'}</Body>
        <Body className="text-text/70 text-sm landscape:text-lg">#{currentPoints}</Body>
      </div>
      
      <ScoreDisplay 
        score={score.b} 
        player="B"
        label={labelB}
        meta={playerNames.b}
        serving={serving === 'B'}
      />
    </div>
  );
}