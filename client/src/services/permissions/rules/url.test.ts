/**
 * URL parsing permission rules - Unit tests
 *
 * Uses mocked AES-256-GCM encryption (Web Crypto API not available in jsdom).
 */

import { describe, it, expect, vi } from 'vitest'
import { parseEncryptedPin } from './url'

// Mock the encryption module since jsdom doesn't support Web Crypto AES-GCM
vi.mock('@/shared/crypto/pinEncryption', () => ({
  encryptPin: vi.fn(async (pin: string) => {
    const timestamp = Date.now().toString()
    const fake = `aabbccdd:${Buffer.from(pin).toString('hex')}:eeff0011:${timestamp}`
    return Buffer.from(fake).toString('base64url')
  }),
  decryptPin: vi.fn(async (encryptedUrl: string) => {
    try {
      const decoded = Buffer.from(encryptedUrl, 'base64url').toString('utf8')
      const parts = decoded.split(':')
      if (parts.length !== 4) return null
      const ciphertextHex = parts[1]
      const timestamp = parseInt(parts[3], 10)
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return null
      const pin = Buffer.from(ciphertextHex, 'hex').toString('utf8')
      return /^\d{4}$/.test(pin) ? pin : null
    } catch {
      return null
    }
  }),
}))

describe('parseEncryptedPin', () => {
  const tableId = 'test-table-123'

  describe('valid PIN flows', () => {
    it('parses valid PIN from URL', async () => {
      const pin = '1234'
      // Create a valid encrypted PIN manually
      const timestamp = Date.now().toString()
      const fake = `aabbccdd:${Buffer.from(pin).toString('hex')}:eeff0011:${timestamp}`
      const ePin = Buffer.from(fake).toString('base64url')

      const result = await parseEncryptedPin(ePin, tableId)

      expect(result.pin).toBe(pin)
      expect(result.isValid).toBe(true)
      expect(result.hasPin).toBe(true)
    })

    it('parses different valid PIN', async () => {
      const pin = '9876'
      const timestamp = Date.now().toString()
      const fake = `aabbccdd:${Buffer.from(pin).toString('hex')}:eeff0011:${timestamp}`
      const ePin = Buffer.from(fake).toString('base64url')

      const result = await parseEncryptedPin(ePin, tableId)

      expect(result.pin).toBe(pin)
      expect(result.isValid).toBe(true)
      expect(result.hasPin).toBe(true)
    })
  })

  describe('invalid PIN flows', () => {
    it('returns invalid for malformed input', async () => {
      const result = await parseEncryptedPin('not-valid-base64!', tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(true)
    })
  })

  describe('no PIN in URL', () => {
    it('returns hasPin: false when ePin is null', async () => {
      const result = await parseEncryptedPin(null, tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(false)
    })

    it('returns hasPin: false when ePin is empty string', async () => {
      const result = await parseEncryptedPin('', tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(false)
    })
  })
})
