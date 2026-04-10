import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardGrid } from '@/components/organisms/DashboardGrid'
import { DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PinModal } from '@/components/molecules/PinModal'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import type { QRData, TableInfoWithPin } from '@/shared/types'

export function DashboardPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [tableName, setTableName] = useState('')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const navigate = useNavigate()
  const { tables, connected, createTable, socket, requestTables, requestTablesWithPins, emit } = useSocketContext()
  const { logout, isReferee, isViewer, isOwner, ownerPin } = useAuth()

  // Load tables with PINs if Owner, otherwise regular tables
  useEffect(() => {
    console.log('[Dashboard] connected:', connected, 'isOwner:', isOwner, 'ownerPin:', ownerPin, 'tables:', tables.length)
    
    if (!connected) return
    
    // Immediate load - no delay
    if (isOwner && ownerPin) {
      console.log('[Dashboard] Requesting tables with PINs, ownerPin:', ownerPin)
      requestTablesWithPins(ownerPin)
    } else if (isOwner) {
      console.log('[Dashboard] Requesting tables with PINs (no ownerPin)')
      requestTablesWithPins('')
    } else {
      console.log('[Dashboard] Requesting regular tables')
      requestTables()
    }
    
    // Refresh every 3 seconds for updates
    const interval = setInterval(() => {
      if (isOwner && ownerPin) {
        requestTablesWithPins(ownerPin)
      } else if (isOwner) {
        requestTablesWithPins('')
      } else {
        requestTables()
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }, [connected, isOwner, ownerPin, requestTables, requestTablesWithPins])

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
    socket.emit('SET_REF', { tableId: selectedTable.id, pin })
    
    // Listen for response
    const handleResponse = (response: { success?: boolean; error?: string }) => {
      socket.off('REF_SET', handleResponse)
      socket.off('ERROR', handleError)
      
      setPinLoading(false)
      
      if (response.success || (response as any).tableId) {
        // Success - navigate
        navigate(`/scoreboard/${selectedTable.id}`)
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
      // Still allow navigation after timeout (trust client)
      navigate(`/scoreboard/${selectedTable.id}`)
    }, 5000)
  }

  const handlePinClose = () => {
    setPinModalOpen(false)
    setSelectedTable(null)
    setPinError(null)
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

  // Only Owner can create tables (RF-03)
  const canCreateTable = isOwner

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
            showPin={isOwner}
            showQr={isOwner}
            onCleanTable={isOwner ? handleRegeneratePin : undefined}
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