import { useState, useEffect } from 'react'
import { Button } from '../../atoms/Button'
import { Body, Title, Label } from '../../atoms/Typography'
import { Info, AlertTriangle, AlertCircle, Bell } from 'lucide-react'
import type { KioskNotificationType } from '@shared/types'

export interface KioskNotificationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (notification: {
    type: KioskNotificationType
    message: string
    duration: number
  }) => void
  isLoading?: boolean
  error?: string | null
  /** i18n labels */
  title?: string
  typeLabel?: string
  typeInfoLabel?: string
  typeWarningLabel?: string
  typeErrorLabel?: string
  typeImportantLabel?: string
  messageLabel?: string
  messagePlaceholder?: string
  durationLabel?: string
  cancelLabel?: string
  submitLabel?: string
}

const TYPE_ICONS: Record<KioskNotificationType, React.ComponentType<{ className?: string; size?: number }>> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  important: Bell,
}

const TYPE_COLORS: Record<KioskNotificationType, string> = {
  info: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  important: 'bg-blue-500',
}

const DURATION_OPTIONS = [5, 10, 15, 30] as const

const MAX_MESSAGE_LENGTH = 280

export function KioskNotificationModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
  title = 'notificationModalTitle',
  typeLabel = 'notificationTypeLabel',
  typeInfoLabel = 'notificationTypeInfo',
  typeWarningLabel = 'notificationTypeWarning',
  typeErrorLabel = 'notificationTypeError',
  typeImportantLabel = 'notificationTypeImportant',
  messageLabel = 'notificationMessageLabel',
  messagePlaceholder = 'notificationMessagePlaceholder',
  durationLabel = 'notificationDurationLabel',
  cancelLabel = 'commonCancel',
  submitLabel = 'notificationSend',
}: KioskNotificationModalProps) {
  const [selectedType, setSelectedType] = useState<KioskNotificationType | null>(null)
  const [message, setMessage] = useState('')
  const [duration, setDuration] = useState(5)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(null)
      setMessage('')
      setDuration(5)
    }
  }, [isOpen])

  const handleSubmit = () => {
    if (!selectedType || message.trim().length === 0) return
    onSubmit({
      type: selectedType,
      message: message.trim(),
      duration,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const isValid = selectedType !== null && message.trim().length > 0

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
      <div className="card relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <Title className="text-center mb-2">{title}</Title>

        {/* Notification Type Selector */}
        <div className="mb-4">
          <Label className="mb-2">{typeLabel}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TYPE_ICONS) as KioskNotificationType[]).map((type) => {
              const Icon = TYPE_ICONS[type]
              const colorClass = TYPE_COLORS[type]
              const isSelected = selectedType === type
              const typeLabels: Record<KioskNotificationType, string> = {
                info: typeInfoLabel,
                warning: typeWarningLabel,
                error: typeErrorLabel,
                important: typeImportantLabel,
              }
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  disabled={isLoading}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-md border-2 font-heading text-sm font-medium
                    transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-primary/30
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface hover:bg-surface-high text-text'}
                  `}
                >
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full ${colorClass} text-white`}>
                    <Icon size={14} />
                  </span>
                  {typeLabels[type]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Message Textarea */}
        <div className="mb-4">
          <Label className="mb-2">{messageLabel}</Label>
          <textarea
            placeholder={messagePlaceholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={3}
            disabled={isLoading}
            className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <Body className="text-right text-xs text-text/60 mt-1">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </Body>
        </div>

        {/* Duration Selector */}
        <div className="mb-6">
          <Label className="mb-2">{durationLabel}</Label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={isLoading}
            className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
            role="combobox"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
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
            {cancelLabel}
          </Button>

          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            disabled={isLoading || !isValid}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
