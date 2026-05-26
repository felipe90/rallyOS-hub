import { SetScore } from '../../../molecules/MatchContext';

export interface ScoreboardSidebarProps {
  tableName: string;
  isConnected: boolean;
  status: string;
  score: any;
  setHistory: any[];
}

export function ScoreboardSidebar({
  status, score, setHistory
}: ScoreboardSidebarProps) {
  return (
    <>
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
    </>
  );
}
