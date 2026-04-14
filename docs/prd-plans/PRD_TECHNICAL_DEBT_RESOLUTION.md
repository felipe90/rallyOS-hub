# PRD - RallyOS-Hub Technical Debt Resolution

## 1) Contexto
- **Problema de negocio o de operación:** RallyOS-Hub es el core de un sistema de marcadores en tiempo real para torneos LAN. Corre en Orange Pi (ARM, 256MB RAM) sin internet. Si falla el scoring, el torneo se detiene.
- **Situación actual y por qué ahora:** El proyecto tiene una base arquitectónica sólida (MatchEngine puro, shared types como SSOT, deploy funcional) pero acumula deuda técnica crítica que pone en riesgo la estabilidad en producción: imports faltantes que pueden crashar en entornos estrictos, sistema dual de auth no reactivo, God Class de 639 líneas sin tests, y más de 20 `console.log` en producción. La infraestructura de planificación SDD existe pero la ejecución está detrás (0 cambios archiveados).
- **Alcance del entorno:** POC LAN — despliegue en Orange Pi sobre red local con HTTPS auto-firmado. Sin dependencia de internet.

## 2) Problema
- **Qué duele hoy:** Riesgo de crash en runtime por imports faltantes (`crypto`), bugs de estado no detectados por falta de tests unitarios, acoplamiento que dificulta mantenimiento y evolución del sistema, y consumo excesivo de recursos por polling innecesario + WebSocket duplicados.
- **Quién lo sufre:**
  - **Árbitro (Referee):** Si el match engine tiene un bug de scoring no detectado, el marcador es incorrecto y el resultado del partido se compromete.
  - **Organizador (Owner):** El sistema dual de auth puede causar estados inconsistentes entre componentes (ej: un componente cree que es referee pero otro no lo refleja). El polling cada 3s envía los PINs de todas las mesas al cliente innecesariamente — datos sensibles viajando sin necesidad en cada ciclo.
  - **Equipo de desarrollo:** La God Class de 639 líneas y los 0 tests unitarios hacen que cada cambio sea una apuesta. Sin tests, no hay red de seguridad.
  - **Orange Pi (hardware):** El polling desperdicia CPU cycles en un dispositivo con 256MB RAM y `--max-old-space-size=256`, generando tráfico redundante donde el 90% de las respuestas son idénticas.
- **Evidencia o síntomas:**
  - 3 archivos sin `import crypto from 'crypto'` que llaman a `crypto.randomUUID()`
  - 0 tests unitarios para `socketHandler.ts` (639 líneas), `tableManager.ts` (~400 líneas), `matchEngine.ts` (~300 líneas)
  - 2 tests triviales para `useSocket` (el hook más complejo del cliente)
  - 20+ `console.log` en archivos de producción
  - Polling cada 3s en `DashboardPage` coexistiendo con eventos `TABLE_UPDATE` por WebSocket — **análisis crítico confirma que el push del server ya cubre todos los casos**: `onTableUpdate` emite `TABLE_UPDATE` + `TABLE_LIST` en cada cambio de mesa (joinTable, leaveTable, setReferee, regeneratePin, configureMatch, startMatch, deleteTable). El polling es deuda técnica pura, no aporta nada.

## 3) Objetivo del producto
Eliminar la deuda técnica crítica de RallyOS-Hub para garantizar estabilidad en producción, habilitar desarrollo seguro con tests, y sentar las bases para evolución futura sin riesgo de regresiones.

## 4) Metas
- **Meta 1:** 100% de imports `crypto` resueltos — cero referencias a `crypto` sin import en todo el server.
- **Meta 2:** Cobertura de tests unitarios del 80%+ en `matchEngine.ts` (módulo puro, más alto ROI).
- **Meta 3:** Sistema de auth unificado — `useAuth()` directo a localStorage eliminado, `AuthContext` como única fuente de verdad reactiva.
- **Meta 4:** `socketHandler.ts` descompuesto en al menos 4 handlers con tests unitarios por handler.
- **Meta 5:** Polling eliminado de `DashboardPage` — 100% server push vía `TABLE_UPDATE`.
- **Meta 6:** Cero `console.log` en producción — todos reemplazados por logger estructurado o eliminados.

