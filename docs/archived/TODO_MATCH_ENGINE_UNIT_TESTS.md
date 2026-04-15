# TODO - Tests Unitarios MatchEngine

## Referencias
- PRD: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- SDD: `docs/specs-sdd/SDD_MATCH_ENGINE_UNIT_TESTS.md`

## Convenciones
- Prioridad: P0 (critico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea debe tener criterio de finalizacion verificable.

## Backlog por fases

### Fase 1 - P0: Setup
- [x] (P0) Verificar configuración de Jest (ts-jest) y crear estructura de tests
  - Archivo(s): `server/jest.config.js`, `server/tests/matchEngine.spec.ts`
  - Criterio: `npm run test -- --testPathPattern=matchEngine` corre sin errores (aunque no haya tests aún)
  - Estado: DONE

- [x] (P0) Mockear logger para silenciar output en tests
  - Archivo(s): `server/tests/matchEngine.spec.ts`
  - Criterio: Tests corren sin output de logger en consola
  - Estado: DONE

### Fase 2 - P0: Tests de configuración e inicialización
- [x] (P0) Tests de estado inicial y config por defecto
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'constructor / initial state')
  - Criterio: Verifica score {a:0, b:0}, sets {a:0, b:0}, serving='A', pointsPerSet=11, bestOf=3, minDifference=2
  - Estado: DONE

- [x] (P0) Tests de configure con config custom
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'configure')
  - Criterio: bestOf=5, pointsPerSet=15, minDifference=3, handicap se aplican correctamente
  - Estado: DONE

### Fase 3 - P0: Tests de scoring (core)
- [x] (P0) Tests de recordPoint — punto simple
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'recordPoint')
  - Criterio: Punto a A y B incrementa score correctamente
  - Estado: DONE

- [x] (P0) Tests de set win — set completado, deuce
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'recordPoint - set win')
  - Criterio: 11-0 → set ganado; 12-10 con minDiff=2 → ganado; 10-10 con minDiff=2 → NO ganado
  - Estado: DONE

- [x] (P0) Tests de match win — bestOf=3 y bestOf=5
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'recordPoint - match win')
  - Criterio: Ganar 2 sets (bestOf=3) y 3 sets (bestOf=5) completa match, evento onMatchWon se emite
  - Estado: DONE

### Fase 4 - P0: Tests de undo y subtract
- [x] (P0) Tests de undoLast — undo funcional y canUndo
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'undoLast')
  - Criterio: Undo retrocede score, canUndo=true después de punto, canUndo=false sin history
  - Estado: DONE

- [x] (P0) Tests de subtractPoint — resta correcta
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'subtractPoint')
  - Criterio: Resta en score>0, no baja de 0 en score=0
  - Estado: DONE

### Fase 5 - P1: Tests de side swap, server, reset
- [x] (P1) Tests de checkSideSwap — swap en sets regulares y decisivo
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'checkSideSwap')
  - Criterio: Swap al completar set, swap en set decisivo cuando suma=pointsPerSet/2
  - Estado: DONE

- [x] (P1) Tests de setServer — servidor se actualiza
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'setServer')
  - Criterio: serving='A' y serving='B' funcionan
  - Estado: DONE

- [x] (P1) Tests de reset — vuelve a INITIAL_CONFIG
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'reset')
  - Criterio: Después de puntos, reset vuelve a estado inicial con defaults
  - Estado: DONE

### Fase 6 - P1: Tests de handicap y edge cases
- [x] (P1) Tests de handicap — score inicial con puntos extra
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'handicap')
  - Criterio: handicapA=3 → score.a inicia en 3
  - Estado: DONE

- [x] (P1) Tests de edge cases — undo sin history, subtract en 0, bestOf=5
  - Archivo(s): `server/tests/matchEngine.spec.ts` (describe: 'edge cases')
  - Criterio: No crash, comportamiento manejado correctamente
  - Estado: DONE

## Casos de prueba minimos
- [ ] Set win normal: 11-0 con pointsPerSet=11
- [ ] Set win con deuce: 12-10 con minDifference=2
- [ ] Deuce pendiente: 10-10 con minDifference=2 → set NO ganado
- [ ] Undo funcional: punto → undo → score vuelve a anterior
- [ ] Match win bestOf=3: ganar 2 sets
- [ ] Match win bestOf=5: ganar 3 sets
- [ ] Reset: vuelve a INITIAL_CONFIG

## Checklist de release
- [ ] Cambios implementados (todos los describe blocks creados)
- [ ] Tests ejecutados (`npm run test -- --testPathPattern=matchEngine` — 0 fallos)
- [ ] Cobertura verificada (`npm run test -- --coverage` — ≥80% líneas, ≥90% branches)
- [ ] Logs sin secretos (logger mockeado, sin output en tests)
- [ ] Documentacion actualizada (SDD y PRD marcados como completados)
- [ ] Validacion funcional en entorno objetivo (tests corren en Docker)

## Registro de avances
- 2026-04-14 - PRD, SDD y TODO creados - Asistente

---

**Owner:** Por definir
**Fecha inicio:** 2026-04-14
**Estado general:** DONE ✅ (2026-04-15)
