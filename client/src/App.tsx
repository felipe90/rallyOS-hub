import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { Routes as ReactRoutes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { SocketProvider } from './contexts/SocketContext'
import { AuthProvider } from './contexts/AuthContext'
import { PrivateRoute } from './components/utilities/PrivateRoute'
import { ErrorBoundary } from './components/utilities/ErrorBoundary/ErrorBoundary'
import { Routes } from './routes'
import { AuthPage } from './pages/AuthPage'
import { OwnerDashboardPage } from './pages/OwnerDashboardPage'
import { RefereeDashboardPage } from './pages/RefereeDashboardPage'
import { SpectatorDashboardPage } from './pages/SpectatorDashboardPage'
import { ScoreboardPage } from './pages/ScoreboardPage'
import { HistoryViewPage } from './pages/HistoryViewPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { useAutoUpdateBanner } from './hooks/useAutoUpdate'

function AppRoutes() {
  return (
    <ErrorBoundary>
      <ReactRoutes>
        {/* Public routes */}
        <Route path={Routes.AUTH} element={<AuthPage />} />

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

          <Route path={Routes.HISTORY} element={<HistoryViewPage />} />

          {/* Redirect root to auth */}
          <Route index element={<Navigate to={Routes.AUTH} replace />} />

          {/* 404 for authenticated users hitting unknown routes */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </ReactRoutes>
    </ErrorBoundary>
  )
}

function App() {
  const { Banner } = useAutoUpdateBanner()

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          {Banner}
        </SocketProvider>
      </AuthProvider>
    </I18nextProvider>
  )
}

export default App
