import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '../../atoms/Button'
import { Body, Title, Label } from '../../atoms/Typography'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { AlertTriangle } from 'lucide-react'
import { SPORT } from '@shared/types'
import type { Sport } from '@shared/types'
import { SportDisplayRegistry } from '../../../adapters/SportDisplayRegistry'
import type { ConfigField } from '../../../adapters/SportDisplayAdapter'

const registry = new SportDisplayRegistry()

export interface MatchConfigModalProps {
  isOpen: boolean
  tableId: string
  tableName: string
  initialBestOf?: 1 | 3 | 5
  initialHandicapA?: number
  initialHandicapB?: number
  initialSport?: Sport
  onSubmit: (config: {
    bestOf: number
    handicapA: number
    handicapB: number
    playerNameA: string
    playerNameB: string
    sport?: Sport
    gamesPerSet?: number
    tiebreakPoints?: 7 | 10
    goldenPoint?: boolean
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
  initialSport = SPORT.TABLE_TENNIS,
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
  const [sport, setSport] = useState<Sport>(initialSport)

  // Sport-specific config state (dynamic per adapter)
  const [sportConfig, setSportConfig] = useState<Record<string, unknown>>({})

  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, isOpen, onClose)

  // Resolve adapter for current sport (memoized, non-React use)
  const adapter = useMemo(() => registry.resolve(sport), [sport])
  const configFields = useMemo(() => adapter.getConfigFields(), [adapter])
  const showHandicap = adapter.needsHandicap()

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPlayerNameA('')
      setPlayerNameB('')
      setBestOf(initialBestOf)
      setHandicapA(initialHandicapA)
      setHandicapB(initialHandicapB)
      setSport(initialSport)
      // Initialize sport config from adapter defaults
      const defaults = adapter.getConfigDefaults()
      const initial: Record<string, unknown> = {}
      for (const field of configFields) {
        initial[field.name] = (defaults as any)[field.name] ?? (
          field.type === 'boolean' ? false : field.type === 'number' ? (field.min ?? 0) : ''
        )
      }
      setSportConfig(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialBestOf, initialHandicapA, initialHandicapB, initialSport])

  const handleSportChange = (newSport: Sport) => {
    setSport(newSport)
    // Reset sport-specific config when sport changes
    const newAdapter = registry.resolve(newSport)
    const defaults = newAdapter.getConfigDefaults()
    const initial: Record<string, unknown> = {}
    for (const field of newAdapter.getConfigFields()) {
      initial[field.name] = (defaults as any)[field.name] ?? (
        field.type === 'boolean' ? false : field.type === 'number' ? (field.min ?? 0) : ''
      )
    }
    setSportConfig(initial)
  }

  const updateSportField = (name: string, value: unknown) => {
    setSportConfig(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = () => {
    const payload: any = {
      bestOf,
      handicapA,
      handicapB,
      playerNameA: playerNameA.trim() || 'Player A',
      playerNameB: playerNameB.trim() || 'Player B',
      sport,
    }

    // Include sport-specific config fields
    for (const field of configFields) {
      payload[field.name] = sportConfig[field.name]
    }

    onSubmit(payload)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  /** Render a config field based on its type */
  const renderField = (field: ConfigField) => {
    const value = sportConfig[field.name]

    if (field.type === 'boolean') {
      return (
        <div key={field.name} className="flex items-center justify-between mb-3">
          <Label>{field.label}</Label>
          <button
            type="button"
            onClick={() => updateSportField(field.name, !value)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              value ? 'bg-primary' : 'bg-surface-low border border-border'
            }`}
            disabled={isLoading}
            role="switch"
            aria-checked={!!value}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              value ? 'left-[26px]' : 'left-0.5'
            }`} />
          </button>
        </div>
      )
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.name} className="mb-3">
          <Label className="mb-1">{field.label}</Label>
          <div className="flex gap-2">
            {field.options.map(opt => (
              <Button
                key={String(opt.value)}
                variant={value === opt.value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => updateSportField(field.name, opt.value)}
                disabled={isLoading}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )
    }

    // Number field
    return (
      <div key={field.name} className="mb-3">
        <Label className="mb-1">{field.label}</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateSportField(field.name, Math.max(field.min ?? 0, (value as number || 1) - 1))}
            disabled={isLoading}
            className="!p-2"
          >
            -
          </Button>
          <div className="w-12 text-center font-heading text-xl font-bold">
            {value as number ?? field.min ?? 1}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateSportField(field.name, Math.min(field.max ?? 99, (value as number || 0) + 1))}
            disabled={isLoading}
            className="!p-2"
          >
            +
          </Button>
        </div>
      </div>
    )
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

        {/* Sport Selector */}
        <div className="mb-4">
          <Label className="mb-2">Deporte</Label>
          <div className="flex gap-2">
            {([SPORT.TABLE_TENNIS, SPORT.PADEL] as Sport[]).map(s => (
              <Button
                key={s}
                variant={sport === s ? 'primary' : 'secondary'}
                size="sm"
                fullWidth
                onClick={() => handleSportChange(s)}
                disabled={isLoading}
              >
                {s === SPORT.TABLE_TENNIS ? 'Tenis de Mesa' : 'Padel'}
              </Button>
            ))}
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

        {/* Dynamic Sport Config Fields */}
        {configFields.length > 0 && (
          <div className="mb-4 p-3 bg-surface-low rounded-[--radius-md]">
            {configFields.map(renderField)}
          </div>
        )}

        {/* Handicap (only shown when adapter supports it) */}
        {showHandicap && (
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
                  -
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
                  -
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
        )}

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
