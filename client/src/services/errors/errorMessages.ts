/**
 * Error messages
 *
 * Centralized error message map for the application.
 * Uses i18nText singleton — no React dependencies.
 */

import type { ValidationError } from '@shared/types'
import { i18nText } from '@/i18n'

/**
 * Get a human-readable error message for an error code.
 */
export function getErrorMessage(
  code: string,
  error?: ValidationError,
): string {
  const keyMap: Record<string, string> = {
    INVALID_PIN: 'errorsInvalidPin',
    INVALID_OWNER_PIN: 'errorsInvalidOwnerPin',
    RATE_LIMITED: 'errorsRateLimited',
    REF_ALREADY_ACTIVE: 'errorsRefAlreadyActive',
    TABLE_NOT_FOUND: 'errorsCourtNotFound',
    UNAUTHORIZED: 'errorsUnauthorized',
    VALIDATION_ERROR: 'errorsValidationError',
    NOT_OWNER: 'errorsNotOwner',
  }

  const key = keyMap[code]

  if (!key) {
    return i18nText('errorsUnknownError', { code })
  }

  if (key === 'errorsValidationError' && error) {
    return i18nText(key, { field: error.field, message: error.message })
  }

  if (key === 'errorsValidationError') {
    return i18nText('errorsValidationErrorFallback', { code })
  }

  return i18nText(key)
}
