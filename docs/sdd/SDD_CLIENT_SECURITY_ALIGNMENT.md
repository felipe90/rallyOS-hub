# SDD - Alineación del Cliente con Security Hardening del Servidor

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/PRD_CLIENT_SECURITY_ALIGNMENT.md`
- Objetivos cubiertos:
  - Meta 1: 0 referencias al PIN hardcodeado `'00000'`
  - Meta 2: 100% de eventos emitidos usando constantes de `SocketEvents`
  - Meta 3: Owner PIN input acepta 5–8 dígitos (patrón del server: `/^\d{5,8}$/`)
  - Meta 4: 0 eventos fantasma — todos los nombres verificados contra `socketHandler.ts`
  - Meta 5: Manejo diferenciado de `VALIDATION_ERROR` en UI

## 2) Arquitectura actual (AS-IS)

### Componentes involucrados hoy
- `client/src/hooks/useSocket.ts`: Hook central, emite y escucha todos los eventos. Usa string literals directos.
- `client/src/hooks/useAuth.ts`: Maneja rol, tableId y ownerPin en localStorage. PinInput length=5.
- `client/src/pages/AuthPage/AuthPage.tsx`: Flujo de selección de rol + auth de Owner. Tiene bypass `'00000'`.
- `client/src/pages/DashboardPage/DashboardPage.tsx`: Emite `REGENERATE_PIN` sin ownerPin.
- `client/src/contexts/SocketContext/`: Wrapper de contexto sobre `useSocket`.
- `shared/types.ts`: Tipos compartidos (solo tipos, sin constantes de eventos).
- `server/src/socketHandler.ts`: Handler de 20+ eventos. Ya tiene `validateSocketPayload` y `pino`. Ya usa nombres correctos internamente. No importa `shared/`.

### Flujo actual resumido
```
AuthPage → emit('VERIFY_OWNER', { pin }) → [bypass si '00000']
DashboardPage → emit('GET_TABLES', {}) → [evento no existe en server]
ScoreboardPage → emit('SCORE_POINT', ...) → [evento no existe, es RECORD_POINT]
ScoreboardPage → emit('UNDO_POINT', ...) → [evento no existe, es UNDO_LAST]
```

### Limitaciones actuales
- String literals duplicados: cambiar un nombre de evento en el server es silenciosamente invisible en el cliente
- Bypass `'00000'` permite acceso como owner sin pasar por el server
- `emit('GET_TABLES', {})` nunca es respondido (el server escucha `LIST_TABLES`)
- `emit('SCORE_POINT', ...)` nunca es respondido (el server escucha `RECORD_POINT`)
- `emit('UNDO_POINT', ...)` nunca es respondido (el server escucha `UNDO_LAST`)
- No se distinguen códigos de error estructurados — todo ERROR se trata igual

## 3) Arquitectura propuesta (TO-BE)

### Componentes nuevos/modificados
```
rallyOS-hub/
├── shared/
│   ├── types.ts          (EXISTE - sin cambios estructurales)
│   └── events.ts         ← NUEVO: diccionario único de eventos
│
├── client/
│   ├── vite.config.ts    ← MODIFICADO: alias @shared
│   ├── tsconfig.app.json ← MODIFICADO: paths para @shared
│   └── src/
│       ├── hooks/
│       │   └── useSocket.ts  ← MODIFICADO: usa SocketEvents, valida payloads
│       ├── pages/
│       │   ├── AuthPage/
│       │   │   └── AuthPage.tsx  ← MODIFICADO: elimina bypass, PinInput flexible
│       │   └── DashboardPage/
│       │       └── DashboardPage.tsx  ← MODIFICADO: REGENERATE_PIN con ownerPin
│       └── shared/
│           └── types.ts  ← MODIFICADO: ValidationError, QRData actualizado
│
└── server/
    └── src/
        └── socketHandler.ts  ← MODIFICADO: importa SocketEvents (solo strings)
```

### Diagrama de flujo TO-BE
```
shared/events.ts (fuente de verdad)
    ↓ import                    ↓ import
