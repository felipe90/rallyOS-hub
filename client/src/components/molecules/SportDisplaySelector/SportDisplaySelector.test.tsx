import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SportDisplaySelector } from './SportDisplaySelector';
import { SPORT } from '@shared/types';
import type { MatchStateExtended, SportDisplayScore } from '@shared/types';
import React from 'react';

// Capturo el sportDisplay que el selector le pasa al DisplayComponent
let lastDisplayProps: any = null;
const MockDisplay = (props: any) => {
  lastDisplayProps = props;
  return <div data-testid="mock-display" data-left-score={props.sportDisplay?.leftScore} data-right-score={props.sportDisplay?.rightScore} data-left-sets={props.sportDisplay?.leftSets} data-right-sets={props.sportDisplay?.rightSets} />;
};

// Mock useSportAdapter to return controlled adapters
const mockAdapter = {
  sport: SPORT.TABLE_TENNIS,
  computeDisplayData: vi.fn(),
  DisplayComponent: MockDisplay,
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
    match: { sport: SPORT.TABLE_TENNIS, swappedSides: false } as MatchStateExtended,
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
    lastDisplayProps = null;
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
    const match = { sport: SPORT.TABLE_TENNIS, swappedSides: false } as MatchStateExtended;
    render(<SportDisplaySelector {...baseProps} match={match} />);
    expect(useSportAdapter).toHaveBeenCalledWith(match);
  });

  it('calls adapter.computeDisplayData with the match', () => {
    const match = { sport: SPORT.TABLE_TENNIS, swappedSides: false } as MatchStateExtended;
    render(<SportDisplaySelector {...baseProps} match={match} />);
    expect(mockAdapter.computeDisplayData).toHaveBeenCalledWith(match);
  });

  it('renders the adapter DisplayComponent', () => {
    const match = { sport: SPORT.TABLE_TENNIS, swappedSides: false } as MatchStateExtended;
    render(<SportDisplaySelector {...baseProps} match={match} />);
    expect(screen.getByTestId('mock-display')).toBeInTheDocument();
  });

  it('passes common props to DisplayComponent', () => {
    const onScorePoint = vi.fn();
    const match = { sport: SPORT.TABLE_TENNIS, swappedSides: false } as MatchStateExtended;
    render(
      <SportDisplaySelector
        {...baseProps}
        match={match}
        isReferee={true}
        onScorePoint={onScorePoint}
      />
    );

    expect(screen.getByTestId('mock-display')).toBeInTheDocument();
    expect(mockAdapter.computeDisplayData).toHaveBeenCalledWith(match);
  });

  describe('side swap handling', () => {
    it('pasa sportDisplay tal cual cuando swappedSides=false', () => {
      const match = { sport: SPORT.TABLE_TENNIS, swappedSides: false } as MatchStateExtended;
      render(<SportDisplaySelector {...baseProps} match={match} />);

      expect(lastDisplayProps.sportDisplay).toEqual({
        type: SPORT.TABLE_TENNIS,
        leftScore: 5,
        rightScore: 3,
        leftSets: 1,
        rightSets: 0,
      });
    });

    it('swappea leftScore/rightScore y leftSets/rightSets cuando swappedSides=true', () => {
      const match = { sport: SPORT.TABLE_TENNIS, swappedSides: true } as MatchStateExtended;
      render(<SportDisplaySelector {...baseProps} match={match} />);

      // Adapters devuelven raw (Player A = izquierda, B = derecha).
      // Con swap: leftScore debe ser rightScore original (3), y viceversa.
      // leftSets: 0 (era el de Player B = rightSets=0), rightSets: 1 (era de A).
      expect(lastDisplayProps.sportDisplay).toEqual({
        type: SPORT.TABLE_TENNIS,
        leftScore: 3,
        rightScore: 5,
        leftSets: 0,
        rightSets: 1,
      });
    });
  });
});
