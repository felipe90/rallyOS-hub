import { describe, it, expect } from 'vitest'
import {
  validateTablePin,
  validateOwnerPin,
  validatePinLength,
} from './pin'
import { PIN_RULES } from '@shared/validation'

describe('validateTablePin', () => {
  it('returns true for 4-digit PIN', () => {
    expect(validateTablePin('1234')).toBe(true)
  })

  it('returns false for 3-digit PIN', () => {
    expect(validateTablePin('123')).toBe(false)
  })

  it('returns false for 5-digit PIN', () => {
    expect(validateTablePin('12345')).toBe(false)
  })

  it('returns false for non-numeric PIN', () => {
    expect(validateTablePin('12ab')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateTablePin('')).toBe(false)
  })

  it('uses shared PIN_RULES for consistency', () => {
    expect(PIN_RULES.tablePin.pattern).toEqual(/^\d{4}$/)
    expect(PIN_RULES.tablePin.minLength).toBe(4)
    expect(PIN_RULES.tablePin.maxLength).toBe(4)
  })
})

describe('validateOwnerPin', () => {
  it('returns true for 8-digit PIN', () => {
    expect(validateOwnerPin('12345678')).toBe(true)
  })

  it('returns false for 7-digit PIN', () => {
    expect(validateOwnerPin('1234567')).toBe(false)
  })

  it('returns false for non-numeric PIN', () => {
    expect(validateOwnerPin('1234567a')).toBe(false)
  })

  it('uses shared PIN_RULES for consistency', () => {
    expect(PIN_RULES.ownerPin.pattern).toEqual(/^\d{8}$/)
    expect(PIN_RULES.ownerPin.minLength).toBe(8)
    expect(PIN_RULES.ownerPin.maxLength).toBe(8)
  })
})

describe('validatePinLength', () => {
  it('validates exact length with digits only', () => {
    expect(validatePinLength('1234', 4)).toBe(true)
    expect(validatePinLength('123', 4)).toBe(false)
    expect(validatePinLength('12ab', 4)).toBe(false)
  })
})
