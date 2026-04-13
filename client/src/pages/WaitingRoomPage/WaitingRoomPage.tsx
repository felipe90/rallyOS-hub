import { useNavigate } from 'react-router-dom'
import { useSocketContext } from '../../contexts/SocketContext'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/molecules/PageHeader'
import { Button } from '../../components/atoms/Button'
import { Typography } from '../../components/atoms/Typography'
import { useState } from 'react'

export function WaitingRoomPage() {
  const navigate = useNavigate()
  const { tables, emit } = useSocketContext()
  const { login } = useAuth()

  const availableTables = tables.filter((t) => t.status === 'WAITING')

  // Espectador entra directo sin PIN ni nombre
  const handleJoinTable = (tableId: string) => {
    // Emit JOIN_TABLE as spectator (no PIN needed)
    emit('JOIN_TABLE', { tableId, name: 'Espectador', role: 'viewer' })
    
    // Store table info
    login('viewer', tableId)
    
    // Navigate to scoreboard directly
    navigate(`/scoreboard/${tableId}`)
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title="Mesas Disponibles"
        actions={
          <Button
            variant="ghost"
            onClick={() => navigate('/auth')}
            size="sm"
          >
            Atrás
          </Button>
        }
      />

      {/* Tables Grid */}
      <div className="flex-1 overflow-auto p-4">
        {availableTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Typography variant="title">No hay mesas disponibles</Typography>
            <Typography variant="body" className="text-text-muted">
              Intenta más tarde
            </Typography>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableTables.map((table) => (
              <div
                key={table.id}
                className="p-4 bg-surface-secondary rounded-lg border border-border cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleJoinTable(table.id)}
              >
                <h3 className="font-heading font-bold text-lg mb-2">{table.name}</h3>
                <p className="text-text-muted">
                  {table.playerNames?.a || 'Jugador A'} vs {table.playerNames?.b || 'Jugador B'}
                </p>
                <p className="text-sm text-primary mt-2">Tocá para spectar</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
