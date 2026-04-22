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
