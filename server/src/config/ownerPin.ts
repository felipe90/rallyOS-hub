/**
 * Owner PIN configuration
 *
 * Single source of truth for the owner PIN.
 * Initialized at startup — imported by index.ts and app.ts.
 */

import crypto from 'crypto';

let _ownerPin: string | null = null;
let _isRandomPin = false;

/**
 * Initialize the owner PIN.
 * If TOURNAMENT_OWNER_PIN is set → use it (production).
 * If not set → generate random 8-digit PIN (plug-and-play Orange Pi).
 */
export function initOwnerPin(): { pin: string; isRandom: boolean } {
  if (process.env.TOURNAMENT_OWNER_PIN && process.env.TOURNAMENT_OWNER_PIN.trim() !== '') {
    _ownerPin = process.env.TOURNAMENT_OWNER_PIN;
    _isRandomPin = false;
  } else {
    _ownerPin = crypto.randomInt(10000000, 99999999).toString();
    _isRandomPin = true;
  }
  return { pin: _ownerPin, isRandom: _isRandomPin };
}

export function getOwnerPin(): string | null {
  return _ownerPin;
}

export function isRandomPin(): boolean {
  return _isRandomPin;
}
