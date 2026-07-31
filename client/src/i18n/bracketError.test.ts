import { describe, it, expect } from 'vitest'
import {
  bracketErrorTranslationKey,
  toCamelCase,
} from './bracketError'

describe('toCamelCase', () => {
  it('converts UPPER_SNAKE to camelCase', () => {
    expect(toCamelCase('INVALID_SIZE')).toBe('invalidSize')
  })

  it('handles single token', () => {
    expect(toCamelCase('UNAUTHORIZED')).toBe('unauthorized')
  })

  it('handles three segments', () => {
    expect(toCamelCase('MATCH_NOT_READY')).toBe('matchNotReady')
  })

  it('handles empty/falsy by returning generic', () => {
    expect(toCamelCase('')).toBe('generic')
  })
})

describe('bracketErrorTranslationKey', () => {
  it('maps known codes to bracketError.<camel>', () => {
    expect(bracketErrorTranslationKey('INVALID_SIZE')).toBe('bracketError.invalidSize')
    expect(bracketErrorTranslationKey('NAME_TOO_LONG')).toBe('bracketError.nameTooLong')
    expect(bracketErrorTranslationKey('MATCH_NOT_READY')).toBe('bracketError.matchNotReady')
    expect(bracketErrorTranslationKey('COURT_NOT_FOUND')).toBe('bracketError.courtNotFound')
    expect(bracketErrorTranslationKey('COURT_ALREADY_ASSIGNED')).toBe('bracketError.courtAlreadyAssigned')
  })

  it('maps RESET_EXPIRED to resetExpired', () => {
    expect(bracketErrorTranslationKey('RESET_EXPIRED')).toBe('bracketError.resetExpired')
  })

  it('maps INVALID_TOKEN to invalidToken', () => {
    expect(bracketErrorTranslationKey('INVALID_TOKEN')).toBe('bracketError.invalidToken')
  })

  it('maps NO_BRACKET to noBracket', () => {
    expect(bracketErrorTranslationKey('NO_BRACKET')).toBe('bracketError.noBracket')
  })

  it('falls back to generic for unknown codes (incl. deprecated aliases)', () => {
    expect(bracketErrorTranslationKey('SOMETHING_NEW')).toBe('bracketError.generic')
    expect(bracketErrorTranslationKey('')).toBe('bracketError.generic')
    // Codes removed from the map fall back to generic
    expect(bracketErrorTranslationKey('MATCH_NOT_COMPLETED')).toBe('bracketError.generic')
    expect(bracketErrorTranslationKey('BRACKET_NOT_FOUND')).toBe('bracketError.generic')
    expect(bracketErrorTranslationKey('TOKEN_EXPIRED')).toBe('bracketError.generic')
    expect(bracketErrorTranslationKey('TOKEN_INVALID')).toBe('bracketError.generic')
  })
})