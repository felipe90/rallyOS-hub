import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreDisplay, ScorePair } from './ScoreDisplay';
import type { Score } from '@shared/types';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('ScoreDisplay', () => {
  describe('rendering', () => {
    it('renders score number correctly', () => {
      render(<ScoreDisplay score={5} player="A" />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders player label', () => {
      render(<ScoreDisplay score={0} player="B" />);
      expect(screen.getByText('Player B')).toBeInTheDocument();
    });

    it('renders meta text when provided', () => {
      render(<ScoreDisplay score={10} player="A" meta="Player Name" />);
      expect(screen.getByText('Player Name')).toBeInTheDocument();
    });
  });

  describe('serving player highlighting', () => {
    it('shows serving indicator when serving is true', () => {
      render(<ScoreDisplay score={5} player="A" serving />);
      const indicator = document.querySelector('.animate-pulse');
      expect(indicator).toBeInTheDocument();
    });

    it('does not show serving indicator when not serving', () => {
      render(<ScoreDisplay score={5} player="A" serving={false} />);
      const indicator = document.querySelector('.animate-pulse');
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('winner state', () => {
    it('applies ring class when winner is true', () => {
      render(<ScoreDisplay score={21} player="A" winner />);
      const scoreContainer = screen.getByText('21').closest('div');
      expect(scoreContainer).toHaveClass('ring-2');
    });

    it('applies scale animation class when winner', () => {
      render(<ScoreDisplay score={21} player="A" winner />);
      const scoreContainer = screen.getByText('21').closest('div');
      expect(scoreContainer).toHaveClass('ring-amber');
    });
  });

  describe('score color based on state', () => {
    it('applies surface-high background when serving', () => {
      render(<ScoreDisplay score={5} player="A" serving />);
      const scoreContainer = screen.getByText('5').closest('div');
      expect(scoreContainer).toHaveClass('bg-surface-high');
    });

    it('applies surface background when not serving', () => {
      render(<ScoreDisplay score={5} player="A" serving={false} />);
      const scoreContainer = screen.getByText('5').closest('div');
      expect(scoreContainer).toHaveClass('bg-surface');
    });
  });
});

describe('ScorePair', () => {
  const mockScore: Score = { a: 5, b: 3 };

  it('renders both scores correctly', () => {
    render(
      <ScorePair
        score={mockScore}
        serving="A"
        playerNames={{ a: 'Juan', b: 'Pedro' }}
      />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows player names', () => {
    render(
      <ScorePair
        score={mockScore}
        serving="A"
        playerNames={{ a: 'Juan', b: 'Pedro' }}
      />
    );
    expect(screen.getByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('Pedro')).toBeInTheDocument();
  });

  it('shows serving player indicator', () => {
    render(
      <ScorePair
        score={mockScore}
        serving="A"
        playerNames={{ a: 'Juan', b: 'Pedro' }}
      />
    );
    const indicators = document.querySelectorAll('.animate-pulse');
    expect(indicators).toHaveLength(1);
  });

  it('displays total points counter', () => {
    render(
      <ScorePair
        score={mockScore}
        serving="A"
        playerNames={{ a: 'Juan', b: 'Pedro' }}
      />
    );
    expect(screen.getByText('#8')).toBeInTheDocument();
  });

  it('displays vs text between scores', () => {
    render(
      <ScorePair
        score={mockScore}
        serving="A"
        playerNames={{ a: 'Juan', b: 'Pedro' }}
      />
    );
    expect(screen.getByText('vs')).toBeInTheDocument();
  });
});