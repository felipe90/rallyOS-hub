/**
 * Tab — stateless tab trigger button.
 *
 * Renders a single ARIA-compliant `role="tab"` button. State management
 * (active tab, content rendering) lives in `TabContainer`; this component
 * only reports clicks. Not meant to be used standalone outside a
 * TabContainer-driven context, but kept as its own atom so the trigger
 * affordance and the panel decorator can evolve independently.
 */

import type { MouseEventHandler } from 'react'

export interface TabProps {
  /** Stable id; used to wire `aria-controls` to the matching `tabpanel`. */
  id: string
  /** User-visible label. */
  label: string
  /** Whether this tab is the currently-selected one. */
  active?: boolean
  /** Disabled tabs cannot be activated and are skipped by click handlers. */
  disabled?: boolean
  /** Click handler; TabContainer wires this to its active-tab setter. */
  onClick?: () => void
}

export function Tab({ id, label, active = false, disabled = false, onClick }: TabProps) {
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
        px-4 py-2 text-sm font-medium border-b-2 transition-colors
        focus:outline-none focus:ring-2 focus:ring-primary/30
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        ${active
          ? 'border-primary text-primary'
          : 'border-transparent text-text/70 hover:text-text hover:border-text/30'}
      `}
    >
      {label}
    </button>
  )
}