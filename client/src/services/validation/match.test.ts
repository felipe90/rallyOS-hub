import { describe, it, expect } from 'vitest'
import { validateMatchConfig, MIN_POINTS_PER_SET, MAX_POINTS_PER_SET } from './match'

describe('validateMatchConfig', () => {
  it('returns valid for good config', () => {
    const result = validateMatchConfig({ pointsPerSet: 11, bestOf: 3, minDifference: 2 })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error for pointsPerSet too low', () => {
    const result = validateMatchConfig({ pointsPerSet: 0 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Puntos por set'))).toBe(true)
  })

  it('returns error for pointsPerSet too high', () => {
    const result = validateMatchConfig({ pointsPerSet: 100 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Puntos por set'))).toBe(true)
  })

  it('returns error for even bestOf', () => {
    const result = validateMatchConfig({ bestOf: 4 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Mejor de debe ser un número impar')
  })

  it('returns error for bestOf too high', () => {
    const result = validateMatchConfig({ bestOf: 11 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Mejor de'))).toBe(true)
  })

  it('returns error for negative handicap', () => {
    const result = validateMatchConfig({ handicapA: -1 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Handicap A debe estar entre 0 y 20')
  })

  it('returns multiple errors', () => {
    const result = validateMatchConfig({ pointsPerSet: 0, bestOf: 4 })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})
