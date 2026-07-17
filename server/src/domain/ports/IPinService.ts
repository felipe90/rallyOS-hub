/**
 * IPinService — PIN generation and validation interface.
 *
 * Domain-level contract for PIN management. Implementations handle
 * generation (e.g., crypto-random 4-digit) and validation with
 * constant-time comparison to prevent timing attacks.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { Court } from '../types';

export interface IPinService {
  /** Generate a new PIN string (typically 4-digit numeric) */
  generatePin(): string;

  /**
   * Validate a PIN for a given court using constant-time comparison.
   * Returns true only when the PIN matches the court's current PIN.
   */
  validatePin(court: Court, pin: string): boolean;
}
