import { lazy, Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { Routes as ReactRoutes, Route, Navigate, useLocation } from 'react-router-dom'
import './index.css'
import { SocketProvider } from './contexts/SocketContext'
import { AuthProvider } from './contexts/AuthContext'
import { PrivateRoute } from './components/utilities/PrivateRoute'
import { ErrorBoundary } from './components/utilities/ErrorBoundary/ErrorBoundary'
import { Routes } from './routes'
import { useAutoUpdateBanner } from './hooks/useAutoUpdate'
import { LanguageSwitcher } from './components/atoms'
import { useI18n } from './i18n'

// Route pages are code-split per route (React.lazy) so the monolithic bundle is
// broken into per-page chunks. The layout shell stays eager; only routed pages
// are lazy-loaded. All pages use named exports, so map the named export to the
// default shape React.lazy requires.
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })))
const KioskPage = lazy(() => import('./pages/KioskPage').then(m => ({ default: m.KioskPage })))
const ClubSetupPage = lazy(() => import('./pages/ClubSetupPage').then(m => ({ default: m.ClubSetupPage })))
const ClubAdminPage = lazy(() => import('./pages/ClubAdminPage').then(m => ({ default: m.ClubAdminPage })))
const ClubPlayPage = lazy(() => import('./pages/ClubPlayPage').then(m => ({ default: m.ClubPlayPage })))
const OwnerDashboardPage = lazy(() => import('./pages/OwnerDashboardPage').then(m => ({ default: m.OwnerDashboardPage })))
const RefereeDashboardPage = lazy(() => import('./pages/RefereeDashboardPage').then(m => ({ default: m.RefereeDashboardPage })))
const SpectatorDashboardPage = lazy(() => import('./pages/SpectatorDashboardPage').then(m => ({ default: m.SpectatorDashboardPage })))
const ScoreboardPage = lazy(() => import('./pages/ScoreboardPage').then(m => ({ default: m.ScoreboardPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

// Centered spinner shown while a route chunk is loading — matches the app's
// existing spinner style (border-primary, transparent top edge).
function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-dvh bg-background">
      <span
        role="status"
        aria-label="Loading"
        className="inline-block size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
      />
    </div>
  )
}

function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <ReactRoutes>
          {/* Public routes */}
          <Route path={Routes.AUTH} element={<AuthPage />} />
          <Route path={Routes.KIOSK} element={<KioskPage />} />
          <Route path={Routes.KIOSK_CLUB} element={<KioskPage />} />
          <Route path={Routes.KIOSK_TOURNAMENT} element={<KioskPage />} />
          <Route path="/scoreboard/all/kiosk" element={<KioskPage />} />

          {/* Club Mode routes */}
          <Route path={Routes.CLUB_SETUP} element={<ClubSetupPage />} />
          <Route path={Routes.CLUB_ADMIN} element={<ClubAdminPage />} />
          <Route path={Routes.CLUB_PLAY} element={<ClubPlayPage />} />

          {/* Protected routes (require authentication) */}
          <Route element={<PrivateRoute />}>
            {/* Dashboard routes */}
            <Route path={Routes.DASHBOARD_OWNER} element={<OwnerDashboardPage />} />
            <Route path={Routes.DASHBOARD_REFEREE} element={<RefereeDashboardPage />} />
            <Route path={Routes.DASHBOARD_SPECTATOR} element={<SpectatorDashboardPage />} />

            {/* Scoreboard routes - separate referee and spectator */}
            <Route path="/scoreboard/:tableId" element={<Navigate to={Routes.SCOREBOARD_VIEW} replace />} />
            <Route path={Routes.SCOREBOARD_REFEREE} element={<ScoreboardPage />} />
            <Route path={Routes.SCOREBOARD_VIEW} element={<ScoreboardPage />} />

            {/* Redirect root to auth */}
            <Route index element={<Navigate to={Routes.AUTH} replace />} />

            {/* 404 for authenticated users hitting unknown routes */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </ReactRoutes>
      </Suspense>
    </ErrorBoundary>
  )
}

function App() {
  const { Banner } = useAutoUpdateBanner()
  const { language, changeLanguage } = useI18n()
  const location = useLocation()

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          {Banner}
          {location.pathname === '/auth' && (
            <LanguageSwitcher language={language} onChangeLanguage={changeLanguage} />
          )}
        </SocketProvider>
      </AuthProvider>
    </I18nextProvider>
  )
}

export default App
