import type { ScoreChange } from '../../../shared/types';

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

  const formatEvent = (event: ScoreChange): string => {
    if (event.action === 'SET_WON') {
      const winner = event.player || 'A';
      const loser = winner === 'A' ? 'B' : 'A';
      const winnerScore = winner === 'A' ? event.pointsAfter.a : event.pointsAfter.b;
      const loserScore = winner === 'A' ? event.pointsAfter.b : event.pointsAfter.a;
      return `Set ${event.setNumber || '?'} - ${winner} ${winnerScore}-${loserScore}`;
    }

    if (event.action === 'POINT') {
      const player = event.player || '?';
      return `${player}: ${event.pointsAfter.a}-${event.pointsAfter.b}`;
    }

    if (event.action === 'CORRECTION') {
      return `Corr: ${event.pointsAfter.a}-${event.pointsAfter.b}`;
    }

    return `${event.action}`;
  };

  const getEventColor = (event: ScoreChange): string => {
    if (event.action === 'SET_WON') {
      return 'text-[var(--color-score-winner)]';
    }
    if (event.player === 'A') {
      return 'text-[var(--color-score-player-a)]';
    }
    if (event.player === 'B') {
      return 'text-[var(--color-score-player-b)]';
    }
    return 'text-[var(--color-score-neutral)]';
  };

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
