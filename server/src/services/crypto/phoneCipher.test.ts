/**
 * phoneCipher — AES-256-GCM encrypt/decrypt pure helpers.
 *
 * Coverage (spec: `player-identity` → "Client-Side Phone Encryption", and
 * `phone-reveal` → "Phone Reveal Is Explicit And Audited"):
 * - encrypt/decrypt round-trip restores original plaintext
 * - key mismatch fails (auth tag verification fails)
 * - tampered auth-tag fails
 * - tampered ciphertext fails
 * - generateKey returns a base64 string that decodes to 32 bytes
 * - different keys produce different ciphertexts for the same plaintext
 * - fresh nonce per call → same input produces different ciphertexts,
 *   but all decrypt back to the same plaintext
 *
 * Pure helpers — no I/O, no module-level state. Safe to call concurrently.
 */

import crypto from 'crypto';
import {
  encryptPhone,
  decryptPhone,
  generateKey,
} from './phoneCipher';

describe('phoneCipher — AES-256-GCM helpers', () => {
  describe('generateKey', () => {
    it('returns a base64 string that decodes to exactly 32 bytes (AES-256 key)', () => {
      const key = generateKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);

      const bytes = Buffer.from(key, 'base64');
      expect(bytes.length).toBe(32);
    });

    it('produces a cryptographically distinct key on each call (randomness sanity)', () => {
      const a = generateKey();
      const b = generateKey();
      expect(a).not.toBe(b);
    });
  });

  describe('encryptPhone / decryptPhone round-trip', () => {
    it('restores the original plaintext phone after encrypt then decrypt (happy path)', () => {
      const key = generateKey();
      const phone = '+54 11 5555-1234';

      const ciphertext = encryptPhone(phone, key);
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toBe(phone); // not plaintext passthrough
      expect(ciphertext.length).toBeGreaterThan(0);

      const recovered = decryptPhone(ciphertext, key);
      expect(recovered).toBe(phone);
    });

    it('handles unicode / non-ASCII phone formatting characters', () => {
      const key = generateKey();
      const phone = '+1 (555) 010-ención'; // mixed unicode + digits + spaces
      const recovered = decryptPhone(encryptPhone(phone, key), key);
      expect(recovered).toBe(phone);
    });

    it('handles an empty plaintext (edge)', () => {
      const key = generateKey();
      const recovered = decryptPhone(encryptPhone('', key), key);
      expect(recovered).toBe('');
    });

    it('uses a fresh random nonce per encryption — same plaintext+key yields different ciphertexts', () => {
      const key = generateKey();
      const phone = '+54 11 1234-5678';

      const c1 = encryptPhone(phone, key);
      const c2 = encryptPhone(phone, key);
      expect(c1).not.toBe(c2);

      // Both must still decrypt back to the same plaintext under the same key.
      expect(decryptPhone(c1, key)).toBe(phone);
      expect(decryptPhone(c2, key)).toBe(phone);
    });
  });

  describe('decryptPhone failure modes (auth-tag integrity)', () => {
    it('throws when the key does not match the one used to encrypt (auth tag mismatch)', () => {
      const keyA = generateKey();
      const keyB = generateKey();
      const ciphertext = encryptPhone('confidential', keyA);

      // Decrypting with a different key MUST fail — AES-GCM auth tag will not verify.
      expect(() => decryptPhone(ciphertext, keyB)).toThrow();
    });

    it('throws when the auth-tag component is tampered with', () => {
      const key = generateKey();
      const ciphertext = encryptPhone('confidential', key);

      // Format: {nonceB64}:{ciphertextB64}:{authTagB64}
      const parts = ciphertext.split(':');
      expect(parts).toHaveLength(3);

      // Flip one character in the auth tag so it no longer verifies.
      const tamperedTag = parts[2].length > 0 && parts[2][0] === 'A'
        ? 'B' + parts[2].slice(1)
        : 'A' + parts[2].slice(1);
      const tampered = `${parts[0]}:${parts[1]}:${tamperedTag}`;

      expect(() => decryptPhone(tampered, key)).toThrow();
    });

    it('throws when the ciphertext component is tampered with', () => {
      const key = generateKey();
      const ciphertext = encryptPhone('confidential', key);
      const parts = ciphertext.split(':');

      // Flip one bit in the ciphertext body (not the tag) — the auth tag WILL
      // catch the modification.
      const tamperedBody = parts[1].length > 0 && parts[1][0] === 'A'
        ? 'B' + parts[1].slice(1)
        : 'A' + parts[1].slice(1);
      const tampered = `${parts[0]}:${tamperedBody}:${parts[2]}`;

      expect(() => decryptPhone(tampered, key)).toThrow();
    });

    it('throws on a malformed ciphertext string (missing components)', () => {
      const key = generateKey();
      expect(() => decryptPhone('not-a-valid-format', key)).toThrow();
      expect(() => decryptPhone('only-one-part', key)).toThrow();
      expect(() => decryptPhone('', key)).toThrow();
    });
  });

  describe('decryptPhone with wrong key — never returns garbage', () => {
    it('never returns a partial plaintext when the key is wrong (auth tag guarantees)', () => {
      const key = generateKey();
      const wrong = generateKey();
      const ciphertext = encryptPhone('+541112345678', key);

      let threw = false;
      try {
        decryptPhone(ciphertext, wrong);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);

      // Sanity: the correct key still recovers the original value.
      expect(decryptPhone(ciphertext, key)).toBe('+541112345678');
    });
  });

  // Sanity: the format on the wire is the documented `{nonce}:{ciphertext}:{authTag}`
  // triple of base64 strings. Phone-reveal (server-side decrypt) depends on
  // this exact wire format.
  describe('wire format', () => {
    it('produces a string with exactly three colon-separated base64 segments', () => {
      const key = generateKey();
      const ciphertext = encryptPhone('+5491100000000', key);
      const segments = ciphertext.split(':');
      expect(segments).toHaveLength(3);

      // Each segment decodes as base64 without throwing.
      for (const seg of segments) {
        expect(Buffer.from(seg, 'base64').length).toBeGreaterThan(0);
      }
    });
  });
});

// Silence unused-import warnings in case the test file is loaded without Node's
// crypto module auto-binding (it isn't actually used here directly, but keep
// the import for parity with other crypto-heavy test files).
void crypto;