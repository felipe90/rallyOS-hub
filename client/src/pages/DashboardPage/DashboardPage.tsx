import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardGrid } from '@/components/organisms/DashboardGrid'
import { DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/atoms/Button'

export function DashboardPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [tableName, setTableName] = useState('')
  const navigate = useNavigate()
  const { tables, connected, createTable } = useSocketContext()
  const { logout, isReferee, isViewer } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  const handleCreateTable = () => {
    if (tableName.trim()) {
      createTable(tableName.trim())
      setTableName('')
      setIsCreatingTable(false)
    }
  }

  const handleTableClick = (tableId: string) => {
    navigate(`/scoreboard/${tableId}`)
  }

  const liveMatches = tables.filter(t => t.status === 'LIVE').length
  const activePlayers = tables.reduce((acc, t) => acc + (t.playerCount || 0), 0)

  const pageTitle = isReferee ? 'Panel de Árbitro' : 'Espectador'
  const pageSubtitle = isReferee 
    ? 'Crea y gestiona mesas'
    : 'Observa los partidos en vivo'

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        showStatus={true}
        actions={
          <div className="flex gap-2">
            {isReferee && (
              <>
                {!isCreatingTable ? (
                  <Button variant="secondary" onClick={() => setIsCreatingTable(true)} size="sm" animate={false}>
                    Nueva Mesa
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Nombre de la mesa..."
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateTable()
                        }
                      }}
                      className="px-3 py-2 rounded border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                    <Button variant="primary" onClick={handleCreateTable} size="sm" animate={false}>
                      Crear
                    </Button>
                    <Button variant="ghost" onClick={() => setIsCreatingTable(false)} size="sm" animate={false}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </>
            )}
            <Button variant="ghost" onClick={handleLogout} size="sm" animate={false}>
              Salir
            </Button>
          </div>
        }
      />

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
