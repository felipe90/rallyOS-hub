import { describe, it, expect } from 'vitest'
import { encryptPin, decryptPin } from './pinEncryption'

const TEST_SECRET = '0123456789abcdef0123456789abcdef' // 32 hex chars = 32 bytes
const TEST_TABLE_ID = 'table-1'

describe('pinEncryption (AES-256-GCM)', () => {
  describe('encryptPin + decryptPin roundtrip', () => {
    it('encrypts and decrypts "1234" correctly', async () => {
      const encrypted = await encryptPin('1234', TEST_TABLE_ID, TEST_SECRET)
      const decrypted = await decryptPin(encrypted, TEST_TABLE_ID, TEST_SECRET)
      expect(decrypted).toBe('1234')
    })

    it('encrypts and decrypts "0000" correctly', async () => {
      const encrypted = await encryptPin('0000', TEST_TABLE_ID, TEST_SECRET)
      const decrypted = await decryptPin(encrypted, TEST_TABLE_ID, TEST_SECRET)
      expect(decrypted).toBe('0000')
    })

    it('encrypts and decrypts "9999" correctly', async () => {
      const encrypted = await encryptPin('9999', TEST_TABLE_ID, TEST_SECRET)
      const decrypted = await decryptPin(encrypted, TEST_TABLE_ID, TEST_SECRET)
      expect(decrypted).toBe('9999')
    })

    it('produces different ciphertexts for same PIN (random IV)', async () => {
      const encrypted1 = await encryptPin('1234', TEST_TABLE_ID, TEST_SECRET)
      const encrypted2 = await encryptPin('1234', TEST_TABLE_ID, TEST_SECRET)
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('produces different ciphertexts for different tableIds', async () => {
      const encrypted1 = await encryptPin('1234', 'table-1', TEST_SECRET)
      const encrypted2 = await encryptPin('1234', 'table-2', TEST_SECRET)
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('produces different ciphertexts for different secrets', async () => {
      const secret2 = 'fedcba9876543210fedcba9876543210'
      const encrypted1 = await encryptPin('1234', TEST_TABLE_ID, TEST_SECRET)
      const encrypted2 = await encryptPin('1234', TEST_TABLE_ID, secret2)
      expect(encrypted1).not.toBe(encrypted2)
    })
  })

  describe('decryptPin', () => {
    it('returns null for wrong secret', async () => {
      const encrypted = await encryptPin('1234', TEST_TABLE_ID, TEST_SECRET)
      const wrongSecret = 'fedcba9876543210fedcba9876543210'
      const decrypted = await decryptPin(encrypted, TEST_TABLE_ID, wrongSecret)
      expect(decrypted).toBeNull()
    })

    it('returns null for wrong tableId', async () => {
      const encrypted = await encryptPin('1234', 'table-1', TEST_SECRET)
      const decrypted = await decryptPin(encrypted, 'table-2', TEST_SECRET)
      expect(decrypted).toBeNull()
    })

    it('returns null for malformed input', async () => {
      const decrypted = await decryptPin('not-valid-base64', TEST_TABLE_ID, TEST_SECRET)
      expect(decrypted).toBeNull()
    })

    it('returns null for expired encrypted PIN (24h+)', async () => {
      // Manually craft an expired encrypted string
      const iv = '00'.repeat(16)
      const ciphertext = '00'.repeat(4)
      const authTag = '00'.repeat(16)
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      const expired = btoa(`${iv}:${ciphertext}:${authTag}:${oldTimestamp}`)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

      const decrypted = await decryptPin(expired, TEST_TABLE_ID, TEST_SECRET)
      expect(decrypted).toBeNull()
    })
  })

  describe('generateKey (deprecated)', () => {
    it('returns a dummy value (deprecated)', () => {
      // Import the deprecated function
      const { generateKey } = require('./pinEncryption')
      expect(generateKey('table-1')).toBe('00000000')
    })
  })
})
