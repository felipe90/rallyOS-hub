import { useNavigate } from 'react-router-dom'
import { useSocketContext } from '../../contexts/SocketContext'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/molecules/PageHeader'
import { PinInput } from '../../components/atoms/PinInput'
import { Button } from '../../components/atoms/Button'
import { Typography } from '../../components/atoms/Typography'
import { useState } from 'react'

export function WaitingRoomPage() {
  const navigate = useNavigate()
  const { tables, emit } = useSocketContext()
  const { login } = useAuth()
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const availableTables = tables.filter((t) => t.status === 'WAITING')

  const handleJoinTable = async (tableId: string) => {
    if (!pin || pin.length !== 5) {
      setError('PIN debe tener 5 dígitos')
      return
    }

    try {
      // Emit JOIN_TABLE event to server
      emit('JOIN_TABLE', { tableId, pin, role: 'viewer' })
      
      // Store table info
      login('viewer', tableId)
      
      // Navigate to scoreboard
      navigate(`/scoreboard/${tableId}`)
    } catch (err) {
      setError('Error al unirse a la mesa')
      console.error(err)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      <PageHeader
        title="Mesas Disponibles"
        showStatus={false}
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
                onClick={() => setSelectedTableId(table.id)}
              >
                <h3 className="font-heading font-bold text-lg mb-2">{table.name}</h3>
                <p className="text-text-muted mb-4">
                  {table.playerNames?.a || 'Jugador A'} vs {table.playerNames?.b || 'Jugador B'}
                </p>
                
                {selectedTableId === table.id && (
                  <div className="flex flex-col gap-2">
                    <PinInput
                      length={5}
                      value={pin}
                      onChange={(value) => {
                        setPin(value)
                        setError('')
                      }}
                      disabled={false}
                      error={error}
                      placeholder="•••••"
                    />
                    {error && (
                      <p className="text-sm text-red-500">{error}</p>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleJoinTable(table.id)}
                      disabled={pin.length !== 5}
                    >
                      Unirse
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
