/**
 * SportDisplayAdapter — Frontend Strategy Pattern
 *
 * Mirrors the backend's SportRules interface. Each sport implementation
 * encapsulates all sport-specific UI logic: score computation, component
 * selection, config validation, side-swap extraction.
 *
 * Adding a new sport: implements this interface + register in registry.
 * Zero changes needed to existing adapters or consumers.
 */

import type { ReactNode } from 'react'
import type { Sport, SportDisplayScore, Score, MatchStateExtended, MatchConfig, Player } from '@shared/types'
import { SPORT } from '@shared/types'

// ── Adapter Interface ───────────────────────────────────────────────

export interface SportDisplayAdapter {
  /** Sport identifier */
  readonly sport: Sport

  /** i18n key for display name (e.g. 'sportTableTennis' → 'Tenis de Mesa') */
  readonly displayKey: string

  /**
   * Transform MatchStateExtended → UI-ready display data.
   * @param state — current match state (extended with runtime fields)
   * @param swapped — whether sides are currently swapped
   */
  computeDisplayData(state: MatchStateExtended, swapped?: boolean): SportDisplayScore

  /** The React component that renders this sport's score visual.
   *  Type is loose (any props) because each sport component has its own
   *  narrowed SportDisplayScore subtype. The adapter contract guarantees
   *  the correct component is paired with the correct data at runtime. */
  readonly DisplayComponent: React.ComponentType<any>

  /**
   * Extract the "current scoring unit" values.
   * TT: points per current set. Padel: games per current set.
   */
  getCurrentScores(state: MatchStateExtended): { a: number; b: number }

  /** Extract the serving player from match state */
  getServing(state: MatchStateExtended): Player

  /** Whether this sport supports handicap scoring */
  needsHandicap(): boolean

  /** Default match configuration for this sport */
  getConfigDefaults(): Partial<MatchConfig>

  /**
   * Validate sport-specific config fields.
   * Returns array of error message strings (empty = valid).
   */
  validateConfig(config: Record<string, unknown>): string[]

  /** Config fields for the MatchConfigModal form */
  getConfigFields(): ConfigField[]

  /**
   * Transform Score[] set history into sport-appropriate display format.
   * Each set shows the core scoring unit for that sport.
   */
  formatSetHistory(setHistory: Score[]): FormattedSet[]
}

// ── Supporting Types ─────────────────────────────────────────────────

/** Common props passed to every DisplayComponent */
export interface SportDisplayProps {
  sportDisplay: SportDisplayScore
  leftPlayerName: string
  rightPlayerName: string
  totalSets: number
  leftServing: boolean
  rightServing: boolean
  leftSets?: number
  rightSets?: number
  isReferee?: boolean
  onScorePoint?: (side: 'A' | 'B') => void
  onSubtractPoint?: (side: 'A' | 'B') => void
}

/** Config field descriptor for dynamic form generation in MatchConfigModal */
export interface ConfigField {
  name: string
  type: 'number' | 'select' | 'boolean'
  label: string
  min?: number
  max?: number
  options?: Array<{ value: string | number; label: string }>
  visible?: boolean
}

/** Sport-appropriate formatted set for display (e.g., ScoreboardBar) */
export interface FormattedSet {
  left: number
  right: number
  label: string
}
