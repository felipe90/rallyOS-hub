# PRD - Alineación del Cliente con Security Hardening del Servidor (POC LAN)

> **v0.2** — Agrega solución de diccionario compartido de eventos de socket (`shared/events.ts`) como fuente de verdad única para cliente y servidor.

## 1) Contexto
- **Problema de negocio u operación**: El servidor rallyOS-hub está recibiendo un hardening de seguridad completo (SDD_SECURITY_HARDENING_POC). El cliente web (`/client`) fue construido para el servidor anterior y tiene supuestos que ya no son válidos con los cambios del backend: PIN de 4 dígitos al hacer owner, hardcoded `'00000'` en AuthPage, QR con solo `pin` en texto plano, y un flujo `START_MATCH` que también configura.
- **Situación actual y por qué ahora**: El server ya tiene el SDD aprobado y comienza implementación. Si el cliente no se actualiza en paralelo, al deployar el nuevo servidor el cliente quedará roto o con comportamientos inseguros (e.g., bypass de owner auth offline con `'00000'`).
- **Alcance del entorno**: POC LAN — Red local de torneo. Clientes en dispositivos móviles y PCs conectados via WiFi al Orange Pi.

## 2) Problema
- **Qué duele hoy**:
  1. `AuthPage.tsx:91` tiene `if (pinToCheck === '00000')` que bypasea la verificación del servidor — con el nuevo server que genera PIN aleatorio de 8 dígitos, este shortcut ya no tiene sentido y representa un riesgo de acceso no autorizado.
  2. `useAuth.ts` y `AuthPage.tsx` aceptan PIN de 5 dígitos para owner (PinInput length=5), pero el SDD define que el owner PIN aleatorio será de **8 dígitos**.
  3. `DashboardPage.tsx:157` emite `REGENERATE_PIN` sin `ownerPin` (solo envía pin vacío), pero el nuevo servidor requiere autorización de owner para este evento.
  4. `useSocket.ts:153` llama `emit('JOIN_TABLE', { tableId, pin, role })` — el campo `role` no está contemplado en el contrato del SDD (payload: `{ tableId, name?, pin? }`). Podría fallar validación.
  5. `useSocket.ts` usa `emit('GET_TABLES', {})` pero el evento servidor es `LIST_TABLES` (no `GET_TABLES`).
  6. `useSocket.ts:156` emite `SCORE_POINT` pero el SDD/server usa `RECORD_POINT`.
  7. `useSocket.ts:157` emite `UNDO_POINT` pero el server usa `UNDO_LAST`.
  8. El cliente no maneja `VALIDATION_ERROR` como código de error diferenciado — todos los `ERROR` se tratan igual. Con el nuevo server que emite `code: 'VALIDATION_ERROR'` en payloads inválidos, el UX de mensajes de error es pobre.
  9. Los tipos en `shared/types.ts` tienen `QRData.pin` como campo plano pero el SDD cambia a `encryptedPin` con formato `{iv}:{ciphertext}:{authTag}` y la URL usa `ePin` en el query param — el cliente no usa la URL del QR directamente pero si algún componente usa `qrData.pin` para mostrar el PIN en texto plano, eso puede romper.
  10. `DashboardPage.tsx:144` navega aunque el timeout de SET_REF expire — trusts client, ignora la respuesta del servidor.
  11. **[RAÍZ]** No existe una fuente de verdad compartida para los nombres de eventos de socket — cliente y servidor definen strings literales independientes, lo que hace que cualquier renombre en un lado sea silenciosamente invisible en el otro (`'SCORE_POINT'` vs `'RECORD_POINT'`, etc.).

- **Quién lo sufre**:
  - **Tournament Owner**: Auth broken con PIN de 8 dígitos (input espera 5).
  - **Referee**: No puede unirse a mesas si JOIN_TABLE falla validación por campo `role` extra.
  - **Developer**: Mensajes de error del servidor no diferenciados hacen debugging imposible en campo.

- **Evidencia o síntomas**:
  - `PinInput length={5}` en AuthPage vs RB-02 del SDD: PIN aleatorio de **8 dígitos**.
  - `if (pinToCheck === '00000')` hardcoded en AuthPage (línea 91) — código muerto y peligroso post-hardening.
  - `emit('GET_TABLES', {})` en useSocket — evento que no existe en el contrato del SDD (es `LIST_TABLES`).
  - `emit('SCORE_POINT', ...)` y `emit('UNDO_POINT', ...)` — los eventos del servidor son `RECORD_POINT` y `UNDO_LAST` respectivamente.

