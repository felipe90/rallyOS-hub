/**
 * Preferences storage service
 *
 * Abstracts localStorage access for UI preferences (orientation, coachmark dismissals).
 * No React dependencies - testable in isolation.
 */

const KEY_ORIENTATION = 'orientation'
const KEY_COACHMARK_PREFIX = 'coachmark-dismissed-'

export const preferencesStorage = {
  /**
   * Get stored orientation preference.
   * @returns 'landscape' | 'portrait' | null
   */
  getOrientation: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(KEY_ORIENTATION)
  },

  /**
   * Set orientation preference.
   */
  setOrientation: (value: 'landscape' | 'portrait'): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(KEY_ORIENTATION, value)
  },

  /**
   * Check if a coachmark has been dismissed.
   */
  isCoachmarkDismissed: (id: string): boolean => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`${KEY_COACHMARK_PREFIX}${id}`) === 'true'
  },

  /**
   * Mark a coachmark as dismissed (won't show again).
   */
  dismissCoachmark: (id: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`${KEY_COACHMARK_PREFIX}${id}`, 'true')
  },

  /**
   * Reset a coachmark dismissal (show again).
   */
  resetCoachmark: (id: string): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(`${KEY_COACHMARK_PREFIX}${id}`)
  },
}
