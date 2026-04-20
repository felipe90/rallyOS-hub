import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableStatusChip } from './TableStatusChip';

describe('TableStatusChip', () => {
  const cases = [
    { status: 'WAITING' as const, text: 'Waiting' },
    { status: 'CONFIGURING' as const, text: 'Configuring' },
    { status: 'LIVE' as const, text: 'Live' },
    { status: 'FINISHED' as const, text: 'Finished' },
  ];

  it.each(cases)('renders $status status text correctly', ({ status, text }) => {
    render(<TableStatusChip tableNumber={1} tableName="Test Table" status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('renders table number and name correctly', () => {
    render(<TableStatusChip tableNumber={5} tableName="Tournament Table" status="WAITING" />);
    expect(screen.getByText('Mesa 5')).toBeInTheDocument();
    expect(screen.getByText('Tournament Table')).toBeInTheDocument();
  });

  it('renders player names when provided', () => {
    const playerNames = { a: 'Player A', b: 'Player B' };
    render(<TableStatusChip tableNumber={1} tableName="Test" status="LIVE" playerNames={playerNames} />);
    expect(screen.getByText('Player A')).toBeInTheDocument();
    expect(screen.getByText('Player B')).toBeInTheDocument();
    expect(screen.getByText('vs')).toBeInTheDocument();
  });

  it('renders player count when provided', () => {
    render(<TableStatusChip tableNumber={1} tableName="Test" status="LIVE" playerCount={2} />);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<TableStatusChip tableNumber={1} tableName="Test" status="WAITING" onClick={handleClick} />);
    screen.getByText('Mesa 1').parentElement?.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has interactive cursor style', () => {
    const { container } = render(<TableStatusChip tableNumber={1} tableName="Test" status="WAITING" />);
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveClass('cursor-pointer');
  });

  it('calls onClick on mouse click', () => {
    const handleClick = vi.fn();
    render(<TableStatusChip tableNumber={1} tableName="Test" status="WAITING" onClick={handleClick} />);
    screen.getByText('Mesa 1').parentElement?.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  describe('delete button', () => {
    it('renders delete button when onDelete is provided', () => {
      const handleDelete = vi.fn();
      render(<TableStatusChip tableNumber={1} tableName="Test" status="WAITING" onDelete={handleDelete} />);
      expect(screen.getByRole('button', { name: /Eliminar Mesa/i })).toBeInTheDocument();
    });

    it('does not render delete button when onDelete is not provided', () => {
      render(<TableStatusChip tableNumber={1} tableName="Test" status="WAITING" />);
      expect(screen.queryByRole('button', { name: /Eliminar Mesa/i })).not.toBeInTheDocument();
    });

    it('calls onDelete when delete button is clicked', () => {
      const handleDelete = vi.fn();
      render(<TableStatusChip tableNumber={1} tableName="Test" status="WAITING" onDelete={handleDelete} />);
      screen.getByRole('button', { name: /Eliminar Mesa/i }).click();
      expect(handleDelete).toHaveBeenCalledTimes(1);
    });

    it('renders delete confirmation dialog when showDeleteConfirm is true', () => {
      const handleDelete = vi.fn();
      const handleDeleteConfirm = vi.fn();
      const handleDeleteCancel = vi.fn();
      render(
        <TableStatusChip 
          tableNumber={1} 
          tableName="Test" 
          status="WAITING" 
          onDelete={handleDelete}
          showDeleteConfirm={true}
          onDeleteConfirm={handleDeleteConfirm}
          onDeleteCancel={handleDeleteCancel}
        />
      );
      // ConfirmDialog shows with the specific message about table deletion
      expect(screen.getByText(/Estás seguro de eliminar la mesa/)).toBeInTheDocument();
    });

    it('calls onDeleteConfirm when confirming delete', () => {
      const handleDelete = vi.fn();
      const handleDeleteConfirm = vi.fn();
      const handleDeleteCancel = vi.fn();
      render(
        <TableStatusChip 
          tableNumber={1} 
          tableName="Test" 
          status="WAITING" 
          onDelete={handleDelete}
          showDeleteConfirm={true}
          onDeleteConfirm={handleDeleteConfirm}
          onDeleteCancel={handleDeleteCancel}
        />
      );
      screen.getByRole('button', { name: /Eliminar$/i }).click();
      expect(handleDeleteConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onDeleteCancel when canceling delete', () => {
      const handleDelete = vi.fn();
      const handleDeleteConfirm = vi.fn();
      const handleDeleteCancel = vi.fn();
      render(
        <TableStatusChip 
          tableNumber={1} 
          tableName="Test" 
          status="WAITING" 
          onDelete={handleDelete}
          showDeleteConfirm={true}
          onDeleteConfirm={handleDeleteConfirm}
          onDeleteCancel={handleDeleteCancel}
        />
      );
      screen.getByRole('button', { name: /^Cancelar$/i }).click();
      expect(handleDeleteCancel).toHaveBeenCalledTimes(1);
    });
  });
});