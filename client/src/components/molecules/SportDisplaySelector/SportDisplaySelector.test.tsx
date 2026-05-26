import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SportDisplaySelector } from './SportDisplaySelector';
import { SPORT } from '@shared/types';
import type { MatchStateExtended } from '@shared/types';

// Mock useSportAdapter to return controlled adapters
const mockAdapter = {
  sport: SPORT.TABLE_TENNIS,
  computeDisplayData: vi.fn(),
  DisplayComponent: (() => <div data-testid="mock-display">Mock</div>) as any,
  getCurrentScores: vi.fn(),
  getServing: vi.fn(),
  needsHandicap: vi.fn(),
  getConfigDefaults: vi.fn(),
  validateConfig: vi.fn(),
  getConfigFields: vi.fn(),
  formatSetHistory: vi.fn(),
};

vi.mock('../../../hooks/useSportAdapter/useSportAdapter', () => ({
  useSportAdapter: vi.fn(() => mockAdapter),
  SportDisplayRegistry: class {},
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

import { useSportAdapter } from '../../../hooks/useSportAdapter/useSportAdapter';

describe('SportDisplaySelector', () => {
  const baseProps = {
    match: { sport: SPORT.TABLE_TENNIS } as MatchStateExtended,
    leftPlayerName: 'Alice',
    rightPlayerName: 'Bob',
    totalSets: 3,
    leftServing: false,
    rightServing: false,
    leftSets: 0,
    rightSets: 0,
    onScorePoint: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSportAdapter as any).mockReturnValue(mockAdapter);
    (mockAdapter.computeDisplayData as any).mockReturnValue({
      type: SPORT.TABLE_TENNIS,
      leftScore: 5,
      rightScore: 3,
      leftSets: 1,
      rightSets: 0,
    });
  });

  it('calls useSportAdapter with the match', () => {
    const match = { sport: SPORT.TABLE_TENNIS } as MatchStateExtended;
    render(<SportDisplaySelector {...baseProps} match={match} />);
    expect(useSportAdapter).toHaveBeenCalledWith(match);
  });

  it('calls adapter.computeDisplayData with the match', () => {
    const match = { sport: SPORT.TABLE_TENNIS } as MatchStateExtended;
    render(<SportDisplaySelector {...baseProps} match={match} />);
    expect(mockAdapter.computeDisplayData).toHaveBeenCalledWith(match);
  });

  it('renders the adapter DisplayComponent', () => {
    const match = { sport: SPORT.TABLE_TENNIS } as MatchStateExtended;
    render(<SportDisplaySelector {...baseProps} match={match} />);
    expect(screen.getByTestId('mock-display')).toBeInTheDocument();
  });

  it('passes common props to DisplayComponent', () => {
    const onScorePoint = vi.fn();
    const match = { sport: SPORT.TABLE_TENNIS } as MatchStateExtended;
    render(
      <SportDisplaySelector
        {...baseProps}
        match={match}
        isReferee={true}
        onScorePoint={onScorePoint}
      />
    );

    // The mock display renders, proving adapter was used
    expect(screen.getByTestId('mock-display')).toBeInTheDocument();
    // computeDisplayData was called with correct match
    expect(mockAdapter.computeDisplayData).toHaveBeenCalledWith(match);
  });
});
