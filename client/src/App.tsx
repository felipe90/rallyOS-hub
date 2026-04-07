import { Routes, Route } from 'react-router-dom'
import './index.css'
import { SocketProvider } from './contexts/SocketContext'
import { PrivateRoute } from './components/PrivateRoute'
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/scoreboard/:tableId" element={<ScoreboardPage />} />
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