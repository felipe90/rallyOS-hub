/**
 * useSportTerms - sport-aware terminology hook (spec ST-2).
 *
 * Every court/table label that currently hardcodes "cancha"/"court" resolves
 * through this hook so a padel hub renders "Cancha"/"Court" and a table-tennis
 * hub renders "Mesa"/"Table", per the club's configured sport (SportContext).
 *
 * The TERM_KEYS contract is the single source of truth for which terms exist:
 * a term missing from the object is a COMPILE error for consumers, and the
 * ST-3 coverage test (useSportTerms.test.ts) fails until every term has a
 * `sportTerm.{term}.{sport}` entry in BOTH locale files.
 *
 * Excluded by design: player/match/set (sport-neutral — decision 2) and the
 * padel-only scoring labels (padelGamesPerSet, gamesLabel, serveIndicator…),
 * which stay REGULAR i18n keys and are exposed through the returned i18nText
 * (decision D4).
 */
import { useMemo } from 'react'
import { useI18n } from '@/i18n'
import type { I18nTextFn } from '@/i18n'
import { useSport } from '@/contexts/SportContext'
import type { Sport } from '@shared/types'

/**
 * Typed contract of every sport-aware terminology key. Values are the term
 * names used to build the flat i18n keys `sportTerm.{term}.{sport}`.
 */
export const TERM_KEYS = {
  // ── court/table group ──────────────────────────────────────────────
  dashboardStatCourts: 'dashboardStatCourts',
  ownerCreateCourt: 'ownerCreateCourt',
  spectatorTitle: 'spectatorTitle',
  spectatorNoCourts: 'spectatorNoCourts',
  scoreboardInvalidCourtId: 'scoreboardInvalidCourtId',
  toastCourtCreated: 'toastCourtCreated',
  toastCourtCleaned: 'toastCourtCleaned',
  toastCourtDeleted: 'toastCourtDeleted',
  clubAdminCreateCourt: 'clubAdminCreateCourt',
  clubAdminDefaultCourtName: 'clubAdminDefaultCourtName',
  clubAdminNoCourts: 'clubAdminNoCourts',
  clubAdminTabCourts: 'clubAdminTabCourts',
  clubAdminDeleteConfirm: 'clubAdminDeleteConfirm',
  toastClubCourtCreated: 'toastClubCourtCreated',
  toastClubCourtActivated: 'toastClubCourtActivated',
  toastClubCourtDeleted: 'toastClubCourtDeleted',
  toastClubCourtDeactivated: 'toastClubCourtDeactivated',
  toastClubCourtResetted: 'toastClubCourtResetted',
  toastClubResetFailed: 'toastClubResetFailed',
  toastClubDeleteFailed: 'toastClubDeleteFailed',
  clubKioskNoCourts: 'clubKioskNoCourts',
  historyColCourt: 'historyColCourt',
  bracketNoCourt: 'bracketNoCourt',
  bracketCourtOrphan: 'bracketCourtOrphan',
  bracketCourtOccupiedWarn: 'bracketCourtOccupiedWarn',
  bracketAssignCourtTitle: 'bracketAssignCourtTitle',
  bracketAssignCourtNone: 'bracketAssignCourtNone',
  bracketErrorCourtNotFound: 'bracketError.courtNotFound',
  bracketErrorCourtAlreadyAssigned: 'bracketError.courtAlreadyAssigned',
  matchConfigForCourt: 'matchConfigForCourt',
  // ── TableStatusChip (ST-4) ─────────────────────────────────────────
  clean: 'clean',
  delete: 'delete',
  cleanDialogTitle: 'cleanDialogTitle',
  cleanDialogMessage: 'cleanDialogMessage',
  deleteDialogTitle: 'deleteDialogTitle',
  deleteDialogMessage: 'deleteDialogMessage',
  deleteAria: 'deleteAria',
  // ── team/pair (ST-2) ───────────────────────────────────────────────
  matchConfigTeamA: 'matchConfigTeamA',
  matchConfigTeamB: 'matchConfigTeamB',
} as const

/** Union of every sport-aware term — a missing term fails at compile time. */
export type SportTermKey = keyof typeof TERM_KEYS

export interface UseSportTermsResult {
  /** Resolved terms for the current sport — one entry per TERM_KEYS key. */
  terms: Record<SportTermKey, string>
  /** The i18n t() function, exposed for interpolated keys (D2). */
  i18nText: I18nTextFn
  sport: Sport
  sportLoaded: boolean
}

export function useSportTerms(): UseSportTermsResult {
  const { sport, sportLoaded } = useSport()
  const { i18nText, language } = useI18n()

  // language is intentionally part of the memo deps even though it is not
  // read inside the computation: a runtime language switch must re-resolve
  // every term (ST-2 "language switch re-resolves").
  const terms = useMemo(() => {
    const resolved = {} as Record<SportTermKey, string>
    for (const key of Object.keys(TERM_KEYS) as SportTermKey[]) {
      resolved[key] = i18nText(`sportTerm.${key}.${sport}`)
    }
    return resolved
  }, [sport, sportLoaded, i18nText, language])

  return { terms, i18nText, sport, sportLoaded }
}
