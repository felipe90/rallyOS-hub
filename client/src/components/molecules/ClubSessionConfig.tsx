/**
 * ClubSessionConfig — initial mode selector shown on JOIN before any play.
 *
 * Spec (player-identity):
 *   - Name + phone inputs BEFORE mode cards
 *   - "Comenzar" disabled until name non-empty AND phone non-empty AND mode selected
 *   - On submit: encrypts phone client-side via AES-256-GCM if encryptionKey is
 *     present (delivered on CLUB_JOIN_RESULT). Falls back to raw phone text when
 *     encryptionKey is missing (graceful degradation for legacy configurations).
 *   - On "Comenzar" with free mode → onSelectFree(name, phone)
 *   - On "Comenzar" with match mode → onSelectMatch(name, phone)
 *
 * The parent (ClubPlayPage) wires:
 *   - onSelectFree → useClubPlay.startFreePlay(name, phone)
 *   - onSelectMatch → render ClubMatchConfig (which later emits via newMatch)
 */
import { useState, useCallback } from 'react'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Typography } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'
import type { SessionMode } from '@shared/types'
import { encryptPhoneClient } from '@/shared/crypto/phoneEncryption'

export interface ClubSessionConfigProps {
  /** Emitted when the player selects "Modo Libre" and confirms. */
  onSelectFree: (name: string, phone: string) => void
  /** Emitted when the player selects "Modo Match" and confirms. */
  onSelectMatch: (name: string, phone: string) => void
  /**
   * Base64 AES-256-GCM key from ClubConfig.encryptionKey.
   * When present, the phone is encrypted client-side before transmission.
   * When absent (graceful degradation), the raw phone text is emitted.
   */
  encryptionKey?: string
}

export function ClubSessionConfig({
  onSelectFree,
  onSelectMatch,
  encryptionKey,
}: ClubSessionConfigProps) {
  const { i18nText } = useI18n()
  const [selected, setSelected] = useState<SessionMode | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const canStart = name.trim().length > 0 && phone.trim().length > 0 && selected !== null

  const handleStart = useCallback(async () => {
    if (!canStart || !selected) return

    setLoading(true)
    try {
      let phoneOut = phone.trim()
      if (encryptionKey) {
        phoneOut = await encryptPhoneClient(phone.trim(), encryptionKey)
      }

      if (selected === 'free') {
        onSelectFree(name.trim(), phoneOut)
      } else {
        onSelectMatch(name.trim(), phoneOut)
      }
    } finally {
      setLoading(false)
    }
  }, [canStart, selected, name, phone, encryptionKey, onSelectFree, onSelectMatch])

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh bg-surface gap-6 p-4"
      data-testid="club-session-config"
    >
      <Typography variant="title" className="text-center">
        {i18nText('clubPlaySessionConfigTitle')}
      </Typography>

      {/* Name + Phone inputs */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Input
          placeholder={i18nText('clubPlayNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <Input
          type="tel"
          placeholder={i18nText('clubPlayPhonePlaceholder')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </div>

      {/* Mode selector */}
      <div className="flex flex-col gap-3 w-full max-w-sm" role="radiogroup" aria-label="session-mode">
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'free'}
          onClick={() => setSelected('free')}
          disabled={loading}
          className={`text-left w-full p-4 rounded-xl border-2 transition-colors ${
            selected === 'free'
              ? 'border-primary bg-primary/10'
              : 'border-border bg-surface hover:bg-surface-low'
          }`}
          data-testid="mode-free"
        >
          <Typography variant="headline" className="text-2xl">
            {i18nText('clubPlayModeFree')}
          </Typography>
          <Typography variant="body" className="text-muted-foreground">
            {i18nText('clubPlayModeFreeDesc')}
          </Typography>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selected === 'match'}
          onClick={() => setSelected('match')}
          disabled={loading}
          className={`text-left w-full p-4 rounded-xl border-2 transition-colors ${
            selected === 'match'
              ? 'border-primary bg-primary/10'
              : 'border-border bg-surface hover:bg-surface-low'
          }`}
          data-testid="mode-match"
        >
          <Typography variant="headline" className="text-2xl">
            {i18nText('clubPlayModeMatch')}
          </Typography>
          <Typography variant="body" className="text-muted-foreground">
            {i18nText('clubPlayModeMatchDesc')}
          </Typography>
        </button>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleStart}
        disabled={!canStart || loading}
        loading={loading}
        fullWidth
        className="max-w-sm"
      >
        {i18nText('clubPlayModeStart')}
      </Button>
    </div>
  )
}