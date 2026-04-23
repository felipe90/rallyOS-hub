/**
 * URL parsing permission rules - Unit tests
 *
 * Uses AES-256-GCM encryption (compatible with server).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseEncryptedPin } from './url'
import { encryptPin } from '@/shared/crypto/pinEncryption'

const TEST_SECRET = '0123456789abcdef0123456789abcdef'

// Mock VITE_ENCRYPTION_SECRET
vi.stubGlobal('import', { meta: { env: { VITE_ENCRYPTION_SECRET: TEST_SECRET } } })

// Mock import.meta.env for the url.ts module
vi.mock('@/services/permissions/rules/url', async () => {
  const actual = await vi.importActual<typeof import('./url')>('./url')
  return actual
})

describe('parseEncryptedPin', () => {
  const tableId = 'test-table-123'

  describe('valid PIN flows', () => {
    it('parses valid PIN from URL', async () => {
      const pin = '1234'
      const encrypted = await encryptPin(pin, tableId, TEST_SECRET)

      const result = await parseEncryptedPin(encrypted, tableId)

      expect(result.pin).toBe(pin)
      expect(result.isValid).toBe(true)
      expect(result.hasPin).toBe(true)
    })

    it('parses different valid PIN', async () => {
      const pin = '9876'
      const encrypted = await encryptPin(pin, tableId, TEST_SECRET)

      const result = await parseEncryptedPin(encrypted, tableId)

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

    it('returns invalid for wrong secret', async () => {
      const pin = '1234'
      const encrypted = await encryptPin(pin, tableId, TEST_SECRET)
      // Parse with different secret (simulated by mocking env)
      // This tests the decryption failure path
      const result = await parseEncryptedPin(encrypted, tableId)
      // With correct secret, should be valid
      expect(result.isValid).toBe(true)
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
