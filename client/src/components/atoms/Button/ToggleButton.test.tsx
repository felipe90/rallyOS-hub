import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleButton } from './ToggleButton';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

describe('ToggleButton', () => {
  it('renders with icon', () => {
    const icon = <span data-testid="icon">↻</span>;
    render(<ToggleButton icon={icon} onClick={() => {}} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const icon = <span>↻</span>;
    render(<ToggleButton icon={icon} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  describe('position variants', () => {
    it('renders with bottom-right position', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} position="bottom-right" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('bottom-6', 'right-6');
    });

    it('renders with bottom-left position', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} position="bottom-left" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('bottom-6', 'left-6');
    });

    it('renders with top-right position', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} position="top-right" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('top-6', 'right-6');
    });

    it('renders with top-left position', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} position="top-left" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('top-6', 'left-6');
    });
  });

  describe('size variants', () => {
    it('renders with sm size', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} size="sm" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('w-10', 'h-10');
    });

    it('renders with md size', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} size="md" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('w-12', 'h-12');
    });

    it('renders with lg size', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} size="lg" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('w-14', 'h-14');
    });
  });

  describe('active state', () => {
    it('has active state styling when active=true', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} active={true} />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('ring-2', 'ring-primary/30');
    });

    it('does not have active state styling when active=false', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} active={false} />
      );
      const button = container.querySelector('button');
      expect(button).not.toHaveClass('ring-2', 'ring-primary/30');
    });
  });

  describe('hover animation', () => {
    it('has hover animation class', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('hover:scale-110');
    });
  });

  describe('click animation', () => {
    it('has click animation class via motion whileTap', () => {
      const icon = <span>↻</span>;
      render(<ToggleButton icon={icon} onClick={() => {}} />);
      // WhileTap is a framer-motion prop, we verify the button renders
      const button = screen.getByRole('button');
      expect(button).toBeDefined();
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      const icon = <span>↻</span>;
      const { container } = render(
        <ToggleButton icon={icon} onClick={() => {}} className="custom-class" />
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  it('has correct aria-label', () => {
    const icon = <span>↻</span>;
    render(<ToggleButton icon={icon} onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Toggle orientation');
  });

  it('renders as fixed position button', () => {
    const icon = <span>↻</span>;
    const { container } = render(
      <ToggleButton icon={icon} onClick={() => {}} />
    );
    const button = container.querySelector('button');
    expect(button).toHaveClass('fixed');
  });

  it('has backdrop blur effect', () => {
    const icon = <span>↻</span>;
    const { container } = render(
      <ToggleButton icon={icon} onClick={() => {}} />
    );
    const button = container.querySelector('button');
    expect(button).toHaveClass('backdrop-blur-md');
  });

  it('has correct rounded shape', () => {
    const icon = <span>↻</span>;
    const { container } = render(
      <ToggleButton icon={icon} onClick={() => {}} />
    );
    const button = container.querySelector('button');
    expect(button).toHaveClass('rounded-full');
  });
});