## 5) No metas
- Refactor de `MatchEngine` (ya está bien diseñado, solo necesita tests).
- Implementación del multi-table system (planeado en openspec, pero fuera de este scope).
- Cambios en la UI/UX visual o flujos de usuario.
- Migración a otro framework o stack.
- Implementación de roles triple (Owner/Referee/Spectator separation SDD pendiente).
- Testing E2E adicional (los existentes se mantienen, no se agregan nuevos en este PRD).

## 6) Alcance
### En alcance
- Agregar `import crypto from 'crypto'` en `tableManager.ts`, `matchEngine.ts`, y `qrGenerator.ts` si aplica
- Escribir tests unitarios para `matchEngine.ts` (recordPoint, checkSetWin, checkMatchWin, undoLast, subtractPoint, setServer, reset, canUndo, side swap, handicap, history)
- Escribir tests unitarios para `tableManager.ts` (createTable, joinTable, leaveTable, setReferee, configureMatch, deleteTable, regeneratePin, isReferee)
- Unificar auth: eliminar `useAuth()` hook de localStorage, migrar todas las páginas a `AuthContext` + `AuthProvider` en `App.tsx`
- Descomponer `socketHandler.ts` en `TableEventHandler`, `MatchEventHandler`, `AuthHandler`, `AdminHandler`
- **Eliminar polling de `DashboardPage`** — remover `setInterval` + `TABLE_REFRESH_INTERVAL` completamente. El server ya pushea `TABLE_UPDATE` + `TABLE_LIST` en cada cambio de mesa vía `onTableUpdate`. Agregar listener de `reconnect` en `useSocket` que re-requestee la lista completa al reconectar (único caso legítimo donde se puede perder estado).
- Reemplazar/eliminar todos los `console.log` y `console.error` del cliente y server por `logger` o eliminar
- Corregir tipos `any` en `Table.matchEngine`, `socketRef`, `history`
- Agregar `AuthProvider` al árbol de `App.tsx`
- CORS: unificar `effectiveAllowedOrigins` en un módulo compartido

### Fuera de alcance
- Re-escribir `MatchEngine` (no necesita reescritura, solo tests)
- Agregar nuevas features (multi-table, QR improvements, etc.)
- Cambios en la infraestructura de deploy (Dockerfile, scripts de Orange Pi)
- Re-arquitectura del WebSocket (protocolo, eventos)
- Internationalización / i18n
- Mejoras de seguridad adicionales a las ya planeadas en SDDs existentes

## 7) Requisitos funcionales
- **RF-01:** `MatchEngine` debe tener tests unitarios que cubran todos los métodos públicos: `recordPoint`, `subtractPoint`, `undoLast`, `setServer`, `reset`, `canUndo`, `getState`, `checkSetWin`, `checkMatchWin`, `checkSideSwap`, `configure`.
- **RF-02:** `TableManager` debe tener tests unitarios para: `createTable`, `joinTable`, `leaveTable`, `setReferee`, `isReferee`, `configureMatch`, `deleteTable`, `regeneratePin`, `getRefereeSocketId`, `getAllTablesWithPins`, `toPublicTableInfo`.
- **RF-03:** Auth unificado — `AuthProvider` envuelve la app en `App.tsx`, todas las páginas y componentes usan el contexto reactivo. `localStorage` solo se usa como persistencia inicial, no como fuente de estado runtime.
- **RF-04:** Socket handlers descompuestos — cada handler tiene tests unitarios para sus eventos con mocks de socket y tableManager.
- **RF-05:** `DashboardPage` no usa `setInterval` ni polling — confía exclusivamente en eventos `TABLE_UPDATE` del servidor.
- **RF-06:** Todos los `console.log` y `console.error` en archivos de producción (no tests, no scripts) son reemplazados por `logger` del servidor o eliminados en el cliente (donde no aplica logger).

