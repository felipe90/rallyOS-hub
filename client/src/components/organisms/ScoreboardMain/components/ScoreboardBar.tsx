import { Wifi, WifiOff } from 'lucide-react';
import { Caption } from '../../../atoms/Typography';
import { SetScore } from '../../../molecules/MatchContext';
import { ScoreboardActions } from './ScoreboardActions';

export interface ScoreboardBarProps {
  tableName: string;
  isConnected: boolean;
  status: string;
  score: any; // MatchStateExtended['score']
  setHistory: any[]; // MatchStateExtended['setHistory']
  hasHistory: boolean;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  isLandscape?: boolean;
}

export function ScoreboardBar({
  status, score, setHistory, isLandscape = false
}: ScoreboardBarProps) {
  // Landscape: hide completely - only show scores
  if (isLandscape) {
    return null;
  }

  // Portrait: vertical layout
  return (
    <div className="
      flex flex-col gap-2 p-4 bg-surface-low
      landscape:hidden landscape:w-0 landscape:overflow-hidden
    ">
      {/* Sets History - Compact */}
      {setHistory && setHistory.length > 0 && (
        <div className="px-2 py-1 bg-surface rounded-lg overflow-x-auto">
          <div className="flex gap-1">
            {setHistory.map((set, i) => (
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
                setNumber={setHistory.length + 1}
                scoreA={score.currentSet.a}
                scoreB={score.currentSet.b}
                isCurrentSet={true}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}