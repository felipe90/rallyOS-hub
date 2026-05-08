import { describe, it, expect } from 'vitest'
import { Routes } from '../routes'

describe('Routes', () => {
  it('has SCOREBOARD_KIOSK route for all-tables kiosk display', () => {
    expect(Routes.SCOREBOARD_KIOSK).toBe('/scoreboard/all/kiosk')
  })
})
