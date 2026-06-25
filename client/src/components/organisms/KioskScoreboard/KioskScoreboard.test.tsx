import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KioskScoreboard } from './KioskScoreboard';
import { SPORT } from '@shared/types';
import type { MatchStateExtended } from '@shared/types';

const mockUseMatchDisplay = vi.fn(() => ({
  totalSets: 3,
  leftName: 'Alice',
  rightName: 'Bob',
  leftServing: true,
  rightServing: false,
  leftSets: 1,
  rightSets: 0,
}));

const MockKioskPointDisplay = vi.fn((props: any) => (
  <div data-testid="kiosk-point-display-mock" data-props={JSON.stringify(props)}>
    KioskPointDisplay
  </div>
));

const MockScoreboardBar = vi.fn(() => (
  <div data-testid="scoreboard-bar-mock">ScoreboardBar</div>
));

const MockSportDisplaySelector = vi.fn(() => (
  <div data-testid="sport-display-selector-mock">SportDisplaySelector</div>
));

vi.mock('../../../hooks/useMatchDisplay', () => ({
  useMatchDisplay: (...args: any[]) => mockUseMatchDisplay(...args),
}));

vi.mock('../../molecules/KioskPointDisplay/KioskPointDisplay', () => ({
  KioskPointDisplay: (props: any) => MockKioskPointDisplay(props),
}));

vi.mock('../ScoreboardMain/components/ScoreboardBar', () => ({
  ScoreboardBar: () => MockScoreboardBar(),
}));

vi.mock('../../molecules/SportDisplaySelector/SportDisplaySelector', () => ({
  SportDisplaySelector: () => MockSportDisplaySelector(),
}));

vi.mock('../../../hooks/useSportAdapter/useSportAdapter', () => ({
  useSportAdapter: () => ({
    formatSetHistory: vi.fn(() => []),
  }),
  SportDisplayRegistry: class {},
}));

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        commonPlayerA: 'Player A',
        commonPlayerB: 'Player B',
      };
      return map[key] || key;
    },
  }),
}));

function createMatch(overrides: Partial<MatchStateExtended> = {}): MatchStateExtended {
  return {
    tableId: 'table-1',
    tableName: 'Table 1',
    playerNames: { a: 'Alice', b: 'Bob' },
    history: [],
    undoAvailable: false,
    config: {
      sport: SPORT.TABLE_TENNIS,
      pointsPerSet: 11,
      bestOf: 3,
      minDifference: 2,
    },
    score: {
      sets: { a: 1, b: 0 },
      currentSet: { a: 11, b: 7 },
      serving: 'A',
    },
    sport: SPORT.TABLE_TENNIS,
    swappedSides: false,
    midSetSwapped: false,
    setHistory: [{ a: 11, b: 7 } as any],
    status: 'LIVE',
    winner: null,
    courtId: 'court-1',
    courtName: 'Court 1',
    ...overrides,
  } as MatchStateExtended;
}

describe('KioskScoreboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMatchDisplay.mockReturnValue({
      totalSets: 3,
      leftName: 'Alice',
      rightName: 'Bob',
      leftServing: true,
      rightServing: false,
      leftSets: 1,
      rightSets: 0,
    });
  });

  it('does not render ScoreboardBar', () => {
    render(<KioskScoreboard match={createMatch()} />);
    expect(screen.queryByTestId('scoreboard-bar-mock')).not.toBeInTheDocument();
  });

  it('does not render SportDisplaySelector', () => {
    render(<KioskScoreboard match={createMatch()} />);
    expect(screen.queryByTestId('sport-display-selector-mock')).not.toBeInTheDocument();
  });

  it('renders KioskPointDisplay', () => {
    render(<KioskScoreboard match={createMatch()} />);
    expect(screen.getByTestId('kiosk-point-display-mock')).toBeInTheDocument();
  });

  it('passes useMatchDisplay values to KioskPointDisplay', () => {
    render(<KioskScoreboard match={createMatch()} />);
    expect(MockKioskPointDisplay).toHaveBeenCalledTimes(1);
    const passedProps = MockKioskPointDisplay.mock.calls[0][0];
    expect(passedProps.match).toEqual(createMatch());
    expect(passedProps.leftName).toBe('Alice');
    expect(passedProps.rightName).toBe('Bob');
    expect(passedProps.leftSets).toBe(1);
    expect(passedProps.rightSets).toBe(0);
    expect(passedProps.totalSets).toBe(3);
    expect(passedProps.leftServing).toBe(true);
    expect(passedProps.rightServing).toBe(false);
  });

  it('falls back to i18n labels when useMatchDisplay names are empty', () => {
    mockUseMatchDisplay.mockReturnValue({
      totalSets: 3,
      leftName: '',
      rightName: '',
      leftServing: false,
      rightServing: false,
      leftSets: 0,
      rightSets: 0,
    });
    render(<KioskScoreboard match={createMatch()} />);
    const passedProps = MockKioskPointDisplay.mock.calls[0][0];
    expect(passedProps.leftName).toBe('Player A');
    expect(passedProps.rightName).toBe('Player B');
  });

  it('renders KioskPointDisplay for a finished match', () => {
    render(<KioskScoreboard match={createMatch({ status: 'FINISHED' })} />);
    expect(screen.getByTestId('kiosk-point-display-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('scoreboard-bar-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sport-display-selector-mock')).not.toBeInTheDocument();
  });
});
