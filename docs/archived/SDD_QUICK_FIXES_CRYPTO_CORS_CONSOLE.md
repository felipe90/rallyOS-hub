# SDD - Quick Fixes: Crypto Imports, CORS Unification, Server Console Cleanup

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- Objetivos cubiertos:
  - **Meta 1:** 100% de imports `crypto` resueltos
  - **Meta 6:** Cero `console.log` en producción (parte server)
  - RF-06 (reemplazo de console.log por logger)
  - Criterio DoD: build sin errores en Docker, grep de console. pasa

## 2) Arquitectura actual (AS-IS)
### Componentes involucrados
- `server/src/tableManager.ts` — llama a `crypto.randomUUID()` en línea ~315 **sin import**
- `server/src/matchEngine.ts` — llama a `crypto.randomUUID()` en línea ~98 **sin import**
- `server/src/app.ts` — define `effectiveAllowedOrigins` inline (array duplicado)
- `server/src/server.ts` — define `effectiveAllowedOrigins` inline (array idéntico duplicado)
- `server/src/index.ts` — usa `console.log` para imprimir el Owner PIN al arranque
- `server/src/utils/qrGenerator.ts` — usa `console.error` en vez de `logger`
- `server/src/server.ts` — usa `process.exit(1)` en `validateCertificates()` sin logger

### Limitaciones actuales
- Los imports faltantes de `crypto` funcionan por un quirk de Node.js pero fallarán en ESM strict o entornos donde los built-ins no se auto-resuelven.
- CORS allowed origins duplicado: si se cambia en un archivo y no en el otro, hay un gap de seguridad.
- `console.log` bypassa el logger estructurado (Pino), no tiene niveles, no redacta campos sensibles, y ensucia stdout.

## 3) Arquitectura propuesta (TO-BE)
### Cambios
- **Crypto imports:** Agregar `import crypto from 'crypto'` en los 3 archivos que lo usan sin importar.
- **CORS unificado:** Crear `server/src/config/allowedOrigins.ts` con un solo `export const effectiveAllowedOrigins`. Importar desde `app.ts` y `server.ts`. Eliminar la definición inline duplicada.
- **Console cleanup:** Reemplazar `console.log` en `index.ts` por `logger.info`. Reemplazar `console.error` en `qrGenerator.ts` por `logger.error`. Reemplazar `process.exit(1)` en `server.ts` por `logger.error` + `process.exit(1)`.

```
server/src/
  config/
    allowedOrigins.ts     <-- NUEVO: único origen de verdad
  app.ts                  <-- importa effectiveAllowedOrigins
  server.ts               <-- importa effectiveAllowedOrigins
  index.ts                <-- usa logger en vez de console.log
  utils/
    qrGenerator.ts        <-- usa logger en vez de console.error
```

## 4) Diseño de datos y contratos
### 4.1 Nuevo módulo: `config/allowedOrigins.ts`
```typescript
export const effectiveAllowedOrigins: string[] = (
  process.env.HUB_ALLOWED_ORIGINS || ''
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Fallback defaults si env está vacío
export const defaultAllowedOrigins: string[] = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  'http://orangepi.local:3000',
  'https://orangepi.local:3000',
];
```

### 4.2 Sin cambios en API/eventos
Este SDD no modifica ningún endpoint, evento de socket, o contrato público. Es puramente refactor interno.

## 5) Reglas de negocio
- **RB-01:** `effectiveAllowedOrigins` siempre se lee de `HUB_ALLOWED_ORIGINS` env var. Si no está definido, usa defaults.
- **RB-02:** Owner PIN se loguea al arranque con `logger.info` (será redactado en logs por la configuración de redaction de Pino).
- **RB-03:** Si los certificados SSL no existen, el server loguea el error con `logger.error` y luego sale con `process.exit(1)`.

## 6) Seguridad y validaciones
- **CORS:** La unificación no cambia la lógica de validación de origins, solo elimina la duplicación. El comportamiento funcional es idéntico.
- **Owner PIN:** `logger.info` para el PIN al arranque — Pino ya tiene `pin` y `ownerPin` en su lista de `redact`, así que el PIN quedará como `[REDACTED]` en los logs. Esto es **mejor** que `console.log` que lo expone en texto plano.
- **Sin nuevos vectores:** No se agregan endpoints ni se modifica la superficie de ataque.

## 7) Observabilidad
### Logs esperados
- `index.ts`: `logger.info({ ownerPin: '[REDACTED]' }, 'Owner PIN initialized')` — el PIN será redactado automáticamente.
- `server.ts`: `logger.error('SSL certificates not found: ...')` antes de `process.exit(1)`.
- `qrGenerator.ts`: `logger.error({ error }, 'Failed to generate QR code')` en vez de `console.error`.

### Sin métricas nuevas
Los cambios son internos, no afectan métricas de negocio.