client/useSocket.ts         server/socketHandler.ts
  SocketEvents.CLIENT.*       socket.on(SocketEvents.CLIENT.*)
  SocketEvents.SERVER.*       socket.emit(SocketEvents.SERVER.*)
```

### Contratos entre módulos
- `shared/events.ts` exporta: `SocketEvents` (as const), `ClientEvent` type, `ServerEvent` type
- `useSocket.ts` consume: `SocketEvents.CLIENT.*` para emitir, `SocketEvents.SERVER.*` para escuchar
- `socketHandler.ts` consume: `SocketEvents.CLIENT.*` para `socket.on(...)`, `SocketEvents.SERVER.*` para `socket.emit(...)`

## 4) Diseño de datos y contratos

### 4.1 Modelos/Tipos nuevos en `shared/`

```typescript
// shared/events.ts — fuente de verdad única para nombres de eventos
export const SocketEvents = {
  // Emitidos por el CLIENT → SERVER
  CLIENT: {
    CREATE_TABLE:        'CREATE_TABLE',
    JOIN_TABLE:          'JOIN_TABLE',
    LEAVE_TABLE:         'LEAVE_TABLE',
    LIST_TABLES:         'LIST_TABLES',
    GET_TABLES_WITH_PINS: 'GET_TABLES_WITH_PINS',
    GET_MATCH_STATE:     'GET_MATCH_STATE',
    SET_REF:             'SET_REF',
    REF_ROLE_CHECK:      'REF_ROLE_CHECK',
    DELETE_TABLE:        'DELETE_TABLE',
    VERIFY_OWNER:        'VERIFY_OWNER',
    CONFIGURE_MATCH:     'CONFIGURE_MATCH',
    START_MATCH:         'START_MATCH',
    RECORD_POINT:        'RECORD_POINT',
    SUBTRACT_POINT:      'SUBTRACT_POINT',
    UNDO_LAST:           'UNDO_LAST',
    SET_SERVER:          'SET_SERVER',
    RESET_TABLE:         'RESET_TABLE',
    REQUEST_TABLE_STATE: 'REQUEST_TABLE_STATE',
    REGENERATE_PIN:      'REGENERATE_PIN',
  },
  // Emitidos por el SERVER → CLIENT
  SERVER: {
    TABLE_LIST:            'TABLE_LIST',
    TABLE_LIST_WITH_PINS:  'TABLE_LIST_WITH_PINS',
    TABLE_UPDATE:          'TABLE_UPDATE',
    TABLE_CREATED:         'TABLE_CREATED',
    TABLE_JOINED:          'TABLE_JOINED',
    TABLE_DELETED:         'TABLE_DELETED',
    MATCH_UPDATE:          'MATCH_UPDATE',
    HISTORY_UPDATE:        'HISTORY_UPDATE',
    REF_SET:               'REF_SET',
    REF_ROLE_CHECK_RESULT: 'REF_ROLE_CHECK_RESULT',
    REF_REVOKED:           'REF_REVOKED',
    QR_DATA:               'QR_DATA',
    PIN_REGENERATED:       'PIN_REGENERATED',
    OWNER_VERIFIED:        'OWNER_VERIFIED',
    SET_WON:               'SET_WON',
    MATCH_WON:             'MATCH_WON',
    PLAYER_LEFT:           'PLAYER_LEFT',
    ERROR:                 'ERROR',
  },
} as const;

export type ClientEvent = typeof SocketEvents.CLIENT[keyof typeof SocketEvents.CLIENT];
export type ServerEvent = typeof SocketEvents.SERVER[keyof typeof SocketEvents.SERVER];
```

```typescript
// Agregar en shared/types.ts

// Respuesta de error estructurada (RF-09)
export interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  field: string;
  expected: string;
  received: string;
}

