import { Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { SocketProvider } from './contexts/SocketContext'
import { PrivateRoute } from './components/utilities/PrivateRoute'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { ScoreboardPage } from './pages/ScoreboardPage'
import { WaitingRoomPage } from './pages/WaitingRoomPage'
import { HistoryViewPage } from './pages/HistoryViewPage'

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/waiting-room" element={<WaitingRoomPage />} />

{/* Protected routes (require authentication) */}
      <Route element={<PrivateRoute />}>
        {/* Dashboard routes */}
        <Route path="/dashboard" element={<Navigate to="/dashboard/owner" replace />} />
        <Route path="/dashboard/owner" element={<DashboardPage mode="owner" />} />
        <Route path="/dashboard/referee" element={<DashboardPage mode="referee" />} />
        
        {/* Scoreboard routes - separate referee and spectator */}
        <Route path="/scoreboard/:tableId" element={<Navigate to="/scoreboard/:tableId/view" replace />} />
        <Route path="/scoreboard/:tableId/referee" element={<ScoreboardPage mode="referee" />} />
        <Route path="/scoreboard/:tableId/view" element={<ScoreboardPage mode="view" />} />
        
        <Route path="/history" element={<HistoryViewPage />} />
      </Route>

      {/* Redirect to auth if no match */}
      <Route path="/" element={<AuthPage />} />
    </Routes>
  )
}

function App() {
  return (
    <SocketProvider>
      <AppRoutes />
    </SocketProvider>
  )
}

export default App