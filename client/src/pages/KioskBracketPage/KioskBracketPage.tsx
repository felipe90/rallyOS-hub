import { useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { useSocketContext } from '@/contexts/SocketContext'
import { useI18n, changeLanguage } from '@/i18n'
import { Typography } from '@/components/atoms'
import { KioskHeader } from '@/components/molecules/KioskHeader'
import { groupIntoRounds } from '@/components/organisms/BracketView/rounds'
import { BRACKET_STATUS, BRACKET_MATCH_STATUS } from '@shared/types'
import type { TournamentBracket, BracketMatch, Player } from '@shared/types'
import { derivePodium } from './derivePodium'
import type { Podium } from './derivePodium'

/**
 * KioskBracketPage — read-only kiosk screen for the live tournament bracket.
 *
 * One screen, two states driven by `bracket.status`:
 *  - SETUP / ACTIVE: the bracket tree is the protagonist (large, auto-updating).
 *  - COMPLETED: the podium becomes the protagonist (champion large/center,
 *    runner-up + 3rd place below) and the bracket tree shrinks to a compact
 *    strip so both share the same screen.
 *
 * The bracket snapshot is sourced from `useSocketContext` (lifted state), so
 * the page renders the current bracket the moment it mounts — regardless of
 * when the owner switched the kiosk to bracket mode. The server pushes
 * BRACKET_STATE on connect and broadcasts on every mutation; no client→server
 * event is emitted from this page (read-only, no auth, no interaction).
 */
export function KioskBracketPage() {
  const { bracket, hubConfig, connected, connecting } = useSocketContext()
  const { i18nText } = useI18n()

  const podium = derivePodium(bracket)
  const completed = bracket?.status === BRACKET_STATUS.COMPLETED && podium !== null

  // Spanish default on the TV kiosk (mirrors KioskAllCourtsPage).
  useEffect(() => {
    const explicit = localStorage.getItem('rallyos-lang-explicit')
    if (!explicit) changeLanguage('es')
  }, [])

  // Prevent overscroll on the kiosk page.
  useEffect(() => {
    document.body.classList.add('kiosk-page')
    return () => { document.body.classList.remove('kiosk-page') }
  }, [])

  // Auto-reload when the socket permanently disconnects (all retries exhausted).
  useEffect(() => {
    if (!connected && !connecting) {
      const timer = setTimeout(() => window.location.reload(), 10_000)
      return () => clearTimeout(timer)
    }
  }, [connected, connecting])

  return (
    <div className="h-dvh stadium-bg flex flex-col">
      <KioskHeader
        title={bracket?.name ?? i18nText('authTournament')}
        hubConfig={hubConfig}
      />

      <main id="main-content" className="flex-1 flex flex-col overflow-auto">
        {bracket === null ? (
          <WaitingState label={i18nText('kioskBracketWaiting')} />
        ) : completed && podium ? (
          <PodiumView podium={podium} />
        ) : null}

        {bracket !== null && (
          <BracketTreeReadOnly
            bracket={bracket}
            compact={completed}
            roundLabel={(key: string) => i18nText(key)}
          />
        )}
      </main>
    </div>
  )
}

// ── Waiting state (no bracket yet) ───────────────────────────────────────

function WaitingState({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="stadium-card rounded-2xl p-10 flex flex-col items-center gap-4">
        <Trophy size={72} className="text-amber-400" />
        <Typography variant="title" className="text-2xl text-text-muted text-center px-4">
          {label}
        </Typography>
      </div>
    </div>
  )
}

// ── Podium (protagonist on COMPLETED) ────────────────────────────────────

function PodiumView({ podium }: { podium: Podium }) {
  const { i18nText } = useI18n()
  return (
    <section
      aria-label="podium"
      className="flex flex-col items-center justify-center gap-6 px-6 pt-6 pb-2"
    >
      {/* Champion — large, centered */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-3">
          <Trophy size={48} className="text-amber-400" />
          <Typography
            variant="headline"
            className="text-3xl md:text-4xl font-bold !text-amber-300 tracking-tight drop-shadow"
          >
            {i18nText('kioskBracketChampion')}
          </Typography>
          <Trophy size={48} className="text-amber-400" />
        </div>
        <Typography
          variant="headline"
          className="text-5xl md:text-6xl font-bold !text-white tracking-tight drop-shadow-lg break-words"
        >
          {podium.champion ?? '—'}
        </Typography>
      </div>

      {/* Runner-up + 3rd place — below, smaller, side by side */}
      <div className="flex flex-col sm:flex-row items-stretch justify-center gap-4 w-full max-w-3xl">
        <PodiumCard
          label={i18nText('kioskBracketRunnerUp')}
          name={podium.runnerUp}
          accent="!text-slate-200"
          ring="ring-slate-400/40"
        />
        {podium.thirdPlace !== null && (
          <PodiumCard
            label={i18nText('bracketRoundThirdPlace')}
            name={podium.thirdPlace}
            accent="!text-amber-200"
            ring="ring-amber-700/50"
          />
        )}
      </div>
    </section>
  )
}

function PodiumCard({
  label,
  name,
  accent,
  ring,
}: {
  label: string
  name: string | null
  accent: string
  ring: string
}) {
  return (
    <div
      className={`flex-1 flex flex-col items-center gap-1 bg-slate-900/60 rounded-2xl ring-1 ${ring} border border-white/10 px-6 py-4`}
    >
      <Typography variant="label" className={`text-xs ${accent}`}>
        {label}
      </Typography>
      <Typography variant="title" className="text-2xl md:text-3xl font-bold !text-white text-center break-words">
        {name ?? '—'}
      </Typography>
    </div>
  )
}

// ── Read-only bracket tree ───────────────────────────────────────────────

interface BracketTreeReadOnlyProps {
  bracket: TournamentBracket
  compact: boolean
  roundLabel: (key: string) => string
}

function BracketTreeReadOnly({ bracket, compact, roundLabel }: BracketTreeReadOnlyProps) {
  const rounds = groupIntoRounds(bracket)

  return (
    <section
      aria-label="bracket-tree"
      className={`flex flex-col gap-4 ${compact ? 'px-6 pb-6 opacity-90' : 'p-6 flex-1'}`}
    >
      <div
        className={`grid gap-4 ${compact ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}
      >
        {rounds.map((round) => (
          <div key={round.round} className="flex flex-col gap-2">
            <Typography
              variant="label"
              className={`font-semibold !text-amber-300 ${compact ? 'text-[11px]' : 'text-sm'}`}
            >
              {roundLabel(round.name)}
            </Typography>
            <div className="flex flex-col gap-2">
              {round.matches.map((m) => (
                <ReadOnlyMatch key={m.id} match={m} compact={compact} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {bracket.thirdPlaceMatch && (
        <div className="flex flex-col gap-2">
          <Typography
            variant="label"
            className={`font-semibold !text-amber-300 ${compact ? 'text-[11px]' : 'text-sm'}`}
          >
            {roundLabel('bracketRoundThirdPlace')}
          </Typography>
          <ReadOnlyMatch match={bracket.thirdPlaceMatch} compact={compact} />
        </div>
      )}
    </section>
  )
}

function ReadOnlyMatch({ match, compact }: { match: BracketMatch; compact: boolean }) {
  const completed = match.status === BRACKET_MATCH_STATUS.COMPLETED
  const bothEmpty = match.playerA == null && match.playerB == null
  const oneEmpty = (match.playerA == null) !== (match.playerB == null)
  const bye = !completed && oneEmpty

  const borderColor = completed
    ? 'border-white/15'
    : bye
      ? 'border-amber-500/40'
      : bothEmpty
        ? 'border-white/10'
        : 'border-emerald-500/50'

  const slotText = (slot: Player) => {
    const name = slot === 'A' ? match.playerA : match.playerB
    const isWinner = completed && match.winner === slot
    const isLoser = completed && match.winner !== slot
    const tone = name == null
      ? '!text-white/30'
      : isWinner
        ? 'font-bold !text-white'
        : isLoser
          ? '!text-white/40 line-through'
          : '!text-white/85'
    return (
      <span
        className={`truncate ${tone} ${compact ? 'text-sm' : 'text-lg'}`}
      >
        {name ?? '—'}
      </span>
    )
  }

  return (
    <div className={`stadium-card rounded-2xl border-2 flex flex-col gap-1 ${borderColor} ${compact ? 'p-2' : 'p-3'}`}>
      <span className={`font-heading text-white/50 ${compact ? 'text-[10px]' : 'text-xs'}`}>{match.id}</span>
      <div className="flex flex-col">
        {slotText('A')}
        <span className={`text-white/30 ${compact ? 'text-[10px]' : 'text-xs'}`}>vs</span>
        {slotText('B')}
      </div>
    </div>
  )
}
