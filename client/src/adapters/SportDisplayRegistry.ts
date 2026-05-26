/**
 * SportDisplayRegistry — Maps Sport identifiers to SportDisplayAdapter instances.
 *
 * Singleton pattern: adapters created once at module load, reused across
 * all match instances. Adding a new sport = register new adapter here.
 */

import type { Sport } from '@shared/types'
import { SPORT } from '@shared/types'
import type { SportDisplayAdapter } from './SportDisplayAdapter'
import { TableTennisDisplayAdapter } from './TableTennisDisplayAdapter'
import { PadelDisplayAdapter } from './PadelDisplayAdapter'

// Adapters created once at module load (singletons)
const tableTennisAdapter = new TableTennisDisplayAdapter()
const padelAdapter = new PadelDisplayAdapter()

const adapterMap = new Map<Sport, SportDisplayAdapter>([
  [SPORT.TABLE_TENNIS, tableTennisAdapter],
  [SPORT.PADEL, padelAdapter],
])

export class SportDisplayRegistry {
  /**
   * Resolve a SportDisplayAdapter by sport identifier.
   * Falls back to TableTennisDisplayAdapter for unknown/missing sports.
   */
  resolve(sport?: Sport): SportDisplayAdapter {
    if (sport && adapterMap.has(sport)) {
      return adapterMap.get(sport)!
    }
    return tableTennisAdapter
  }
}
