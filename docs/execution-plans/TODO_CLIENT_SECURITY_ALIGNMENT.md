# TODO - Alineación Cliente/Servidor con Security Hardening

## Referencias
- PRD: `docs/prd-plans/PRD_CLIENT_SECURITY_ALIGNMENT.md`
- SDD: `docs/specs-sdd/SDD_CLIENT_SECURITY_ALIGNMENT.md`

## Convenciones
- Prioridad: P0 (crítico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea tiene criterio de finalización verificable.

## Backlog por fases

### Fase 0 — Bloqueante: Diccionario de eventos (P0)

⚠️ Todo lo demás depende de esta fase. `shared/events.ts` no existe aún. El servidor ya completó su hardening (Fases 1–4 del SDD de server): AES-256-GCM ✅, owner PIN aleatorio ✅, refactor app/server/socket ✅, logger/validation ✅.

- [ ] (P0) Crear `shared/events.ts` con `SocketEvents` as const
  - Archivo(s): `shared/events.ts`
  - Criterio: Archivo exporta `SocketEvents.CLIENT` (19 eventos) y `SocketEvents.SERVER` (18 eventos), más los types `ClientEvent` y `ServerEvent`
  - Estado: TODO

- [ ] (P0) Configurar alias `@shared` en Vite
  - Archivo(s): `client/vite.config.ts`
  - Criterio: `import { SocketEvents } from '@shared/events'` resuelve sin error en `npm run dev`
  - Estado: TODO

- [ ] (P0) Configurar paths `@shared/*` en tsconfig del cliente
  - Archivo(s): `client/tsconfig.app.json`
  - Criterio: TypeScript no reporta error de módulo no encontrado para `@shared/events`
  - Estado: TODO

- [ ] (P0) Configurar alias `@shared` en Vitest
  - Archivo(s): `client/vitest.config.ts`
  - Criterio: `npm test` no falla por módulo `@shared/events` no encontrado
  - Estado: TODO

- [ ] (P0) Habilitar importación de `shared/` desde el servidor
  - Archivo(s): `server/tsconfig.json`
  - Criterio: `import { SocketEvents } from '../../shared/events'` resuelve en `tsx src/index.ts` sin error
  - Estado: TODO

### Fase 1 — Server: migrar socketHandler.ts a constantes (P0)

🔍 Estado verificado: el server usa string literals en todos los eventos. Owner PIN: ✅ ya es aleatorio (8 dígitos). AES-256-GCM: ✅ implementado. Refactor app/server/socket: ✅ hecho. Pendiente únicamente: adoptar SocketEvents (depende de Fase 0).

- [ ] (P0) Importar `SocketEvents` en `socketHandler.ts`
  - Archivo(s): `server/src/socketHandler.ts`
  - Criterio: Import presente y sin error de compilación
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P0) Reemplazar todos los `socket.on('...')` por constantes de `SocketEvents.CLIENT`
  - Archivo(s): `server/src/socketHandler.ts`
  - Criterio: `grep -n "socket\.on('" server/src/socketHandler.ts` retorna 0 resultados (excepto 'connection', 'disconnect', 'error')
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P0) Reemplazar todos los `socket.emit('...')` y `io.emit('...')` por constantes de `SocketEvents.SERVER`
  - Archivo(s): `server/src/socketHandler.ts`
  - Criterio: `grep -n "\.emit('" server/src/socketHandler.ts` retorna 0 resultados
  - Estado: BLOCKED (espera Fase 0)

### Fase 2 — Cliente: migrar useSocket.ts a constantes + corregir eventos (P0)

🔍 Estado verificado (grep directo sobre el archivo):
- `emit('GET_TABLES', {})` línea 154 — ❌ sigue roto (server escucha `LIST_TABLES`)
- `emit('SCORE_POINT', ...)` línea 156 — ❌ sigue roto (server escucha `RECORD_POINT`)
- `emit('UNDO_POINT', ...)` línea 157 — ❌ sigue roto (server escucha `UNDO_LAST`)
- `emit('GET_TABLES_WITH_PINS', ...)` línea 112 — ✅ nombre correcto
- Todos los `socket.on(...)` usan strings directos — ❌ sin constantes aún

