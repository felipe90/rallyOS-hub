import { useI18n } from '@/i18n'
import { Button } from '@/components/atoms/Button'
import { Title, Body } from '@/components/atoms/Typography'

export interface TournamentResumeModalProps {
  isOpen: boolean
  matchCount: number
  lastSaved: string | null
  onLoad: () => void
  onNew: () => void
}

/**
 * Formats an ISO date string to a localized date string.
 * Falls back to the raw string if parsing fails.
 */
function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  try {
    const date = new Date(isoDate)
    if (isNaN(date.getTime())) return isoDate
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoDate
  }
}

export function TournamentResumeModal({
  isOpen,
  matchCount,
  lastSaved,
  onLoad,
  onNew,
}: TournamentResumeModalProps) {
  const { i18nText } = useI18n()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — no onClick handler: blocks dismissal */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal content */}
      <div className="relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm">
        <Title className="text-center mb-2">
          {i18nText('tournamentResumeTitle')}
        </Title>

        <Body className="text-center text-text/70 mb-4">
          {i18nText('tournamentResumeDescription')}
        </Body>

        <div className="mb-6 space-y-2">
          <div className="flex justify-between items-center px-3 py-2 bg-surface-low rounded-md">
            <Body className="text-text/70">
              {i18nText('tournamentResumeMatches')}
            </Body>
            <Body className="font-semibold">{matchCount}</Body>
          </div>
          <div className="flex justify-between items-center px-3 py-2 bg-surface-low rounded-md">
            <Body className="text-text/70">
              {i18nText('tournamentResumeLastSaved')}
            </Body>
            <Body className="font-semibold text-sm">
              {formatDate(lastSaved)}
            </Body>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onNew}
            className="flex-1"
          >
            {i18nText('tournamentResumeNew')}
          </Button>
          <Button
            variant="primary"
            onClick={onLoad}
            className="flex-1"
          >
            {i18nText('tournamentResumeLoad')}
          </Button>
        </div>
      </div>
    </div>
  )
}
