/**
 * Tab — stateless tab trigger button.
 *
 * Material Design 3 inspired: text label, no background,
 * 4px primary indicator on active tab, hover state layer.
 */

import type { MouseEventHandler, ReactNode } from 'react'

export interface TabProps {
  /** Stable id; used to wire `aria-controls` to the matching `tabpanel`. */
  id: string
  /** User-visible label. */
  label: string
  /** Optional icon rendered before the label. */
  icon?: ReactNode
  /** Whether this tab is the currently-selected one. */
  active?: boolean
  /** Disabled tabs cannot be activated and are skipped by click handlers. */
  disabled?: boolean
  /** Click handler; TabContainer wires this to its active-tab setter. */
  onClick?: () => void
  /** Additional classes. */
  className?: string
}

export function Tab({ id, label, icon, active = false, disabled = false, onClick, className = '' }: TabProps) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault()
    onClick?.()
  }

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls={`tabpanel-${id}`}
      disabled={disabled}
      onClick={handleClick}
      data-active={active}
      className={`
        relative flex-1 flex items-center justify-center px-4 min-h-[48px] text-sm font-medium tracking-wide
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        hover:bg-black/[0.04] dark:hover:bg-white/[0.04]
        after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-t-full
        after:transition-colors after:duration-200
        ${active
          ? 'text-primary after:bg-primary'
          : 'text-text/50 hover:text-text/80 after:bg-transparent'}
        ${className}
      `}
    >
      <span className="flex items-center gap-1.5">
        {icon && <span className="[&_svg]:size-4">{icon}</span>}
        {label}
      </span>
    </button>
  )
}