## 3) Objetivo del producto
Actualizar el cliente web rallyOS-hub para que **funcione correctamente y de forma segura** con el servidor después del hardening, sin regressions funcionales para ninguno de los 3 roles (Owner, Referee, Espectador).

## 4) Metas
- **Meta 1**: 0 referencias al PIN hardcodeado `'00000'` en el cliente
- **Meta 2**: 100% de eventos emitidos validados contra el contrato del SDD antes de emitir (client-side validation)
- **Meta 3**: Owner PIN input acepta 8 dígitos y flujo de auth funciona end-to-end con el nuevo servidor
- **Meta 4**: Todos los nombres de eventos de socket emitidos coinciden con los del servidor (0 eventos fantasma)
- **Meta 5**: Manejo diferenciado de `VALIDATION_ERROR` en la UI con mensajes útiles para el usuario

## 5) No metas
- Cambiar el diseño visual/UI — solo lógica y contratos de eventos
- Implementar validación de payloads en el servidor (eso es del SDD del server)
- Cambios en la arquitectura de componentes (Atomic Design ya refactorizado)
- Persistencia de estado en base de datos (backlog posterior)
- Soporte offline-first

## 6) Alcance
### En alcance
- **[NUEVO]** Crear `shared/events.ts` — diccionario de constantes con todos los nombres de eventos de socket (emitidos y recibidos), tipados con `as const` y exportados como `SocketEvents`
- **[NUEVO]** Agregar alias `@shared` en `vite.config.ts` y `tsconfig.app.json` del cliente para resolución limpia de `shared/`
- **[NUEVO]** Hacer que el servidor importe `SocketEvents` desde `../shared/events.ts` en `socketHandler.ts` (y futuros `socket.ts`)
- Cambiar `PinInput length` de 5 a 8 en `AuthPage` para owner PIN
- Eliminar el bypass `if (pinToCheck === '00000')` del `handlePinSubmit`
- Migrar todos los string literals de eventos en `useSocket.ts` a constantes de `SocketEvents` (elimina los 3 errores de naming de golpe)
- Limpiar payload de `JOIN_TABLE` — eliminar campo `role` del emit
- Agregar `ownerPin` en el emit de `REGENERATE_PIN` (requerido por el nuevo server)
- Implementar manejo diferenciado de `code: 'VALIDATION_ERROR'` en el hook de socket y en la UI
- Actualizar tipos en `shared/types.ts`: `QRData.encryptedPin` formato AES, `ValidationError` interface
- Validación client-side proactiva de payloads antes de emitir (longitud de strings, formato de PIN de mesa 4 dígitos)
- Actualizar tests unitarios existentes para los cambios anteriores

### Fuera de alcance
- Cambios en el servidor (cubierto por SDD_SECURITY_HARDENING_POC) — salvo el import de `SocketEvents`
- Cambios en Docker/CI/CD
- Nuevos componentes de UI
- Integración con RallyOS app principal

## 7) Requisitos funcionales
- **RF-00**: Crear `shared/events.ts` con `SocketEvents` — objeto `as const` con las dos categorías: `CLIENT` (eventos que emite el cliente) y `SERVER` (eventos que emite el servidor). El servidor importa desde `../../shared/events`; el cliente desde `@shared/events`. Ningún string literal de evento puede existir fuera de este archivo.

  ```typescript
  // shared/events.ts — fuente de verdad única
  export const SocketEvents = {
    // Emitidos por el CLIENT → SERVER
    CLIENT: {
      CREATE_TABLE: 'CREATE_TABLE',
      JOIN_TABLE: 'JOIN_TABLE',
      LIST_TABLES: 'LIST_TABLES',
      GET_TABLES_WITH_PINS: 'GET_TABLES_WITH_PINS',
      SET_REF: 'SET_REF',
      DELETE_TABLE: 'DELETE_TABLE',
      VERIFY_OWNER: 'VERIFY_OWNER',
      CONFIGURE_MATCH: 'CONFIGURE_MATCH',
      START_MATCH: 'START_MATCH',
      RECORD_POINT: 'RECORD_POINT',
      SUBTRACT_POINT: 'SUBTRACT_POINT',
      UNDO_LAST: 'UNDO_LAST',
      SET_SERVER: 'SET_SERVER',
      RESET_TABLE: 'RESET_TABLE',
      LEAVE_TABLE: 'LEAVE_TABLE',
      GET_MATCH_STATE: 'GET_MATCH_STATE',
      REGENERATE_PIN: 'REGENERATE_PIN',
      REF_ROLE_CHECK: 'REF_ROLE_CHECK',
    },
    // Emitidos por el SERVER → CLIENT
    SERVER: {
      TABLE_CREATED: 'TABLE_CREATED',
      TABLE_JOINED: 'TABLE_JOINED',
      TABLE_LIST: 'TABLE_LIST',
      TABLE_LIST_WITH_PINS: 'TABLE_LIST_WITH_PINS',
      TABLE_UPDATE: 'TABLE_UPDATE',
      TABLE_DELETED: 'TABLE_DELETED',
      REF_SET: 'REF_SET',
      REF_REVOKED: 'REF_REVOKED',
      MATCH_UPDATE: 'MATCH_UPDATE',
      HISTORY_UPDATE: 'HISTORY_UPDATE',
      QR_DATA: 'QR_DATA',
      PIN_REGENERATED: 'PIN_REGENERATED',
      OWNER_VERIFIED: 'OWNER_VERIFIED',
      ERROR: 'ERROR',
    },
  } as const;

  export type ClientEvent = typeof SocketEvents.CLIENT[keyof typeof SocketEvents.CLIENT];
  export type ServerEvent = typeof SocketEvents.SERVER[keyof typeof SocketEvents.SERVER];
  ```

