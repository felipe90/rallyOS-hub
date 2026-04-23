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
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { usePinSubmission } from '@/hooks/usePinSubmission'
import { Button } from '@/components/atoms/Button'
import { SocketEvents } from '@shared/events'
import { Routes, buildScoreboardRoute } from '@/routes'
import type { QRData, TableInfoWithPin } from '@shared/types'

export interface OwnerDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function OwnerDashboardPage({ viewMode: initialViewMode }: OwnerDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [tableName, setTableName] = useState('')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const [cleanConfirmTableId, setCleanConfirmTableId] = useState<string | null>(null)
  const [deleteConfirmTableId, setDeleteConfirmTableId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { tables, connected, createTable, socket, requestTablesWithPins } = useSocketContext()
  const { logout, ownerPin, isOwner, setTablePin } = useAuthContext()
  const stats = useDashboardStats(tables)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)

  // Owner always gets tables with PINs
  useEffect(() => {
    if (!connected) return
    requestTablesWithPins(ownerPin || '')
  }, [connected, ownerPin, requestTablesWithPins])

  // Listen for QR_DATA and PIN_REGENERATED events
  useEffect(() => {
    if (!socket) return

    const handleQRData = (_qrData: QRData) => {
      // QR received - could show modal if needed
    }

    const handlePinRegenerated = (_data: { tableId: string; newPin: string }) => {
      // Request updated table list with PINs (similar to TABLE_CREATED flow)
      requestTablesWithPins(ownerPin || '')
    }

    socket.on(SocketEvents.SERVER.QR_DATA, handleQRData)
    socket.on(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)

    return () => {
      socket.off(SocketEvents.SERVER.QR_DATA, handleQRData)
      socket.off(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)
    }
  }, [socket, ownerPin, requestTablesWithPins])

  const handleLogout = () => {
    logout()
    navigate(Routes.AUTH)
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
      clearError()
    }
  }

  const handlePinSubmit = async (pin: string) => {
    if (!selectedTable) return
    setTablePin(pin)
    const result = await submitPin(pin, selectedTable.id)
    if (result.success) {
      navigate(buildScoreboardRoute(selectedTable.id, 'referee'))
    }
  }

  const handlePinClose = () => {
    setPinModalOpen(false)
    setSelectedTable(null)
    clearError()
  }

  const handleCleanTableRequest = (tableId: string) => {
    setCleanConfirmTableId(tableId)
  }

  const handleCleanTableConfirm = () => {
    if (cleanConfirmTableId && socket && connected) {
      socket.emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId: cleanConfirmTableId })
    }
    setCleanConfirmTableId(null)
  }

  const handleCleanTableCancel = () => {
    setCleanConfirmTableId(null)
  }

  // Delete table handlers
  const handleDeleteTableRequest = (tableId: string) => {
    setDeleteConfirmTableId(tableId)
  }

  const handleDeleteTableConfirm = () => {
    if (deleteConfirmTableId && socket && connected) {
      // Owner already authenticated in dashboard, no PIN needed
      socket.emit(SocketEvents.CLIENT.DELETE_TABLE, { tableId: deleteConfirmTableId })
    }
    setDeleteConfirmTableId(null)
  }

  const handleDeleteTableCancel = () => {
    setDeleteConfirmTableId(null)
  }

  return (
    <div className="flex flex-col h-screen bg-surface ">
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
              Atrás
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto bg-primary/10">
        <div className="p-4 ">
          <DashboardHeader
            totalTables={stats.totalTables}
            liveMatches={stats.liveMatches}
            activePlayers={stats.activePlayers}
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
            onDeleteTable={handleDeleteTableRequest}
            showDeleteConfirm={deleteConfirmTableId}
            onDeleteTableConfirm={handleDeleteTableConfirm}
            onDeleteTableCancel={handleDeleteTableCancel}
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
