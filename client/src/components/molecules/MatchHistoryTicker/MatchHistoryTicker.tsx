import type { ScoreChange } from '@shared/types';
import { formatEvent, getEventColor } from '@/services/match';

export interface MatchHistoryTickerProps {
  history: ScoreChange[];
  maxItems?: number;
}

export function MatchHistoryTicker({
  history,
  maxItems = 20,
}: MatchHistoryTickerProps) {
  if (!history || history.length === 0) {
    return null;
  }

  // Take the most recent events, limited by maxItems
  const recentEvents = history.slice(-maxItems);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex items-end justify-center pb-2 px-4">
        <div className="flex flex-row gap-1 overflow-x-auto whitespace-nowrap max-w-full pointer-events-auto">
          {recentEvents.map((event, index) => (
            <span
              key={event.id || index}
              className={`
                inline-flex items-center px-2 py-0.5 rounded-sm
                text-[10px] font-mono font-medium
                bg-black/40 backdrop-blur-sm
                ${getEventColor(event)}
              `}
            >
              {formatEvent(event)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
