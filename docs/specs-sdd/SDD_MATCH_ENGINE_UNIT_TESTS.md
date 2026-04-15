# SDD - Unit Tests para MatchEngine

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- Objetivos cubiertos:
  - **Meta 2:** Cobertura de tests unitarios del 80%+ en `matchEngine.ts`
  - RF-01 (tests para todos los métodos públicos)
  - Criterio DoD: cobertura ≥ 80%, `npm run test` pasa

## 2) Arquitectura actual (AS-IS)
### Componente: `server/src/matchEngine.ts`
- Clase pura de lógica de dominio (~300 líneas)
- Sin I/O, sin side effects (salvo logging)
- Métodos públicos: `configure`, `recordPoint`, `subtractPoint`, `undoLast`, `setServer`, `reset`, `canUndo`, `getState`, `checkSetWin`, `checkMatchWin`, `checkSideSwap`
- Callbacks de eventos: `onSetWon`, `onMatchWon`
- Usa `crypto.randomUUID()` (sin import actualmente — se arregla en SDD de Quick Fixes)
- Usa `JSON.parse(JSON.stringify(...))` para deep clone en `addToHistory` y `getState`

### Limitaciones actuales
- **0 tests unitarios** para el módulo más testeable del proyecto
- Solo testing indirecto vía E2E Playwright (`match-logic.spec.ts` — 3 tests UI)
- Bugs potenciales sin detectar: side swap en bestOf=5, undo con history vacía, reset que descarta config custom

## 3) Arquitectura propuesta (TO-BE)
### Estructura de tests
```
server/
  src/
    matchEngine.ts          <-- SIN CAMBIOS (solo crypto import del SDD anterior)
  tests/
    matchEngine.spec.ts     <-- NUEVO: tests unitarios con Jest
```

### Enfoque: Behavior-based testing
Tests basados en comportamiento público, no en implementación interna:
1. Crear instancia con config por defecto
2. Llamar métodos públicos
3. Verificar `getState()` y eventos emitidos
4. No acceder a propiedades privadas

## 4) Diseño de datos y contratos
### 4.1 Configuración por defecto (INITIAL_CONFIG)
```typescript
{
  pointsPerSet: 11,
  bestOf: 3,
  minDifference: 2,
  handicapA: 0,
  handicapB: 0
}
```

### 4.2 Comportamiento esperado por método

| Método | Input | Output esperado | Eventos |
|--------|-------|----------------|---------|
| `configure(config)` | MatchConfig | Estado actualizado | Ninguno |
| `recordPoint(player)` | 'A' \| 'B' | Estado con punto sumado | `onSetWon` si set completado, `onMatchWon` si match completado |
| `subtractPoint(player)` | 'A' \| 'B' | Estado con punto restado | Ninguno |
| `undoLast()` | void | Estado anterior o false si no hay history | Ninguno |
| `setServer(player)` | 'A' \| 'B' | Estado con servidor actualizado | Ninguno |
| `reset()` | void | Estado reiniciado a INITIAL_CONFIG | Ninguno |
| `canUndo()` | void | boolean | Ninguno |
| `getState()` | void | Copia del estado actual | Ninguno |
| `checkSetWin()` | void | boolean | `onSetWon` si aplica |
| `checkMatchWin()` | void | boolean | `onMatchWon` si aplica |
| `checkSideSwap()` | void | boolean | Ninguno |

## 5) Reglas de negocio
- **RB-01:** Un set se gana cuando un jugador alcanza `pointsPerSet` con al menos `minDifference` de ventaja.
- **RB-02:** Un match se gana cuando un jugador gana `(bestOf / 2) + 1` sets.
- **RB-03:** Side swap ocurre al final de cada set (ambos jugadores cambian de lado). En el set decisivo (último del bestOf), el swap ocurre cuando la suma de puntos de ambos llega a `pointsPerSet / 2` (redondeado hacia abajo).
- **RB-04:** Handicap: los puntos de handicap se suman al score inicial del set.
- **RB-05:** Undo: deshace el último cambio de score. Si no hay history, retorna false.
- **RB-06:** Reset: reinicia el match a INITIAL_CONFIG, perdiendo configuración custom.

## 6) Seguridad y validaciones
- **Sin cambios de seguridad:** Los tests no exponen datos sensibles.
- **Mocks:** Se mockean callbacks (`onSetWon`, `onMatchWon`) con jest.fn().
- **Sin I/O:** MatchEngine no tiene I/O, así que no hay que mockear filesystem, red, ni base de datos.

## 7) Observabilidad
### Sin logs nuevos
Los tests no agregan logging. El logger de MatchEngine puede mockearse para silenciar output durante tests.

### Métricas de cobertura
- Target: ≥ 80% de líneas, ≥ 90% de branches
- `jest --coverage --testPathPattern=matchEngine` reportará cobertura

## 8) Plan de implementacion tecnica
### Fase 1: Setup
1. Verificar que `jest.config.js` está configurado correctamente para TypeScript (ts-jest)
2. Crear `server/tests/matchEngine.spec.ts`
3. Importar `MatchEngine` y tipos necesarios
4. Mockear logger para silenciar output: `jest.mock('../src/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))`

### Fase 2: Tests de configuración e inicialización
1. `describe('constructor / initial state')` — estado inicial correcto, defaults de config
2. `describe('configure')` — config custom se aplica correctamente

