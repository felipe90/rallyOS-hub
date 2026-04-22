import { describe, it, expect, vi } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "recién" for recent events', () => {
    expect(formatRelativeTime(Date.now() - 30000)).toBe('recién')
  })

  it('returns minutes for events within an hour', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60000)).toBe('hace 5m')
  })

  it('returns hours for events within a day', () => {
    expect(formatRelativeTime(Date.now() - 2 * 3600000)).toBe('hace 2h')
  })

  it('returns full date for older events', () => {
    const result = formatRelativeTime(Date.now() - 48 * 3600000)
    expect(result).toContain('20')
    expect(result).toContain('abr')
  })
})
