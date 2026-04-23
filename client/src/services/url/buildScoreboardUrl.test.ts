import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildScoreboardUrl, buildTableUrl } from './buildScoreboardUrl'

// Mock window.location.origin
const mockOrigin = 'https://localhost:3000'
Object.defineProperty(window, 'location', {
  value: { origin: mockOrigin },
  writable: true,
})

// Mock encryptPin (async, since Web Crypto API is async)
vi.mock('@/shared/crypto/pinEncryption', () => ({
  encryptPin: vi.fn(async (pin: string, _tableId: string, _secret: string) => {
    const timestamp = Date.now().toString()
    const fake = `aabbccdd:${Buffer.from(pin).toString('hex')}:eeff0011:${timestamp}`
    return Buffer.from(fake).toString('base64url')
  }),
}))

describe('buildScoreboardUrl', () => {
  it('generates URL with encrypted PIN', async () => {
    const url = await buildScoreboardUrl('table-1', '1234')
    expect(url).toContain('/scoreboard/table-1/referee')
    expect(url).toContain('ePin=')
  })
})

describe('buildTableUrl', () => {
  it('generates spectator view URL', () => {
    const url = buildTableUrl('table-1')
    expect(url).toContain('/scoreboard/table-1/view')
  })
})
