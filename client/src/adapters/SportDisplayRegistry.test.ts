import { describe, it, expect } from 'vitest'
import { SPORT } from '@shared/types'
import { SportDisplayRegistry } from './SportDisplayRegistry'

describe('SportDisplayRegistry', () => {
  const registry = new SportDisplayRegistry()

  describe('resolve', () => {
    it('returns PadelDisplayAdapter for SPORT.PADEL', () => {
      const adapter = registry.resolve(SPORT.PADEL)
      expect(adapter.sport).toBe(SPORT.PADEL)
    })

    it('returns TableTennisDisplayAdapter for SPORT.TABLE_TENNIS', () => {
      const adapter = registry.resolve(SPORT.TABLE_TENNIS)
      expect(adapter.sport).toBe(SPORT.TABLE_TENNIS)
    })

    it('falls back to TableTennisDisplayAdapter for undefined sport', () => {
      const adapter = registry.resolve(undefined)
      expect(adapter.sport).toBe(SPORT.TABLE_TENNIS)
    })

    it('falls back to TableTennisDisplayAdapter for unknown sport', () => {
      const adapter = registry.resolve('pickleball' as any)
      expect(adapter.sport).toBe(SPORT.TABLE_TENNIS)
    })

    it('returns the same adapter instance on repeated calls (singleton)', () => {
      const a1 = registry.resolve(SPORT.PADEL)
      const a2 = registry.resolve(SPORT.PADEL)
      expect(a1).toBe(a2) // reference equality
    })

    it('returns same TT instance on repeated calls', () => {
      const a1 = registry.resolve(SPORT.TABLE_TENNIS)
      const a2 = registry.resolve(SPORT.TABLE_TENNIS)
      expect(a1).toBe(a2)
    })
  })
})
