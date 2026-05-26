import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerScoreArea } from './PlayerScoreArea';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        matchConfigHandicap: 'Desventaja',
      }
      return map[key] || key
    },
  }),
}));

describe('PlayerScoreArea', () => {
  const defaultProps = {
    isReferee: true,
    side: 'A' as const,
    playerName: 'Juan',
    score: 5,
    setsWon: 1,
    totalSets: 3,
    isServing: false,
    isLeft: true,
  };

  it('renders player name', () => {
    render(<PlayerScoreArea {...defaultProps} />);
    expect(screen.getByText('Juan')).toBeInTheDocument();
  });

  it('renders score number', () => {
    render(<PlayerScoreArea {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders default player name when empty', () => {
    render(<PlayerScoreArea {...defaultProps} playerName="" />);
    expect(screen.getByText('Player A')).toBeInTheDocument();
  });

  it('calls onScorePoint when tapped', () => {
    const onScorePoint = vi.fn();
    render(<PlayerScoreArea {...defaultProps} onScorePoint={onScorePoint} />);
    
    const section = screen.getByLabelText(/Área de Juan/);
    fireEvent.click(section);
    
    expect(onScorePoint).toHaveBeenCalledWith('A');
  });

  it('does NOT call onScorePoint when not referee', () => {
    const onScorePoint = vi.fn();
    render(<PlayerScoreArea {...defaultProps} isReferee={false} onScorePoint={onScorePoint} />);
    
    const section = screen.getByLabelText(/Área de Juan/);
    fireEvent.click(section);
    
    expect(onScorePoint).not.toHaveBeenCalled();
  });

  it('calls onSubtractPoint when undo clicked', () => {
    const onSubtractPoint = vi.fn();
    render(<PlayerScoreArea {...defaultProps} onSubtractPoint={onSubtractPoint} />);
    
    const undoButton = screen.getByLabelText(/Undo/);
    fireEvent.click(undoButton);
    
    expect(onSubtractPoint).toHaveBeenCalledWith('A');
  });

  it('does not show undo button when not referee', () => {
    render(<PlayerScoreArea {...defaultProps} isReferee={false} />);
    expect(screen.queryByLabelText(/Undo/)).not.toBeInTheDocument();
  });

  it('renders serving indicator when serving', () => {
    render(<PlayerScoreArea {...defaultProps} isServing={true} />);
    expect(screen.getByText('Saque')).toBeInTheDocument();
  });

  it('does not render serving indicator when not serving', () => {
    render(<PlayerScoreArea {...defaultProps} isServing={false} />);
    expect(screen.queryByText('Saque')).not.toBeInTheDocument();
  });

  it('renders handicap when provided', () => {
    render(<PlayerScoreArea {...defaultProps} handicap={2} />);
    expect(screen.getByText('+2 Desventaja')).toBeInTheDocument();
  });

  it('renders negative handicap', () => {
    render(<PlayerScoreArea {...defaultProps} handicap={-1} />);
    expect(screen.getByText('-1 Desventaja')).toBeInTheDocument();
  });

  it('renders set indicators', () => {
    render(<PlayerScoreArea {...defaultProps} setsWon={2} totalSets={3} />);
    const indicators = document.querySelectorAll('.rounded-full');
    expect(indicators.length).toBeGreaterThan(0);
  });

  // ── Task 3.1: Haptic feedback ──
  it('triggers haptic feedback on tap via navigator.vibrate', () => {
    const vibrateSpy = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibrateSpy });
    render(<PlayerScoreArea {...defaultProps} onScorePoint={vi.fn()} />);

    const section = screen.getByLabelText(/Área de Juan/);
    fireEvent.click(section);

    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it('triggers haptic feedback on undo via navigator.vibrate', () => {
    const vibrateSpy = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibrateSpy });
    render(<PlayerScoreArea {...defaultProps} onSubtractPoint={vi.fn()} />);

    const undoButton = screen.getByLabelText(/Undo/);
    fireEvent.click(undoButton);

    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it('does not throw when navigator.vibrate is undefined (Safari)', () => {
    vi.stubGlobal('navigator', {});
    render(<PlayerScoreArea {...defaultProps} onScorePoint={vi.fn()} />);

    const section = screen.getByLabelText(/Área de Juan/);
    expect(() => fireEvent.click(section)).not.toThrow();
  });

  // ── Task 3.1: Undo button outside tap area ──
  it('renders undo button outside the tappable motion.section', () => {
    const { container } = render(<PlayerScoreArea {...defaultProps} />);

    const section = screen.getByLabelText(/Área de Juan/);
    const undoButton = screen.getByLabelText(/Undo/);

    // The undo button must NOT be a descendant of the tappable section
    expect(section.contains(undoButton)).toBe(false);
  });

  it('undo button has increased touch target size (size-20 / 80px)', () => {
    render(<PlayerScoreArea {...defaultProps} />);

    const undoButton = screen.getByLabelText(/Undo/);
    expect(undoButton.className).toContain('size-20');
  });

  it('undo button has icon padding class', () => {
    render(<PlayerScoreArea {...defaultProps} />);

    const undoButton = screen.getByLabelText(/Undo/);
    expect(undoButton.className).toContain('p-4');
  });
});