- [ ] (P0) Importar `SocketEvents` en `useSocket.ts`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: Import presente, TypeScript no reporta errores
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P0) Corregir `requestTables`: `'GET_TABLES'` → `SocketEvents.CLIENT.LIST_TABLES`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: Al llamar `requestTables()`, el server responde con `TABLE_LIST`
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P0) Corregir `scorePoint`: `'SCORE_POINT'` → `SocketEvents.CLIENT.RECORD_POINT`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: Al registrar un punto, el server responde con `MATCH_UPDATE`
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P0) Corregir `undoLastPoint`: `'UNDO_POINT'` → `SocketEvents.CLIENT.UNDO_LAST`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: Al deshacer un punto, el server responde con `MATCH_UPDATE`
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P0) Migrar todos los `socket.on('...')` en `useSocket.ts` a `SocketEvents.SERVER.*`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: `grep -n "socket\.on('" client/src/hooks/useSocket.ts` retorna 0 resultados
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P0) Migrar todos los `socket.emit('...')` en `useSocket.ts` a `SocketEvents.CLIENT.*`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: `grep -n "socket\.emit('" client/src/hooks/useSocket.ts` retorna 0 resultados
  - Estado: BLOCKED (espera Fase 0)

- [ ] (P1) Limpiar payload de `joinTable`: eliminar campo `role` del emit
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: Test unitario confirma que el payload no contiene `role`
  - Estado: TODO

- [ ] (P1) Agregar validaciones client-side antes de emitir
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: `name > 256` chars → no emite; `pin` mesa != 4 dígitos → no emite
  - Estado: TODO

- [ ] (P1) Implementar manejo diferenciado de códigos de error
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: `VALIDATION_ERROR`, `RATE_LIMITED`, `INVALID_PIN`, `REF_ALREADY_ACTIVE` todos muestran mensajes distintos en UI
  - Estado: TODO

### Fase 3 — Cliente: Auth de Owner (P0)

🔍 Estado verificado:
- Bypass `'00000'` en línea 91 de `AuthPage.tsx` — ❌ sigue presente
- `PinInput length={5}` en línea 172 — ❌ server genera PIN aleatorio 8 dígitos
- Server `VERIFY_OWNER` acepta patrón `/^\d{5,8}$/` (5-8 dígitos)

- [ ] (P0) Eliminar bypass `if (pinToCheck === '00000')` de `handlePinSubmit`
  - Archivo(s): `client/src/pages/AuthPage/AuthPage.tsx`
  - Criterio: `grep -n "'00000'" client/src/pages/AuthPage/AuthPage.tsx` retorna 0 resultados
  - Estado: TODO

- [ ] (P0) Ajustar validación de longitud de PIN: `length < 5 || length > 8`
  - Archivo(s): `client/src/pages/AuthPage/AuthPage.tsx`
  - Criterio: PINs de 5–8 dígitos se envían correctamente; 4 y 9 son rechazados
  - Estado: TODO

- [ ] (P1) Ajustar `PinInput` para aceptar hasta 8 caracteres
  - Archivo(s): `client/src/pages/AuthPage/AuthPage.tsx` (o atom `PinInput` si tiene `length` fijo)
  - Criterio: Un usuario puede ingresar hasta 8 dígitos sin truncamiento
  - Estado: TODO

### Fase 4 — Tipos y REGENERATE_PIN (P1)

🔍 Estado verificado:
- `shared/types.ts`: no tiene `ValidationError`, no tiene `encryptedPin` en absoluto (solo en `client/src/shared/types.ts` como opcional)
- `client/src/shared/types.ts` línea 115: `encryptedPin?: string` — ❌ opcional, debe ser requerido
- `DashboardPage.tsx` línea 157: `emit('REGENERATE_PIN', { tableId, pin: '' })` — ❌ pin vacío

- [ ] (P1) Agregar interfaz `ValidationError` en `shared/types.ts`
  - Archivo(s): `shared/types.ts`
  - Criterio: Interfaz con `code: 'VALIDATION_ERROR'`, `message`, `field`, `expected`, `received`
  - Estado: TODO

- [ ] (P1) Actualizar `QRData.encryptedPin` de opcional a requerido
  - Archivo(s): `shared/types.ts` y `client/src/shared/types.ts`
  - Criterio: TypeScript falla en cualquier construcción de `QRData` sin `encryptedPin`
  - Estado: TODO

- [ ] (P1) Corregir `handleRegeneratePin` para enviar `ownerPin`
  - Archivo(s): `client/src/pages/DashboardPage/DashboardPage.tsx`
  - Criterio: El emit incluye `{ tableId, pin: ownerPin }` donde `ownerPin` viene de `useAuth().ownerPin`
  - Estado: TODO

