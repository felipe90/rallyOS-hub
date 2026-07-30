/**
 * AdminOccupyModal — modal for admin to start a session on a RESERVED court
 *
 * Spec: admin-session-start — "A modal SHALL appear with: player name
 * (required), phone (required), mode (Match/Libre). Submit SHALL occupy
 * with timer."
 *
 * Phone encryption is handled internally when encryptionKey is provided.
 * Falls back to sending unencrypted when encryptionKey is null/undefined.
 */

import { useState, useCallback } from 'react'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { Body, Title } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'
import type { SessionMode } from '@shared/types'
import { encryptPhoneClient } from '@/shared/crypto/phoneEncryption'
import { User, Phone, X } from 'lucide-react'

export interface AdminOccupyModalProps {
  isOpen: boolean
  courtName: string
  encryptionKey?: string | null
  onClose: () => void
  onSubmit: (playerName: string, encryptedPhone: string, mode: SessionMode) => void
}

export function AdminOccupyModal({
  isOpen,
  courtName,
  encryptionKey,
  onClose,
  onSubmit,
}: AdminOccupyModalProps) {
  const { i18nText } = useI18n()
  const [playerName, setPlayerName] = useState('')
  const [phone, setPhone] = useState('')
  const [mode, setMode] = useState<SessionMode>('free')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!playerName.trim() || !phone.trim() || submitting) return

    setSubmitting(true)
    try {
      const phoneToSend = encryptionKey
        ? await encryptPhoneClient(phone.trim(), encryptionKey)
        : phone.trim()

      onSubmit(playerName.trim(), phoneToSend, mode)
    } catch {
      // Encryption failure — still send raw phone (backward-compatible)
      onSubmit(playerName.trim(), phone.trim(), mode)
    } finally {
      setSubmitting(false)
    }
  }, [playerName, phone, mode, encryptionKey, onSubmit, submitting])

  if (!isOpen) return null

  const canSubmit = playerName.trim().length > 0 && phone.trim().length > 0 && !submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="occupy-modal-title"
        className="card relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm space-y-5"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text/50 hover:text-text/80 transition-colors"
          aria-label={i18nText('commonClose')}
        >
          <X size={20} />
        </button>

        {/* Title */}
        <div className="text-center">
          <Title id="occupy-modal-title" className="text-lg">
            {i18nText('clubAdminOccupyTitle', { courtName })}
          </Title>
          <Body className="text-text/70 text-sm mt-1">
            {i18nText('clubAdminOccupySubtitle')}
          </Body>
        </div>

        {/* Name input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text/50">
            <User size={16} />
          </span>
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={i18nText('clubAdminOccupyNamePlaceholder')}
            className="pl-10"
            disabled={submitting}
            autoFocus
          />
        </div>

        {/* Phone input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text/50">
            <Phone size={16} />
          </span>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={i18nText('clubAdminOccupyPhonePlaceholder')}
            className="pl-10"
            disabled={submitting}
          />
        </div>

        {/* Mode buttons */}
        <div>
          <Body className="text-sm font-medium text-text/80 mb-2">
            {i18nText('clubAdminOccupyModeLabel')}
          </Body>
          <div className="flex gap-2">
            <Button
              variant={mode === 'free' ? 'primary' : 'outline'}
              size="sm"
              fullWidth
              onClick={() => setMode('free')}
              disabled={submitting}
            >
              {i18nText('clubAdminOccupyModeFree')}
            </Button>
            <Button
              variant={mode === 'match' ? 'primary' : 'outline'}
              size="sm"
              fullWidth
              onClick={() => setMode('match')}
              disabled={submitting}
            >
              {i18nText('clubAdminOccupyModeMatch')}
            </Button>
          </div>
        </div>

        {/* Submit */}
        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        >
          {i18nText('clubAdminOccupySubmit')}
        </Button>
      </div>
    </div>
  )
}
