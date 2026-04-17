/**
 * Scoreboard permission rules - Unit tests
 */

import { describe, it, expect } from 'vitest'
import {
  canEditScoreboard,
  canConfigureMatch,
  canViewMatchHistory,
} from './scoreboard'

describe('canEditScoreboard', () => {
  it('returns true for referee in referee mode', () => {
    expect(canEditScoreboard('referee', 'referee')).toBe(true)
  })

  it('returns true for owner in referee mode', () => {
    expect(canEditScoreboard('owner', 'referee')).toBe(true)
  })

  it('returns false for referee in view mode', () => {
    expect(canEditScoreboard('referee', 'view')).toBe(false)
  })

  it('returns false for owner in view mode', () => {
    expect(canEditScoreboard('owner', 'view')).toBe(false)
  })

  it('returns false for viewer in referee mode', () => {
    expect(canEditScoreboard('viewer', 'referee')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(canEditScoreboard(null, 'referee')).toBe(false)
  })
})

describe('canConfigureMatch', () => {
  it('returns true for referee in referee mode', () => {
    expect(canConfigureMatch('referee', 'referee')).toBe(true)
  })

  it('returns true for owner in referee mode', () => {
    expect(canConfigureMatch('owner', 'referee')).toBe(true)
  })

  it('returns false for referee in view mode', () => {
    expect(canConfigureMatch('referee', 'view')).toBe(false)
  })

  it('returns false for viewer', () => {
    expect(canConfigureMatch('viewer', 'referee')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(canConfigureMatch(null, 'referee')).toBe(false)
  })
})

describe('canViewMatchHistory', () => {
  it('returns true for referee', () => {
    expect(canViewMatchHistory('referee')).toBe(true)
  })

  it('returns false for owner', () => {
    expect(canViewMatchHistory('owner')).toBe(false)
  })

  it('returns false for viewer', () => {
    expect(canViewMatchHistory('viewer')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(canViewMatchHistory(null)).toBe(false)
  })
})