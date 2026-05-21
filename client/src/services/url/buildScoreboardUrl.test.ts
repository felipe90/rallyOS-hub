import { describe, it, expect } from 'vitest'
import { buildScoreboardUrl, buildTableUrl } from './buildScoreboardUrl'

// Mock window.location.origin
const mockOrigin = 'https://localhost:3000'
Object.defineProperty(window, 'location', {
  value: { origin: mockOrigin },
  writable: true,
})

describe('buildScoreboardUrl', () => {
  it('generates URL with raw PIN in query param', () => {
    const url = buildScoreboardUrl('table-1', '1234')
    expect(url).toContain('/scoreboard/table-1/referee')
    expect(url).toContain('pin=1234')
  })
})

describe('buildTableUrl', () => {
  it('generates spectator view URL', () => {
    const url = buildTableUrl('table-1')
    expect(url).toContain('/scoreboard/table-1/view')
  })
})