### Fase 3: Tests de scoring (core)
1. `describe('recordPoint')` — punto se suma correctamente a player A y B
2. `describe('recordPoint - set win')` — set se completa al llegar a pointsPerSet con minDifference
3. `describe('recordPoint - deuce')` — set no se completa si hay empate por debajo de minDifference (ej: 10-10 con minDifference=2)
4. `describe('recordPoint - match win')` — match se completa al ganar sets suficientes

### Fase 4: Tests de undo y subtract
1. `describe('undoLast')` — undo funciona, canUndo retorna true/false correctamente
2. `describe('subtractPoint')` — resta punto correctamente, no baja de 0

### Fase 5: Tests de side swap y server
1. `describe('checkSideSwap')` — swap al final de cada set, swap en set decisivo
2. `describe('setServer')` — servidor se actualiza correctamente

### Fase 6: Tests de reset y edge cases
1. `describe('reset')` — reset vuelve a INITIAL_CONFIG
2. `describe('handicap')` — handicap se aplica al score
3. `describe('edge cases')` — undo sin history, subtract en 0, config con bestOf=5

## 9) Plan de migracion/compatibilidad
- **Sin breaking changes:** Tests no modifican código de producción.
- **Sin feature flags:** Son tests, no requieren toggles.
- **Sin migración:** No hay datos ni schema que migrar.

## 10) Plan de pruebas
### Unit tests (matchEngine.spec.ts)
#### `describe('constructor / initial state')`
- Estado inicial: score { a: 0, b: 0 }, sets { a: 0, b: 0 }, serving: 'A'
- Config por defecto: pointsPerSet=11, bestOf=3, minDifference=2

#### `describe('configure')`
- Config custom se aplica: bestOf=5, pointsPerSet=15, minDifference=3
- Handicap se aplica correctamente

#### `describe('recordPoint')`
- Punto a player A → score.a incrementa
- Punto a player B → score.b incrementa
- Estado refleja cambio correctamente

#### `describe('recordPoint - set win')`
- 11-0 con pointsPerSet=11 → set ganado
- 12-10 con minDifference=2 → set ganado (deuce resuelto)
- 10-10 con minDifference=2 → set NO ganado (deuce pendiente)

#### `describe('recordPoint - match win')`
- bestOf=3: ganar 2 sets → match ganado
- bestOf=5: ganar 3 sets → match ganado
- Evento `onMatchWon` se emite con datos correctos

#### `describe('undoLast')`
- Undo después de punto → score vuelve al estado anterior
- Undo sin history → retorna false, canUndo() = false
- Múltiples undo → retrocede toda la history

#### `describe('subtractPoint')`
- Subtract en score > 0 → decrementa
- Subtract en score = 0 → no baja de 0 (o error manejado)

#### `describe('checkSideSwap')`
- Swap al completar un set
- Swap en set decisivo cuando suma de puntos = pointsPerSet/2

#### `describe('setServer')`
- Set server a 'A' → serving = 'A'
- Set server a 'B' → serving = 'B'

#### `describe('reset')`
- Reset después de puntos → vuelve a estado inicial
- Reset descarta config custom (vuelve a INITIAL_CONFIG)

#### `describe('handicap')`
- Handicap positivo → score inicial con puntos extra
- Handicap negativo → no aplicable (validar)

#### `describe('canUndo')`
- Sin puntos → false
- Después de punto → true
- Después de undo → false

### Tests de integración
- No aplica — MatchEngine es pura, no tiene dependencias externas.

### E2E/smoke
- `npm run test` debe pasar con 0 fallos
- `npm run test -- --coverage` debe mostrar ≥ 80% en matchEngine.ts

## 11) Riesgos tecnicos y trade-offs
- **Riesgo 1:** Tests frágiles si prueban propiedades privadas -> **Mitigación:** Solo tests de comportamiento público (getState(), métodos públicos). No acceder a `this.state` directamente.
- **Riesgo 2:** `reset()` descarta config custom -> **Documentado como comportamiento esperado.** Los tests deben verificar esto explícitamente para que no sea una sorpresa.
- **Trade-off:** No refactorizar `JSON.parse(JSON.stringify(...))` en este SDD -> **Justificación:** El foco es cubrir con tests primero. El refactor de deep clone es un SDD separado (performance optimization).

## 12) Criterios de aceptacion tecnicos
- [ ] `server/tests/matchEngine.spec.ts` existe
- [ ] `npm run test -- --testPathPattern=matchEngine` pasa con 0 fallos
- [ ] Cobertura de líneas ≥ 80% en `matchEngine.ts`
- [ ] Cobertura de branches ≥ 90% en `matchEngine.ts`
- [ ] Tests cubren: constructor, configure, recordPoint, subtractPoint, undoLast, setServer, reset, canUndo, checkSetWin, checkMatchWin, checkSideSwap, handicap
- [ ] Tests mockean logger para evitar output en consola
- [ ] Tests basados en comportamiento público, no en propiedades privadas

## 13) Archivos impactados
### Nuevos
- `server/tests/matchEngine.spec.ts` — tests unitarios

### Modificados
- `server/src/matchEngine.ts` — solo el import de crypto (del SDD de Quick Fixes), sin cambios funcionales
- `server/jest.config.js` — si necesita ajuste de coverage paths

---

**Estado:** Draft
**Owner tecnico:** Por definir
**Fecha:** 2026-04-14
**Version:** v0.1
