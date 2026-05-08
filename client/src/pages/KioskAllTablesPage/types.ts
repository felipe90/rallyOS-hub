import type { TableInfo } from '@shared/types'

/** Kiosk-optimized table info type (alias of TableInfo from shared) */
export type KioskTableInfo = TableInfo

/** Proof constant — confirms the type export is importable at runtime */
export const KIOSK_TABLE_INFO_PROOF = 'KioskTableInfo = TableInfo' as const
