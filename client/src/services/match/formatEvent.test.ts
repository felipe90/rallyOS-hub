import { describe, it, expect } from 'vitest'
import { formatEvent } from './formatEvent'
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

describe('formatEvent', () => {
  it('formats POINT event', () => {
    const event = createEvent({
      action: 'POINT',
      player: 'A',
      pointsAfter: { a: 5, b: 3 },
    })
    expect(formatEvent(event)).toBe('A: 5-3')
  })

  it('formats POINT event for player B', () => {
    const event = createEvent({
      action: 'POINT',
      player: 'B',
      pointsAfter: { a: 2, b: 7 },
    })
    expect(formatEvent(event)).toBe('B: 2-7')
  })

  it('formats SET_WON event', () => {
    const event = createEvent({
      action: 'SET_WON',
      player: 'A',
      pointsAfter: { a: 11, b: 5 },
      setNumber: 2,
    })
    expect(formatEvent(event)).toBe('Set 2 - A 11-5')
  })

  it('formats SET_WON event for player B', () => {
    const event = createEvent({
      action: 'SET_WON',
      player: 'B',
      pointsAfter: { a: 8, b: 11 },
      setNumber: 1,
    })
    expect(formatEvent(event)).toBe('Set 1 - B 11-8')
  })

  it('formats SET_WON with unknown set number', () => {
    const event = createEvent({
      action: 'SET_WON',
      player: 'A',
      pointsAfter: { a: 11, b: 9 },
    })
    expect(formatEvent(event)).toBe('Set ? - A 11-9')
  })

  it('formats CORRECTION event', () => {
    const event = createEvent({
      action: 'CORRECTION',
      pointsAfter: { a: 3, b: 4 },
    })
    expect(formatEvent(event)).toBe('Corr: 3-4')
  })

  it('formats unknown action as string', () => {
    const event = createEvent({
      action: 'UNKNOWN' as any,
    })
    expect(formatEvent(event)).toBe('UNKNOWN')
  })
})
