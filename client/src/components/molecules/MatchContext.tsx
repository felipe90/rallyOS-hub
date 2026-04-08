import type { TableStatus } from '../../../../shared/types';
import { Body, Label } from '../atoms/Typography';
import { LiveBadge } from '../atoms/Badge';

/* MatchContext Molecule - Tournament phase info */
export interface MatchContextProps {
  phase: 'quarterfinal' | 'semifinal' | 'final';
  status: TableStatus;
  matchNumber?: number;
  totalMatches?: number;
  bestOf?: number;
  pointsPerSet?: number;
}

/* Display text for phases (in Spanish - Kinetic Clubhouse uses Spanish) */
const phaseLabels: Record<string, string> = {
  quarterfinal: 'Cuartos de Final',
  semifinal: 'Semifinal',
  final: 'Final',
};

const phaseColors: Record<string, string> = {
  quarterfinal: 'bg-surface-low',
  semifinal: 'bg-tertiary/10',
  final: 'bg-amber/10',
};

export function MatchContext({
  phase,
  status,
  matchNumber,
  totalMatches,
  bestOf,
  pointsPerSet,
}: MatchContextProps) {
  const phaseLabel = phaseLabels[phase] || phase;
  
  return (
    <div className={`
      flex flex-col gap-2 p-4 rounded-[--radius-md]
      ${phaseColors[phase]}
      transition-all duration-200
    `}>
      <div className="flex items-center justify-between">
        <Label className="text-text/70">{phaseLabel}</Label>
        {status === 'LIVE' && <LiveBadge />}
      </div>
      
      {matchNumber && totalMatches && (
        <Body className="text-sm text-text/50">
          Partido {matchNumber} de {totalMatches}
        </Body>
      )}
      
      <div className="flex gap-4 mt-1 text-sm text-text/70">
        {bestOf && (
          <span>
            <strong className="text-text">{bestOf}</strong> a {bestOf}
          </span>
        )}
        {pointsPerSet && (
          <span>
            <strong className="text-text">{pointsPerSet}</strong> pts/set
          </span>
        )}
      </div>
    </div>
  );
}

/* SetScore Molecule - Individual set score display */
export interface SetScoreProps {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  isCurrentSet?: boolean;
  isComplete?: boolean;
}

export function SetScore({ 
  setNumber, 
  scoreA, 
  scoreB,
  isCurrentSet = false,
  isComplete = false,
}: SetScoreProps) {
  return (
    <div className={`
      flex items-center gap-4 px-3 py-2 rounded-[--radius-sm]
      ${isCurrentSet ? 'bg-surface-high ring-1 ring-primary/30' : 'bg-surface'}
      ${isComplete ? 'opacity-70' : ''}
    `}>
      <span className="text-xs text-text/50 font-heading w-6">#{setNumber}</span>
      <span className={`font-heading text-lg ${scoreA > scoreB ? 'text-primary font-bold' : 'text-text'}`}>
        {scoreA}
      </span>
      <span className="text-text/30">-</span>
      <span className={`font-heading text-lg ${scoreB > scoreA ? 'text-primary font-bold' : 'text-text'}`}>
        {scoreB}
      </span>
    </div>
  );
}