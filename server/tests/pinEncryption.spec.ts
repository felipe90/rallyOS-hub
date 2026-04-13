/**
 * PIN Encryption Tests - AES-256-GCM
 */

import { encryptPin, decryptPin, encryptPinForUrl, decryptPinFromUrl } from '../src/utils/pinEncryption';

describe('PIN Encryption - AES-256-GCM', () => {
  const testTableId = 'test-table-123';
  const testPin = '1234';

  test('encryptPin returns format iv:ciphertext:authTag:timestamp', () => {
    const encrypted = encryptPin(testPin, testTableId);
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(4);
    // All parts should be hex strings
    expect(parts[0]).toMatch(/^[0-9a-f]+$/i); // iv
    expect(parts[1]).toMatch(/^[0-9a-f]+$/i); // ciphertext
    expect(parts[2]).toMatch(/^[0-9a-f]+$/i); // authTag
    expect(parts[3]).toMatch(/^\d+$/); // timestamp
  });

  test('encryptPin and decryptPin round trip', () => {
    const encrypted = encryptPin(testPin, testTableId);
    const decrypted = decryptPin(encrypted, testTableId);
    expect(decrypted).toBe(testPin);
  });

  test('decryptPin fails with wrong tableId', () => {
    const encrypted = encryptPin(testPin, testTableId);
    const decrypted = decryptPin(encrypted, 'wrong-table-id');
    expect(decrypted).toBeNull();
  });

  test('decryptPin fails with tampered ciphertext', () => {
    const encrypted = encryptPin(testPin, testTableId);
    const parts = encrypted.split(':');
    // Tamper with ciphertext
    parts[1] = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'a' ? 'b' : 'a');
    const tampered = parts.join(':');
    const decrypted = decryptPin(tampered, testTableId);
    expect(decrypted).toBeNull();
  });

  test('decryptPin fails with invalid format', () => {
    const decrypted = decryptPin('invalid:format', testTableId);
    expect(decrypted).toBeNull();
  });

  test('PIN encryption produces different outputs for same PIN (random IV)', () => {
    const encrypted1 = encryptPin(testPin, testTableId);
    const encrypted2 = encryptPin(testPin, testTableId);
    expect(encrypted1).not.toBe(encrypted2);
  });

  test('encryptPinForUrl produces URL-safe base64', () => {
    const encryptedUrl = encryptPinForUrl(testPin, testTableId);
    // Should not contain +, /, or = (URL-unsafe characters)
    expect(encryptedUrl).not.toMatch(/[+/=]/);
  });

  test('decryptPinFromUrl round trip', () => {
    const encryptedUrl = encryptPinForUrl(testPin, testTableId);
    const decrypted = decryptPinFromUrl(encryptedUrl, testTableId);
    expect(decrypted).toBe(testPin);
  });

  test('rejects non-4-digit PINs', () => {
    const encrypted = encryptPin('12345', testTableId);
    const decrypted = decryptPin(encrypted, testTableId);
    expect(decrypted).toBeNull();
  });
});