- **RF-01**: El flujo de Owner auth debe funcionar con PIN de 8 dígitos — `PinInput length=8`, validación `pinToCheck.length !== 8`
- **RF-02**: Eliminar completamente el bypass de `'00000'` — toda auth de Owner debe pasar por `VERIFY_OWNER` socket event
- **RF-03**: `useSocket.ts` debe usar `SocketEvents.CLIENT.LIST_TABLES` — no string literal
- **RF-04**: `useSocket.ts` debe usar `SocketEvents.CLIENT.RECORD_POINT` — no string literal
- **RF-05**: `useSocket.ts` debe usar `SocketEvents.CLIENT.UNDO_LAST` — no string literal
- **RF-06**: El payload de `JOIN_TABLE` debe ser `{ tableId, name?, pin? }` — eliminar el campo `role` del emit
- **RF-07**: El payload de `REGENERATE_PIN` debe incluir el `ownerPin` del localStorage para autorización
- **RF-08**: El hook de socket debe distinguir `error.code === 'VALIDATION_ERROR'` y mostrar mensajes descriptivos
- **RF-09**: `shared/types.ts` debe agregar la interfaz `ValidationError` con `code`, `message`, `field`, `expected`, `received`
- **RF-10**: `shared/types.ts` debe actualizar `QRData` — `encryptedPin` pasa de opcional a requerido, formato `{iv}:{ciphertext}:{authTag}`
- **RF-11**: Validación client-side en `useSocket.ts` antes de emitir eventos críticos: `name` max 256 chars, `pin` pattern `/^\d{4}$/` para mesa, PIN owner 8 dígitos
- **RF-12**: Tests unitarios actualizados para reflejar los nuevos contratos de eventos

## 8) Requisitos no funcionales
- **RNF-01 (Compatibilidad)**: Los cambios no deben romper el flujo de Referee ni Espectador — solo Owner auth y eventos de socket
- **RNF-02 (Tipado)**: Cero `any` explícitos adicionales introducidos; tipos deben ser exactos con los del SDD del server
- **RNF-03 (Seguridad)**: Ningún PIN (de mesa ni de owner) debe quedar en logs del cliente (`console.log`)
- **RNF-04 (UX)**: Mensajes de error en UI deben ser en español, descriptivos y específicos al campo que falla

## 9) Trade-offs
- **Decisión 0**: `shared/events.ts` con objeto `as const` vs enum de TypeScript vs strings libres → **`as const` object**. Beneficio: funciona en ESM (cliente Vite) y CJS (servidor Node), sin overhead de runtime, 100% type-safe con `typeof`. Costo: requiere configurar alias `@shared` en Vite y `paths` en tsconfig. Los enums de TS se compilan a JS con valores, crean indirección innecesaria, y son difíciles de usar en ambos mundos de módulos.
- **Decisión 1**: Validación client-side proactiva vs confiar solo en el server → **Validación dual** (client previene requests inválidos, server rechaza igual si llegan). Beneficio: mejor UX (feedback inmediato, menos round-trips). Costo: duplicación de lógica de validación.
- **Decisión 2**: PIN de owner 8 dígitos en un input numérico vs texto libre → **8 dígitos numéricos** para consistencia con la política del servidor (RB-02). Beneficio: UX predecible. Costo: owner con PIN configurado de longitud diferente tendrá que ajustar.
- **Decisión 3**: Manejar `VALIDATION_ERROR` inline en cada componente vs en el hook global → **en el hook global** (`useSocket`). Beneficio: un solo lugar de verdad para mapear códigos de error a mensajes. Costo: el hook necesita estado adicional o callback.

