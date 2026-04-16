/**
 * Owner Dashboard Page
 * Full admin dashboard with table creation, PIN management, and QR codes
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardGrid } from '@/components/organisms/DashboardGrid'
import { DashboardHeader } from '@/components/organisms/DashboardGrid'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PinModal } from '@/components/molecules/PinModal'
import { useSocketContext } from '@/contexts/SocketContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { useDashboardAuth } from '@/hooks/useDashboardAuth'
import { Button } from '@/components/atoms/Button'
import { SocketEvents } from '@shared/events'
import type { QRData, TableInfoWithPin } from '@/shared/types'

export interface OwnerDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function OwnerDashboardPage({ viewMode: initialViewMode }: OwnerDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [tableName, setTableName] = useState('')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [cleanConfirmTableId, setCleanConfirmTableId] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const navigate = useNavigate()
  const { tables, connected, createTable, socket, requestTablesWithPins, emit: _emit } = useSocketContext()
  const { logout, ownerPin } = useAuthContext()
  const { isOwner } = useDashboardAuth()

  // Owner always gets tables with PINs
  useEffect(() => {
    if (!connected) return
    requestTablesWithPins(ownerPin || '')
  }, [connected, ownerPin, requestTablesWithPins])

  // Listen for QR_DATA and PIN_REGENERATED events
  useEffect(() => {
    if (!socket) return

    const handleQRData = (_qrData: QRData) => {
      // Could show a modal or toast with the new QR
    }

    const handlePinRegenerated = (_data: { tableId: string; newPin: string }) => {
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
    createTable(tableName.trim() || undefined)
    setTableName('')
    setIsCreatingTable(false)
  }

  const handleTableClick = (tableId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (table) {
      setSelectedTable(table as TableInfoWithPin)
      setPinModalOpen(true)
      setPinError(null)
    }
  }

  const handlePinSubmit = async (pin: string) => {
    if (!selectedTable || !socket) return
    
    localStorage.setItem('tablePin', pin)
    setPinLoading(true)
    socket.emit(SocketEvents.CLIENT.SET_REF, { tableId: selectedTable.id, pin })
    
    const handleResponse = (response: { success?: boolean; error?: string }) => {
      socket.off('REF_SET', handleResponse)
      socket.off('ERROR', handleError)
      setPinLoading(false)
      
      if (response.success || (response as any).tableId) {
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
    
    setTimeout(() => {
      socket.off('REF_SET', handleResponse)
      socket.off('ERROR', handleError)
      setPinLoading(false)
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

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title="Panel de Organizador"
        subtitle="Crea mesas, gestiona árbitros y partidos"
        showStatus={true}
        actions={
          <div className="flex gap-2">
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
            <Button variant="ghost" onClick={handleLogout} size="sm" animate={false}>
              Salir
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <DashboardHeader
            totalTables={tables.length || 0}
            liveMatches={tables.filter(t => t.status === 'LIVE' || t.status === 'CONFIGURING').length || 0}
            activePlayers={tables.reduce((acc, t) => {
              const hasPlayers = t.playerNames?.a || t.playerNames?.b
              return acc + (hasPlayers ? 2 : (t.playerCount || 0))
            }, 0) || 0}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <DashboardGrid 
            tables={tables} 
            onTableClick={handleTableClick} 
            viewMode={viewMode}
            showPin={true}
            showQr={true}
            onCleanTable={handleCleanTableRequest}
            cleanTableId={cleanConfirmTableId}
            onCleanTableConfirm={handleCleanTableConfirm}
            onCleanTableCancel={handleCleanTableCancel}
          />
        </div>
      </div>

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
