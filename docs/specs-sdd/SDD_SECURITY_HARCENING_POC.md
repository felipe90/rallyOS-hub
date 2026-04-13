# SDD - Hardening de Seguridad rallyOS-hub

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/PRD_SECURITY_HARCENING_POC.md`
- Objetivos cubiertos: 
  - Meta 1: 0 vulnerabilidades críticas pendientes
  - Meta 2: 100% validación de payloads
  - Meta 3: Logging estructurado
  - Meta 4: Graceful shutdown y error handling
  - Meta 5: Tests de seguridad actualizados

## 2) Arquitectura actual (AS-IS)
### Componentes involucrados hoy
- `src/index.ts`: Entry point monolítico (Express setup, TLS, CORS, Socket.IO init, static serving)
- `src/socketHandler.ts`: Manejo de 17 eventos de socket, rate limiting por socket ID, auth por PIN
- `src/tableManager.ts`: Gestión de mesas en memoria (Map), generación de PIN, CRUD de mesas
- `src/matchEngine.ts`: Lógica de partido de tenis de mesa (ITTF rules)
- `src/utils/pinEncryption.ts`: XOR cipher con sal diaria (INSEGURO)
- `src/utils/qrGenerator.ts`: Generación de QR codes

### Flujo actual resumado
1. Server inicia con TLS obligatorio
2. Cliente crea mesa -> auto-promovido a referee
3. QR generado con PIN encriptado (XOR)
4. Jugadores escanean QR, join con PIN desencriptado
5. Referee controla partido via eventos de socket
6. Owner puede regenerar PIN con `TOURNAMENT_OWNER_PIN` (default `'00000'`)

### Limitaciones actuales
- XOR cipher: brute-force en segundos (PIN 4 dígitos = 10,000 combinaciones)
- Owner PIN hardcodeado: cualquiera puede ser owner si no se configura env var
- Rate limit evadible: reconectar socket = nuevo socket ID = nuevos intentos
- Sin validación de payloads: strings de tamaño ilimitado
- Logging sin estructura: difícil de debuggear en producción
- Monolito en `index.ts`: difícil de testear y mantener

## 3) Arquitectura propuesta (TO-BE)
### Componentes nuevos/modificados
```
src/
├── app.ts                    # NUEVO: Express setup (CORS, routes, static)
├── server.ts                 # NUEVO: HTTPS server + graceful shutdown
├── socket.ts                 # NUEVO: Socket.IO setup + event routing
├── socketHandler.ts          # MODIFICADO: Rate limit por IP, payload validation
├── tableManager.ts           # SIN CAMBIOS MAYORES
├── matchEngine.ts            # SIN CAMBIOS
├── types.ts                  # MODIFICADO: Agregar tipos de validación
├── utils/
│   ├── pinEncryption.ts      # MODIFICADO: AES-256-GCM en lugar de XOR
│   ├── qrGenerator.ts        # SIN CAMBIOS
│   ├── validation.ts         # NUEVO: Payload validation utilities
│   └── logger.ts             # NUEVO: Pino logger setup
└── index.ts                  # MODIFICADO: Solo orquestador (importa app, server, socket)
```

### Diagrama de flujo (simplificado)
```
index.ts
  ├── app.ts (Express: CORS, routes, static)
  ├── server.ts (HTTPS + graceful shutdown)
  │     └── socket.ts (Socket.IO init)
  │           └── socketHandler.ts (event handlers)
  │                 ├── validation.ts (payload checks)
  │                 ├── pinEncryption.ts (AES-256-GCM)
  │                 └── logger.ts (structured logging)
  └── tableManager.ts (state management)
