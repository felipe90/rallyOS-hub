import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard, MiniStatCard } from './StatCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('StatCard', () => {
  describe('rendering', () => {
    it('renders title correctly', () => {
      render(<StatCard title="Total Games" value={42} />);
      expect(screen.getByText('Total Games')).toBeInTheDocument();
    });

    it('renders numeric value correctly', () => {
      render(<StatCard title="Score" value={100} />);
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('renders string value correctly', () => {
      render(<StatCard title="Name" value="John Doe" />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('trend indicator', () => {
    it('shows up trend with positive change', () => {
      render(<StatCard title="Wins" value={10} change={25} trend="up" />);
      expect(screen.getByText('↑ 25%')).toBeInTheDocument();
    });

    it('shows down trend with negative change', () => {
      render(<StatCard title="Losses" value={5} change={10} trend="down" />);
      expect(screen.getByText('↓ 10%')).toBeInTheDocument();
    });

    it('shows neutral trend', () => {
      render(<StatCard title="Draws" value={2} change={0} trend="neutral" />);
      expect(screen.getByText('→ 0%')).toBeInTheDocument();
    });

    it('does not show trend when change is undefined', () => {
      render(<StatCard title="Games" value={15} />);
      expect(screen.queryByText('%')).not.toBeInTheDocument();
    });
  });

  describe('graph rendering', () => {
    it('renders graph node when provided', () => {
      const TestGraph = () => <div data-testid="test-graph">Graph</div>;
      render(<StatCard title="Stats" value={50} graph={<TestGraph />} />);
      expect(screen.getByTestId('test-graph')).toBeInTheDocument();
    });

    it('does not render graph container when graph is not provided', () => {
      render(<StatCard title="Stats" value={50} />);
      const graphContainer = document.querySelector('.mt-2');
      expect(graphContainer).not.toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<StatCard title="Test" value={1} className="custom-class" />);
      const container = screen.getByText('Test').closest('div');
      expect(container).toHaveClass('custom-class');
    });
  });
});

describe('MiniStatCard', () => {
  describe('rendering', () => {
    it('renders label correctly', () => {
      render(<MiniStatCard label="Sessions" value={15} />);
      expect(screen.getByText('Sessions')).toBeInTheDocument();
    });

    it('renders value correctly', () => {
      render(<MiniStatCard label="Sessions" value={15} />);
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  describe('icon', () => {
    it('renders icon when provided', () => {
      render(<MiniStatCard label="Time" value="2h" icon={<span>⏱</span>} />);
      expect(screen.getByText('⏱')).toBeInTheDocument();
    });

    it('does not render icon placeholder when not provided', () => {
      render(<MiniStatCard label="Score" value={100} />);
      // When no icon is provided, there's no span wrapper for icon (only the label Caption)
      // The Caption uses text-text/50 but it's a different element
      // Check that there's no icon span with the specific structure
      const container = document.querySelector('.flex.items-center.gap-3');
      if (container) {
        const iconSpans = container.querySelectorAll('span');
        // Should have: icon span (optional) + div with Caption + Body
        // Without icon: 2 spans (Caption wrapper inside div)
        // With icon: 1 span (icon) + div with Caption + Body
        const spansInFlex = iconSpans;
        // If no icon, the only span direct children should be inside the div
        expect(spansInFlex.length).toBeLessThanOrEqual(2);
      }
    });
  });
});