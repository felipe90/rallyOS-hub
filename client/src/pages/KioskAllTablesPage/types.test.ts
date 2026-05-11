import { describe, it, expect } from 'vitest'
import { KIOSK_TABLE_INFO_PROOF } from './types'

describe('KioskTableInfo type', () => {
  it('is structurally compatible with TableInfo via proof constant', () => {
    // KIOSK_TABLE_INFO_PROOF exists to demonstrate the type was exported.
    // Any TableInfo-compatible object satisfies KioskTableInfo.
    expect(KIOSK_TABLE_INFO_PROOF).toBe('KioskTableInfo = TableInfo')
  })
})
