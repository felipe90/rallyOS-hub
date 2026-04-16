/**
 * Type-safe route constants and builders
 * Centralizes all route paths to avoid magic strings throughout the app
 */

// Base routes (const assertion ensures type safety)
export const Routes = {
  AUTH: '/auth',
  DASHBOARD_OWNER: '/dashboard/owner',
  DASHBOARD_REFEREE: '/dashboard/referee',
  DASHBOARD_SPECTATOR: '/dashboard/spectator',
  SCOREBOARD_REFEREE: '/scoreboard/:tableId/referee',
  SCOREBOARD_VIEW: '/scoreboard/:tableId/view',
  HISTORY: '/history',
} as const

// Type for all route values
export type RoutePath = typeof Routes[keyof typeof Routes]

// Route builder for parameterized routes
export const buildScoreboardRoute = (
  tableId: string,
  mode: 'referee' | 'view'
): string => {
  const template = mode === 'referee' 
    ? Routes.SCOREBOARD_REFEREE 
    : Routes.SCOREBOARD_VIEW
  return template.replace(':tableId', tableId)
}

// Redirect routes
export const Redirects = {
  DASHBOARD_ROOT: '/dashboard',
  SCOREBOARD_ROOT: '/scoreboard/:tableId',
} as const

// Check if a path matches a scoreboard route pattern
export const isScoreboardRoute = (path: string): boolean => {
  return path.includes('/scoreboard/')
}

// Extract mode from scoreboard path
export const getScoreboardMode = (
  path: string
): 'referee' | 'view' | null => {
  if (path.includes('/referee')) return 'referee'
  if (path.includes('/view')) return 'view'
  return null
}

// Extract tableId from scoreboard path
export const getTableIdFromPath = (path: string): string | null => {
  const match = path.match(/\/scoreboard\/([^/]+)/)
  return match ? match[1] : null
}
