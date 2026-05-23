/**
 * URL parsing permission rules - Unit tests
 *
 * DEPRECATED: Client-side crypto removed. parseEncryptedPin is a stub
 * that always returns invalid. Server-side decryption replaces it.
 */

import { describe, it, expect } from 'vitest'
import { parseEncryptedPin } from './url'

describe('parseEncryptedPin', () => {
  const tableId = 'test-table-123'

  describe('stub behavior (client-side crypto deprecated)', () => {
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

    it('returns hasPin: true with invalid pin for any ePin value', async () => {
      // Client-side decryption is deprecated — server handles it now
      const result = await parseEncryptedPin('any-encrypted-value', tableId)
      expect(result.pin).toBe(null)
      expect(result.isValid).toBe(false)
      expect(result.hasPin).toBe(true)
    })
  })
})
