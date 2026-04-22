import { describe, it, expect } from 'vitest'
import { getErrorMessage, ERROR_MESSAGES } from './errorMessages'

describe('getErrorMessage', () => {
  it('returns simple message for known code', () => {
    expect(getErrorMessage('INVALID_PIN')).toBe('PIN de mesa incorrecto')
  })

  it('returns owner pin message', () => {
    expect(getErrorMessage('INVALID_OWNER_PIN')).toBe('PIN de organizador incorrecto')
  })

  it('returns dynamic message for VALIDATION_ERROR', () => {
    expect(getErrorMessage('VALIDATION_ERROR', { field: 'name', message: 'required' } as any))
      .toBe('Campo inválido: name — required')
  })

  it('returns fallback for VALIDATION_ERROR without error detail', () => {
    expect(getErrorMessage('VALIDATION_ERROR')).toBe('Error de validación: VALIDATION_ERROR')
  })

  it('returns unknown error for unknown code', () => {
    expect(getErrorMessage('UNKNOWN_CODE')).toBe('Error desconocido: UNKNOWN_CODE')
  })

  it('has all expected error codes', () => {
    expect(ERROR_MESSAGES.INVALID_PIN).toBeDefined()
    expect(ERROR_MESSAGES.INVALID_OWNER_PIN).toBeDefined()
    expect(ERROR_MESSAGES.RATE_LIMITED).toBeDefined()
    expect(ERROR_MESSAGES.REF_ALREADY_ACTIVE).toBeDefined()
    expect(ERROR_MESSAGES.TABLE_NOT_FOUND).toBeDefined()
    expect(ERROR_MESSAGES.UNAUTHORIZED).toBeDefined()
    expect(ERROR_MESSAGES.VALIDATION_ERROR).toBeDefined()
    expect(ERROR_MESSAGES.NOT_OWNER).toBeDefined()
  })
})
