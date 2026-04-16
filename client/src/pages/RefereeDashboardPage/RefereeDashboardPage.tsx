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
import { Button } from '@/components/atoms/Button'
import { SocketEvents } from '@shared/events'
import { Routes, buildScoreboardRoute } from '@/routes'
import type { TableInfoWithPin } from '@/shared/types'

export interface RefereeDashboardPageProps {
  viewMode?: 'grid' | 'list'
}

export function RefereeDashboardPage({ viewMode: initialViewMode }: RefereeDashboardPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode || 'grid')
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableInfoWithPin | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const navigate = useNavigate()
  const { tables, connected, socket, requestTables, emit: _emit } = useSocketContext()
  const { logout } = useAuthContext()

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
        navigate(buildScoreboardRoute(selectedTable.id, 'referee'))
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
      navigate(buildScoreboardRoute(selectedTable.id, 'referee'))
    }, 5000)
  }

  const handlePinClose = () => {
    setPinModalOpen(false)
    setSelectedTable(null)
    setPinError(null)
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
