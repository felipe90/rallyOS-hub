import { describe, it, expect } from 'vitest'
import enUS from '../locales/en-US.json'
import es from '../locales/es.json'

describe('Kiosk i18n keys', () => {
  it('en-US has kioskPageTitle', () => {
    expect(enUS.kioskPageTitle).toBe('Scoreboard')
  })

  it('en-US has kioskNoActiveMatches', () => {
    expect(enUS.kioskNoActiveMatches).toBe('No active matches')
  })

  it('en-US has kioskStatusLive', () => {
    expect(enUS.kioskStatusLive).toBe('In play')
  })

  it('en-US has kioskStatusPaused', () => {
    expect(enUS.kioskStatusPaused).toBe('Paused')
  })

  it('en-US has kioskStatusFinished', () => {
    expect(enUS.kioskStatusFinished).toBe('Finished')
  })

  it('es has kioskPageTitle', () => {
    expect(es.kioskPageTitle).toBe('Marcador')
  })

  it('es has kioskNoActiveMatches', () => {
    expect(es.kioskNoActiveMatches).toBe('No hay partidos activos')
  })

  it('es has kioskStatusLive', () => {
    expect(es.kioskStatusLive).toBe('En juego')
  })

  it('es has kioskStatusPaused', () => {
    expect(es.kioskStatusPaused).toBe('Pausado')
  })

  it('es has kioskStatusFinished', () => {
    expect(es.kioskStatusFinished).toBe('Finalizado')
  })
})
