import { Caption } from '../../../atoms/Typography';
import { SetScore } from '../../../molecules/MatchContext';
import type { FormattedSet } from '../../../../adapters/SportDisplayAdapter';

export interface ScoreboardBarProps {
  tableName: string;
  isConnected: boolean;
  status: string;
  /** Pre-formatted set history from adapter.formatSetHistory() */
  formattedSets: FormattedSet[];
  isLandscape?: boolean;
}

export function ScoreboardBar({
  status, formattedSets, isLandscape = false
}: ScoreboardBarProps) {
  // Landscape: hide completely - only show scores
  if (isLandscape) {
    return null;
  }

  const showStatusBadge = status !== 'LIVE' && status !== 'FINISHED';

  // Portrait: vertical layout
  return (
    <div className="
      flex flex-col gap-2 p-4 bg-surface-low
      landscape:hidden landscape:w-0 landscape:overflow-hidden
    ">
      {/* Status Badge */}
      {showStatusBadge && (
        <div className="px-3 py-1 bg-surface rounded-lg inline-flex self-start">
          <Caption className="text-text-muted uppercase tracking-widest">
            {status}
          </Caption>
        </div>
      )}

      {/* Sets History - Compact */}
      {formattedSets.length > 0 && (
        <div className="px-2 py-1 bg-surface rounded-lg overflow-x-auto">
          <div className="flex gap-1">
            {formattedSets.map((set, i) => (
              <SetScore
                key={i}
                setNumber={i + 1}
                scoreA={set.left}
                scoreB={set.right}
                isCurrentSet={false}
                isComplete={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
