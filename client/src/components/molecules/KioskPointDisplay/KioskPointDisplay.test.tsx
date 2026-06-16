import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { KioskPointDisplay } from './KioskPointDisplay';
import { SPORT } from '@shared/types';
import type { MatchStateExtended, Score } from '@shared/types';

const mockTTAdapter = {
  sport: SPORT.TABLE_TENNIS,
  computeDisplayData: vi.fn(),
  formatSetHistory: vi.fn(),
  getCurrentScores: vi.fn(),
  getServing: vi.fn(),
  needsHandicap: vi.fn(),
  getConfigDefaults: vi.fn(),
  validateConfig: vi.fn(),
  getConfigFields: vi.fn(),
  DisplayComponent: vi.fn(),
  displayKey: 'sportTableTennis',
  icon: null,
};

const mockPadelAdapter = {
  sport: SPORT.PADEL,
  computeDisplayData: vi.fn(),
  formatSetHistory: vi.fn(),
  getCurrentScores: vi.fn(),
  getServing: vi.fn(),
  needsHandicap: vi.fn(),
  getConfigDefaults: vi.fn(),
  validateConfig: vi.fn(),
  getConfigFields: vi.fn(),
  DisplayComponent: vi.fn(),
  displayKey: 'sportPadel',
  icon: null,
};

let currentAdapter = mockTTAdapter;
let shouldReduceMotion = false;

vi.mock('../../../hooks/useSportAdapter/useSportAdapter', () => ({
  useSportAdapter: vi.fn(() => currentAdapter),
  SportDisplayRegistry: class {},
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => (
      <div {...props} data-testid="motion-div">
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => shouldReduceMotion,
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
    language: 'en-US',
    changeLanguage: vi.fn(),
  }),
  i18nText: (key: string) => key,
  changeLanguage: vi.fn(),
  SUPPORTED_LANGS: [
    { code: 'es', label: 'ES' },
    { code: 'en-US', label: 'EN' },
  ],
  default: { language: 'en-US' },
}));

import { useSportAdapter } from '../../../hooks/useSportAdapter/useSportAdapter';

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
    setHistory: [{ a: 11, b: 7 } as Score],
    status: 'LIVE',
    winner: null,
    courtId: 'court-1',
    courtName: 'Court 1',
    ...overrides,
  } as MatchStateExtended;
}

const baseProps = {
  leftName: 'Alice',
  rightName: 'Bob',
  leftSets: 1,
  rightSets: 0,
  totalSets: 3,
  leftServing: true,
  rightServing: false,
};

