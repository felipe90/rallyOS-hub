import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MatchHistoryTicker } from './MatchHistoryTicker';
import type { ScoreChange } from '@shared/types';

describe('MatchHistoryTicker', () => {
  const mockHistory: ScoreChange[] = [
    {
      id: '1',
      player: 'A',
      action: 'POINT',
      pointsBefore: { a: 0, b: 0 },
      pointsAfter: { a: 1, b: 0 },
      timestamp: Date.now(),
    },
    {
      id: '2',
      player: 'B',
      action: 'POINT',
      pointsBefore: { a: 1, b: 0 },
      pointsAfter: { a: 1, b: 1 },
      timestamp: Date.now() + 1000,
    },
    {
      id: '3',
      player: 'A',
      action: 'SET_WON',
      pointsBefore: { a: 10, b: 8 },
      pointsAfter: { a: 11, b: 8 },
      setNumber: 1,
      timestamp: Date.now() + 2000,
    },
  ];

  it('renders nothing when history is empty', () => {
    const { container } = render(<MatchHistoryTicker history={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when history is undefined', () => {
    const { container } = render(<MatchHistoryTicker history={undefined as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders point events', () => {
    render(<MatchHistoryTicker history={mockHistory} />);
    expect(screen.getByText('A: 1-0')).toBeInTheDocument();
    expect(screen.getByText('B: 1-1')).toBeInTheDocument();
  });

  it('renders set won event', () => {
    render(<MatchHistoryTicker history={mockHistory} />);
    expect(screen.getByText('Set 1 - A 11-8')).toBeInTheDocument();
  });

  it('limits events by maxItems', () => {
    const manyEvents = Array.from({ length: 25 }, (_, i) => ({
      id: `${i}`,
      player: i % 2 === 0 ? 'A' : 'B',
      action: 'POINT' as const,
      pointsBefore: { a: i, b: i },
      pointsAfter: { a: i + 1, b: i },
      timestamp: Date.now() + i * 1000,
    }));

    render(<MatchHistoryTicker history={manyEvents} maxItems={10} />);
    const events = screen.getAllByText(/^[AB]: \d+-\d+$/);
    expect(events.length).toBe(10);
  });
});
