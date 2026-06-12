import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadelPointDisplay } from './PadelPointDisplay';
import { SPORT } from '@shared/types';
import type { PadelPointDisplay as PadelPointDisplayData } from '@shared/types';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

const createPadelDisplay = (overrides: Partial<PadelPointDisplayData> = {}): PadelPointDisplayData => ({
  type: SPORT.PADEL,
  leftPoint: '0',
  rightPoint: '0',
  leftGames: 0,
  rightGames: 0,
  leftSets: 0,
  rightSets: 0,
  ...overrides,
});

describe('PadelPointDisplay', () => {
  describe('point rendering', () => {
    it('renders "30-40" score when points are 30 and 40', () => {
      const data = createPadelDisplay({ leftPoint: '30', rightPoint: '40' });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('renders "0-15" score when points are 0 and 15', () => {
      const data = createPadelDisplay({ leftPoint: '0', rightPoint: '15' });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('renders "AD" indicator when left player has advantage', () => {
      const data = createPadelDisplay({ leftPoint: 'AD', rightPoint: '40' });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      expect(screen.getByText('AD')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('renders "AD" indicator when right player has advantage', () => {
      const data = createPadelDisplay({ leftPoint: '40', rightPoint: 'AD' });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      expect(screen.getByText('AD')).toBeInTheDocument();
    });

    it('renders "40-40" (deuce) score correctly', () => {
      const data = createPadelDisplay({ leftPoint: '40', rightPoint: '40' });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      expect(screen.getAllByText('40').length).toBe(2);
    });
  });

  describe('games rendering', () => {
    it('renders games counter as "Games: 0-0" when no games won', () => {
      const data = createPadelDisplay({ leftGames: 0, rightGames: 0 });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      const gamesElements = screen.getAllByText(/Games:/);
      expect(gamesElements.length).toBe(2); // one per side
    });

    it('renders games counter as "Games: 3-2"', () => {
      const data = createPadelDisplay({ leftGames: 3, rightGames: 2 });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      // Each side shows "Games: N" — find the elements
      const gamesElements = screen.getAllByText(/Games:/);
      expect(gamesElements.length).toBeGreaterThanOrEqual(1);

      // The VS divider shows "3-2"
      expect(screen.getByText('3-2')).toBeInTheDocument();
    });
  });

  describe('sets rendering', () => {
    it('renders set indicators with filled circles for won sets', () => {
      const data = createPadelDisplay({ leftSets: 1, rightSets: 0 });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          isReferee={true}
        />
      );

      const filledDots = document.querySelectorAll('.bg-amber');
      expect(filledDots.length).toBe(1);
    });

    it('renders all empty dots when no sets won', () => {
      const data = createPadelDisplay({ leftSets: 0, rightSets: 0 });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={5}
          isReferee={true}
        />
      );

      const filledDots = document.querySelectorAll('.bg-amber');
      expect(filledDots.length).toBe(0);
    });

    it('renders set indicators when isReferee is false (kiosk/spectator)', () => {
      const data = createPadelDisplay({ leftSets: 2, rightSets: 1 });

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          isReferee={false}
        />
      );

      const dots = document.querySelectorAll('.bg-amber');
      expect(dots.length).toBe(3);
    });
  });

  describe('player names', () => {
    it('renders player names', () => {
      const data = createPadelDisplay();

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  describe('serving indicator', () => {
    it('shows serving indicator when left is serving', () => {
      const data = createPadelDisplay();

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={true}
          rightServing={false}
        />
      );

      expect(screen.getByText('Saque')).toBeInTheDocument();
    });

    it('does not show serving indicator when neither is serving', () => {
      const data = createPadelDisplay();

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
        />
      );

      expect(screen.queryByText('Saque')).not.toBeInTheDocument();
    });
  });

  describe('referee interactions', () => {
    it('calls onScorePoint with A when left section tapped as referee', () => {
      const onScorePoint = vi.fn();
      const data = createPadelDisplay();

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          isReferee={true}
          onScorePoint={onScorePoint}
        />
      );

      const sections = document.querySelectorAll('section');
      const leftSection = sections[0];
      if (leftSection) fireEvent.click(leftSection);

      expect(onScorePoint).toHaveBeenCalledWith('A');
    });

    it('calls onScorePoint with B when right section tapped as referee', () => {
      const onScorePoint = vi.fn();
      const data = createPadelDisplay();

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          isReferee={true}
          onScorePoint={onScorePoint}
        />
      );

      const sections = document.querySelectorAll('section');
      const rightSection = sections[1];
      if (rightSection) fireEvent.click(rightSection);

      expect(onScorePoint).toHaveBeenCalledWith('B');
    });

    it('does not call onScorePoint when not referee', () => {
      const onScorePoint = vi.fn();
      const data = createPadelDisplay();

      render(
        <PadelPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          isReferee={false}
          onScorePoint={onScorePoint}
        />
      );

      const sections = document.querySelectorAll('section');
      const leftSection = sections[0];
      if (leftSection) fireEvent.click(leftSection);

      expect(onScorePoint).not.toHaveBeenCalled();
    });
  });
});
