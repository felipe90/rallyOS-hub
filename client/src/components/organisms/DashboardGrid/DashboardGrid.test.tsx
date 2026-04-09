import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardGrid, DashboardHeader } from './DashboardGrid';
import type { TableInfo } from '../../../shared/types';

const mockTables: TableInfo[] = [
  {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'WAITING',
    playerCount: 0,
  },
  {
    id: 'table-2',
    number: 2,
    name: 'Mesa 2',
    status: 'LIVE',
    playerCount: 2,
    playerNames: { a: 'Player A', b: 'Player B' },
  },
  {
    id: 'table-3',
    number: 3,
    name: 'Mesa 3',
    status: 'FINISHED',
    playerCount: 2,
  },
];

describe('DashboardGrid', () => {
  it('renders list of tables in grid mode', () => {
    render(<DashboardGrid tables={mockTables} viewMode="grid" />);
    expect(screen.getAllByText('Mesa 1')).toHaveLength(2);
    expect(screen.getAllByText('Mesa 2')).toHaveLength(2);
    expect(screen.getAllByText('Mesa 3')).toHaveLength(2);
  });

  it('renders list of tables in list mode', () => {
    render(<DashboardGrid tables={mockTables} viewMode="list" />);
    expect(screen.getAllByText('Mesa 1')).toHaveLength(2);
    expect(screen.getAllByText('Mesa 2')).toHaveLength(2);
  });

  it('calls onTableClick when table is clicked', () => {
    const handleClick = vi.fn();
    render(<DashboardGrid tables={mockTables} onTableClick={handleClick} />);
    
    const firstTable = screen.getAllByText('Mesa 1')[0].closest('div');
    fireEvent.click(firstTable!);
    expect(handleClick).toHaveBeenCalledWith('table-1');
  });

  it('displays correct status indicators', () => {
    render(<DashboardGrid tables={mockTables} />);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('shows empty state when no tables', () => {
    render(<DashboardGrid tables={[]} />);
    expect(screen.queryByText(/Mesa/)).not.toBeInTheDocument();
  });

  it('renders grid with correct responsive classes', () => {
    const { container } = render(<DashboardGrid tables={mockTables} viewMode="grid" />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  });
});

describe('DashboardHeader', () => {
  it('renders dashboard title and stats', () => {
    render(
      <DashboardHeader
        totalTables={5}
        liveMatches={2}
        activePlayers={10}
        viewMode="grid"
        onViewModeChange={() => {}}
      />
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls onViewModeChange when grid button is clicked', () => {
    const handleChange = vi.fn();
    render(
      <DashboardHeader
        totalTables={5}
        liveMatches={2}
        activePlayers={10}
        viewMode="list"
        onViewModeChange={handleChange}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Grid view'));
    expect(handleChange).toHaveBeenCalledWith('grid');
  });

  it('calls onViewModeChange when list button is clicked', () => {
    const handleChange = vi.fn();
    render(
      <DashboardHeader
        totalTables={5}
        liveMatches={2}
        activePlayers={10}
        viewMode="grid"
        onViewModeChange={handleChange}
      />
    );
    
    fireEvent.click(screen.getByLabelText('List view'));
    expect(handleChange).toHaveBeenCalledWith('list');
  });

  it('has accessible button labels', () => {
    render(
      <DashboardHeader
        totalTables={5}
        liveMatches={2}
        activePlayers={10}
        viewMode="grid"
        onViewModeChange={() => {}}
      />
    );
    
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
  });
});