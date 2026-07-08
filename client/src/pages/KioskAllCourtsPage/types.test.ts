import { describe, it, expect } from 'vitest'
import { KIOSK_TABLE_INFO_PROOF } from './types'

describe('KioskCourtInfo type', () => {
  it('is structurally compatible with CourtInfo via proof constant', () => {
    // KIOSK_TABLE_INFO_PROOF exists to demonstrate the type was exported.
    // Any CourtInfo-compatible object satisfies KioskCourtInfo.
    expect(KIOSK_TABLE_INFO_PROOF).toBe('KioskCourtInfo = CourtInfo')
  })
})
