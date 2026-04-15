# SDD - Eliminación de Polling y Limpieza del Cliente

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- Objetivos cubiertos:
  - **Meta 5:** Polling eliminado de `DashboardPage` — 100% server push vía `TABLE_UPDATE`
  - **Meta 6:** Cero `console.log` en producción (parte cliente)
  - RF-05 (DashboardPage sin polling), RF-06 (console cleanup)
  - Criterio DoD: DashboardPage sin setInterval, useSocket con listener reconnect, zero console.log

## 2) Arquitectura actual (AS-IS)
### Polling en DashboardPage
- `client/src/pages/DashboardPage/DashboardPage.tsx` — `setInterval` cada 3s (`TABLE_REFRESH_INTERVAL`)
- Cada tick emite `LIST_TABLES` o `GET_TABLES_WITH_PINS` según el rol
- El server responde con la lista completa de mesas (con PINs si es owner)
- Coexiste con eventos `TABLE_UPDATE` que el server pushea en cada cambio real

### Console.log en cliente
- `client/src/hooks/useSocket.ts` — múltiples `console.log` (conexión, eventos, debug)
- `client/src/pages/DashboardPage/DashboardPage.tsx` — 6+ `console.log` (debug de estado)
- `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` — 10+ `console.log` (debug de auth, match)
- `client/src/pages/AuthPage/AuthPage.tsx` — `console.log` en debug
- `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx` — `console.log` en render (anti-pattern grave)

### useSocket hook
- `socketRef` tipado como `any` — pierde toda la seguridad de TypeScript
- No tiene listener de `reconnect` — si el socket se cae y vuelve, no re-requestea el estado
- `TABLE_CREATED` handler auto-emite `GET_TABLES_WITH_PINS` si hay ownerPin en localStorage

### Limitaciones actuales
- **Tráfico redundante:** 90% de los polls devuelven datos idénticos
- **PINs expuestos innecesariamente:** `GET_TABLES_WITH_PINS` envía PINs cada 3s
- **CPU desperdiciado en Orange Pi:** serialización y envío de datos innecesarios
- **Race conditions:** push + poll pueden llegar en orden impredecible
- **Enmascara bugs:** si el push falla, nadie lo nota porque el polling "arregla" el síntoma
- **20+ console.log en producción:** debug artifacts que ensucian la consola

## 3) Arquitectura propuesta (TO-BE)
### Sin polling — 100% server push

```
ANTES:
  DashboardPage useEffect
    ├── requestTablesWithPins()  ← inmediato
    └── setInterval(3s)          ← polling
         └── requestTablesWithPins()  ← cada 3s

DESPUÉS:
  DashboardPage useEffect
    └── requestTablesWithPins()  ← UNA VEZ al montar
  useSocket reconnect listener
    └── requestTablesWithPins()  ← SOLO al reconectar

  Server push (ya existe):
    └── onTableUpdate → TABLE_UPDATE + TABLE_LIST  ← en cada cambio real
```

### useSocket con reconnect
```typescript
socket.on('reconnect', (attemptNumber) => {
  logger.debug({ attemptNumber }, 'Socket reconnected, refreshing tables');
  // Re-request tables based on role
  const ownerPin = localStorage.getItem('ownerPin');
  if (ownerPin) {
    requestTablesWithPins(ownerPin);
  } else {
    requestTables();
  }
});
```

### Console cleanup
- Eliminar TODOS los `console.log` y `console.error` de archivos de producción
- Reemplazar por:
  - Server: `logger` de Pino (ya existe)
  - Cliente: eliminar sin reemplazo (no hay logger en cliente, y no se necesita)
- Excepción: tests pueden usar `console.log` si es necesario

### Tipos any corregidos
- `socketRef: useRef<any>(null)` → `socketRef: useRef<Socket | null>(null)`
- Requiere `import type { Socket } from 'socket.io-client'`

## 4) Diseño de datos y contratos
### 4.1 Eventos de socket (sin cambios)
Los eventos no cambian — solo se deja de hacer polling innecesario.

### 4.2 useSocket interface (con reconnect)
```typescript
// Nuevo listener en useSocket
socket.on('reconnect', () => {
  const ownerPin = localStorage.getItem('ownerPin');
  if (ownerPin) {
    emit(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, { ownerPin });
  } else {
    emit(SocketEvents.CLIENT.LIST_TABLES);
  }
});
```

### 4.3 Tipos corregidos
```typescript
// ANTES
const socketRef = useRef<any>(null);

// DESPUÉS
import type { Socket } from 'socket.io-client';
const socketRef = useRef<Socket | null>(null);
```

## 5) Reglas de negocio
- **RB-01:** Dashboard se actualiza exclusivamente vía server push (`TABLE_UPDATE` + `TABLE_LIST`).
- **RB-02:** Al reconectar, se re-requestea la lista completa de mesas (único caso de refresh no-push).
- **RB-03:** No hay polling periódico — cero `setInterval` relacionados con datos de mesa.
- **RB-04:** No hay `console.log` en producción cliente — debug artifacts eliminados.
- **RB-05:** `socketRef` está correctamente tipado como `Socket | null`.

## 6) Seguridad y validaciones
- **PINs:** Se reducen las veces que los PINs viajan por la red (solo al montar y al reconectar, no cada 3s).
- **Sin nuevos vectores:** No se agregan endpoints ni se modifica la superficie de ataque.
- **localStorage:** Se mantiene como fuente del ownerPin para el reconnect (ya existía).