```

### Contratos entre módulos
- `app.ts` exporta: `app: Express`
- `server.ts` exporta: `createSecureServer(app: Express) => Server`
- `socket.ts` exporta: `createSocketServer(server: Server, tableManager: TableManager) => SocketHandler`
- `socketHandler.ts` exporta: `class SocketHandler`
- `validation.ts` exporta: `validatePayload(data: any, rules: ValidationRules) => void`
- `logger.ts` exporta: `logger: Pino instance`
- `pinEncryption.ts` exporta: `encryptPin(pin, tableId)`, `decryptPin(encrypted, tableId)`

## 4) Diseño de datos y contratos
### 4.1 Modelos/Tipos
```typescript
// NUEVO: Validation rules para payloads
interface ValidationRules {
  tableId?: { required: boolean; type: 'string'; maxLength: 36 };
  pin?: { required: boolean; type: 'string'; pattern: /^\d{4}$/ };
  name?: { required: boolean; type: 'string'; maxLength: 256 };
  player?: { required: boolean; type: 'string'; enum: ['A', 'B'] };
  format?: { required: boolean; type: 'number'; min: 1; max: 99 };
  ptsPerSet?: { required: boolean; type: 'number'; min: 1; max: 99 };
  handicap?: { 
    required: boolean; 
    type: 'object'; 
    shape: { a: { type: 'number'; min: 0; max: 99 }; b: { type: 'number'; min: 0; max: 99 } }
  };
}

// NUEVO: Error response estandarizado
interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  field: string;
  expected: string;
  received: string;
}