// QRData actualizado (RF-10): encryptedPin requerido, formato AES
export interface QRData {
  hubSsid: string;
  hubIp: string;
  hubPort: number;
  tableId: string;
  tableName: string;
  pin: string;           // plain text (solo referencia, no exponer)
  encryptedPin: string;  // formato: {iv}:{ciphertext}:{authTag}
  url: string;           // rallyhub://join/{tableId}?ePin={encryptedPin}
}
```

### 4.2 Cambios en contratos de eventos

**Evento `VERIFY_OWNER` (RF-01, RF-02)**
- Input validado server: `{ pin: string }` → pattern `/^\d{5,8}$/`
- El cliente actualmente valida `length !== 5` → cambiar a `length < 5 || length > 8`
- Eliminar el IF `pinToCheck === '00000'` completamente

**Evento `LIST_TABLES` (RF-03)**
- Antes en cliente: `emit('GET_TABLES', {})` → fantasma, nunca respondido
- Después: `emit(SocketEvents.CLIENT.LIST_TABLES)` → server responde `TABLE_LIST`

**Evento `RECORD_POINT` (RF-04)**
- Antes: `emit('SCORE_POINT', { tableId, player })`
- Después: `emit(SocketEvents.CLIENT.RECORD_POINT, { tableId, player })`

**Evento `UNDO_LAST` (RF-05)**
- Antes: `emit('UNDO_POINT', { tableId })`
- Después: `emit(SocketEvents.CLIENT.UNDO_LAST, { tableId })`

**Evento `JOIN_TABLE` (RF-06)**
- Antes: `emit('JOIN_TABLE', { tableId, pin, role })`
- Después: `emit(SocketEvents.CLIENT.JOIN_TABLE, { tableId, pin, name? })`
- El campo `role` se elimina del emit (el server lo ignora pero produce payload innecesario)

**Evento `REGENERATE_PIN` (RF-07)**
- Antes: `emit('REGENERATE_PIN', { tableId, pin: '' })`
- Después: `emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId, pin: ownerPin })`
- `ownerPin` viene de `useAuth().ownerPin` (ya está en localStorage)

**Error `VALIDATION_ERROR` (RF-08)**
- Nuevo manejo en `useSocket.ts`:
  ```typescript
  socket.on(SocketEvents.SERVER.ERROR, (error: ErrorResponse | ValidationError) => {
    if (error.code === 'VALIDATION_ERROR') {
      // Mostrar campo específico: error.field, error.message
    } else if (error.code === 'RATE_LIMITED') {
      // Mensaje específico de rate limit
    } else if (error.code === 'INVALID_PIN') {
      // PIN incorrecto
    }
    // Actualizar estado de error con código diferenciado
  });
  ```

## 5) Reglas de negocio (cliente)

- **RB-C01**: Ningún string literal de evento de socket puede existir fuera de `shared/events.ts` — aplica tanto en cliente como en servidor.
- **RB-C02**: El cliente no debe asumir que el bypass offline con PIN fijo funciona — toda auth debe pasar por el servidor.
- **RB-C03**: El PIN de owner del localStorage (`ownerPin`) debe enviarse en `REGENERATE_PIN` para que el servidor pueda autorizar.
- **RB-C04**: Si el servidor responde `ERROR` con `code: 'VALIDATION_ERROR'`, el mensaje de UI debe indicar el campo específico que falló.
- **RB-C05**: El cliente debe validar `name.length <= 256` antes de emitir `CREATE_TABLE` o `JOIN_TABLE`.
- **RB-C06**: El PIN de mesa (4 dígitos) debe cumplir `/^\d{4}$/` antes de emitir `SET_REF`.

## 6) Seguridad y validaciones

### Validaciones client-side antes de emitir

```typescript
// En useSocket.ts — guard antes de emit
const validateName = (name?: string): boolean =>
  !name || (typeof name === 'string' && name.length <= 256);

const validateTablePin = (pin: string): boolean => /^\d{4}$/.test(pin);

