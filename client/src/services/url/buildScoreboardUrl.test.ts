import { describe, it, expect, vi } from 'vitest'
import { buildScoreboardUrl, buildTableUrl } from './buildScoreboardUrl'

// Mock the crypto module
vi.mock('@/shared/crypto/pinEncryption', () => ({
  generateKey: vi.fn(() => 'mock-key'),
  encryptPin: vi.fn(() => 'encrypted-1234'),
}))

describe('buildScoreboardUrl', () => {
  it('generates URL with encrypted PIN', () => {
    const url = buildScoreboardUrl('table-1', '1234')
    expect(url).toContain('/scoreboard/table-1/referee')
    expect(url).toContain('ePin=encrypted-1234')
  })
})

describe('buildTableUrl', () => {
  it('generates spectator view URL', () => {
    const url = buildTableUrl('table-1')
    expect(url).toContain('/scoreboard/table-1/view')
  })
})