## 8) Requisitos no funcionales
- **RNF-01 (Rendimiento):** Los tests unitarios de `matchEngine.ts` deben ejecutarse en < 2 segundos (lógica pura, sin I/O).
- **RNF-02 (Rendimiento):** Eliminar polling debe reducir tráfico de red en ~1 mensaje/3s por cliente conectado. En un torneo con 8-16 mesas, el 90% de los polls devuelven datos idénticos. El push del server ya emite `TABLE_UPDATE` + `TABLE_LIST` en cada cambio real de mesa.
- **RNF-03 (Seguridad):** Tipos `any` eliminados en paths críticos — `Table.matchEngine` tipado como `MatchEngine`, `socketRef` tipado como `Socket | null`, `history` tipado como `ScoreChange[]`.
- **RNF-04 (Mantenibilidad):** Cada handler de socket resultante de la descomposición no debe exceder 200 líneas.
- **RNF-05 (Compatibilidad):** Todos los cambios deben funcionar en Node.js 22 Alpine (Docker) y ARM64 (Orange Pi).
- **RNF-06 (Testing):** Cobertura de tests unitarios del 80%+ en `matchEngine.ts`, 70%+ en cada handler de socket resultante.

## 9) Trade-offs
- **Descomponer socketHandler primero vs tests primero:** Descomponer primero hace el código más testeable (handlers más pequeños), pero introduce riesgo de regresión sin tests. Se recomienda: escribir tests de humo (happy path) para la God Class actual, descomponer, y luego ampliar tests por handler.
- **AuthContext vs useAuth():** `AuthContext` requiere re-wrap de la app y migración de todas las páginas (más trabajo upfront). `useAuth()` funciona pero no es reactivo (bug latente). Se elige `AuthContext` porque el costo de un bug de auth en producción (torneo en curso) es mayor que el costo de la migración.
- **Eliminar polling vs mantener como fallback:** El análisis crítico confirma que el push del server ya cubre **todos** los paths de cambio de mesa. No hay trade-off: el polling es redundancia pura sin beneficio. Se elimina completamente y se agrega re-request solo en `reconnect` (único caso donde se puede perder estado: caída de socket y reconexión).

## 10) Riesgos y mitigaciones
- **Riesgo 1:** Descomponer `socketHandler.ts` introduce regresiones en eventos de socket -> **Mitigación:** Tests de humo en la God Class actual antes de tocar. Si un test pasa antes y falla después, la descomposición rompió algo.
- **Riesgo 2:** Migrar auth a `AuthContext` puede cambiar comportamiento sutil en páginas que dependen de `localStorage` directo -> **Mitigación:** `AuthContext` persiste en `localStorage` como backup. Los tests de páginas existentes deben pasar después de la migración.
- **Riesgo 3:** Agregar `import crypto` puede no ser suficiente si algún entorno usa ESM strict -> **Mitigación:** Verificar con `npm run build` en Docker (Node 22 Alpine) después del fix.
- **Riesgo 4:** Eliminar polling puede dejar `DashboardPage` sin updates si `TABLE_UPDATE` falla o si el socket se cae y reconecta -> **Mitigación:** Agregar listener de `reconnect` en `useSocket` que emita `LIST_TABLES` (o `GET_TABLES_WITH_PINS` si es owner) al reconectar. Esto cubre el único caso real de pérdida de estado. Verificar que `notifyUpdate()` se llama en todos los paths de cambio (ya confirmado: joinTable, leaveTable, setReferee, regeneratePin, configureMatch, startMatch, deleteTable).
- **Riesgo 5:** Tests de `matchEngine` pueden ser frágiles si prueban implementación interna en vez de comportamiento -> **Mitigación:** Tests basados en comportamiento público (getState(), recordPoint(), etc.), no en propiedades privadas.