describe('KioskPointDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAdapter = mockTTAdapter;
    shouldReduceMotion = false;
    (useSportAdapter as any).mockReturnValue(currentAdapter);

    mockTTAdapter.computeDisplayData.mockReturnValue({
      type: SPORT.TABLE_TENNIS,
      leftScore: 11,
      rightScore: 7,
      leftSets: 1,
      rightSets: 0,
    });
    mockTTAdapter.formatSetHistory.mockReturnValue([{ left: 11, right: 7, label: 'Set 1' }]);

    mockPadelAdapter.computeDisplayData.mockReturnValue({
      type: SPORT.PADEL,
      leftPoint: '40',
      rightPoint: '30',
      leftGames: 5,
      rightGames: 2,
      leftSets: 1,
      rightSets: 0,
    });
    mockPadelAdapter.formatSetHistory.mockReturnValue([{ left: 6, right: 4, label: 'Set 1' }]);
  });

  describe('table tennis layout', () => {
    it('renders player names above each score digit', () => {
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('left-player-name')).toHaveTextContent('Alice');
      expect(screen.getByTestId('right-player-name')).toHaveTextContent('Bob');
    });

    it('renders large left and right point digits', () => {
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('main-score-area')).toHaveTextContent('11');
      expect(screen.getByTestId('main-score-area')).toHaveTextContent('7');
    });

    it('shows leftSets and rightSets in center panels', () => {
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('left-sets-panel')).toHaveTextContent('1');
      expect(screen.getByTestId('right-sets-panel')).toHaveTextContent('0');
    });

    it('renders a TV-style set-history strip with finished sets only', () => {
      const setHistory: Score[] = [
        { a: 11, b: 7 },
        { a: 8, b: 11 },
      ];
      mockTTAdapter.formatSetHistory.mockReturnValue([
        { left: 11, right: 7, label: 'Set 1' },
        { left: 8, right: 11, label: 'Set 2' },
      ]);
      render(
        <KioskPointDisplay
          {...baseProps}
          match={createMatch({ setHistory })}
        />
      );
      const strip = screen.getByTestId('set-history-strip');
      expect(strip).toBeInTheDocument();
      expect(strip.children).toHaveLength(2);
      expect(screen.getByTestId('left-set-0')).toHaveTextContent('11');
      expect(screen.getByTestId('left-set-1')).toHaveTextContent('8');
      expect(screen.getByTestId('right-set-0')).toHaveTextContent('7');
      expect(screen.getByTestId('right-set-1')).toHaveTextContent('11');
    });

    it('calls adapter.computeDisplayData and adapter.formatSetHistory with the match', () => {
      const match = createMatch();
      render(<KioskPointDisplay {...baseProps} match={match} />);
      expect(useSportAdapter).toHaveBeenCalledWith(match);
      expect(mockTTAdapter.computeDisplayData).toHaveBeenCalledWith(match);
      expect(mockTTAdapter.formatSetHistory).toHaveBeenCalledWith(match.setHistory);
    });
  });

  describe('padel layout', () => {
    beforeEach(() => {
      currentAdapter = mockPadelAdapter;
      (useSportAdapter as any).mockReturnValue(currentAdapter);
    });

    it('renders point strings and games counters for both sides', () => {
      const match = createMatch({
        sport: SPORT.PADEL,
        config: {
          sport: SPORT.PADEL,
          bestOf: 3,
          tiebreakPoints: 7,
          gamesPerSet: 6,
          goldenPoint: false,
        },
        padelPoints: { a: 40, b: 30 },
        games: { a: 5, b: 2 },
        sets: { a: 1, b: 0 },
        isTiebreak: false,
        tiebreakPoints: { a: 0, b: 0 },
        tiebreakTarget: 7,
        goldenPoint: false,
        serving: 'A',
      });
      render(<KioskPointDisplay {...baseProps} match={match as MatchStateExtended} />);
      expect(screen.getByTestId('main-score-area')).toHaveTextContent('40');
      expect(screen.getByTestId('main-score-area')).toHaveTextContent('30');
      expect(screen.getByTestId('left-games')).toHaveTextContent('Games: 5');
      expect(screen.getByTestId('right-games')).toHaveTextContent('Games: 2');
    });

    it('renders a set-history strip with finished set scores', () => {
      const setHistory: Score[] = [{ a: 6, b: 4 }];
      const match = createMatch({
        sport: SPORT.PADEL,
        config: {
          sport: SPORT.PADEL,
          bestOf: 3,
          tiebreakPoints: 7,
          gamesPerSet: 6,
          goldenPoint: false,
        },
        setHistory,
        padelPoints: { a: 40, b: 30 },
        games: { a: 5, b: 2 },
        sets: { a: 1, b: 0 },
        isTiebreak: false,
        tiebreakPoints: { a: 0, b: 0 },
        tiebreakTarget: 7,
        goldenPoint: false,
        serving: 'A',
      });
      render(<KioskPointDisplay {...baseProps} match={match as MatchStateExtended} />);
      expect(screen.getByTestId('set-history-strip')).toBeInTheDocument();
      expect(screen.getByTestId('left-set-0')).toHaveTextContent('6');
      expect(screen.getByTestId('right-set-0')).toHaveTextContent('4');
    });
  });

  describe('side-swap correctness', () => {
    it('mirrors adapter scores when swappedSides is true', () => {
      const match = createMatch({ swappedSides: true });
      render(
        <KioskPointDisplay
          {...baseProps}
          leftName="Bob"
          rightName="Alice"
          leftSets={0}
          rightSets={1}
          match={match}
        />
      );
      expect(screen.getByTestId('left-player-name')).toHaveTextContent('Bob');
      expect(screen.getByTestId('right-player-name')).toHaveTextContent('Alice');
      expect(screen.getByTestId('left-sets-panel')).toHaveTextContent('0');
      expect(screen.getByTestId('right-sets-panel')).toHaveTextContent('1');
      const mainScore = screen.getByTestId('main-score-area');
      expect(mainScore).toHaveTextContent('7');
      expect(mainScore).toHaveTextContent('11');
    });

    it('mirrors padel point and games when swappedSides is true', () => {
      currentAdapter = mockPadelAdapter;
      (useSportAdapter as any).mockReturnValue(currentAdapter);
      const match = createMatch({
        sport: SPORT.PADEL,
        swappedSides: true,
        config: {
          sport: SPORT.PADEL,
          bestOf: 3,
          tiebreakPoints: 7,
          gamesPerSet: 6,
          goldenPoint: false,
        },
        padelPoints: { a: 40, b: 30 },
        games: { a: 5, b: 2 },
        sets: { a: 1, b: 0 },
        isTiebreak: false,
        tiebreakPoints: { a: 0, b: 0 },
        tiebreakTarget: 7,
        goldenPoint: false,
        serving: 'A',
      });
      render(
        <KioskPointDisplay
          {...baseProps}
          leftName="Bob"
          rightName="Alice"
          leftSets={0}
          rightSets={1}
          match={match as MatchStateExtended}
        />
      );
      const mainScore = screen.getByTestId('main-score-area');
      expect(mainScore).toHaveTextContent('30');
      expect(mainScore).toHaveTextContent('40');
      expect(screen.getByTestId('left-games')).toHaveTextContent('Games: 2');
      expect(screen.getByTestId('right-games')).toHaveTextContent('Games: 5');
    });

    it('mirrors set-history columns when swappedSides is true', () => {
      const setHistory: Score[] = [{ a: 11, b: 7 }];
      mockTTAdapter.formatSetHistory.mockReturnValue([{ left: 11, right: 7, label: 'Set 1' }]);
      const match = createMatch({ swappedSides: true, setHistory });
      render(
        <KioskPointDisplay
          {...baseProps}
          leftName="Bob"
          rightName="Alice"
          match={match}
        />
      );
      expect(screen.getByTestId('left-set-0')).toHaveTextContent('7');
      expect(screen.getByTestId('right-set-0')).toHaveTextContent('11');
    });
  });

  describe('empty player names', () => {
    it('falls back to i18n labels for missing names', () => {
      render(
        <KioskPointDisplay
          {...baseProps}
          leftName=""
          rightName=""
          match={createMatch()}
        />
      );
      expect(screen.getByTestId('left-player-name')).toHaveTextContent('Player A');
      expect(screen.getByTestId('right-player-name')).toHaveTextContent('Player B');
    });
  });

  describe('reduced motion', () => {
    it('renders score immediately without motion wrapper when reduced motion is enabled', () => {
      shouldReduceMotion = true;
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('main-score-area')).toHaveTextContent('11');
      expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument();
    });

    it('uses motion wrapper by default when reduced motion is disabled', () => {
      shouldReduceMotion = false;
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('main-score-area')).toHaveTextContent('11');
      expect(screen.getAllByTestId('motion-div').length).toBeGreaterThan(0);
    });
  });

  describe('serving indicator', () => {
    it('renders amber serving indicator on the left side when leftServing is true', () => {
      render(<KioskPointDisplay {...baseProps} leftServing={true} rightServing={false} match={createMatch()} />);
      const leftArea = screen.getByTestId('left-player-area');
      const indicator = within(leftArea).getByTestId('serving-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('Saque');
      expect(indicator.querySelector('.bg-amber')).toBeInTheDocument();
    });

    it('renders amber serving indicator on the right side when rightServing is true', () => {
      render(<KioskPointDisplay {...baseProps} leftServing={false} rightServing={true} match={createMatch()} />);
      const rightArea = screen.getByTestId('right-player-area');
      const indicator = within(rightArea).getByTestId('serving-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('Saque');
      expect(indicator.querySelector('.bg-amber')).toBeInTheDocument();
    });

    it('does not render serving indicator when neither side is serving', () => {
      render(<KioskPointDisplay {...baseProps} leftServing={false} rightServing={false} match={createMatch()} />);
      expect(screen.queryByTestId('serving-indicator')).not.toBeInTheDocument();
    });
  });

  describe('background colors', () => {
    it('applies primary surface and border classes to score digit panels', () => {
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('left-score-panel')).toHaveClass('bg-primary/10');
      expect(screen.getByTestId('left-score-panel')).toHaveClass('border-primary/20');
      expect(screen.getByTestId('right-score-panel')).toHaveClass('bg-primary/10');
      expect(screen.getByTestId('right-score-panel')).toHaveClass('border-primary/20');
    });

    it('applies primary surface and border classes to set-count panels', () => {
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('left-sets-panel')).toHaveClass('bg-primary/10');
      expect(screen.getByTestId('left-sets-panel')).toHaveClass('border-primary/20');
      expect(screen.getByTestId('right-sets-panel')).toHaveClass('bg-primary/10');
      expect(screen.getByTestId('right-sets-panel')).toHaveClass('border-primary/20');
    });

    it('applies primary surface class to the set-history strip', () => {
      render(<KioskPointDisplay {...baseProps} match={createMatch()} />);
      expect(screen.getByTestId('set-history-strip')).toHaveClass('bg-primary/10');
    });
  });
});
