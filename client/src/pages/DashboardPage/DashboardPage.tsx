import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardGrid } from '@/components/organisms/DashboardGrid'
import { DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import type { QRData } from '@/shared/types'

export function DashboardPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [tableName, setTableName] = useState('')
  const navigate = useNavigate()
  const { tables, connected, createTable, socket } = useSocketContext()
  const { logout, isReferee, isViewer, isOwner } = useAuth()

  // Listen for QR_DATA and PIN_REGENERATED events
  useEffect(() => {
    if (!socket) return

    const handleQRData = (qrData: QRData) => {
      console.log('[Dashboard] QR Data received:', qrData)
      // Could show a modal or toast with the new QR
    }

    const handlePinRegenerated = (data: { tableId: string; newPin: string }) => {
      console.log('[Dashboard] PIN regenerated:', data)
    }

    socket.on('QR_DATA', handleQRData)
    socket.on('PIN_REGENERATED', handlePinRegenerated)

    return () => {
      socket.off('QR_DATA', handleQRData)
      socket.off('PIN_REGENERATED', handlePinRegenerated)
    }
  }, [socket])

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

  const handleRegeneratePin = (tableId: string) => {
    if (socket && connected) {
      // Owner can regenerate without knowing the current PIN (use empty string as placeholder)
      socket.emit('REGENERATE_PIN', { tableId, pin: '' })
    }
  }

  const pageTitle = isOwner ? 'Panel de Organizador' : isReferee ? 'Panel de Árbitro' : 'Espectador'
  const pageSubtitle = isOwner 
    ? 'Crea mesas, gestiona árbitros y partidos' 
    : isReferee 
      ? 'Gestiona tus mesas'
      : 'Observa los partidos en vivo'

  // Only Owner and Referee can see "Nueva Mesa" button
  const canCreateTable = isOwner || isReferee

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        showStatus={true}
        actions={
          <div className="flex gap-2">
            {canCreateTable && (
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
            totalTables={tables.length || 0}
            liveMatches={tables.filter(t => t.status === 'LIVE').length || 0}
            activePlayers={tables.reduce((acc, t) => acc + (t.playerCount || 0), 0) || 0}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <DashboardGrid 
            tables={tables} 
            onTableClick={handleTableClick} 
            viewMode={viewMode}
            showRegeneratePin={isOwner}
            onRegeneratePin={handleRegeneratePin}
          />
        </div>
      </div>
    </div>
  )
}