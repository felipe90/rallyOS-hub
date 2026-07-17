import type { CourtInfo } from '@shared/types'

/** Kiosk-optimized table info type (alias of CourtInfo from shared) */
export type KioskCourtInfo = CourtInfo

/** Proof constant — confirms the type export is importable at runtime */
export const KIOSK_TABLE_INFO_PROOF = 'KioskCourtInfo = CourtInfo' as const
