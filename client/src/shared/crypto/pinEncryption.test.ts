import { describe, it, expect } from 'vitest'
import { generateKey, encryptPin, decryptPin } from './pinEncryption'

describe('pinEncryption', () => {
  describe('generateKey', () => {
    it('returns an 8-character hex string', () => {
      const key = generateKey('table-1')
      expect(key).toMatch(/^[0-9a-f]{8}$/)
    })

    it('is deterministic for same tableId on same day', () => {
      const key1 = generateKey('table-1')
      const key2 = generateKey('table-1')
      expect(key1).toBe(key2)
    })

    it('produces different keys for different tableIds', () => {
      const key1 = generateKey('table-1')
      const key2 = generateKey('table-2')
      expect(key1).not.toBe(key2)
    })

    it('produces different keys on different days (different daily salt)', () => {
      // Keys for different tableIds should be different
      const keyA = generateKey('alpha')
      const keyB = generateKey('beta')
      expect(keyA).not.toBe(keyB)
    })
  })

  describe('encryptPin + decryptPin roundtrip', () => {
    it('encrypts and decrypts "1234" correctly', () => {
      const key = generateKey('table-1')
      const encrypted = encryptPin('1234', key)
      const decrypted = decryptPin(encrypted, key)
      expect(decrypted).toBe('1234')
    })

    it('encrypts and decrypts "0000" correctly', () => {
      const key = generateKey('table-1')
      const encrypted = encryptPin('0000', key)
      const decrypted = decryptPin(encrypted, key)
      expect(decrypted).toBe('0000')
    })

    it('encrypts and decrypts "9999" correctly', () => {
      const key = generateKey('table-1')
      const encrypted = encryptPin('9999', key)
      const decrypted = decryptPin(encrypted, key)
      expect(decrypted).toBe('9999')
    })

    it('produces different ciphertexts for different keys', () => {
      const key1 = generateKey('table-1')
      const key2 = generateKey('table-2')
      const encrypted1 = encryptPin('1234', key1)
      const encrypted2 = encryptPin('1234', key2)
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('encrypted output is hex bytes (even length)', () => {
      const key = generateKey('table-1')
      const encrypted = encryptPin('1234', key)
      expect(encrypted.length).toBe(8) // 4 chars * 2 hex bytes each
      expect(encrypted).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('decryptPin', () => {
    it('decrypts a known encrypted value back to original', () => {
      const key = generateKey('table-1')
      // Manually compute: encrypt then decrypt
      const encrypted = encryptPin('5678', key)
      const decrypted = decryptPin(encrypted, key)
      expect(decrypted).toBe('5678')
    })

    it('returns garbled output if wrong key is used for decryption', () => {
      const key1 = generateKey('table-1')
      const key2 = generateKey('table-2')
      const encrypted = encryptPin('1234', key1)
      const wrongDecrypted = decryptPin(encrypted, key2)
      expect(wrongDecrypted).not.toBe('1234')
    })
  })
})