const validateOwnerPin = (pin: string): boolean => /^\d{5,8}$/.test(pin);
```

### Manejo de secretos
- **NUNCA** loguear el `ownerPin` del localStorage en `console.log`
- **NUNCA** loguear el `pin` de mesa en `console.log`  
- Los únicos `console.log` permitidos en el cliente son de estado de conexión y tableId (sin datos sensibles)

### Autorización en el cliente
- El cliente NO autoriza nada — solo valida formato antes de enviar
- Si el server responde `ERROR`, el cliente revierte el estado de UI

## 7) Observabilidad

### Errores esperados con códigos diferenciados
```typescript
// Tabla de mapeo código → mensaje UI (español)
const ERROR_MESSAGES: Record<string, string> = {
  'INVALID_PIN':       'PIN de mesa incorrecto',
  'INVALID_OWNER_PIN': 'PIN de organizador incorrecto',
  'RATE_LIMITED':      'Demasiados intentos. Esperá un minuto.',
  'REF_ALREADY_ACTIVE': 'Ya hay un árbitro activo en esta mesa',
  'TABLE_NOT_FOUND':   'Mesa no encontrada',
  'UNAUTHORIZED':      'No autorizado',
  'VALIDATION_ERROR':  (error) => `Campo inválido: ${error.field} — ${error.message}`,
  'NOT_OWNER':         'No tenés permisos de organizador',
};
```

### Logs del cliente eliminados (RNF-03)
- Remover todos los `console.log` que contengan: `ownerPin`, `pin`, `data.pin`

## 8) Plan de implementación técnica

### Fase 0 — Bloqueante: shared/events.ts (T0)
1. Crear `shared/events.ts` con `SocketEvents` as const — **TODOS los eventos del servidor verificados**
2. Agregar `@shared` alias en `client/vite.config.ts`:
   ```typescript
   alias: {
     '@': path.resolve(__dirname, './src'),
     '@shared': path.resolve(__dirname, '../shared'),
   }
   ```
3. Agregar paths en `client/tsconfig.app.json`:
   ```json
   "paths": {
     "@/*": ["./src/*"],
     "@shared/*": ["../shared/*"]
   }
   ```
4. Actualizar `server/tsconfig.json` para incluir shared:
   ```json
   "include": ["src/**/*", "../shared/**/*"]
   ```
5. Test rápido: `import { SocketEvents } from '@shared/events'` en un archivo temporal de cada lado

### Fase 1 — Server: migrar socketHandler.ts a constantes (junto con Fase 1 del SDD server)
1. Importar `SocketEvents` en `socketHandler.ts`
2. Reemplazar todos los `socket.on('EVENT_NAME', ...)` por `socket.on(SocketEvents.CLIENT.EVENT_NAME, ...)`
3. Reemplazar todos los `socket.emit('EVENT_NAME', ...)` por `socket.emit(SocketEvents.SERVER.EVENT_NAME, ...)`
4. Verificar: `grep -r "socket.on('" server/src` retorna 0 resultados con strings

### Fase 2 — Client: migrar useSocket.ts a constantes + corregir eventos
1. Importar `SocketEvents` desde `@shared/events`
2. Reemplazar TODOS los string literals de eventos por constantes
3. Corregir el payload de `JOIN_TABLE` (eliminar `role`)
4. Agregar validaciones client-side (`validateName`, `validateTablePin`)
5. Implementar manejo diferenciado de códigos de error

### Fase 3 — Client: Auth de Owner
1. `AuthPage.tsx`: eliminar el bloque `if (pinToCheck === '00000')`
2. `AuthPage.tsx`: cambiar validación a `pinToCheck.length < 5 || pinToCheck.length > 8`
3. `PinInput`: si el componente acepta `length` fijo, cambiar a aceptar `maxLength` o usar `length={8}` como máximo

### Fase 4 — Client: REGENERATE_PIN + tipos
1. `DashboardPage.tsx`: `handleRegeneratePin` emite con `ownerPin`
2. `shared/types.ts`: agregar `ValidationError`, actualizar `QRData`

### Fase 5 — Tests
1. Actualizar mocks en `useSocket.test.ts` con nuevos nombres de eventos
2. Agregar test: `REGENERATE_PIN` emite `ownerPin`
3. Agregar test: bypass `'00000'` no existe (no hay rama para ese string)
4. Agregar test: `JOIN_TABLE` no incluye `role` en el payload

## 9) Plan de migración/compatibilidad

### Compatibilidad hacia atrás
- El servidor ya tiene los nombres correctos (`LIST_TABLES`, `RECORD_POINT`, `UNDO_LAST`) — el cambio en el cliente solo hace que funcione lo que antes estaba roto
- No hay breaking changes en los eventos del servidor — solo el cliente se alinea
- El patrón regex del server para Owner PIN es `/^\d{5,8}$/` — el cliente con 5 dígitos actualmente YA funciona si llega al servidor. El issue es el bypass que lo evita.

### Feature flags
- No se necesitan feature flags — los cambios corrigen comportamiento roto, no introducen features nuevas

### Estrategia de rollback
- Git: revertir commit de `shared/events.ts` y los cambios en `useSocket.ts`
- El servidor no depende del cliente para operar — rollback de cliente no afecta server

## 10) Plan de pruebas

### Unit tests (Vitest)

**`useSocket.test.ts`** — actualizar mocks existentes:
```typescript
// Verificar que se emite el evento CORRECTO
it('requestTables emite LIST_TABLES, no GET_TABLES', () => {
  mockSocket.emit.mockClear();
  result.current.requestTables();
  expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.LIST_TABLES);
});

