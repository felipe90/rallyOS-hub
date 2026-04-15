# TODO - Quick Fixes: Crypto Imports, CORS, Server Console Cleanup

## Referencias
- PRD: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- SDD: `docs/specs-sdd/SDD_QUICK_FIXES_CRYPTO_CORS_CONSOLE.md`

## Convenciones
- Prioridad: P0 (critico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea debe tener criterio de finalizacion verificable.

## Backlog por fases

### Fase 1 - P0: Crypto imports
- [x] (P0) Agregar `import crypto from 'crypto'` en `tableManager.ts`
  - Archivo(s): `server/src/tableManager.ts`
  - Criterio: `npm run build` pasa, `crypto.randomUUID()` en línea ~315 tiene import disponible
  - Estado: DONE

- [x] (P0) Agregar `import crypto from 'crypto'` en `matchEngine.ts`
  - Archivo(s): `server/src/matchEngine.ts`
  - Criterio: `npm run build` pasa, `crypto.randomUUID()` en línea ~98 tiene import disponible
  - Estado: DONE

### Fase 2 - P0: CORS unificado
- [x] (P0) Crear `server/src/config/allowedOrigins.ts` con export único de `effectiveAllowedOrigins` y `defaultAllowedOrigins`
  - Archivo(s): `server/src/config/allowedOrigins.ts` (nuevo), `server/src/config/` (dir nueva)
  - Criterio: El módulo exporta el array parseado de `HUB_ALLOWED_ORIGINS` con fallback a defaults
  - Estado: DONE

- [x] (P0) Reemplazar definición inline de `effectiveAllowedOrigins` en `app.ts` por import del módulo compartido
  - Archivo(s): `server/src/app.ts`
  - Criterio: No hay definición inline de origins en app.ts, solo import desde config/allowedOrigins
  - Estado: DONE

- [x] (P0) Reemplazar definición inline de `effectiveAllowedOrigins` en `server.ts` por import del módulo compartido
  - Archivo(s): `server/src/server.ts`
  - Criterio: No hay definición inline de origins en server.ts, solo import desde config/allowedOrigins
  - Estado: DONE

- [ ] (P0) Escribir tests unitarios para `config/allowedOrigins.ts`
  - Archivo(s): `server/src/config/allowedOrigins.test.ts` (nuevo)
  - Criterio: Tests para: env seteado, sin env, con espacios, env vacío → defaults
  - Estado: TODO (funcionalidad verificada manualmente)

### Fase 3 - P1: Server console cleanup
- [x] (P1) Reemplazar `console.log` en `index.ts` por `logger.info` / `logger.warn`
  - Archivo(s): `server/src/index.ts`
  - Criterio: Cero `console.log` en el archivo, Owner PIN se loguea vía logger (será redactado por Pino)
  - Estado: DONE

- [x] (P1) Reemplazar `console.error` en `server.ts` (`validateCertificates`) por `logger.error` + `process.exit(1)`
  - Archivo(s): `server/src/server.ts`
  - Criterio: Error de certificados se loguea estructurado antes de salir
  - Estado: DONE

- [x] (P1) Reemplazar `console.error` en `qrGenerator.ts` por `logger.error`
  - Archivo(s): `server/src/utils/qrGenerator.ts`
  - Criterio: Cero `console.error` en el archivo
  - Estado: DONE

## Casos de prueba minimos
- [ ] Crypto imports: `npm run build` pasa sin errores en server
- [ ] CORS unificado: `allowedOrigins` tests pasan (4 tests mínimo)
- [ ] Console cleanup: grep `console\.` en `server/src/**/*.ts` (excluyendo tests) devuelve 0 resultados
- [ ] Build final: `npm run build` + `npm run lint` pasan sin errores

## Checklist de release
- [ ] Cambios implementados
- [ ] Tests ejecutados (`npm run test`)
- [ ] Logs sin secretos (verificar que Owner PIN aparece como `[REDACTED]` en logs)
- [ ] Documentacion actualizada (SDD y PRD marcados como completados)
- [ ] Validacion funcional en entorno objetivo (npm run dev en local, HTTPS funciona)

## Registro de avances
- 2026-04-14 - PRD, SDD y TODO creados - Asistente

---

**Owner:** Por definir
**Fecha inicio:** 2026-04-14
**Estado general:** DONE ✅ (2026-04-15)
