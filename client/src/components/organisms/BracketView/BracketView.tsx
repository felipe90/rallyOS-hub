/**
 * BracketView organism — full bracket tree with a per-round layout.
 *
 * - `bracket === null` → setup form (name + size + 3rd-place toggle + Create).
 * - otherwise → rounds grouped via `groupIntoRounds` (memoized to keep the
 *   Orange Pi Zero 3's render budget low), each round headed by a `Headline`
 *   and each match rendered by `BracketMatchCard`.
 * - Modals (slot assignment, court assignment) are owned here so cards stay
 *   presentationally thin. Winner/undo confirms live inside the card.
 * - Responsive: 1 column < 1024px, 2 columns ≥ 1024px per round.
 * - All strings flow through i18n keys.
 */

import { useMemo, useState, useEffect } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { useSportTerms } from '@/hooks/useSportTerms'
import { bracketErrorTranslationKey } from '@/i18n/bracketError'
import { Button } from '@/components/atoms/Button'
import { Title, Body } from '@/components/atoms/Typography'
import { Input } from '@/components/atoms/Input'
import { Modal } from '@/components/atoms/Modal'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { BracketMatchCard } from '@/components/molecules/BracketMatchCard'
import { groupIntoRounds, resolveCourtContext } from './rounds'
import type {
  TournamentBracket,
  BracketSlot,
  Player,
  CourtInfo,
} from '@shared/types'

export interface BracketViewHandlers {
  onCreate: (name: string, numSlots: 4 | 8 | 16 | 32, includeThirdPlace: boolean) => void
  onAssignPlayer: (matchId: string, slot: BracketSlot, name: string) => void
  onSetWinner: (matchId: string, winner: Player) => void
  onAssignCourt: (matchId: string, courtId: string | null) => void
  /** Owner-picker court binding (D13/TCS-1) — emits TOURNAMENT_SELECT_TABLE. */
  onSelectTable: (matchId: string, courtId: string) => void
  onUndo: (matchId: string) => void
  onReset: (token?: string) => void
  onResetConfirm: (token: string) => void
  onClearError: () => void
}

export interface BracketViewProps extends BracketViewHandlers {
  bracket: TournamentBracket | null
  courts: CourtInfo[]
  error: { code: string; message: string } | null
  resetToken: string | null
  /**
   * TCS-4 strict cold start: false when the inventory has zero ACTIVE courts —
   * the setup form is replaced by the empty-state copy (no provisional
   * seeding). Defaults to true (backward compatible with direct usage).
   */
  hasAvailableCourts?: boolean
}

const SIZES: Array<4 | 8 | 16 | 32> = [4, 8, 16, 32]

interface SlotTarget {
  matchId: string
  slot: BracketSlot
  currentName: string
}

/**
 * Resolve a BRACKET_ERROR to display text. Court-related errors (the court
 * was removed, or is already assigned to another match) are sport-aware and
 * resolve through the sportTerm family; every other code keeps its regular
 * i18n key (with optional server message interpolation).
 */
function resolveBracketErrorText(
  code: string,
  message: string,
  terms: Record<string, string>,
  i18nText: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const key = bracketErrorTranslationKey(code)
  if (key === 'bracketError.courtNotFound') return terms.bracketErrorCourtNotFound
  if (key === 'bracketError.courtAlreadyAssigned') return terms.bracketErrorCourtAlreadyAssigned
  return i18nText(key, { message })
}