## 11) Criterios de aceptación (DoD)
- [ ] `npm run build` del server pasa sin errores en Docker (Node 22 Alpine)
- [ ] `npm run test` del server pasa con 0 fallos
- [ ] `npm run test` del cliente pasa con 0 fallos
- [ ] `matchEngine.ts` tiene tests unitarios con cobertura ≥ 80%
- [ ] Cada handler de socket (post-descomposición) tiene tests unitarios con cobertura ≥ 70%
- [ ] `App.tsx` incluye `AuthProvider` en el árbol
- [ ] Ningún archivo de producción importa o usa `useAuth()` (el hook de localStorage)
- [ ] `DashboardPage` no contiene `setInterval` ni `TABLE_REFRESH_INTERVAL`
- [ ] `useSocket` tiene listener de `reconnect` que re-requestea lista de mesas (LIST_TABLES o GET_TABLES_WITH_PINS según rol)
- [ ] Cero `console.log` o `console.error` en archivos de producción server (grep: `console\.` en `server/src/**/*.ts` excluyendo tests)
- [ ] Cero `console.log` o `console.error` en archivos de producción cliente (grep: `console\.` en `client/src/**/*.{ts,tsx}` excluyendo tests)
- [ ] `Table.matchEngine` está tipado como `MatchEngine` (no `any`)
- [ ] `effectiveAllowedOrigins` existe en un solo módulo compartido, no duplicado
- [ ] PRD revisado y aprobado por owner
- [ ] Cambio archiveado en `openspec/changes/archive/`

## 12) Plan de rollout
- **Etapa 1 — Fixes rápidos (P0):** Agregar imports de `crypto`, unificar CORS, eliminar `console.log` del server. Verificación: `npm run build` pasa.
- **Etapa 2 — Tests de MatchEngine:** Escribir tests unitarios para todos los métodos públicos. Verificación: `npm run test` pasa con cobertura ≥ 80%.
- **Etapa 3 — Auth unificado:** Agregar `AuthProvider` a `App.tsx`, migrar todas las páginas de `useAuth()` a `useAuthContext()`. Verificación: tests de páginas pasan, flujo de auth funcional.
- **Etapa 4 — Descomposición de SocketHandler:** Escribir tests de humo en God Class actual, luego extraer 4 handlers, verificar que tests siguen pasando. Verificación: tests de handlers pasan con cobertura ≥ 70%.
- **Etapa 5 — Limpieza cliente:** Eliminar polling de `DashboardPage` (remover `setInterval` + `TABLE_REFRESH_INTERVAL`). Agregar listener de `reconnect` en `useSocket` que re-requestee lista de mesas según rol. Eliminar `console.log` del cliente. Corregir tipos `any`. Verificación: `npm run build` del cliente pasa, tests pasan, dashboard se actualiza vía push sin polling.
- **Etapa 6 — Verificación final:** `npm run test` completo, `npm run build` en Docker, smoke test manual en localhost. Archive en openspec.

## 13) Dependencias
- **Dependencia técnica:** `vitest` y `jest` ya están configurados en el proyecto. No se necesita infraestructura de testing adicional.
- **Dependencia operativa:** El PRD depende de que el owner apruebe la prioridad de deuda técnica sobre features nuevas.
- **Dependencia de infraestructura:** Docker + Node 22 Alpine debe estar disponible para verificación de builds.
- **Dependencia de SDDs existentes:** Los SDDs de Triple Role Architecture, Table PIN Auth, y Scoreboard Refactor deben considerarse bloqueados hasta que este PRD se complete (para evitar trabajar sobre código que va a cambiar).

## 14) Backlog posterior
- Implementar Triple Role Architecture SDD (Owner/Referee/Spectator separation con encrypted PINs)
- Implementar Scoreboard Refactor SDD (ScoreboardMain monolith → componentes atómicos)
- Implementar Table PIN Auth SDD (QR display per table)
- Implementar Multi-Table System (openspec `add-multi-table-system`)
- Agregar tests E2E para flujos de auth y reconexión
- Internationalización / i18n (error messages en español vs inglés)
- Reemplazar ofuscación XOR del PIN con cifrado real si el threat model lo requiere
- Agregar error boundaries en React para manejo graceful de errores de socket

---

**Estado:** Draft
**Owner:** Por definir
**Fecha:** 2026-04-14
**Version:** v0.2
