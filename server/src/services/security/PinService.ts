/**
 * PinService - PIN generation and validation
 *
 * Responsibility: Generate and validate PINs.
 * Uses constant-time comparison to prevent timing attacks.
 */

import crypto from 'crypto';
import { Table } from '../../types';

export class PinService {
  generatePin(): string {
    return crypto.randomInt(1000, 9999).toString();
  }

  /**
   * Validate a PIN against a table's PIN using constant-time comparison.
   * Prevents timing attacks that could leak PIN digits.
   */
  validatePin(table: Table, pin: string): boolean {
    const tablePinBuf = Buffer.from(table.pin, 'utf8');
    const inputPinBuf = Buffer.from(pin, 'utf8');

    // Different lengths → not equal (but still constant-time for same-length inputs)
    if (tablePinBuf.length !== inputPinBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(tablePinBuf, inputPinBuf);
  }
}
