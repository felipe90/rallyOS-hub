/**
 * AdminPinService — scrypt-based admin PIN hashing and verification
 *
 * One-way hash for the admin PIN (chosen at setup) stored in ClubConfig.
 * Uses crypto.scryptSync with a random salt to protect the PIN at rest,
 * and timingSafeEqual for constant-time verification.
 *
 * Format: salt:hash (both hex-encoded) — stored in ClubConfig.adminPinHash
 */

import crypto from 'crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export class AdminPinService {
  /**
   * Hash a PIN with scrypt.
   * Returns a `salt:hash` string (both hex-encoded).
   */
  hashPin(pin: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hash = crypto.scryptSync(pin, salt, KEY_LENGTH).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify a PIN against a stored hash (salt:hash format).
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifyPin(pin: string, hash: string): boolean {
    const parts = hash.split(':');
    if (parts.length !== 2) {
      return false;
    }

    const [salt, storedHash] = parts;

    try {
      const derivedHash = crypto.scryptSync(pin, salt, KEY_LENGTH).toString('hex');

      const derivedBuf = Buffer.from(derivedHash, 'hex');
      const storedBuf = Buffer.from(storedHash, 'hex');

      if (derivedBuf.length !== storedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedBuf, storedBuf);
    } catch {
      return false;
    }
  }
}