it('scorePoint emite RECORD_POINT', () => {
  result.current.scorePoint('A');
  expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.RECORD_POINT, expect.any(Object));
});

it('undoLastPoint emite UNDO_LAST', () => {
  result.current.undoLastPoint();
  expect(mockSocket.emit).toHaveBeenCalledWith(SocketEvents.CLIENT.UNDO_LAST, expect.any(Object));
});

it('joinTable NO incluye campo role en el payload', () => {
  result.current.joinTable('table-1', '1234', 'referee');
  const call = mockSocket.emit.mock.calls[0];
  expect(call[1]).not.toHaveProperty('role');
});
```

**`AuthPage.test.tsx`** — eliminar test de bypass `'00000'` si existe, agregar:
```typescript
it('no tiene bypass para PIN 00000 — siempre emite VERIFY_OWNER', () => {
  fireEvent.change(pinInput, { target: { value: '00000' } });
  fireEvent.click(submitButton);
  expect(mockSocket.emit).toHaveBeenCalledWith(
    SocketEvents.CLIENT.VERIFY_OWNER, 
    { pin: '00000' }
  );
  // No debe navegar sin respuesta del servidor
  expect(mockNavigate).not.toHaveBeenCalled();
});
```

### Integración
- Conectar cliente con servidor en dev (`npm run dev` en ambos), verificar que los 3 flujos principales funcionan:
  1. Crear mesa → QR_DATA recibido
  2. Árbitro: entrar con PIN 4 dígitos → REF_SET recibido
  3. Marcar punto → MATCH_UPDATE recibido

### E2E / Smoke
- Flujo completo: Owner-auth → Dashboard → Crear mesa → Join como árbitro → Start match → Record point → Undo → End match
- Verificar que `getByTestId('score-a')` actualiza al registrar punto
- Verificar que errores de PIN muestran el mensaje correcto

### Casos borde
- `JOIN_TABLE` con `name` de 257 chars → client rechaza antes de emitir
- `SET_REF` con PIN de 3 dígitos → client rechaza antes de emitir
- `VERIFY_OWNER` con PIN de 4 chars → client rechaza (min es 5)
- `VERIFY_OWNER` con PIN de 9 chars → client rechaza (max es 8)
- Error `VALIDATION_ERROR` del server → UI muestra campo específico

## 11) Riesgos técnicos y trade-offs

- **Riesgo**: El alias `@shared` en Vite puede no resolverse en los tests de Vitest → **Mitigación**: agregar también en `vitest.config.ts` el `alias` con el mismo mapeo
- **Riesgo**: El `server/tsconfig.json` tiene `rootDir: './src'` — agregar `../shared/**/*` en `include` puede conflictuar → **Mitigación**: cambiar a `rootDir: '.'` y ajustar `outDir` apropiadamente, o usar paths relativos directos sin incluir en tsconfig (importar con `../../shared/events`)
- **Riesgo**: El servidor usa módulos CommonJS y `shared/events.ts` usa `export const` → **Mitigación**: `as const` con exports ES6 es compatible con `tsx` + `esModuleInterop: true` que ya tiene el server
- **Trade-off**: `PinInput` de longitud fija vs flexible → **flexible con maxLength=8** porque el server acepta 5–8 dígitos; un usuario con PIN de 6 dígitos no puede ingresar con `length={5}` fijo

## 12) Criterios de aceptación técnicos

- [ ] `shared/events.ts` existe, exporta `SocketEvents` con 19 eventos CLIENT y 18 eventos SERVER
- [ ] `shared/events.ts` exporta `ClientEvent` y `ServerEvent` types derivados con `typeof`
- [ ] `client/vite.config.ts`: alias `@shared` → `../shared` configurado
- [ ] `client/tsconfig.app.json`: `paths` con `@shared/*` → `../shared/*` configurado
- [ ] `client/vitest.config.ts`: alias `@shared` configurado (mismo que vite)
- [ ] `server/socketHandler.ts`: importa `SocketEvents`, 0 string literals en `socket.on()`/`socket.emit()`
- [ ] `client/useSocket.ts`: importa `SocketEvents` desde `@shared/events`, 0 string literals de eventos
- [ ] `AuthPage.tsx`: bypass `if (pinToCheck === '00000')` eliminado completamente
- [ ] `AuthPage.tsx`: validación de PIN es `pin.length < 5 || pin.length > 8`
- [ ] `useSocket.ts:joinTable`: payload emitido es `{ tableId, pin?, name? }` sin `role`
- [ ] `DashboardPage.tsx:handleRegeneratePin`: emite `{ tableId, pin: ownerPin }`
- [ ] `shared/types.ts`: `ValidationError` interface agregada
- [ ] `shared/types.ts`: `QRData.encryptedPin` es `string` (requerido)
- [ ] `useSocket.ts`: handler de `ERROR` diferencia `VALIDATION_ERROR`, `RATE_LIMITED`, etc.
- [ ] `grep -rn "socket\.emit('" client/src` retorna 0 resultados
- [ ] `grep -rn "socket\.on('" server/src` retorna 0 resultados (salvo connection/disconnect/error)
- [ ] Todos los tests unitarios del cliente pasan sin modificación a lógica de negocio
- [ ] 2 nuevos tests de `useSocket.test.ts` pasando

## 13) Archivos impactados

### Nuevos
- `shared/events.ts` → Diccionario único de eventos de socket

### Modificados
- `client/vite.config.ts` → Alias `@shared`
- `client/tsconfig.app.json` → Paths `@shared/*`
- `client/vitest.config.ts` → Alias `@shared` para tests
- `client/src/hooks/useSocket.ts` → Constantes de `SocketEvents`, validaciones, error handling
- `client/src/pages/AuthPage/AuthPage.tsx` → Eliminar bypass, validación de longitud
- `client/src/pages/DashboardPage/DashboardPage.tsx` → `REGENERATE_PIN` con ownerPin
- `client/src/shared/types.ts` → `ValidationError`, `QRData.encryptedPin` requerido
- `server/src/socketHandler.ts` → Importa `SocketEvents`, reemplaza string literals
- `server/tsconfig.json` → Include `../shared/**/*`

### Sin cambios
- `client/src/contexts/SocketContext/` (solo reexporta useSocket)
- `client/src/hooks/useAuth.ts` (ya maneja ownerPin correctamente)
- `client/src/components/` (ningún componente emite eventos directamente)
- `server/src/tableManager.ts`
- `server/src/matchEngine.ts`
- `server/src/utils/`

---

**Estado:** Draft  
**Owner técnico:** raikenwolf  
**Fecha:** 2026-04-13  
**Version:** v0.1
