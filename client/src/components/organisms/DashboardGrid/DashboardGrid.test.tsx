import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardGrid, DashboardHeader } from './DashboardGrid';
import type { CourtInfo, TableInfo, TableInfoWithPin } from '@shared/types';

// TableStatusChip (rendered via CourtStatusChip) resolves its action labels
// through useSportTerms, which requires SportContext. Default to tableTennis.
vi.mock('@/contexts/SportContext', () => ({
  useSport: () => ({ sport: 'tableTennis', sportLoaded: true }),
}))

// Provide default aria-labels for DashboardHeader buttons
const defaultHeaderProps = {
  gridViewLabel: 'Grid view',
  listViewLabel: 'List view',
}

const mockCourts: CourtInfo[] = [
  {
    id: 'court-1',
    number: 1,
    name: 'Cancha 1',
    status: 'WAITING',
    playerCount: 0,
  },
  {
    id: 'court-2',
    number: 2,
    name: 'Cancha 2',
    status: 'LIVE',
    playerCount: 2,
    playerNames: { a: 'Player A', b: 'Player B' },
  },
  {
    id: 'court-3',
    number: 3,
    name: 'Cancha 3',
    status: 'FINISHED',
    playerCount: 2,
  },
];

describe('DashboardGrid', () => {
  it('renders list of courts in grid mode', () => {
    render(<DashboardGrid courts={mockCourts} viewMode="grid" />);
    expect(screen.getAllByText('Cancha 1')).toHaveLength(1);
    expect(screen.getAllByText('Cancha 2')).toHaveLength(1);
    expect(screen.getAllByText('Cancha 3')).toHaveLength(1);
  });

  it('renders list of courts in list mode', () => {
    render(<DashboardGrid courts={mockCourts} viewMode="list" />);
    expect(screen.getAllByText('Cancha 1')).toHaveLength(1);
    expect(screen.getAllByText('Cancha 2')).toHaveLength(1);
  });

  it('calls onCourtClick when court is clicked', () => {
    const handleClick = vi.fn();
    render(<DashboardGrid courts={mockCourts} onCourtClick={handleClick} />);
    
    const firstCourt = screen.getByText('Cancha 1').closest('div');
    fireEvent.click(firstCourt!);
    expect(handleClick).toHaveBeenCalledWith('court-1');
  });

  it('displays correct status indicators', () => {
    render(<DashboardGrid courts={mockCourts} />);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('In play')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('shows empty state when no courts', () => {
    render(<DashboardGrid courts={[]} />);
    expect(screen.queryByText(/Cancha/)).not.toBeInTheDocument();
  });

  it('renders grid with correct responsive classes', () => {
    const { container } = render(<DashboardGrid courts={mockCourts} viewMode="grid" />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  });
});

describe('DashboardHeader', () => {
  it('renders view mode toggle', () => {
    render(
      <DashboardHeader
        totalTables={5}
        liveMatches={2}
        activePlayers={10}
        viewMode="grid"
        onViewModeChange={() => {}}
        {...defaultHeaderProps}
      />
    );
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
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
        {...defaultHeaderProps}
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
        {...defaultHeaderProps}
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
        {...defaultHeaderProps}
      />
    );
    
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
  });
});
describe('DashboardGrid — Generar PIN (referee free-play)', () => {
  function court(over: Partial<TableInfo> = {}): TableInfo {
    return {
      id: 'c1',
      number: 1,
      name: 'Mesa 1',
      status: 'WAITING',
      playerCount: 0,
      mode: 'tournament',
      ...over,
    } as TableInfo;
  }

  function renderGrid(over: Partial<Parameters<typeof DashboardGrid>[0]> = {}) {
    return render(
      <DashboardGrid
        courts={over.courts ?? [court()]}
        viewMode="grid"
        showPin
        onGeneratePin={vi.fn()}
        {...over}
      />,
    );
  }

  it('shows Generar PIN for a free WAITING court without a PIN', () => {
    renderGrid({ courts: [court({ availability: 'IDLE' })] });
    expect(screen.getByRole('button', { name: /generar pin/i })).toBeInTheDocument();
  });

  it('hides Generar PIN for a court in play (LIVE)', () => {
    renderGrid({ courts: [court({ status: 'LIVE', availability: 'BUSY' })] });
    expect(screen.queryByRole('button', { name: /generar pin/i })).not.toBeInTheDocument();
  });

  it('hides Generar PIN when the bracket references the court', () => {
    renderGrid({
      courts: [court({ availability: 'IDLE' })],
      bracketAssignedCourtIds: ['c1'],
    });
    expect(screen.queryByRole('button', { name: /generar pin/i })).not.toBeInTheDocument();
  });

  it('hides Generar PIN when the court already has a PIN', () => {
    renderGrid({
      courts: [{ ...court({ availability: 'IDLE' }), pin: '1234' } as TableInfoWithPin],
    });
    // The court has a pin on the row → no generate button.
    expect(screen.queryByRole('button', { name: /generar pin/i })).not.toBeInTheDocument();
  });
});