## 10) Riesgos y mitigaciones
- **Riesgo**: `LIST_TABLES` era el nombre anterior y puede que el server ya lo tenga así → **Mitigación**: verificar el nombre exacto en `socketHandler.ts` del server antes de cambiar
- **Riesgo**: El campo `role` en `JOIN_TABLE` puede ser necesario para lógica de UI (no solo server) → **Mitigación**: si se necesita distinguir rol, usar una variable de estado local en el componente, no enviarlo al server
- **Riesgo**: Tests existentes pueden fallar al cambiar los nombres de eventos → **Mitigación**: actualizar mocks de test en simultáneo con los cambios en el hook

## 11) Criterios de aceptación (DoD)
- [ ] `shared/events.ts`: archivo creado con `SocketEvents.CLIENT` y `SocketEvents.SERVER`, exporta `ClientEvent` y `ServerEvent` types
- [ ] `client/vite.config.ts`: alias `@shared` → `../../shared` configurado
- [ ] `client/tsconfig.app.json`: `paths` con `@shared/*` → `../../shared/*` configurado
- [ ] `server/socketHandler.ts`: importa `SocketEvents` desde `../../shared/events`, 0 string literals de eventos
- [ ] `client/useSocket.ts`: importa `SocketEvents` desde `@shared/events`, 0 string literals de eventos
- [ ] `AuthPage.tsx`: `PinInput length` cambiado a 8, validación de longitud actualizada
- [ ] `AuthPage.tsx`: bypass `'00000'` eliminado completamente
- [ ] `useSocket.ts`: evento `GET_TABLES` reemplazado por `SocketEvents.CLIENT.LIST_TABLES`
- [ ] `useSocket.ts`: evento `SCORE_POINT` reemplazado por `SocketEvents.CLIENT.RECORD_POINT`
- [ ] `useSocket.ts`: evento `UNDO_POINT` reemplazado por `SocketEvents.CLIENT.UNDO_LAST`
- [ ] `useSocket.ts`: payload `JOIN_TABLE` sin campo `role`
- [ ] `DashboardPage.tsx`: `REGENERATE_PIN` emite con `ownerPin` del localStorage
- [ ] `useSocket.ts` o contexto: manejo diferenciado de `VALIDATION_ERROR` con mensaje en español
- [ ] `shared/types.ts`: interfaz `ValidationError` agregada
- [ ] `shared/types.ts`: `QRData.encryptedPin` actualizado a requerido con formato AES
- [ ] Validación client-side en `useSocket.ts` para `name` (max 256), `pin` de mesa (`/^\d{4}$/`)
- [ ] Tests unitarios actualizados y pasando (no regressions)
- [ ] 0 `console.log` de PINs en el cliente
- [ ] `grep -r "socket.emit('" server/src` retorna 0 resultados (todo usa constantes)

## 12) Plan de rollout
- **Etapa 1**: Correcciones críticas de contratos de eventos (`GET_TABLES`, `SCORE_POINT`, `UNDO_POINT`, payload `JOIN_TABLE`) — sincronizar con Fase 1 del server
- **Etapa 2**: Auth de Owner 8 dígitos + eliminación del bypass `'00000'` — sincronizar con Fase 1 del server (AES + owner PIN)
- **Etapa 3**: Manejo de `VALIDATION_ERROR` + validación client-side — sincronizar con Fase 2 del server
- **Etapa 4**: Actualización de tipos + tests — junto con Etapa 5 del server (testing y documentación)
- **Etapa 5**: Smoke test end-to-end en LAN (Orange Pi) con todos los roles

## 13) Dependencias
- **Dependencia técnica**: `shared/events.ts` debe crearse ANTES de cualquier otro cambio — es el bloqueante de todos los RF subsiguientes
- **Dependencia técnica**: El servidor debe poder importar `../../shared/events` — verificar que `tsconfig.json` del server incluya el path correcto (`"include": ["src/**/*", "../shared/**/*"]`)
- **Dependencia técnica**: Implementación de Fase 1 del SDD del server (AES-256-GCM, owner PIN aleatorio) antes de la Etapa 2 del cliente
- **Dependencia operativa**: Acceso al servidor Orange Pi para testing end-to-end en cada etapa

## 14) Backlog posterior
- Mostrar el QR del PIN de mesa en el client (actualmente solo en el servidor via `QR_DATA` event, no renderizado en UI)
- Input de nombre de mesa con validación de max 256 chars en modo visual
- Toast notifications para errores de validación (vs inline error text actual)
- Logout automático si el servidor emite `REF_REVOKED` para el socket actual

---

**Estado:** Draft  
**Owner:** raikenwolf  
**Fecha:** 2026-04-13  
**Version:** v0.2