## 8) Plan de implementacion tecnica
### Fase 1: Crypto imports (server)
1. Agregar `import crypto from 'crypto'` en `tableManager.ts` (arriba de todo, junto a los otros imports)
2. Agregar `import crypto from 'crypto'` en `matchEngine.ts`
3. Verificar si `qrGenerator.ts` usa crypto (si no, ignorar)
4. `npm run build` para verificar compilación

### Fase 2: CORS unificado (server)
1. Crear `server/src/config/allowedOrigins.ts`
2. Reemplazar la definición inline en `app.ts` por import del nuevo módulo
3. Reemplazar la definición inline en `server.ts` por import del nuevo módulo
4. Exportar `effectiveAllowedOrigins` desde `app.ts` si hay consumidores externos (buscar referencias)
5. `npm run build` para verificar

### Fase 3: Console cleanup (server)
1. Reemplazar `console.log` en `index.ts` por `logger.info` / `logger.warn`
2. Reemplazar `console.error` en `qrGenerator.ts` por `logger.error`
3. Reemplazar `console.error` en `server.ts` (`validateCertificates`) por `logger.error` + `process.exit(1)`
4. `npm run build` para verificar
5. `npm run lint` para verificar sin errores de lint

## 9) Plan de migracion/compatibilidad
- **Sin breaking changes:** Ningún cambio afecta el comportamiento externo del server.
- **Sin feature flags:** Son fixes internos, no requieren toggles.
- **Rollback trivial:** Si algo falla, revertir los commits. No hay migración de datos ni cambios de schema.
- **Compatibilidad hacia atrás:** El módulo `allowedOrigins.ts` exporta los mismos valores que antes, solo que desde un solo lugar.

## 10) Plan de pruebas
### Unit tests
- `config/allowedOrigins.test.ts`:
  - Con `HUB_ALLOWED_ORIGINS` seteado → devuelve los origins parseados
  - Sin env var → devuelve defaults
  - Con env var con espacios → trim correcto
  - Con env var vacío → defaults

### Integración
- No aplica para crypto imports (son imports puros)
- No aplica para console cleanup (cambios de logging)

### E2E/smoke
- `npm run build` debe pasar en Docker (Node 22 Alpine)
- `npm run dev` debe arrancar sin errores
- `npm run lint` debe pasar sin errores

### Casos borde
- Certificados SSL inexistentes → server debe loguear error y salir limpiamente
- Owner PIN sin env var → se genera random, se loguea (redactado)

## 11) Riesgos tecnicos y trade-offs
- **Riesgo 1:** `import crypto from 'crypto'` puede no funcionar en algunos entornos ESM -> **Mitigación:** Usar `import * as crypto from 'crypto'` si el default import falla. Verificar con `npm run build` en Docker.
- **Riesgo 2:** `logger.info` redacta `ownerPin` automáticamente -> **Esto es un beneficio, no un riesgo.** El PIN ya no se expone en logs.
- **Trade-off:** Crear `config/allowedOrigins.ts` agrega un archivo más al proyecto -> **Justificación:** Elimina duplicación en 2 archivos y centraliza un punto de cambio de seguridad. El costo de 1 archivo extra es marginal vs el riesgo de inconsistencia CORS.

## 12) Criterios de aceptacion tecnicos
- [ ] `server/src/tableManager.ts` tiene `import crypto from 'crypto'`
- [ ] `server/src/matchEngine.ts` tiene `import crypto from 'crypto'`
- [ ] `server/src/config/allowedOrigins.ts` existe y es el único lugar donde se definen los origins
- [ ] `server/src/app.ts` importa `effectiveAllowedOrigins` del módulo compartido
- [ ] `server/src/server.ts` importa `effectiveAllowedOrigins` del módulo compartido
- [ ] Cero `console.log` o `console.error` en `server/src/**/*.ts` (excluyendo `tests/`)
- [ ] `npm run build` del server pasa sin errores
- [ ] `npm run lint` del server pasa sin errores
- [ ] `config/allowedOrigins.test.ts` existe y pasa todos los tests

## 13) Archivos impactados
### Nuevos
- `server/src/config/allowedOrigins.ts` — único origen de allowed origins
- `server/src/config/allowedOrigins.test.ts` — tests unitarios

### Modificados
- `server/src/tableManager.ts` — agregar import crypto
- `server/src/matchEngine.ts` — agregar import crypto
- `server/src/app.ts` — importar allowedOrigins, eliminar definición inline
- `server/src/server.ts` — importar allowedOrigins, eliminar definición inline, reemplazar console.error por logger
- `server/src/index.ts` — reemplazar console.log por logger
- `server/src/utils/qrGenerator.ts` — reemplazar console.error por logger

---

**Estado:** Draft
**Owner tecnico:** Por definir
**Fecha:** 2026-04-14
**Version:** v0.1