## 7) Observabilidad
### Sin logs nuevos en producción
- Eliminar todos los `console.log` del cliente
- Si se necesita debug en desarrollo, usar `import.meta.env.DEV` guards:
```typescript
if (import.meta.env.DEV) {
  console.log('[Socket] Connected');
}
```

### Métricas
- Sin métricas nuevas.
- El tráfico de red se reduce significativamente (eliminar ~1 mensaje/3s por cliente).

## 8) Plan de implementacion tecnica
### Fase 1: Eliminar polling de DashboardPage
1. Remover `const TABLE_REFRESH_INTERVAL = ...` constante
2. Remover `setInterval` del useEffect principal
3. Mantener el request inicial (inmediato al montar)
4. Verificar que `npm run build` pasa

### Fase 2: Agregar reconnect listener a useSocket
1. En el `connect` callback, agregar `socket.on('reconnect', ...)` listener
2. Dentro del listener, re-requestear tablas según rol (ownerPin check)
3. Verificar que `npm run build` pasa

### Fase 3: Corregir tipo de socketRef
1. Cambiar `useRef<any>(null)` a `useRef<Socket | null>(null)`
2. Importar `import type { Socket } from 'socket.io-client'`
3. Verificar que `npm run build` pasa sin errores de tipo

### Fase 4: Eliminar console.log del cliente
1. `useSocket.ts` — eliminar todos los `console.log` (o envolver en `import.meta.env.DEV` si son útiles)
2. `DashboardPage.tsx` — eliminar todos los `console.log`
3. `ScoreboardPage.tsx` — eliminar todos los `console.log`
4. `AuthPage.tsx` — eliminar todos los `console.log`
5. `DashboardGrid.tsx` — eliminar `console.log` en render (crítico)
6. Verificar: grep `console\.` en `client/src/**/*.{ts,tsx}` (excluyendo tests) = 0
7. Verificar que `npm run build` pasa

## 9) Plan de migracion/compatibilidad
- **Sin breaking changes:** El comportamiento observable es el mismo (dashboard actualizado), solo cambia el mecanismo (push en vez de poll).
- **Sin feature flags:** No se necesitan toggles.
- **Rollback:** Revertir los commits. El polling vuelve a funcionar.
- **Compatibilidad:** El server no cambia — solo el cliente deja de hacer polling.

## 10) Plan de pruebas
### Unit tests
- `useSocket.test.ts` — agregar test para reconnect listener:
  - Al reconectar, emite LIST_TABLES (sin ownerPin)
  - Al reconectar, emite GET_TABLES_WITH_PINS (con ownerPin)

### Tests de DashboardPage
- `DashboardPage.test.tsx` — verificar que NO hay setInterval (buscar en el código)
- Test de que al montar, se requestean tablas UNA VEZ

### E2E/smoke
- `npm run test` del cliente pasa con 0 fallos
- Flujo manual: conectar → dashboard se actualiza vía push → crear mesa → dashboard actualiza sin polling
- Simular desconexión/reconexión → dashboard re-requestea tablas

### Casos borde
- Socket se cae inmediatamente al conectar → reconnect handler se ejecuta al reconectar
- Owner se va y vuelve → re-requestea con PIN
- Viewer se va y vuelve → re-requestea sin PIN
- Múltiples reconexiones → no duplica requests (cada reconnect dispara uno)

## 11) Riesgos tecnicos y trade-offs
- **Riesgo 1:** Eliminar polling puede dejar Dashboard sin updates si `TABLE_UPDATE` no se emite en algún path del server -> **Mitigación:** Ya se verificó que `notifyUpdate()` se llama en todos los paths de cambio de mesa (joinTable, leaveTable, setReferee, regeneratePin, configureMatch, startMatch, deleteTable). El reconnect handler cubre el caso de caída de socket.
- **Riesgo 2:** `console.log` en desarrollo son útiles para debug -> **Mitigación:** Si se necesitan, envolver en `if (import.meta.env.DEV) { ... }`. En producción no se ejecutan.
- **Riesgo 3:** Corregir `any` a `Socket | null` puede revelar errores de tipo existentes -> **Mitigación:** Los errores de tipo revelados son bugs existentes que deben fixearse. Es un beneficio, no un riesgo.

## 12) Criterios de aceptacion tecnicos
- [ ] `DashboardPage.tsx` no contiene `setInterval` ni `TABLE_REFRESH_INTERVAL`
- [ ] `DashboardPage.tsx` hace request inicial UNA VEZ al montar
- [ ] `useSocket.ts` tiene listener de `reconnect` que re-requestea tablas según rol
- [ ] `socketRef` en `useSocket.ts` está tipado como `Socket | null` (no `any`)
- [ ] Cero `console.log` o `console.error` en `client/src/**/*.{ts,tsx}` (excluyendo tests)
- [ ] `npm run build` del cliente pasa sin errores
- [ ] `npm run test` del cliente pasa con 0 fallos
- [ ] `useSocket.test.ts` tiene test para reconnect listener

## 13) Archivos impactados
### Modificados
- `client/src/pages/DashboardPage/DashboardPage.tsx` — eliminar polling, mantener request inicial
- `client/src/hooks/useSocket.ts` — agregar reconnect listener, corregir tipo socketRef, eliminar console.log
- `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` — eliminar console.log
- `client/src/pages/AuthPage/AuthPage.tsx` — eliminar console.log
- `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx` — eliminar console.log en render

### Tests
- `client/src/hooks/useSocket.test.ts` — agregar test de reconnect

---

**Estado:** Draft
**Owner tecnico:** Por definir
**Fecha:** 2026-04-14
**Version:** v0.1
