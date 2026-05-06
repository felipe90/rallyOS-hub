import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionStatus } from './ConnectionStatus';
import { useSocketContext } from '../../../contexts/SocketContext';

vi.mock('../../../contexts/SocketContext', () => ({
  useSocketContext: vi.fn(),
}));

describe('ConnectionStatus', () => {
  const mockUseSocketContext = useSocketContext as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows connected status', () => {
    mockUseSocketContext.mockReturnValue({ connected: true, connecting: false, error: null });
    render(<ConnectionStatus labels={{ connected: 'Connected' }} />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows connecting status', () => {
    mockUseSocketContext.mockReturnValue({ connected: false, connecting: true, error: null });
    render(<ConnectionStatus labels={{ connecting: 'Connecting' }} />);
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  it('shows error status', () => {
    mockUseSocketContext.mockReturnValue({ connected: false, connecting: false, error: new Error('fail') });
    render(<ConnectionStatus labels={{ error: 'No Connection' }} />);
    expect(screen.getByText('No Connection')).toBeInTheDocument();
  });

  it('shows disconnected status', () => {
    mockUseSocketContext.mockReturnValue({ connected: false, connecting: false, error: null });
    render(<ConnectionStatus labels={{ disconnected: 'Disconnected' }} />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('renders wifi icon when connected', () => {
    mockUseSocketContext.mockReturnValue({ connected: true, connecting: false, error: null });
    render(<ConnectionStatus />);
    // The wifi icon is rendered via lucide-react SVG
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});
