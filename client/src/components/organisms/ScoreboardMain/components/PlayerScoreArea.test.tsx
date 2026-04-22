import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerScoreArea } from './PlayerScoreArea';

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
    expect(screen.getByText('+2 HCP')).toBeInTheDocument();
  });

  it('renders negative handicap', () => {
    render(<PlayerScoreArea {...defaultProps} handicap={-1} />);
    expect(screen.getByText('-1 HCP')).toBeInTheDocument();
  });

  it('renders set indicators', () => {
    render(<PlayerScoreArea {...defaultProps} setsWon={2} totalSets={3} />);
    const indicators = document.querySelectorAll('.rounded-full');
    expect(indicators.length).toBeGreaterThan(0);
  });
});
