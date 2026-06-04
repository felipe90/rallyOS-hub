import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TTPointDisplay } from './TTPointDisplay';
import { SPORT } from '@shared/types';
import type { TTPointDisplay as TTPointDisplayData } from '@shared/types';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
  useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

const createTTSportDisplay = (overrides: Partial<TTPointDisplayData> = {}): TTPointDisplayData => ({
  type: SPORT.TABLE_TENNIS,
  leftScore: 0,
  rightScore: 0,
  leftSets: 0,
  rightSets: 0,
  ...overrides,
});

describe('TTPointDisplay', () => {
  describe('score rendering', () => {
    it('renders leftScore and rightScore as numbers', () => {
      const data = createTTSportDisplay({ leftScore: 5, rightScore: 3 });

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders player names', () => {
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders VS divider between scores', () => {
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
        />
      );

      expect(screen.getByText('VS')).toBeInTheDocument();
    });
  });

  describe('serving indicator', () => {
    it('shows serving indicator on left side when left is serving', () => {
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={true}
          rightServing={false}
        />
      );

      // Serving indicator is rendered with "Saque" text
      const saqueElements = screen.getAllByText('Saque');
      expect(saqueElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows serving indicator on right side when right is serving', () => {
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={true}
        />
      );

      const saqueElements = screen.getAllByText('Saque');
      expect(saqueElements.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show serving indicator when neither is serving', () => {
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
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

  describe('set indicators', () => {
    it('renders set indicators for completed sets', () => {
      const data = createTTSportDisplay({ leftSets: 2, rightSets: 1 });

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
          isReferee={true}
        />
      );

      // set indicators are rendered as colored circles (2 on left + 1 on right = 3 total amber dots)
      const dots = document.querySelectorAll('.bg-amber');
      expect(dots.length).toBe(3);
    });

    it('renders no filled sets when neither side has won any', () => {
      const data = createTTSportDisplay({ leftSets: 0, rightSets: 0 });

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
          isReferee={true}
        />
      );

      const filledDots = document.querySelectorAll('.bg-amber');
      expect(filledDots.length).toBe(0);
    });
  });

  describe('referee interactions', () => {
    it('calls onScorePoint with A when left side is tapped as referee', () => {
      const onScorePoint = vi.fn();
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
          isReferee={true}
          onScorePoint={onScorePoint}
        />
      );

      // Find the left section and click it
      const sections = document.querySelectorAll('section');
      const leftSection = sections[0];
      if (leftSection) fireEvent.click(leftSection);

      expect(onScorePoint).toHaveBeenCalledWith('A');
    });

    it('calls onScorePoint with B when right side is tapped as referee', () => {
      const onScorePoint = vi.fn();
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
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
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
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

  describe('swap sides button', () => {
    it('renders swap sides button when onSwapSides provided and isReferee', () => {
      const onSwapSides = vi.fn();
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
          isReferee={true}
          onSwapSides={onSwapSides}
        />
      );

      const button = screen.getByLabelText('Intercambiar lados');
      expect(button).toBeInTheDocument();
    });

    it('does not render swap sides button when onSwapSides is not provided', () => {
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
          isReferee={true}
        />
      );

      expect(screen.queryByLabelText('Intercambiar lados')).not.toBeInTheDocument();
    });

    it('does not render swap sides button when not referee', () => {
      const onSwapSides = vi.fn();
      const data = createTTSportDisplay();

      render(
        <TTPointDisplay
          sportDisplay={data}
          leftPlayerName="Alice"
          rightPlayerName="Bob"
          totalSets={3}
          leftServing={false}
          rightServing={false}
          isReferee={false}
          onSwapSides={onSwapSides}
        />
      );

      expect(screen.queryByLabelText('Intercambiar lados')).not.toBeInTheDocument();
    });
  });
});
