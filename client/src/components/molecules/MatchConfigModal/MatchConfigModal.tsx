import { useState, useEffect } from 'react'
import { Button } from '../../atoms/Button'
import { Body, Title, Label } from '../../atoms/Typography'

export interface MatchConfigModalProps {
  isOpen: boolean
  tableId: string
  tableName: string
  initialBestOf?: 1 | 3 | 5
  initialHandicapA?: number
  initialHandicapB?: number
  onSubmit: (config: {
    bestOf: number
    handicapA: number
    handicapB: number
    playerNameA: string
    playerNameB: string
  }) => void
  onClose: () => void
  isLoading?: boolean
  error?: string | null
}

export function MatchConfigModal({
  isOpen,
  tableName,
  initialBestOf = 3,
  initialHandicapA = 0,
  initialHandicapB = 0,
  onSubmit,
  onClose,
  isLoading = false,
  error,
}: MatchConfigModalProps) {
  const [playerNameA, setPlayerNameA] = useState('')
  const [playerNameB, setPlayerNameB] = useState('')
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(initialBestOf)
  const [handicapA, setHandicapA] = useState(initialHandicapA)
  const [handicapB, setHandicapB] = useState(initialHandicapB)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPlayerNameA('')
      setPlayerNameB('')
      setBestOf(initialBestOf)
      setHandicapA(initialHandicapA)
      setHandicapB(initialHandicapB)
    }
  }, [isOpen, initialBestOf, initialHandicapA, initialHandicapB])

  const handleSubmit = () => {
    onSubmit({
      bestOf,
      handicapA,
      handicapB,
      playerNameA: playerNameA.trim() || 'Player A',
      playerNameB: playerNameB.trim() || 'Player B',
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <Title className="text-center mb-2">Configurar Partido</Title>

        <Body className="text-center text-text/70 mb-6">
          para {tableName}
        </Body>

        {/* Player Names */}
        <div className="mb-4">
          <Label className="mb-2">Jugadores</Label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Jugador A"
              value={playerNameA}
              onChange={(e) => setPlayerNameA(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Jugador B"
              value={playerNameB}
              onChange={(e) => setPlayerNameB(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Best Of */}
        <div className="mb-4">
          <Label className="mb-2">Mejor de</Label>
          <div className="flex gap-2">
            {([1, 3, 5] as const).map((bo) => (
              <Button
                key={bo}
                variant={bestOf === bo ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                onClick={() => setBestOf(bo)}
                disabled={isLoading}
              >
                {bo}
              </Button>
            ))}
          </div>
        </div>

        {/* Handicap */}
        <div className="mb-6">
          <Label className="mb-2">Handicap</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-2 bg-surface-low rounded-[--radius-md] p-3">
              <Label>Equipo A</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapA(handicapA - 1)}
                  disabled={isLoading}
                  className="!p-2"
                >
                  −
                </Button>
                <div className="w-10 text-center font-heading text-xl font-bold">
                  {handicapA}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapA(handicapA + 1)}
                  disabled={isLoading}
                  className="!p-2"
                >
                  +
                </Button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 bg-surface-low rounded-[--radius-md] p-3">
              <Label>Equipo B</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapB(handicapB - 1)}
                  disabled={isLoading}
                  className="!p-2"
                >
                  −
                </Button>
                <div className="w-10 text-center font-heading text-xl font-bold">
                  {handicapB}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapB(handicapB + 1)}
                  disabled={isLoading}
                  className="!p-2"
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <Body className="text-center text-red-500 mb-4 text-sm">
            {error}
          </Body>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancelar
          </Button>

          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando...' : 'Iniciar Partido'}
          </Button>
        </div>
      </div>
    </div>
  )
}
