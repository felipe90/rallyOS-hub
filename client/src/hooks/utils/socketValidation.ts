/**
 * Shared socket validation helpers
 */

export const validateName = (name?: string): boolean =>
  !name || (typeof name === 'string' && name.length <= 256)
