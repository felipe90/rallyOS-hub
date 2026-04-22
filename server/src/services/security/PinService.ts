/**
 * PinService - PIN generation and validation
 *
 * Responsibility: Generate and validate PINs.
 */

import crypto from 'crypto';
import { Table } from '../../types';

export class PinService {
  generatePin(): string {
    return crypto.randomInt(1000, 9999).toString();
  }

  validatePin(table: Table, pin: string): boolean {
    return table.pin === pin;
  }
}
