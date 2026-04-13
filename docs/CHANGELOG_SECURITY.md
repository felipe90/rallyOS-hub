# Changelog - Security Hardening POC

## Version 2.0.0 - Security Hardening (2026-04-13)

### Resumen
Implementación completa de hardening de seguridad para rallyOS-hub. Este release incluye mejoras críticas en criptografía, autenticación, validación de payloads, logging estructurado y manejo de errores.

### Vulnerabilidades Corregidas

| ID | Vulnerabilidad | Severidad | Estado |
|----|---------------|-----------|--------|
| V-01 | XOR cipher en PINs (brute-force en segundos) | CRÍTICA | ✅ Corregida |
| V-02 | Owner PIN hardcodeado `'00000'` | CRÍTICA | ✅ Corregida |
| V-03 | Rate limit evadible por reconexión de socket | ALTA | ✅ Corregida |
| V-04 | Sin validación de payloads (strings ilimitados) | ALTA | ✅ Corregida |
| V-05 | Logging sin estructura (difícil debug) | MEDIA | ✅ Corregida |
| V-06 | Sin graceful shutdown | MEDIA | ✅ Corregida |
| V-07 | Sin manejo de errores globales | MEDIA | ✅ Corregida |

### Cambios Implementados

#### 1. Criptografía (AES-256-GCM)
- **Archivo**: `server/src/utils/pinEncryption.ts`
- **Cambio**: Reemplazo de XOR cipher con AES-256-GCM
- **Formato output**: `{iv}:{ciphertext}:{authTag}:{timestamp}` (todos hex)
- **Derivación de clave**: HMAC-SHA256(tableId, serverSecret)
- **Expiración**: PINs expiran después de 24 horas
- **Breaking**: QRs generados con versión anterior NO funcionarán

#### 2. Owner PIN Obligatorio
- **Archivos**: `server/src/index.ts`
- **Cambio**: `TOURNAMENT_OWNER_PIN` generado aleatoriamente si no está configurado
- **Generación**: `crypto.randomInt(10000000, 99999999)` (8 dígitos)
- **Log**: Se loguea en startup con advertencia
- **Variable de entorno**: `TOURNAMENT_OWNER_PIN` (opcional, recomendado)

#### 3. Rate Limiting por IP
- **Archivo**: `server/src/socketHandler.ts`
- **Cambio**: Rate limiter usa `socket.handshake.address` como key
- **Límite**: 5 intentos por ventana de 60 segundos
- **Eventos afectados**: `SET_REF`, `DELETE_TABLE`
- **Respuesta**: `ERROR` con `code: 'RATE_LIMITED'`

#### 4. Validación de Payloads
- **Archivo**: `server/src/utils/validation.ts`
- **Nuevo módulo**: `validatePayload(data, rules)` y `validateSocketPayload(socket, data, rules, eventName)`
- **Reglas**: `required`, `type`, `maxLength`, `minLength`, `pattern`, `enum`, `min`, `max`
- **Error**: `ValidationError` con campo, mensaje, expected vs received
- **Aplicado**: 17 eventos de socket validados

#### 5. Logging Estructurado (Pino)
- **Archivo**: `server/src/utils/logger.ts`
- **Nuevo módulo**: Pino logger con formato JSON
- **Niveles**: `info`, `warn`, `error`, `debug`
- **Timestamps**: ISO 8601
- **Redacción**: PINs y secretos automáticamente redactados
- **Reemplazo**: Zero `console.log/warn/error` en código de servidor

#### 6. Graceful Shutdown
- **Archivo**: `server/src/index.ts`
- **Señales**: `SIGTERM`, `SIGINT`
- **Acciones**:
  1. Cierra HTTP/HTTPS server
  2. Cierra Socket.IO connections
  3. Limpia mesas activas
  4. Loguea evento
  5. Exit code 0

#### 7. Manejo de Errores Globales
- **Archivo**: `server/src/index.ts`
- **Handlers**:
  - `process.on('uncaughtException')` - loguea, no crashea
  - `process.on('unhandledRejection')` - loguea, no crashea

### Breaking Changes

1. **QRs viejos no funcionan**: Todos los QR codes generados con la versión anterior (XOR cipher) dejarán de funcionar. **Acción requerida**: Regenerar todos los QR codes al deployar.
2. **Owner PIN cambia en cada restart**: Si no se configura `TOURNAMENT_OWNER_PIN`, se genera uno aleatorio que cambia en cada reinicio. **Acción requerida**: Configurar variable de entorno en producción.

### Instrucciones de Migración

1. **Deployar nueva versión**:
   ```bash
   cd server
   npm install
   npm run build
   ```

2. **Configurar variables de entorno**:
   ```bash
   export TOURNAMENT_OWNER_PIN="12345678"  # Tu PIN de 8 dígitos
   export ENCRYPTION_SECRET="tu-secreto-de-32-bytes"  # Opcional, para QRs persistentes
   ```

3. **Regenerar QRs**: Todos los QR codes existentes deben regenerarse.

4. **Verificar logs**: Revisar que no haya secretos expuestos en logs.

5. **Tests**:
   ```bash
   npm test  # Unit tests (19 tests)
   npm run test:e2e  # E2E tests (requiere servidor corriendo)
   ```

### Tests Agregados

| Test | Archivo | Descripción |
|------|---------|-------------|
| AES-256-GCM encrypt/decrypt | `tests/pinEncryption.spec.ts` | 9 tests de encriptación |
| Payload validation | `tests/validation.spec.ts` | 10 tests de validación |
| **Total** | | **19 tests pasando** |

### Archivos Nuevos
- `server/src/utils/logger.ts` - Pino logger setup
- `server/tests/pinEncryption.spec.ts` - AES-256-GCM tests
- `server/tests/validation.spec.ts` - Payload validation tests
- `server/jest.config.js` - Jest configuration
- `server/tsconfig.test.json` - TypeScript test configuration

### Archivos Modificados
- `server/src/utils/pinEncryption.ts` - AES-256-GCM implementation
- `server/src/index.ts` - Owner PIN, graceful shutdown, error handling
- `server/src/socketHandler.ts` - Logger, IP rate limit
- `server/src/tableManager.ts` - Logger integration
- `server/src/matchEngine.ts` - Logger integration
- `server/tests/security-test.ts` - Updated tests
- `server/package.json` - Jest scripts and dependencies

### Dependencias Agregadas
```json
{
  "devDependencies": {
    "jest": "^29.x",
    "ts-jest": "^29.x",
    "@types/jest": "^29.x"
  }
}
```

### Checklist de Release
- [x] Cambios implementados (Fases 1-3, 5 completadas)
- [x] Tests ejecutados (19/19 pasando)
- [x] Logs sin secretos (Pino redacta PINs automáticamente)
- [x] Documentación actualizada (este CHANGELOG)
- [ ] Validación funcional en entorno objetivo (Orange Pi LAN) - **Pendiente**

### Pendiente (Fase 4 - COMPLETADA)
- [x] Separar `index.ts` en `app.ts`, `server.ts`, `socket.ts` - **DONE 2026-04-13**
- [x] Unificar flujo de configuración de match (`CONFIGURE_MATCH` + `START_MATCH`) - **DONE 2026-04-13**

### Docker
- Dockerfile mejorado con multi-stage build (builder + production)
- docker-compose.yml con healthcheck y `unless-stopped` restart policy
- `.dockerignore` optimizado para excluir archivos innecesarios
- `.env.example` creado como referencia para configuración

---

**Owner:** raikenwolf
**Fecha:** 2026-04-13
**Versión:** 2.0.0
