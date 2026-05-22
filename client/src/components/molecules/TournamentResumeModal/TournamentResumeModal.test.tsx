import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TournamentResumeModal } from './TournamentResumeModal'

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        'tournamentResumeTitle': 'Previous Tournament Found',
        'tournamentResumeDescription': 'Load previous tournament or start a new one?',
        'tournamentResumeMatches': 'Saved matches',
        'tournamentResumeLastSaved': 'Last saved',
        'tournamentResumeLoad': 'Load',
        'tournamentResumeNew': 'New',
      }
      return map[key] || key
    },
    language: 'en-US',
    changeLanguage: vi.fn(),
  }),
}))

const defaultProps = {
  isOpen: true,
  matchCount: 3,
  lastSaved: '2026-05-21T15:30:00Z',
  onLoad: vi.fn(),
  onNew: vi.fn(),
}

describe('TournamentResumeModal', () => {
  // ── Rendering ──────────────────────────────────────────────────────

  it('renders when isOpen is true', () => {
    render(<TournamentResumeModal {...defaultProps} />)
    expect(screen.getByText('Previous Tournament Found')).toBeInTheDocument()
    expect(screen.getByText('Load previous tournament or start a new one?')).toBeInTheDocument()
    expect(screen.getByText('Load')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<TournamentResumeModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Previous Tournament Found')).not.toBeInTheDocument()
    expect(screen.queryByText('Load')).not.toBeInTheDocument()
  })

  // ── Match count display ────────────────────────────────────────────

  it('displays the match count from props', () => {
    render(<TournamentResumeModal {...defaultProps} matchCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows match count label via i18n', () => {
    render(<TournamentResumeModal {...defaultProps} />)
    expect(screen.getByText('Saved matches')).toBeInTheDocument()
  })

  // ── Last saved date display ────────────────────────────────────────

  it('displays a formatted version of the last saved date', () => {
    render(<TournamentResumeModal {...defaultProps} lastSaved="2026-05-21T15:30:00Z" />)
    // Date is formatted with toLocaleDateString — at minimum the year should appear
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('shows last saved label via i18n', () => {
    render(<TournamentResumeModal {...defaultProps} />)
    expect(screen.getByText('Last saved')).toBeInTheDocument()
  })

  it('handles missing lastSaved gracefully', () => {
    render(<TournamentResumeModal {...defaultProps} lastSaved={null as unknown as string} />)
    // Should not crash — still renders the buttons
    expect(screen.getByText('Load')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  // ── Load button ────────────────────────────────────────────────────

  it('calls onLoad when Load button is clicked', () => {
    const onLoad = vi.fn()
    render(<TournamentResumeModal {...defaultProps} onLoad={onLoad} />)
    fireEvent.click(screen.getByText('Load'))
    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  // ── New button ─────────────────────────────────────────────────────

  it('calls onNew when New button is clicked', () => {
    const onNew = vi.fn()
    render(<TournamentResumeModal {...defaultProps} onNew={onNew} />)
    fireEvent.click(screen.getByText('New'))
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  // ── Blocks dismissal ───────────────────────────────────────────────

  it('does NOT close when backdrop is clicked (blocks dismissal)', () => {
    const onLoad = vi.fn()
    const onNew = vi.fn()
    render(<TournamentResumeModal {...defaultProps} onLoad={onLoad} onNew={onNew} />)

    // Click the backdrop element (the outer fixed div with bg-black/50)
    const backdrop = document.querySelector('.bg-black\\/50')
    if (backdrop) {
      fireEvent.click(backdrop)
    }

    // Modal should still be visible (no onLoad/onNew call means no action triggered)
    expect(onLoad).not.toHaveBeenCalled()
    expect(onNew).not.toHaveBeenCalled()
    expect(screen.getByText('Previous Tournament Found')).toBeInTheDocument()
  })

  it('does NOT respond to Escape key (blocks dismissal)', () => {
    const onLoad = vi.fn()
    const onNew = vi.fn()
    render(<TournamentResumeModal {...defaultProps} onLoad={onLoad} onNew={onNew} />)

    const overlay = document.querySelector('.fixed.inset-0.z-50')
    if (overlay) {
      fireEvent.keyDown(overlay, { key: 'Escape' })
    }

    // Modal should still be visible
    expect(onLoad).not.toHaveBeenCalled()
    expect(onNew).not.toHaveBeenCalled()
    expect(screen.getByText('Previous Tournament Found')).toBeInTheDocument()
  })
})
