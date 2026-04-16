/**
 * Scoreboard mode hook
 * Determines the current scoreboard mode from the URL path
 * 
 * Returns:
 * - isRefereeMode: true if URL ends with /referee
 * - isViewMode: true if URL ends with /view
 * - mode: 'referee' | 'view' | null
 */

import { useLocation } from 'react-router-dom'

export interface ScoreboardModeState {
  isRefereeMode: boolean
  isViewMode: boolean
  mode: 'referee' | 'view' | null
}

export function useScoreboardMode(): ScoreboardModeState {
  const location = useLocation()
  const path = location.pathname

  // Check URL path for mode
  const isRefereeMode = path.endsWith('/referee')
  const isViewMode = path.endsWith('/view')

  const mode: 'referee' | 'view' | null = isRefereeMode 
    ? 'referee' 
    : isViewMode 
      ? 'view' 
      : null

  return {
    isRefereeMode,
    isViewMode,
    mode,
  }
}
