import { describe, it, expect, vi } from 'vitest'
import { getErrorMessage } from './errorMessages'

// Mock i18nText to return predictable values
vi.mock('@/i18n', () => ({
  i18nText: (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      'errorsInvalidPin': 'PIN de mesa incorrecto',
      'errorsInvalidOwnerPin': 'PIN de organizador incorrecto',
      'errorsRateLimited': 'Demasiados intentos. Esperá un minuto.',
      'errorsRefAlreadyActive': 'Ya hay un árbitro activo en esta mesa',
      'errorsTableNotFound': 'Mesa no encontrada',
      'errorsUnauthorized': 'No autorizado',
      'errorsNotOwner': 'No tenés permisos de organizador',
    }
    if (key === 'errorsValidationError' && params) {
      return `Campo inválido: ${params.field} — ${params.message}`
    }
    if (key === 'errorsValidationErrorFallback') {
      return `Error de validación: ${params?.code || 'VALIDATION_ERROR'}`
    }
    if (key === 'errorsUnknownError') {
      return `Error desconocido: ${params?.code || 'UNKNOWN_CODE'}`
    }
    return map[key] || key
  },
}))

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
})
