import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import es from '@/i18n/locales/es.json'
import en from '@/i18n/locales/en-US.json'
import { TERM_KEYS, useSportTerms } from './useSportTerms'
import { useSport } from '@/contexts/SportContext'

// The hook wires TERM_KEYS × resolved sport into `sportTerm.{term}.{sport}`
// keys via useI18n(). Mock both dependencies so each scenario controls the
// sport and the locale deterministically. The REAL locale data is validated
// separately by the ST-3 parity tests below (direct JSON import) and by the
// existing i18n/__tests__/locale-parity.test.ts.
vi.mock('@/contexts/SportContext', () => ({
  useSport: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  useI18n: vi.fn(),
}))

import { useI18n } from '@/i18n'

const mockUseSport = useSport as ReturnType<typeof vi.fn>
const mockUseI18n = useI18n as ReturnType<typeof vi.fn>

const esLookup = (key: string) => (es as Record<string, string>)[key] ?? key
const enLookup = (key: string) => (en as Record<string, string>)[key] ?? key

describe('useSportTerms — ST-2 resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSport.mockReturnValue({ sport: 'tableTennis', sportLoaded: true })
    mockUseI18n.mockReturnValue({
      i18nText: esLookup,
      language: 'es',
      changeLanguage: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves dashboardStatCourts to "Mesas" for es + tableTennis (ST-2)', () => {
    const { result } = renderHook(() => useSportTerms())

    expect(result.current.terms.dashboardStatCourts).toBe('Mesas')
    expect(result.current.sport).toBe('tableTennis')
    expect(result.current.sportLoaded).toBe(true)
  })

  it('resolves ownerCreateCourt to "Cancha" for es + padel', () => {
    mockUseSport.mockReturnValue({ sport: 'padel', sportLoaded: true })

    const { result } = renderHook(() => useSportTerms())

    expect(result.current.terms.ownerCreateCourt).toBe('Cancha')
  })

  it('resolves ownerCreateCourt to "Court" for en-US + padel (ST-2)', () => {
    mockUseSport.mockReturnValue({ sport: 'padel', sportLoaded: true })
    mockUseI18n.mockReturnValue({
      i18nText: enLookup,
      language: 'en-US',
      changeLanguage: vi.fn(),
    })

    const { result } = renderHook(() => useSportTerms())

    expect(result.current.terms.ownerCreateCourt).toBe('Court')
  })

  it('re-resolves terms when the language switches (ST-2 locale switch)', () => {
    const { result, rerender } = renderHook(() => useSportTerms())
    expect(result.current.terms.ownerCreateCourt).toBe('Mesa')

    mockUseI18n.mockReturnValue({
      i18nText: enLookup,
      language: 'en-US',
      changeLanguage: vi.fn(),
    })
    rerender()

    expect(result.current.terms.ownerCreateCourt).toBe('Table')
  })

  it('passes through sportLoaded and exposes i18nText for interpolated keys (D2)', () => {
    mockUseSport.mockReturnValue({ sport: 'tableTennis', sportLoaded: false })

    const { result } = renderHook(() => useSportTerms())

    expect(result.current.sportLoaded).toBe(false)
    expect(typeof result.current.i18nText).toBe('function')
    // clubAdminDefaultCourtName interpolates {{number}} — consumers resolve it
    // through the returned i18nText rather than terms (D2).
    expect(result.current.i18nText('sportTerm.clubAdminDefaultCourtName.tableTennis')).toBe('Mesa {{number}}')
  })

  it('exposes one typed entry per TERM_KEYS key (full contract)', () => {
    const { result } = renderHook(() => useSportTerms())

    for (const key of Object.keys(TERM_KEYS) as Array<keyof typeof TERM_KEYS>) {
      expect(result.current.terms[key]).toEqual(expect.any(String))
    }
  })
})

describe('ST-3 — sportTerm locale parity', () => {
  const esSportTermKeys = Object.keys(es).filter((k) => k.startsWith('sportTerm.'))
  const enSportTermKeys = Object.keys(en).filter((k) => k.startsWith('sportTerm.'))

  it('es.json and en-US.json define the identical sportTerm.* key set (D3)', () => {
    expect([...esSportTermKeys].sort()).toEqual([...enSportTermKeys].sort())
  })

  it('both locales define the court/table structure for both sports', () => {
    // PR-1 ships the court/table structure; full TERM_KEYS coverage is added
    // in PR-2 task 2.1 (see the skipped coverage suite below).
    expect(esLookup('sportTerm.dashboardStatCourts.tableTennis')).toBe('Mesas')
    expect(esLookup('sportTerm.dashboardStatCourts.padel')).toBe('Canchas')
    expect(esLookup('sportTerm.ownerCreateCourt.tableTennis')).toBe('Mesa')
    expect(esLookup('sportTerm.ownerCreateCourt.padel')).toBe('Cancha')
    expect(enLookup('sportTerm.ownerCreateCourt.tableTennis')).toBe('Table')
    expect(enLookup('sportTerm.ownerCreateCourt.padel')).toBe('Court')
  })
})

// The coverage assertions below pin the FULL TERM_KEYS contract (court/table
// + chip + team/pair) against both locale files: every term must exist for
// both sports in both locales (spec ST-3 "Complete coverage"). PR-2 task 2.1
// added the remaining sportTerm.{term}.{sport} keys, so this suite is now
// GREEN and runs with the rest of the file.
describe('ST-3 — sportTerm contract coverage', () => {
  it('every TERM_KEYS term exists for both sports in es.json', () => {
    const esRecord = es as Record<string, unknown>
    for (const term of Object.keys(TERM_KEYS)) {
      expect(esRecord[`sportTerm.${term}.tableTennis`]).toBeTruthy()
      expect(esRecord[`sportTerm.${term}.padel`]).toBeTruthy()
    }
  })

  it('every TERM_KEYS term exists for both sports in en-US.json', () => {
    const enRecord = en as Record<string, unknown>
    for (const term of Object.keys(TERM_KEYS)) {
      expect(enRecord[`sportTerm.${term}.tableTennis`]).toBeTruthy()
      expect(enRecord[`sportTerm.${term}.padel`]).toBeTruthy()
    }
  })
})
