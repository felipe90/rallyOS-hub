/**
 * useSportAdapter — Resolve the correct SportDisplayAdapter for a match.
 *
 * Uses useMemo keyed on match.sport to avoid unnecessary re-resolves.
 * Re-exports the registry for non-React contexts.
 */

import { useMemo } from 'react'
import { SPORT } from '@shared/types'
import type { Sport, MatchStateExtended } from '@shared/types'
import type { SportDisplayAdapter } from '../../adapters/SportDisplayAdapter'
import { SportDisplayRegistry } from '../../adapters/SportDisplayRegistry'

const registry = new SportDisplayRegistry()

export { SportDisplayRegistry } from '../../adapters/SportDisplayRegistry'

/**
 * React hook: resolve SportDisplayAdapter from match.sport.
 * Defaults to SPORT.TABLE_TENNIS when sport is undefined.
 * Re-memoizes only when match.sport changes.
 */
export function useSportAdapter(match: MatchStateExtended): SportDisplayAdapter {
  return useMemo(() => {
    const sport: Sport | undefined = (match as any).sport ?? SPORT.TABLE_TENNIS
    return registry.resolve(sport)
  }, [(match as any).sport])
}