export function BracketView({
  bracket,
  courts,
  error,
  resetToken,
  hasAvailableCourts = true,
  onCreate,
  onAssignPlayer,
  onSetWinner,
  onAssignCourt,
  onSelectTable,
  onUndo,
  onReset,
  onResetConfirm,
  onClearError,
}: BracketViewProps) {
  const { terms, i18nText } = useSportTerms()
  const [name, setName] = useState('')
  const [size, setSize] = useState<4 | 8 | 16 | 32>(4)
  const [includeThird, setIncludeThird] = useState(false)

  const [slotTarget, setSlotTarget] = useState<SlotTarget | null>(null)
  const [slotName, setSlotName] = useState('')
  const [courtTargetMatchId, setCourtTargetMatchId] = useState<string | null>(null)
  const [resetFirstOpen, setResetFirstOpen] = useState(false)
  const [resetSecondOpen, setResetSecondOpen] = useState(false)

  // Step 2 of the 2-step reset: server issued a single-use token → show the
  // final confirmation. Falls back to idle when the token is cleared.
  useEffect(() => {
    if (resetToken != null) {
      setResetSecondOpen(true)
    }
  }, [resetToken])

  const rounds = useMemo(
    () => (bracket ? groupIntoRounds(bracket) : []),
    [bracket],
  )

  if (bracket === null) {
    // TCS-4 strict cold start: zero ACTIVE inventory courts → no provisional
    // seeding — the setup form is replaced by the explicit empty-state copy.
    if (hasAvailableCourts === false) {
      return (
        <div className="max-w-md mx-auto py-6">
          <Title className="mb-1">{i18nText('bracketSetupTitle')}</Title>
          <Body className="mb-4 text-text/70">{terms.tournamentNoCourts}</Body>
        </div>
      )
    }
    return (
      <div className="max-w-md mx-auto py-6">
        <Title className="mb-1">{i18nText('bracketSetupTitle')}</Title>
        <Body className="mb-4 text-text/70">{i18nText('bracketSetupSubtitle')}</Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim().length === 0) return
            onCreate(name.trim(), size, includeThird)
          }}
        >
          <Input
            label={i18nText('bracketSetupNameLabel')}
            placeholder={i18nText('bracketSetupNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <Body className="text-text/70">{i18nText('bracketSetupSizeLabel')}</Body>
            <div className="grid grid-cols-2 gap-2">
              {SIZES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={size === s ? 'primary' : 'secondary'}
                  onClick={() => setSize(s)}
                >
                  {i18nText(`bracketSize${s}`)}
                </Button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeThird}
              onChange={(e) => setIncludeThird(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <Body>{i18nText('bracketSetupThirdPlace')}</Body>
          </label>
          <Button type="submit" variant="primary" disabled={name.trim().length === 0}>
            {i18nText('bracketSetupCreate')}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      {error && (
        <div role="alert" className="flex items-center justify-between bg-red-50 border-l-4 border-red-500 px-4 py-2 rounded">
          <span className="text-red-700 text-sm">
            {resolveBracketErrorText(error.code, error.message, terms, i18nText)}
          </span>
          <button aria-label={i18nText('commonClose')} onClick={onClearError} className="text-red-700 hover:text-red-900">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Body className="font-bold truncate">{bracket.name}</Body>
        <Button
          variant="secondary"
          size="sm"
          icon={<RotateCcw size={14} />}
          onClick={() => setResetFirstOpen(true)}
        >
          {i18nText('bracketResetTitle')}
        </Button>
      </div>

      {error === null && courts.length === 0 && (
        <Body className="text-text/70">{i18nText('bracketNoBracket')}</Body>
      )}

      <div className="flex flex-col gap-6">
        {rounds.map((round) => (
          <section key={round.round} aria-label={round.name}>
            <Body className="mb-3 font-semibold text-center">{i18nText(round.name)}</Body>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {round.matches.map((match) => {
                const ctx = resolveCourtContext(match, courts, bracket.matches)
                return (
                  <BracketMatchCard
                    key={match.id}
                    match={match}
                    courtLabel={ctx.courtLabel}
                    courtOrphan={ctx.courtOrphan}
                    courtOccupied={ctx.courtOccupied}
                    onAssignSlot={(mid, slot) => {
                      const m = match // closed over the current match
                      const current =
                        slot === 'A' ? m.playerA ?? '' : m.playerB ?? ''
                      setSlotName(current)
                      setSlotTarget({ matchId: mid, slot, currentName: current })
                    }}
                    onSetWinner={onSetWinner}
                    onAssignCourt={(mid) => setCourtTargetMatchId(mid)}
                    onUndo={onUndo}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {bracket.thirdPlaceMatch && (
        <section aria-label="3rd place">
          <Body className="mb-3 font-semibold text-center">{i18nText('bracketRoundThirdPlace')}</Body>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <BracketMatchCard
              match={bracket.thirdPlaceMatch}
              courtLabel={resolveCourtContext(bracket.thirdPlaceMatch, courts, bracket.matches).courtLabel}
              courtOrphan={resolveCourtContext(bracket.thirdPlaceMatch, courts, bracket.matches).courtOrphan}
              courtOccupied={resolveCourtContext(bracket.thirdPlaceMatch, courts, bracket.matches).courtOccupied}
              onAssignSlot={(mid, slot) => {
                const m = bracket.thirdPlaceMatch!
                const current = slot === 'A' ? m.playerA ?? '' : m.playerB ?? ''
                setSlotName(current)
                setSlotTarget({ matchId: mid, slot, currentName: current })
              }}
              onSetWinner={onSetWinner}
              onAssignCourt={(mid) => setCourtTargetMatchId(mid)}
              onUndo={onUndo}
            />
          </div>
        </section>
      )}

      {/* Slot assignment modal */}
      <Modal
        isOpen={slotTarget != null}
        onClose={() => setSlotTarget(null)}
        title={i18nText('bracketAssignSlotTitle')}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Body className="text-sm text-text/70">{i18nText('bracketAssignSlotLabel')}</Body>
            <Input
              autoFocus
              placeholder={i18nText('bracketAssignSlotPlaceholder')}
              value={slotName}
              onChange={(e) => setSlotName(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSlotTarget(null)} className="flex-1">
              {i18nText('commonCancel')}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                if (slotTarget) {
                  onAssignPlayer(slotTarget.matchId, slotTarget.slot, slotName.trim())
                  setSlotTarget(null)
                  setSlotName('')
                }
              }}
            >
              {i18nText('bracketAssignSlotSave')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Court assignment modal */}
      <Modal
        isOpen={courtTargetMatchId != null}
        onClose={() => setCourtTargetMatchId(null)}
        title={terms.bracketAssignCourtTitle}
      >
        <div className="flex flex-col gap-2">
          {courts.length === 0 && (
            <Body className="text-text/70">{i18nText('bracketNoBracket')}</Body>
          )}
          {courts.map((c) => (
            <Button
              key={c.id}
              variant="secondary"
              fullWidth
              onClick={() => {
                if (courtTargetMatchId) onSelectTable(courtTargetMatchId, c.id)
                setCourtTargetMatchId(null)
              }}
            >
              {c.name}
            </Button>
          ))}
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              if (courtTargetMatchId) onAssignCourt(courtTargetMatchId, null)
              setCourtTargetMatchId(null)
            }}
          >
            {terms.bracketAssignCourtNone}
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => setCourtTargetMatchId(null)}
          >
            {i18nText('bracketAssignCourtCancel')}
          </Button>
        </div>
      </Modal>

      {/* 2-step reset — step 1: request the single-use token. */}
      <ConfirmDialog
        isOpen={resetFirstOpen}
        title={i18nText('bracketResetTitle')}
        message={i18nText('bracketResetFirstMessage')}
        severity="warning"
        confirmLabel={i18nText('commonConfirm')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={() => {
          setResetFirstOpen(false)
          onReset()
        }}
        onCancel={() => setResetFirstOpen(false)}
      />

      {/* 2-step reset — step 2: confirm with the issued token. */}
      <ConfirmDialog
        isOpen={resetSecondOpen && resetToken != null}
        title={i18nText('bracketResetTitle')}
        message={i18nText('bracketResetConfirmMessage')}
        severity="error"
        confirmLabel={i18nText('bracketResetConfirm')}
        cancelLabel={i18nText('commonCancel')}
        onConfirm={() => {
          const token = resetToken
          setResetSecondOpen(false)
          if (token) onResetConfirm(token)
        }}
        onCancel={() => setResetSecondOpen(false)}
      />
    </div>
  )
}