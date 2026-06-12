export { useMatchDisplay } from './useMatchDisplay'
export type { MatchDisplayState } from './useMatchDisplay'

export { useSocket } from './useSocket'
export type { UseSocketOptions, SocketState } from './useSocket'

export { useScoreboardMode } from './useScoreboardMode'
export type { ScoreboardModeState } from './useScoreboardMode'

export { useServiceWorkerUpdate } from './useServiceWorkerUpdate'
export { useAutoUpdateBanner } from './useAutoUpdate'

// New focused socket hooks (preferred over useSocket for new code)
export { useSocketConnection } from './useSocketConnection'
export { useSocketState } from './useSocketState'
export { useSocketActions } from './useSocketActions'

// New feature hooks
export { usePinSubmission } from './usePinSubmission'
export { useDashboardStats } from './useDashboardStats'
export { usePermissions } from './usePermissions'
export { useCan } from './useCan'
export { useAuthFlow } from './useAuthFlow'
export { useCourtManagement } from './useCourtManagement'
export { useWakeLock } from './useWakeLock'
export type { WakeLockState } from './useWakeLock'

export { useResponsiveQrSize } from './useResponsiveQrSize'
export { useFocusTrap } from './useFocusTrap'
