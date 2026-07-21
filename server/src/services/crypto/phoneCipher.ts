/**
 * phoneCipher — AES-256-GCM pure helpers for club phone encryption.
 *
 * Spec: `player-identity` ("Client-Side Phone Encryption") and `phone-reveal`
 * ("Phone Reveal Is Explicit And Audited"). The client encrypts the player's
 * phone number with the club's `encryptionKey` (delivered on CLUB_JOIN_RESULT
 * and CLUB_ADMIN_OCCUPY response) before transmitting it to the server. The
 * server never decrypts inside client flows; it only stores the ciphertext
 * and later decrypts server-side on an explicit admin reveal request.
 *
 * Wire format: `{nonceB64}:{ciphertextB64}:{authTagB64}` — three colon-
 * separated base64 strings. AES-256-GCM was chosen so that tampering with any
 * byte of the ciphertext OR the auth tag causes `decryptPhone` to throw,
 * guaranteeing the integrity of every stored phone without a separate HMAC.
 *
 * This module is deliberately pure and side-effect free:
 * - no module-level state
 * - no I/O
 * - safe to call concurrently from multiple handlers
 *
 * Only Node's built-in `crypto` is used — no extra dependency, and the same
 * primitives are available in the browser via Web Crypto (`SubtleCrypto`).
 */

import crypto from 'crypto';

/** AES-256-GCM requires a 32-byte key. */
const KEY_BYTES = 32;

/** 96-bit nonce — the recommended length for GCM mode (do not change). */
const NONCE_BYTES = 12;

/**
 * Generate a fresh AES-256 key encoded as base64.
 *
 * Used by:
 * - ClubAdminHandler.CLUB_SETUP (auto-generate on first club setup)
 * - ClubPlayerHandler.CLUB_JOIN (auto-generate on first join when the
 *   ClubConfig lacks an `encryptionKey`, e.g. legacy clubs that pre-date this
 *   change)
 *
 * The returned key is safe to persist to `ClubConfig.encryptionKey`.
 */
export function generateKey(): string {
  return crypto.randomBytes(KEY_BYTES).toString('base64');
}

/**
 * Encrypt a plaintext phone with the given base64 key.
 *
 * @param plaintext  The player's phone in plain text. Validated upstream as
 *                   non-empty by the client (ClubSessionConfig form). The
 *                   empty-string case is still supported here for tests and
 *                   symmetry with `decryptPhone`.
 * @param keyB64     The base64 AES-256 key (from ClubConfig.encryptionKey).
 * @returns          `{nonce}:{ciphertext}:{authTag}` — all base64. A FRESH
 *                   random nonce is used on every call so the same plaintext
 *                   + key produces different ciphertexts across calls.
 */
export function encryptPhone(plaintext: string, keyB64: string): string {
  const key = decodeKey(keyB64);
  const nonce = crypto.randomBytes(NONCE_BYTES);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${nonce.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
}

/**
 * Decrypt a `{nonce}:{ciphertext}:{authTag}` wire-format string with the
 * given base64 key.
 *
 * Throws when:
 * - the key does not match (AES-GCM auth tag verification fails)
 * - the auth tag has been tampered with
 * - the ciphertext body has been tampered with
 * - the input is not in the documented 3-segment format
 *
 * Used server-side by the phone-reveal handler (Phase 4) to perform explicit
 * per-row decryption for an admin. Never invoked during normal session flow.
 */
export function decryptPhone(ciphertext: string, keyB64: string): string {
  const key = decodeKey(keyB64);

  const segments = ciphertext.split(':');
  if (segments.length !== 3) {
    throw new Error('Invalid ciphertext format — expected {nonce}:{ciphertext}:{authTag}');
  }

  const [nonceB64, bodyB64, tagB64] = segments;
  // Nonce and auth tag MUST be present (they carry the GCM security guarantees).
  // Body MAY be empty — encrypting an empty plaintext legitimately produces zero
  // ciphertext bytes, which base64-encodes to the empty string. Rejecting empty
  // body would break the empty-plaintext edge case.
  if (!nonceB64 || !tagB64) {
    throw new Error('Invalid ciphertext format — missing nonce or auth tag');
  }

  const nonce = Buffer.from(nonceB64, 'base64');
  const body = Buffer.from(bodyB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(body),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/**
 * Decode and validate a base64 AES-256 key. Throws if the key is not exactly
 * 32 bytes after base64 decode — catches programmer errors (e.g. wrong env
 * variable, truncated value) before they reach the cipher primitive.
 */
function decodeKey(keyB64: string): Buffer {
  if (typeof keyB64 !== 'string' || keyB64.length === 0) {
    throw new Error('phoneCipher: encryptionKey is empty');
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `phoneCipher: encryptionKey must decode to ${KEY_BYTES} bytes (got ${key.length})`,
    );
  }
  return key;
}