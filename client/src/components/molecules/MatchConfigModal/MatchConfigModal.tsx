import { useState, useEffect, useRef } from 'react'
import { Button } from '../../atoms/Button'
import { Body, Title, Label } from '../../atoms/Typography'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { AlertTriangle } from 'lucide-react'

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
  title?: string
  forTableLabel?: string
  playersLabel?: string
  playerAPlaceholder?: string
  playerBPlaceholder?: string
  bestOfLabel?: string
  handicapLabel?: string
  teamALabel?: string
  teamBLabel?: string
  cancelLabel?: string
  submitLabel?: string
  submitLoadingLabel?: string
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
  title = 'Configurar Partido',
  forTableLabel = 'para {{tableName}}',
  playersLabel = 'Jugadores',
  playerAPlaceholder = 'Jugador A',
  playerBPlaceholder = 'Jugador B',
  bestOfLabel = 'Mejor de',
  handicapLabel = 'Handicap',
  teamALabel = 'Equipo A',
  teamBLabel = 'Equipo B',
  cancelLabel = 'Cancelar',
  submitLabel = 'Iniciar Partido',
  submitLoadingLabel = 'Iniciando...',
}: MatchConfigModalProps) {
  const [playerNameA, setPlayerNameA] = useState('')
  const [playerNameB, setPlayerNameB] = useState('')
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(initialBestOf)
  const [handicapA, setHandicapA] = useState(initialHandicapA)
  const [handicapB, setHandicapB] = useState(initialHandicapB)

  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, isOpen, onClose)

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
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-config-modal-title"
        className="card relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
      >
        <Title id="match-config-modal-title" className="text-center mb-2">{title}</Title>

        <Body className="text-center text-text/70 mb-6">
          {forTableLabel.replace('{{tableName}}', tableName)}
        </Body>

        {/* Player Names */}
        <div className="mb-4">
          <Label className="mb-2">{playersLabel}</Label>
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor="player-a-name" className="sr-only">{playerAPlaceholder}</label>
            <input
              id="player-a-name"
              type="text"
              placeholder={playerAPlaceholder}
              value={playerNameA}
              onChange={(e) => setPlayerNameA(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="player-b-name" className="sr-only">{playerBPlaceholder}</label>
            <input
              id="player-b-name"
              type="text"
              placeholder={playerBPlaceholder}
              value={playerNameB}
              onChange={(e) => setPlayerNameB(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Best Of */}
        <div className="mb-4">
          <Label className="mb-2">{bestOfLabel}</Label>
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
          <Label className="mb-2">{handicapLabel}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-2 bg-surface-low rounded-[--radius-md] p-3">
              <Label>{teamALabel}</Label>
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
              <Label>{teamBLabel}</Label>
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
          <div role="alert" className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <Body className="text-red-500 text-sm">
              {error}
            </Body>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>

          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? submitLoadingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
