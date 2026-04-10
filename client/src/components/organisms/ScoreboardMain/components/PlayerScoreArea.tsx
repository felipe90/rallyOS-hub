import { Title } from '../../../atoms/Typography';
import { ScoreButton } from '../../../atoms/Button';
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
  const bgClass = isLeft 
    ? 'bg-surface-container-low' 
    : 'bg-surface';
  
  return (
    <section className={`
      flex-1 flex flex-col relative overflow-hidden
      ${bgClass}
    `}>
      {/* Tap Zone (only if referee) */}
      {isReferee && (
        <ScoreButton 
          side={side} 
          onAdd={() => onScorePoint?.(side)} 
          onSubtract={() => onSubtractPoint?.(side)} 
          disabled={false} 
        />
      )}
      
      {/* Score Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <div className="text-center mb-[-1rem]">
          <Title className="text-xl tracking-tight">{playerName || `Player ${side}`}</Title>
          {isReferee && handicap !== undefined && handicap !== 0 && (
            <span className={`
              inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase mt-1
              ${handicap > 0 ? 'bg-surface-high text-primary' : 'bg-surface-high text-error'}
            `}>
              {handicap > 0 ? `+${handicap}` : handicap} HCP
            </span>
          )}
        </div>
        
        <div className="font-heading font-bold text-[18rem] leading-none text-text-h tracking-tighter drop-shadow-2xl">
          {score}
        </div>
        
        {/* Sets Won Indicators */}
        {isReferee && (
          <div className="flex gap-2 mt-[-0.5rem]">
            {Array.from({ length: totalSets }).map((_, i) => (
              <div 
                key={i}
                className={`
                  w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,107,95,0.5)]
                  ${i < setsWon ? 'bg-primary' : 'bg-outline/30'}
                `}
              />
            ))}
          </div>
        )}
        
        {isServing && (
          <ServingIndicator side={side} />
        )}
      </div>
    </section>
  );
}
