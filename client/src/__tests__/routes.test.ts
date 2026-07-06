import { describe, it, expect } from 'vitest'
import { Routes } from '../routes'

describe('Routes', () => {
  it('has KIOSK route for club/tournament kiosk display', () => {
    expect(Routes.KIOSK).toBe('/kiosk')
  })
})
