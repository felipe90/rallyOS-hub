import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryDrawer } from './HistoryDrawer';
import type { ScoreChange } from '@shared/types';

// Mock useI18n to return translated strings
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'historyDrawerTitle': 'Historial',
        'historyNoEventsYet': 'Sin eventos aún',
        'commonPlayerA': 'Player A',
        'commonPlayerB': 'Player B',
        'historyEventTypePoint': 'Punto',
        'historyEventTypeSetWon': 'Set ganado',
        'historyEventTypeCorrection': 'Corrección',
      }
      return map[key] || key
    },
  }),
  i18nText: (key: string) => key,
  default: { language: 'es' },
}))

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
    render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={handleUndo} />
    );
    
    // Undo button is now permanently visible with aria-label
    const undoButton = screen.getByLabelText('historyUndo');
    expect(undoButton).toBeInTheDocument();
    fireEvent.click(undoButton);
    expect(handleUndo).toHaveBeenCalledWith('event-1');
  });

  it('undo button is permanently visible (no opacity-0/group-hover reliance)', () => {
    const { container } = render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );

    const undoButton = screen.getByLabelText('historyUndo');
    // Must NOT have opacity-0 or group-hover:opacity-100 classes
    expect(undoButton.className).not.toContain('opacity-0');
    expect(undoButton.className).not.toContain('group-hover');
  });

  it('undo button has visible background styling', () => {
    render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );

    const undoButton = screen.getByLabelText('historyUndo');
    expect(undoButton.className).toContain('bg-amber/10');
    expect(undoButton.className).toContain('hover:bg-amber/20');
  });

  it('undo button has focus-visible ring for keyboard accessibility', () => {
    render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );

    const undoButton = screen.getByLabelText('historyUndo');
    expect(undoButton.className).toContain('focus-visible:ring-2');
    expect(undoButton.className).toContain('focus-visible:ring-amber/50');
  });

  it('renders scrollable content area', () => {
    const { container } = render(
      <HistoryDrawer isOpen={true} onClose={() => {}} events={mockEvents} onUndo={() => {}} />
    );
    expect(container.querySelector('.overflow-y-auto')).toBeInTheDocument();
  });
});