// MODIFICADO: QRData con encryptedPin en formato AES
interface QRData {
  hubSsid: string;
  hubIp: string;
  hubPort: number;
  tableId: string;
  tableName: string;
  pin: string; // plain text (solo para uso interno)
  encryptedPin: string; // formato: {iv}:{ciphertext}:{authTag}
  url: string; // rallyhub://join/{tableId}?ePin={encryptedPin}
}
```

### 4.2 API/Eventos
**Eventos MODIFICADOS**:

| Evento | Cambios | Input validado | Output |
|--------|---------|----------------|--------|
| `CREATE_TABLE` | Agregar validación de `data.name` | `{ name?: string (max 256) }` | `TABLE_CREATED`, `REF_SET`, `QR_DATA` |
| `JOIN_TABLE` | Agregar validación de `data.name`, `data.pin` | `{ tableId, name? (max 256), pin? (4 digits) }` | `TABLE_JOINED` o `ERROR` |
| `SET_REF` | Rate limit por IP, validar PIN | `{ tableId, pin (4 digits) }` | `REF_SET` o `ERROR` |
| `DELETE_TABLE` | Rate limit por IP, validar PIN | `{ tableId, pin (4 digits) }` | `TABLE_DELETED` o `ERROR` |
| `VERIFY_OWNER` | Validar PIN owner, loguear intento | `{ pin (required) }` | `OWNER_VERIFIED` o `ERROR` |
| `CONFIGURE_MATCH` | Unificar con START_MATCH, validar configs | `{ tableId, playerNames?, matchConfig? }` | `MATCH_UPDATE` o `ERROR` |
| `START_MATCH` | Simplificar (solo inicia, no configura) | `{ tableId }` | `MATCH_UPDATE` o `ERROR` |
| `REGENERATE_PIN` | Validar owner auth | `{ tableId, pin? }` | `PIN_REGENERATED`, `QR_DATA` o `ERROR` |

**Eventos SIN CAMBIOS**: `LIST_TABLES`, `GET_MATCH_STATE`, `LEAVE_TABLE`, `RECORD_POINT`, `SUBTRACT_POINT`, `UNDO_LAST`, `SET_SERVER`, `RESET_TABLE`, `REQUEST_TABLE_STATE`, `GET_TABLES_WITH_PINS`, `REF_ROLE_CHECK`

## 5) Reglas de negocio
- **RB-01**: PIN de mesa siempre 4 dígitos numéricos (1000-9999)
- **RB-02**: Owner PIN es obligatorio; si no se configura via env var, generar uno aleatorio criptográficamente seguro de 8 dígitos
- **RB-03**: Solo un referee activo por mesa; owner puede forzar cambio
- **RB-04**: Rate limiting: 5 intentos por IP por evento (`SET_REF`, `DELETE_TABLE`) en ventana de 60 segundos
- **RB-05**: Payloads validados antes de procesar; rechazar con `VALIDATION_ERROR` si no cumplen reglas
- **RB-06**: PIN encriptado con AES-256-GCM, salt aleatorio por generación de QR
- **RB-07**: Graceful shutdown: cerrar conexiones, limpiar estado, loguear evento
- **RB-08**: Errores no crashean el servidor; loguear y continuar operando

## 6) Seguridad y validaciones
### Autorizacion
- **Referee**: Verificado via PIN de mesa (4 dígitos)
- **Owner**: Verificado via `TOURNAMENT_OWNER_PIN` (env var o aleatorio)
- **Spectator**: Sin autenticación, pero validación de payloads

### Validacion de payloads
```typescript
// Ejemplo de validación para JOIN_TABLE
function validateJoinTable(data: any): void {
  if (!data?.tableId || typeof data.tableId !== 'string') {
    throw new ValidationError('tableId required');
  }
  if (data.name && (typeof data.name !== 'string' || data.name.length > 256)) {
    throw new ValidationError('name must be string <= 256 chars');
  }
  if (data.pin && !/^\d{4}$/.test(data.pin)) {
    throw new ValidationError('pin must be 4 digits');
  }
}
```

### Manejo de secretos/logs
- **NUNCA** loguear PINs en texto plano (excepto en startup si es aleatorio)
- **NUNCA** loguear owner PIN en logs accesibles a clientes
- **SIEMPRE** loguear con niveles: `info` (operaciones normales), `warn` (intentos fallidos), `error` (errores de sistema)
- **NUNCA** exponer `SUPABASE_SERVICE_ROLE_KEY` (no aplica en este proyecto, pero principio general)

## 7) Observabilidad
### Logs esperados (sin secretos)
```json
{"level":"info","time":"2026-04-11T10:00:00.000Z","msg":"rallyOS-hub started","port":3000}
{"level":"info","time":"2026-04-11T10:00:01.000Z","msg":"Table created","tableId":"abc-123","tableName":"Mesa 1"}
{"level":"warn","time":"2026-04-11T10:05:00.000Z","msg":"Invalid PIN attempt","tableId":"abc-123","ip":"192.168.1.100"}
{"level":"error","time":"2026-04-11T10:10:00.000Z","msg":"Uncaught exception","error":"TypeError: Cannot read property 'id' of undefined"}
```

### Metricas recomendadas
- Conexiones activas de socket
- Mesas activas
- Eventos procesados por segundo
- Errores de validación por tipo
- Intentos fallidos de PIN por IP

### Alertas basicas
- Si errores de validación > 10/min -> posible ataque o bug de cliente
- Si rate limit activado > 5/min -> posible brute-force
- Si servidor crashea -> reiniciar automáticamente (Docker restart policy)

## 8) Plan de implementacion tecnica
### Fase 1: Criptografia y autenticacion (P0)
1. Reemplazar `pinEncryption.ts` XOR con AES-256-GCM
2. Modificar `socketHandler.ts` para usar nueva encriptación
3. Hacer `TOURNAMENT_OWNER_PIN` obligatorio con fallback aleatorio
4. Actualizar `qrGenerator.ts` si es necesario
5. Tests: verificar encriptación/decriptación, owner PIN generation

### Fase 2: Rate limiting y validacion (P0/P1)
1. Implementar rate limiter por IP en `socketHandler.ts`
2. Crear `validation.ts` con reglas de validación
3. Agregar validación en todos los handlers de eventos
4. Tests: verificar rate limit por IP, payload validation

### Fase 3: Logging y graceful shutdown (P1)
1. Crear `logger.ts` con Pino
2. Reemplazar todos los `console.log/warn/error` con logger
3. Implementar graceful shutdown en `server.ts`
4. Agregar `process.on('uncaughtException')` y `process.on('unhandledRejection')`
5. Tests: verificar logs estructurados, graceful shutdown

### Fase 4: Refactor de arquitectura (P2)
1. Separar `index.ts` en `app.ts`, `server.ts`, `socket.ts`
2. Unificar `CONFIGURE_MATCH` y `START_MATCH`
3. Actualizar imports en todos los archivos
4. Tests E2E completos

### Fase 5: Testing y documentacion (P2)
1. Actualizar 6 tests existentes para que pasen
2. Agregar 4 nuevos tests (AES, owner PIN, rate limit IP, payload validation)
3. Documentar cambios en `docs/`
4. Deploy a Orange Pi y validación en LAN

## 9) Plan de migracion/compatibilidad
### Compatibilidad hacia atras
- **Eventos de socket**: Mantener nombres y estructuras de respuesta existentes
- **QR codes**: QRs generados con XOR viejo NO funcionarán con nueva encriptación AES. **Solución**: Regenerar todos los QRs al deployar nueva versión.
- **Owner PIN**: Si usuarios tienen `'00000'` configurado, seguirá funcionando si env var está seteda. Si no, se generará uno aleatorio.

### Feature flags
- No se necesitan feature flags para este hardening (todos los cambios son obligatorios)

### Estrategia de rollback
- Si algo falla, revertir a commit anterior y redeployar
- Docker Compose facilita rollback: `docker-compose down && docker-compose up -d` con imagen anterior

## 10) Plan de pruebas
### Unit tests
- `pinEncryption.ts`: encryptPin/decriptPin con AES-256-GCM, verificar formato `{iv}:{ciphertext}:{authTag}`
- `validation.ts`: validatePayload con datos válidos e inválidos
- `logger.ts`: verificar que logs sean JSON estructurado

### Integracion
- Rate limit por IP: simular múltiples sockets desde misma IP
- Owner PIN aleatorio: verificar que se genera si env var no está seteda
- Payload validation: verificar que eventos con payloads inválidos retornan `VALIDATION_ERROR`

### E2E/smoke
- Flujo completo: crear mesa -> join -> start match -> record point -> finish
- Owner verification con PIN aleatorio
- Regenerate PIN y verify old referee revoked
- Graceful shutdown: enviar SIGTERM, verificar cleanup

### Casos borde
- PIN con caracteres no numéricos -> reject
- Name con 1000 caracteres -> reject
- Múltiples sockets desde misma IP -> rate limit
- Server restart -> owner PIN aleatorio cambia (log en startup)

## 11) Riesgos tecnicos y trade-offs
- **Riesgo**: AES-256-GCM requiere manejo de IV y auth tag -> **mitigacion**: Usar `crypto.createCipheriv` y `crypto.createDecipheriv` con manejo explícito de IV y tag
- **Riesgo**: Rate limit por IP puede bloquear usuarios detras de NAT -> **mitigacion**: En LAN cada dispositivo tiene IP única, no aplica
- **Trade-off**: Separar `index.ts` aumenta modularidad pero agrega complejidad de inicialización -> **justificacion**: Beneficio de mantenibilidad supera costo (tests E2E catch regressions)
- **Trade-off**: Validación de payloads agrega overhead -> **justificacion**: Negligible (< 1ms por validación) vs beneficio de seguridad

## 12) Criterios de aceptacion tecnicos
- [ ] AES-256-GCM implementado y verificado en tests unitarios
- [ ] Owner PIN aleatorio generado si env var no está seteda, logueado en startup
- [ ] Rate limiting por IP funcionando, tests verifican bloqueo tras 5 intentos
- [ ] Payload validation en todos los 17 eventos de socket
- [ ] Pino logger reemplaza todos los `console.log/warn/error`
- [ ] Graceful shutdown implementado, tests verifican cleanup
- [ ] Manejo de errores globales implementado, servidor no crashea
- [ ] `index.ts` refactorizado en 3 módulos
- [ ] 10 tests de seguridad pasando (6 existentes + 4 nuevos)
- [ ] Zero `any` explícitos en TypeScript

## 13) Archivos impactados
### Modificados
- `server/src/index.ts` -> Reducido a orquestador
- `server/src/socketHandler.ts` -> Rate limit por IP, payload validation, logger
- `server/src/utils/pinEncryption.ts` -> AES-256-GCM en lugar de XOR
- `server/src/types.ts` -> Agregar tipos de validación

### Nuevos
- `server/src/app.ts` -> Express setup
- `server/src/server.ts` -> HTTPS server + graceful shutdown
- `server/src/socket.ts` -> Socket.IO setup
- `server/src/utils/validation.ts` -> Payload validation
- `server/src/utils/logger.ts` -> Pino logger setup

### Sin cambios
- `server/src/tableManager.ts`
- `server/src/matchEngine.ts`
- `server/src/utils/qrGenerator.ts` (solo uso interno, no lógica de encriptación)

### Tests
- `server/tests/security-test.ts` -> Actualizar para AES, owner PIN, rate limit IP
- `server/tests/security.spec.ts` -> Actualizar para rate limit por IP
- `server/tests/validation.spec.ts` -> NUEVO: tests de payload validation
- `server/tests/pinEncryption.spec.ts` -> NUEVO: tests de AES-256-GCM

---

**Estado:** Draft
**Owner tecnico:** raikenwolf
**Fecha:** 2026-04-11
**Version:** v0.1
