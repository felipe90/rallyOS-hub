import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryList } from './HistoryList';

const mockHistory = [
  { action: 'POINT' as const, player: 'Player A', timestamp: Date.now() - 60000 },
  { action: 'POINT' as const, player: 'Player B', timestamp: Date.now() - 120000 },
  { action: 'UNDO' as const, player: 'Player A', timestamp: Date.now() - 180000 },
];

describe('HistoryList', () => {
  it('renders empty state when no items', () => {
    render(<HistoryList history={[]} />);
    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument();
  });

  it('renders empty state when history is undefined', () => {
    render(<HistoryList history={undefined as any} />);
    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument();
  });

  it('renders history items in compact mode', () => {
    render(<HistoryList history={mockHistory} compact={true} />);
    expect(screen.getAllByText(/Punto/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Deshacer/).length).toBeGreaterThan(0);
  });

  it('renders history items in full mode', () => {
    render(<HistoryList history={mockHistory} compact={false} />);
    expect(screen.getAllByText(/Punto/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Deshacer/).length).toBeGreaterThan(0);
  });

  it('displays POINT action correctly', () => {
    render(<HistoryList history={[{ action: 'POINT', player: 'Test Player', timestamp: Date.now() }]} />);
    expect(screen.getByText(/Punto/)).toBeInTheDocument();
  });

  it('displays UNDO action correctly', () => {
    render(<HistoryList history={[{ action: 'UNDO', player: 'Test Player', timestamp: Date.now() }]} />);
    expect(screen.getByText(/Deshacer/)).toBeInTheDocument();
  });

  it('shows edit button when onEdit is provided', () => {
    const onEdit = vi.fn();
    render(<HistoryList history={mockHistory} onEdit={onEdit} />);
    expect(screen.getAllByText('Editar').length).toBeGreaterThan(0);
  });

  it('shows delete button when onDelete is provided', () => {
    const onDelete = vi.fn();
    render(<HistoryList history={mockHistory} onDelete={onDelete} />);
    expect(screen.getAllByText('Eliminar').length).toBeGreaterThan(0);
  });

  it('calls onEdit with correct index', () => {
    const onEdit = vi.fn();
    render(<HistoryList history={mockHistory} onEdit={onEdit} />);
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith(0);
  });

  it('calls onDelete with correct index', () => {
    const onDelete = vi.fn();
    render(<HistoryList history={mockHistory} onDelete={onDelete} />);
    const deleteButtons = screen.getAllByText('Eliminar');
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(0);
  });

  it('displays player names correctly', () => {
    render(<HistoryList history={[{ action: 'POINT', player: 'John Doe', timestamp: Date.now() }]} />);
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('displays unknown player when player is undefined', () => {
    render(<HistoryList history={[{ action: 'POINT', player: undefined, timestamp: Date.now() }]} />);
    expect(screen.getByText(/Desconocido/)).toBeInTheDocument();
  });

  it('displays formatted timestamp', () => {
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    render(<HistoryList history={[{ action: 'POINT', player: 'Player', timestamp }]} />);
    expect(screen.getByText(/2:30/)).toBeInTheDocument();
  });

  it('displays emoji in action label', () => {
    render(<HistoryList history={[{ action: 'POINT', player: 'Player', timestamp: Date.now() }]} />);
    expect(screen.getByText(/⚽/)).toBeInTheDocument();
  });

  it('does not show action buttons in compact mode', () => {
    render(<HistoryList history={mockHistory} compact={true} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
  });
});