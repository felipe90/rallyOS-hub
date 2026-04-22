import { describe, it, expect } from 'vitest'
import { getEventColor } from './getEventColor'
import type { ScoreChange } from '@shared/types'

const createEvent = (overrides: Partial<ScoreChange> = {}): ScoreChange => ({
  id: 'evt-1',
  player: 'A',
  action: 'POINT',
  pointsBefore: { a: 0, b: 0 },
  pointsAfter: { a: 1, b: 0 },
  timestamp: Date.now(),
  ...overrides,
})

describe('getEventColor', () => {
  it('returns winner color for SET_WON', () => {
    const event = createEvent({ action: 'SET_WON' })
    expect(getEventColor(event)).toBe('text-[var(--color-score-winner)]')
  })

  it('returns player A color for A events', () => {
    const event = createEvent({ player: 'A', action: 'POINT' })
    expect(getEventColor(event)).toBe('text-[var(--color-score-player-a)]')
  })

  it('returns player B color for B events', () => {
    const event = createEvent({ player: 'B', action: 'POINT' })
    expect(getEventColor(event)).toBe('text-[var(--color-score-player-b)]')
  })

  it('returns neutral color when no player', () => {
    const event = createEvent({ player: undefined, action: 'CORRECTION' })
    expect(getEventColor(event)).toBe('text-[var(--color-score-neutral)]')
  })
})
