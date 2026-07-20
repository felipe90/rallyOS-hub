/**
 * TabContainer — manages active-tab state, renders tab triggers + the
 * active tab's content panel.
 *
 * Uncontrolled by design: parent passes a `tabs` array and an optional
 * `defaultTab`. Switching is internal. ARIA tab pattern: the container
 * renders `role="tablist"`, each trigger is a `role="tab"` (via `Tab`),
 * and the active content renders inside a `role="tabpanel"` labelled by
 * the active tab.
 */

import { useState, type ReactNode } from 'react'
import { Tab } from './Tab'

export interface TabDefinition {
  id: string
  label: string
  content: ReactNode
  disabled?: boolean
}

export interface TabContainerProps {
  tabs: TabDefinition[]
  /** Initial active tab id; defaults to the first tab. */
  defaultTab?: string
  className?: string
}

export function TabContainer({ tabs, defaultTab, className }: TabContainerProps) {
  const fallback = tabs[0]?.id
  const [activeId, setActiveId] = useState<string | undefined>(defaultTab ?? fallback)

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 border-b border-surface-high">
        {tabs.map((t) => (
          <Tab
            key={t.id}
            id={t.id}
            label={t.label}
            active={t.id === activeTab?.id}
            disabled={t.disabled}
            onClick={() => setActiveId(t.id)}
          />
        ))}
      </div>

      {activeTab ? (
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
          className="pt-4"
        >
          {activeTab.content}
        </div>
      ) : null}
    </div>
  )
}