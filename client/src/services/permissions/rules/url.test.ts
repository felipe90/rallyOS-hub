/**
 * URL parsing permission rules - Unit tests
 *
 * Note: These tests use the actual generateKey/decryptPin from pinEncryption.
 * The key is derived from the current date, so tests are date-sensitive.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { parseEncryptedPin } from './url'
import { encryptPin, generateKey } from '@/shared/crypto/pinEncryption'

describe('parseEncryptedPin', () => {
  const tableId = 'test-table-123'

  describe('valid PIN flows', () => {
    it('parses valid PIN from URL', () => {
      const pin = '1234'
      const key = generateKey(tableId)
      const encrypted = encryptPin(pin, key)
      // URL format: base64("hex:originalPin")
      const ePin = btoa(`${encrypted}:${pin}`)

      const result = parseEncryptedPin(ePin, tableId)

      expect(result.pin).toBe(pin)
      expect(result.isValid).toBe(true)
      expect(result.hasPin).toBe(true)
    })

    it('parses different valid PIN', () => {
      const pin = '9876'
      const key = generateKey(tableId)
      const encrypted = encryptPin(pin, key)
      const ePin = btoa(`${encrypted}:${pin}`)

      const result = parseEncryptedPin(ePin, tableId)

      expect(result.pin).toBe(pin)
      expect(result.isValid).toBe(true)
      expect(result.hasPin).toBe(true)
    })
  })

  describe('invalid PIN flows', () => {
    it('returns invalid for malformed base64', () => {
      const result = parseEncryptedPin('not-valid-base64!', tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(true)
    })

    it('returns invalid for wrong format (no colon)', () => {
      const wrongFormat = btoa('justhexbytes')
      const result = parseEncryptedPin(wrongFormat, tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(true)
    })

    it('returns invalid for wrong separator', () => {
      const wrongFormat = btoa('hex-pin')
      const result = parseEncryptedPin(wrongFormat, tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(true)
    })
  })

  describe('no PIN in URL', () => {
    it('returns hasPin: false when ePin is null', () => {
      const result = parseEncryptedPin(null, tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(false)
    })

    it('returns hasPin: false when ePin is empty string', () => {
      const result = parseEncryptedPin('', tableId)

      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(false)
    })
  })
})