### Fase 5 — Tests (P1)

- [ ] (P1) Actualizar mocks de `useSocket.test.ts` con nuevos nombres de eventos
  - Archivo(s): `client/src/hooks/useSocket.test.ts`
  - Criterio: Todos los tests existentes pasan sin cambios en lógica de negocio
  - Estado: TODO

- [ ] (P1) Agregar test: `requestTables` emite `LIST_TABLES` (no `GET_TABLES`)
  - Archivo(s): `client/src/hooks/useSocket.test.ts`
  - Criterio: Test pasa con `expect(mock).toHaveBeenCalledWith(SocketEvents.CLIENT.LIST_TABLES)`
  - Estado: TODO

- [ ] (P1) Agregar test: `scorePoint` emite `RECORD_POINT`
  - Archivo(s): `client/src/hooks/useSocket.test.ts`
  - Criterio: Test pasa con `expect(mock).toHaveBeenCalledWith(SocketEvents.CLIENT.RECORD_POINT, ...)`
  - Estado: TODO

- [ ] (P1) Agregar test: `joinTable` no incluye `role` en el payload
  - Archivo(s): `client/src/hooks/useSocket.test.ts`
  - Criterio: `expect(payload).not.toHaveProperty('role')`
  - Estado: TODO

- [ ] (P1) Agregar test: AuthPage no tiene rama para `'00000'`
  - Archivo(s): `client/src/pages/AuthPage/AuthPage.test.tsx`
  - Criterio: Ingresar `'00000'` emite `VERIFY_OWNER` al server y no navega hasta recibir respuesta
  - Estado: TODO

## Casos de prueba mínimos
- [ ] Caso feliz: Owner ingresa PIN de 8 dígitos → `OWNER_VERIFIED` → navega a Dashboard
- [ ] Caso feliz: Árbitro hace click en mesa, ingresa PIN 4 dígitos → `REF_SET` → navega a Scoreboard
- [ ] Caso feliz: Árbitro registra punto → `MATCH_UPDATE` llega con score actualizado
- [ ] Caso feliz: Owner regenera PIN → `QR_DATA` + `PIN_REGENERATED` recibidos
- [ ] Caso de error: PIN de mesa incorrecto → mensaje "PIN de mesa incorrecto" en UI, no navega
- [ ] Caso de error: `RATE_LIMITED` → mensaje "Demasiados intentos. Esperá un minuto."
- [ ] Caso de error: `VALIDATION_ERROR` → mensaje con nombre del campo fallido
- [ ] Caso borde: `name` de 257 chars en `CREATE_TABLE` → rechazado en cliente antes de emitir
- [ ] Caso borde: PIN de mesa `"abc1"` (no numérico) → rechazado en cliente antes de emitir

## Checklist de release
- [ ] Fase 0 completada — `shared/events.ts` existe y ambos lados importan sin error
- [ ] `grep -rn "socket\.emit('" server/src/socketHandler.ts` → 0 resultados
- [ ] `grep -rn "socket\.on('" server/src/socketHandler.ts` → 0 resultados (salvo connection/disconnect/error)
- [ ] `grep -rn "socket\.emit('" client/src/hooks/useSocket.ts` → 0 resultados
- [ ] `grep -rn "'00000'" client/src` → 0 resultados
- [ ] Tests ejecutados: `npm test` en `client/` → todo verde
- [ ] Logs sin secretos: no hay `console.log` con `pin` o `ownerPin`
- [ ] Validación funcional en LAN con Orange Pi — flujo completo de los 3 roles

## Registro de avances
- 2026-04-13 - PRD v0.2 + SDD v0.1 creados y aprobados - raikenwolf
- 2026-04-13 - TODO sincronizado con estado real del repo: server hardening completado (AES, refactor, logger), cliente sin cambios aún - raikenwolf
- 2026-04-13 - Fases 0-4 completadas. shared/events.ts creado, server socketHandler migrado, client useSocket migrado, AuthPage bypass eliminado, DashboardPage REGENERATE_PIN corregido, tipos actualizados. 19 tests pasando. - raikenwolf

---

**Owner:** raikenwolf
**Fecha inicio:** 2026-04-13
**Última actualización:** 2026-04-13
**Estado general:** Fases 0-4 DONE. Fase 5 (tests) PENDING
**Progreso:** 20/25 tareas completadas (80%)
