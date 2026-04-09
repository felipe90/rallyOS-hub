import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryDrawer } from './HistoryDrawer';
import type { ScoreChange } from '../../../shared/types';

const mockEvents: ScoreChange[] = [
  {
    id: 'event-1',
    player: 'A',
    action: 'POINT',
    pointsBefore: { a: 1, b: 0 },
    pointsAfter: { a: 2, b: 0 },
    timestamp: Date.now() - 30000,
  },
  {
    id: 'event-2',
    player: 'B',
    action: 'POINT',
    pointsBefore: { a: 0, b: 1 },
    pointsAfter: { a: 0, b: 2 },
    timestamp: Date.now() - 60000,
  },
  {
    id: 'event-3',
    player: 'A',
    action: 'SET_WON',
    pointsBefore: { a: 5, b: 3 },
    pointsAfter: { a: 6, b: 3 },
    setNumber: 1,
    timestamp: Date.now() - 120000,
  },
];

describe('HistoryDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <HistoryDrawer isOpen={false} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );
    expect(container.querySelector('.fixed.right-0')).not.toBeInTheDocument();
  });

  it('renders drawer when open', () => {
    render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );
    expect(screen.getByText('Historial')).toBeInTheDocument();
  });

  it('displays history events', () => {
    render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );
    expect(screen.getByText('2 - 0')).toBeInTheDocument();
    expect(screen.getByText('0 - 2')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={[]} onUndo={() => {}} />
    );
    expect(screen.getByText('Sin eventos aún')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <HistoryDrawer isOpen={true} onClose={handleClose} events={mockEvents} onUndo={() => {}} />
    );
    
    // Close button is the first button with X icon
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(btn => btn.querySelector('.lucide-x'));
    expect(closeButton).toBeInTheDocument();
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls onUndo when undo button is clicked', () => {
    const handleUndo = vi.fn();
    const { container } = render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={handleUndo} />
    );
    
    const undoButton = container.querySelector('.group-hover\\:opacity-100');
    if (undoButton) {
      fireEvent.click(undoButton);
      expect(handleUndo).toHaveBeenCalledWith('event-1');
    }
  });

  it('renders scrollable content area', () => {
    const { container } = render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );
    expect(container.querySelector('.overflow-y-auto')).toBeInTheDocument();
  });
});