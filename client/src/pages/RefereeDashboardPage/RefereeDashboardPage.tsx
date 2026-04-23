/**
 * Referee Dashboard Page
 * Simplified dashboard for referees - can join tables with PIN but cannot create them
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
import type { TableInfoWithPin } from '@shared/types'

export interface RefereeDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function RefereeDashboardPage({ viewMode: initialViewMode }: RefereeDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const navigate = useNavigate()
  const { tables, connected, socket, requestTables, emit: _emit } = useSocketContext()
  const { logout, setTablePin } = useAuthContext()
  const stats = useDashboardStats(tables)
  const { submitPin, loading: pinLoading, error: pinError, clearError } = usePinSubmission(socket)

  // Referee gets regular tables (no PINs visible)
  useEffect(() => {
    if (!connected) return
    requestTables()
  }, [connected, requestTables])

  const handleLogout = () => {
    logout()
    navigate(Routes.AUTH)
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

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title="Panel de Árbitro"
        subtitle="Gestiona tu mesa y arbitra"
        showStatus={true}
        actions={
          <Button variant="ghost" onClick={handleLogout} size="sm" animate={false}>
            Atrás
          </Button>
        }
      />

      <div className="flex-1 overflow-auto bg-primary/10">
        <div className="p-4">
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
            showPin={false}
            showQr={false}
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
