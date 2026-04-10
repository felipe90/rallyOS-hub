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
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const availableTables = tables.filter((t) => t.status === 'WAITING')

  const handleJoinTable = async (tableId: string) => {
    if (!name.trim()) {
      setError('Ingresa tu nombre')
      return
    }
    if (!pin || pin.length !== 4) {
      setError('PIN debe tener 4 dígitos')
      return
    }

    try {
      // Emit JOIN_TABLE event to server with name and pin
      emit('JOIN_TABLE', { tableId, name: name.trim(), pin })
      
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
                    <input
                      type="text"
                      placeholder="Tu nombre"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        setError('')
                      }}
                      className="w-full px-4 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <PinInput
                      length={4}
                      value={pin}
                      onChange={(value) => {
                        setPin(value)
                        setError('')
                      }}
                      onComplete={() => handleJoinTable(table.id)}
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
                      disabled={pin.length !== 4 || !name.trim()}
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
