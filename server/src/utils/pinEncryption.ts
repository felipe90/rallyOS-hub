/**
 * PIN Encryption Utility
 *
 * Uses AES-256-GCM encryption for secure PIN transport.
 * Format output: {iv}:{ciphertext}:{authTag} (all hex encoded)
 * Key derivation: HMAC-SHA256(tableId, serverSecret)
 */

import crypto from 'crypto';
import { logger } from './logger';

/**
 * Get or generate server secret from environment
 */
function getServerSecret(): string {
  const envSecret = process.env.ENCRYPTION_SECRET;
  if (envSecret) {
    return envSecret;
  }

  // Generate a random secret at startup if not provided
  if (!(globalThis as any)._RALLYOS_ENCRYPTION_SECRET) {
    (globalThis as any)._RALLYOS_ENCRYPTION_SECRET = crypto.randomBytes(32).toString('hex');
    logger.warn('ENCRYPTION_SECRET not set, using random secret generated at startup');
  }
  return (globalThis as any)._RALLYOS_ENCRYPTION_SECRET;
}

/**
 * Derive encryption key from tableId and server secret using HMAC-SHA256
 */
function deriveKey(tableId: string): Buffer {
  const serverSecret = getServerSecret();
  return crypto.createHmac('sha256', serverSecret).update(tableId).digest();
}

/**
 * Encrypt a PIN
 * @param pin - 4 digit PIN
 * @param tableId - Table ID for key derivation
 * @returns Encrypted string in format {iv}:{ciphertext}:{authTag}
 */
export function encryptPin(pin: string, tableId: string): string {
  const key = deriveKey(tableId);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(pin, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const timestamp = Date.now().toString();
  return `${iv.toString('hex')}:${ciphertext}:${authTag.toString('hex')}:${timestamp}`;
}

/**
 * Decrypt a PIN from encrypted string
 * @param encryptedString - String in format {iv}:{ciphertext}:{authTag}:{timestamp}
 * @param tableId - Table ID for key derivation
 * @returns Original PIN or null if decryption fails
 */
export function decryptPin(encryptedString: string, tableId: string): string | null {
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 4) {
      logger.error('Invalid PIN format - expected iv:ciphertext:authTag:timestamp');
      return null;
    }

    const [ivHex, ciphertext, authTagHex, timestamp] = parts;

    // Check if expired (24 hours)
    const age = Date.now() - parseInt(timestamp, 10);
    const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    if (age > EXPIRY_MS) {
      logger.warn('PIN expired');
      return null;
    }

    const key = deriveKey(tableId);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Validate it's a 4-digit number
    if (!/^\d{4}$/.test(decrypted)) {
      logger.error('Decrypted PIN invalid format');
      return null;
    }

    return decrypted;
  } catch (error) {
    logger.error({ error }, 'Decryption failed');
    return null;
  }
}

/**
 * Encrypt PIN for URL query parameter
 * Uses Base64 encoding for URL safety
 */
export function encryptPinForUrl(pin: string, tableId: string): string {
  const encrypted = encryptPin(pin, tableId);
  // Base64 encode and make URL-safe
  return Buffer.from(encrypted).toString('base64url');
}

/**
 * Decrypt PIN from URL query parameter
 */
export function decryptPinFromUrl(encryptedUrl: string, tableId: string): string | null {
  try {
    // Decode from URL-safe Base64
    const decoded = Buffer.from(encryptedUrl, 'base64url').toString('utf8');
    return decryptPin(decoded, tableId);
  } catch (error) {
    logger.error({ error }, 'URL decryption failed');
    return null;
  }
}
