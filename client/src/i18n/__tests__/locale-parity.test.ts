import { describe, it, expect } from 'vitest'
import enUS from '../locales/en-US.json'
import es from '../locales/es.json'

/**
 * Locale parity — every key shipped in one locale MUST exist in the other.
 * Catches the silent "I added the Spanish string but forgot English" drift.
 *
 * This test was added with the club-session-history i18n keys
 * (tasks 4.1 / 4.2) to lock the structural invariant going forward.
 */
describe('Locale parity (es ↔ en-US)', () => {
  const esKeys = Object.keys(es).sort()
  const enKeys = Object.keys(enUS).sort()

  it('es and en-US have identical key sets', () => {
    const missingInEn = esKeys.filter((k) => !enKeys.includes(k))
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k))
    expect({
      missingInEn,
      missingInEs,
    }).toEqual({ missingInEn: [], missingInEs: [] })
  })

  it('club-session-history keys are present in es', () => {
    expect(es.clubAdminTabCourts).toBe('Canchas')
    expect(es.clubAdminTabHistory).toBe('Historial')
    expect(es.historyColCourt).toBe('Cancha')
    expect(es.historyColMode).toBe('Modalidad')
    expect(es.historyColDuration).toBe('Duración')
    expect(es.historyColCost).toBe('Costo')
    expect(es.historyColDate).toBe('Fecha')
    expect(es.historyClearBtn).toBe('Limpiar historial')
    expect(es.historyExportBtn).toBe('Exportar CSV')
    expect(es.historyEmpty).toBe('No hay sesiones registradas')
    expect(es.historyDisabled).toBe('Club no configurado')
  })

  it('club-session-history keys are present in en-US', () => {
    expect(enUS.clubAdminTabCourts).toBe('Courts')
    expect(enUS.clubAdminTabHistory).toBe('History')
    expect(enUS.historyEmpty).toBe('No session records')
    expect(enUS.historyDisabled).toBe('Club not configured')
  })
})