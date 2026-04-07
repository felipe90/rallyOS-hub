import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardGrid } from '../components/organisms/DashboardGrid'
import { DashboardHeader } from '../components/organisms/DashboardGrid'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { useSocketContext } from '../contexts/SocketContext'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/atoms/Button'

export function DashboardPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const navigate = useNavigate()
  const { tables, connected } = useSocketContext()
  const { logout, isReferee } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  const handleCreateTable = () => {
    // TODO: Implementar creación de nueva mesa
    console.log('Create new table')
  }

  const handleTableClick = (tableId: string) => {
    navigate(`/scoreboard/${tableId}`)
  }

  const liveMatches = tables.filter(t => t.status === 'LIVE').length
  const activePlayers = tables.reduce((acc, t) => acc + (t.playerCount || 0), 0)

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Connection Status Bar */}
      <ConnectionStatus />

      {/* Header */}
      <div className="pt-12 p-4 border-b border-border flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <p className="text-sm text-text-muted">
            {connected ? '✅ Conectado' : '⚠️ Desconectado'}
          </p>
        </div>
        <div className="flex gap-2">
          {isReferee && (
            <Button variant="secondary" onClick={handleCreateTable} size="sm">
              Nueva Mesa
            </Button>
          )}
          <Button variant="ghost" onClick={handleLogout} size="sm">
            Salir
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <DashboardHeader
            totalTables={tables.length}
            liveMatches={liveMatches}
            activePlayers={activePlayers}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <DashboardGrid tables={tables} onTableClick={handleTableClick} viewMode={viewMode} />
        </div>
      </div>
    </div>
  )
}
