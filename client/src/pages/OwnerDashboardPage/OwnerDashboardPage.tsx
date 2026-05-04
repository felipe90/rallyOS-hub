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
import { useTableManagement } from '@/hooks/useTableManagement'
import { Button } from '@/components/atoms/Button'
import { SocketEvents } from '@shared/events'
import { Routes, buildScoreboardRoute } from '@/routes'
import type { QRData, TableInfoWithPin } from '@shared/types'

export interface OwnerDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function OwnerDashboardPage({ viewMode: initialViewMode }: OwnerDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const navigate = useNavigate()
  const { tables, connected, socket, requestTablesWithPins } = useSocketContext()
  const { logout, ownerPin, setTablePin } = useAuthContext()
  const stats = useDashboardStats(tables)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)

  const tableMgmt = useTableManagement({ socket, connected })

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
      requestTablesWithPins(ownerPin || '')
    }

    socket.on(SocketEvents.SERVER.QR_DATA, handleQRData)
    socket.on(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)

    return () => {
      socket.off(SocketEvents.SERVER.QR_DATA, handleQRData)
      socket.off(SocketEvents.SERVER.PIN_REGENERATED, handlePinRegenerated)
    }
  }, [socket, ownerPin, requestTablesWithPins])

  /** ── PIN Modal ── */
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

  return (
    <div className="flex flex-col h-screen bg-surface ">
      <PageHeader
        title="Panel de Organizador"
        subtitle="Crea mesas, gestiona árbitros y partidos"
        showStatus={true}
        actions={
          <div className="flex gap-2">
            {!tableMgmt.isCreatingTable ? (
              <Button variant="secondary" onClick={tableMgmt.startCreating} size="sm" animate={false}>
                Nueva Mesa
              </Button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Nombre de la mesa..."
                  value={tableMgmt.tableName}
                  onChange={(e) => tableMgmt.setTableName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') tableMgmt.createTable()
                  }}
                  className="px-3 py-2 rounded border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <Button variant="primary" onClick={tableMgmt.createTable} size="sm" animate={false}>
                  Crear
                </Button>
                <Button variant="ghost" onClick={tableMgmt.cancelCreating} size="sm" animate={false}>
                  Cancelar
                </Button>
              </div>
            )}
            <Button variant="ghost" onClick={() => { logout(); navigate(Routes.AUTH) }} size="sm" animate={false}>
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
            onCleanTable={tableMgmt.requestClean}
            cleanTableId={tableMgmt.cleanConfirmTableId}
            onCleanTableConfirm={tableMgmt.confirmClean}
            onCleanTableCancel={tableMgmt.cancelClean}
            onDeleteTable={tableMgmt.requestDelete}
            showDeleteConfirm={tableMgmt.deleteConfirmTableId}
            onDeleteTableConfirm={tableMgmt.confirmDelete}
            onDeleteTableCancel={tableMgmt.cancelDelete}
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
