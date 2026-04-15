import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardGrid } from '@/components/organisms/DashboardGrid'
import { DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PinModal } from '@/components/molecules/PinModal'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext, UserRoles, type DashboardMode, DefaultDashboardMode } from '@/contexts/AuthContext'
import { Button } from '@/components/atoms/Button'
// Typography reserved for future use
// import { Typography } from '@/components/atoms/Typography'
import { SocketEvents } from '@shared/events'
import type { QRData, TableInfoWithPin } from '@/shared/types'

export interface DashboardPageProps {
  viewMode?: 'grid' | 'list';  // Display mode (from component)
  mode?: DashboardMode;        // Route mode - 'owner' = full admin, 'referee' = join only
}

export function DashboardPage({ viewMode: routeViewMode, mode = DefaultDashboardMode }: DashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(routeViewMode || 'grid')
  const isOwnerDashboard = mode === UserRoles.OWNER
  const isRefereeDashboard = mode === UserRoles.REFEREE
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [tableName, setTableName] = useState('')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [cleanConfirmTableId, setCleanConfirmTableId] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const navigate = useNavigate()
  const { tables, connected, createTable, socket, requestTables, requestTablesWithPins, emit: _emit } = useSocketContext()
  const { logout, isReferee, isViewer: _isViewer, isOwner, ownerPin } = useAuthContext()

  // Load tables with PINs if Owner, otherwise regular tables
  // Single request on mount - updates come via WebSocket TABLE_UPDATE events
  useEffect(() => {
    if (!connected) return

    // Immediate load - no delay
    if (isOwner && ownerPin) {
      requestTablesWithPins(ownerPin)
    } else if (isOwner) {
      requestTablesWithPins('')
    } else {
      requestTables()
    }
  }, [connected, isOwner, ownerPin, requestTables, requestTablesWithPins])

  // Listen for QR_DATA and PIN_REGENERATED events
  useEffect(() => {
    if (!socket) return

    const handleQRData = (qrData: QRData) => {
      // Could show a modal or toast with the new QR
    }

    const handlePinRegenerated = (data: { tableId: string; newPin: string }) => {
      // PIN regenerated - UI updates automatically via TABLE_UPDATE
    }

    socket.on(SocketEvents.SERVER.QR_DATA, handleQRData)
    socket.on(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)

    return () => {
      socket.off(SocketEvents.SERVER.QR_DATA, handleQRData)
      socket.off(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)
    }
  }, [socket])

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  const handleCreateTable = () => {
    // Allow creating table without name (server will assign default name)
    createTable(tableName.trim() || undefined)
    setTableName('')
    setIsCreatingTable(false)
  }

  // Handle table click - opens PIN modal (RF-04)
  const handleTableClick = (tableId: string) => {
    // Find the table to get its name
    const table = tables.find(t => t.id === tableId)
    if (table) {
      setSelectedTable(table as TableInfoWithPin)
      setPinModalOpen(true)
      setPinError(null)
    }
  }

  // Validate PIN and navigate if correct
  const handlePinSubmit = async (pin: string) => {
    if (!selectedTable || !socket) return
    
    // Save PIN for scoreboard auth
    localStorage.setItem('tablePin', pin)
    
    // Validate PIN with server
    setPinLoading(true)
    socket.emit(SocketEvents.CLIENT.SET_REF, { tableId: selectedTable.id, pin })
    
    // Listen for response
    const handleResponse = (response: { success?: boolean; error?: string }) => {
      socket.off('REF_SET', handleResponse)
      socket.off('ERROR', handleError)
      
      setPinLoading(false)
      
      if (response.success || (response as any).tableId) {
        // Success - navigate to referee view (with full controls)
        navigate(`/scoreboard/${selectedTable.id}/referee`)
      }
    }
    
    const handleError = (error: { code: string; message: string }) => {
      socket.off('REF_SET', handleResponse)
      socket.off('ERROR', handleError)
      
      setPinLoading(false)
      setPinError(error.message)
    }
    
    socket.once('REF_SET', handleResponse)
    socket.once('ERROR', handleError)
    
    // Timeout after 5 seconds
    setTimeout(() => {
      socket.off('REF_SET', handleResponse)
      socket.off('ERROR', handleError)
      setPinLoading(false)
      // Still allow navigation after timeout (trust client) - go to referee view
      navigate(`/scoreboard/${selectedTable.id}/referee`)
    }, 5000)
  }

  const handlePinClose = () => {
    setPinModalOpen(false)
    setSelectedTable(null)
    setPinError(null)
  }

  const handleCleanTableRequest = (tableId: string) => {
    setCleanConfirmTableId(tableId)
  }

  const handleCleanTableConfirm = () => {
    if (cleanConfirmTableId && socket && connected && ownerPin) {
      socket.emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId: cleanConfirmTableId, pin: ownerPin })
    }
    setCleanConfirmTableId(null)
  }

  const handleCleanTableCancel = () => {
    setCleanConfirmTableId(null)
  }

  const pageTitle = isOwnerDashboard ? 'Panel de Organizador' : 'Panel de Árbitro'
  const pageSubtitle = isOwnerDashboard 
    ? 'Crea mesas, gestiona árbitros y partidos' 
    : isReferee 
      ? 'Gestiona tu mesa y arbitra'
      : 'Observa los partidos en vivo'

  // Only Owner can create tables (RF-03)
  const canCreateTable = isOwnerDashboard

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
            liveMatches={tables.filter(t => t.status === 'LIVE' || t.status === 'CONFIGURING').length || 0}
            activePlayers={tables.reduce((acc, t) => {
              // Count 2 players if there are player names (match in progress)
              const hasPlayers = t.playerNames?.a || t.playerNames?.b;
              return acc + (hasPlayers ? 2 : (t.playerCount || 0));
            }, 0) || 0}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <DashboardGrid 
            tables={tables} 
            onTableClick={handleTableClick} 
            viewMode={viewMode}
            showPin={isOwnerDashboard}
            showQr={isOwnerDashboard}
            onCleanTable={isOwnerDashboard ? handleCleanTableRequest : undefined}
            cleanTableId={cleanConfirmTableId}
            onCleanTableConfirm={handleCleanTableConfirm}
            onCleanTableCancel={handleCleanTableCancel}
          />
        </div>
      </div>

      {/* PIN Modal for table access (RF-04) */}
      <PinModal
        isOpen={pinModalOpen}
        tableName={selectedTable?.name || ''}
        onClose={handlePinClose}
        onSubmit={handlePinSubmit}
        isLoading={pinLoading}
        error={pinError}
      />
    </div>
  )
}