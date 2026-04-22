/**
 * Error messages
 *
 * Centralized error message map for the application.
 * No React dependencies - testable in isolation.
 */

import type { ValidationError } from '@shared/types'

export const ERROR_MESSAGES: Record<
  string,
  string | ((error: ValidationError) => string)
> = {
  INVALID_PIN: 'PIN de mesa incorrecto',
  INVALID_OWNER_PIN: 'PIN de organizador incorrecto',
  RATE_LIMITED: 'Demasiados intentos. Esperá un minuto.',
  REF_ALREADY_ACTIVE: 'Ya hay un árbitro activo en esta mesa',
  TABLE_NOT_FOUND: 'Mesa no encontrada',
  UNAUTHORIZED: 'No autorizado',
  VALIDATION_ERROR: (error) => `Campo inválido: ${error.field} — ${error.message}`,
  NOT_OWNER: 'No tenés permisos de organizador',
}

/**
 * Get a human-readable error message for an error code.
 */
export function getErrorMessage(
  code: string,
  error?: ValidationError,
): string {
  const message = ERROR_MESSAGES[code]

  if (!message) {
    return `Error desconocido: ${code}`
  }

  if (typeof message === 'function') {
    return error ? message(error) : `Error de validación: ${code}`
  }

  return message
}
