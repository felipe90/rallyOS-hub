import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Icon, LayoutGridIcon, ListIcon, HistoryIcon, UndoIcon, SettingsIcon, type IconName } from './index'
import React from 'react'

describe('Icon', () => {
  describe('rendering', () => {
    it('renders SVG icon when valid name provided', () => {
      render(<Icon name="check" />)
      const svg = document.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('lucide', 'lucide-check')
    })

    it('renders trophy icon', () => {
      render(<Icon name="trophy" />)
      expect(document.querySelector('svg')).toBeInTheDocument()
    })

    it('renders users icon', () => {
      render(<Icon name="users" />)
      expect(document.querySelector('svg')).toBeInTheDocument()
    })

    it('renders different icon names correctly', () => {
      const iconNames = ['plus', 'minus', 'settings', 'x', 'check', 'clock']
      iconNames.forEach(name => {
        const { container } = render(<Icon name={name as any} />)
        expect(container.querySelector('svg')).toBeInTheDocument()
      })
    })
  })

  describe('size prop', () => {
    it('applies custom size to icon', () => {
      render(<Icon name="check" size={32} />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('width', '32')
      expect(svg).toHaveAttribute('height', '32')
    })

    it('uses default size of 24 when not provided', () => {
      render(<Icon name="check" />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('width', '24')
      expect(svg).toHaveAttribute('height', '24')
    })

    it('applies small size', () => {
      render(<Icon name="check" size={16} />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('width', '16')
      expect(svg).toHaveAttribute('height', '16')
    })

    it('applies large size', () => {
      render(<Icon name="check" size={48} />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('width', '48')
      expect(svg).toHaveAttribute('height', '48')
    })
  })

  describe('color prop', () => {
    it('applies color class to icon', () => {
      render(<Icon name="check" className="text-red-500" />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveClass('text-red-500')
    })

    it('applies custom className alongside default', () => {
      render(<Icon name="settings" className="custom-class" />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveClass('custom-class')
    })
  })

  describe('variant prop', () => {
    it('applies outline variant (default strokeWidth)', () => {
      render(<Icon name="check" variant="outline" />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('stroke-width', '1.5')
    })

    it('applies filled variant with higher strokeWidth', () => {
      render(<Icon name="check" variant="filled" />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('stroke-width', '2')
    })
  })

  describe('accessibility', () => {
    it('has aria-hidden by default from Lucide', () => {
      render(<Icon name="check" />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })

    it('accepts aria-label for accessibility', () => {
      render(<Icon name="check" aria-label="Check icon" />)
      expect(screen.getByLabelText('Check icon')).toBeInTheDocument()
    })

    it('accepts aria-hidden prop', () => {
      render(<Icon name="check" aria-hidden={false} />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'false')
    })
  })

  describe('error handling', () => {
    it('logs warning for unknown icon name', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      render(<Icon name={('unknown-icon' as unknown) as IconName} />)
      expect(warnSpy).toHaveBeenCalledWith('Icon "unknown-icon" not found')
      warnSpy.mockRestore()
    })

    it('returns null for unknown icon', () => {
      const { container } = render(<Icon name={('unknown-icon' as unknown) as IconName} />)
      expect(container.firstChild).toBeNull()
    })
  })
})

describe('Convenience Icon Components', () => {
  it('LayoutGridIcon renders correctly', () => {
    render(<LayoutGridIcon />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('ListIcon renders correctly', () => {
    render(<ListIcon />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('HistoryIcon renders correctly', () => {
    render(<HistoryIcon />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('UndoIcon renders correctly', () => {
    render(<UndoIcon />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('SettingsIcon renders correctly', () => {
    render(<SettingsIcon />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('convenience components accept LucideProps', () => {
    render(<SettingsIcon size={32} className="test-class" />)
    const svg = document.querySelector('svg')
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveClass('test-class')
  })
})