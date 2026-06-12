import { describe, it, expect } from 'vitest'
import { validateCourtName, validateOwnerPinInput, validatePlayerName, MAX_COURT_NAME_LENGTH } from './auth'

describe('validateCourtName', () => {
  it('returns true for undefined', () => {
    expect(validateCourtName(undefined)).toBe(true)
  })

  it('returns true for valid name', () => {
    expect(validateCourtName('Mesa 1')).toBe(true)
  })

  it('returns false for name too long', () => {
    expect(validateCourtName('a'.repeat(MAX_COURT_NAME_LENGTH + 1))).toBe(false)
  })

  it('returns true for max length name', () => {
    expect(validateCourtName('a'.repeat(MAX_COURT_NAME_LENGTH))).toBe(true)
  })
})

describe('validateOwnerPinInput', () => {
  it('returns true for 8 digits', () => {
    expect(validateOwnerPinInput('12345678')).toBe(true)
  })

  it('returns false for 7 digits', () => {
    expect(validateOwnerPinInput('1234567')).toBe(false)
  })

  it('returns false for non-numeric', () => {
    expect(validateOwnerPinInput('1234567a')).toBe(false)
  })
})

describe('validatePlayerName', () => {
  it('returns true for undefined', () => {
    expect(validatePlayerName(undefined)).toBe(true)
  })

  it('returns true for valid name', () => {
    expect(validatePlayerName('Juan')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(validatePlayerName('')).toBe(false)
  })

  it('returns false for name too long', () => {
    expect(validatePlayerName('a'.repeat(51))).toBe(false)
  })
})
