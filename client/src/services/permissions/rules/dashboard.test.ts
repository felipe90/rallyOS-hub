/**
 * Dashboard permission rules - Unit tests
 */

import { describe, it, expect } from 'vitest'
import {
  canCreateTable,
  shouldShowPinColumn,
  shouldShowQrColumn,
} from './dashboard'

describe('canCreateTable', () => {
  it('returns true for owner', () => {
    expect(canCreateTable('owner')).toBe(true)
  })

  it('returns false for referee', () => {
    expect(canCreateTable('referee')).toBe(false)
  })

  it('returns false for viewer', () => {
    expect(canCreateTable('viewer')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(canCreateTable(null)).toBe(false)
  })
})

describe('shouldShowPinColumn', () => {
  it('returns true for owner', () => {
    expect(shouldShowPinColumn('owner')).toBe(true)
  })

  it('returns false for referee', () => {
    expect(shouldShowPinColumn('referee')).toBe(false)
  })

  it('returns false for viewer', () => {
    expect(shouldShowPinColumn('viewer')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(shouldShowPinColumn(null)).toBe(false)
  })
})

describe('shouldShowQrColumn', () => {
  it('returns true for owner', () => {
    expect(shouldShowQrColumn('owner')).toBe(true)
  })

  it('returns false for referee', () => {
    expect(shouldShowQrColumn('referee')).toBe(false)
  })

  it('returns false for viewer', () => {
    expect(shouldShowQrColumn('viewer')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(shouldShowQrColumn(null)).toBe(false)
  })
})