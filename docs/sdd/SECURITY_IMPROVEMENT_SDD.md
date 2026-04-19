# SDD - Security Improvement (POC LAN)

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/SECURITY_IMPROVEMENT_PRD.md`
- Objetivos cubiertos:
  - Evitar exposicion de PIN en flujos globales.
  - Mitigar fuerza bruta en acciones sensibles.
  - Eliminar secretos en logs.
  - Restringir origenes permitidos (CORS) para torneo LAN.

## 2) Arquitectura actual (AS-IS)
- Backend con `Express + Socket.io` sobre HTTPS self-signed.
- `TableInfo` incluye `pin` y se emite globalmente en `TABLE_LIST`/`TABLE_UPDATE`.
- Eventos sensibles (`SET_REF`, `DELETE_TABLE`) sin rate-limit.
- CORS abierto (`origin` permitido para cualquier origen).
- Logs incluyen datos sensibles de PIN.

## 3) Arquitectura propuesta (TO-BE)
- Modelo de datos publico (`TableInfoPublic`) sin `pin`.
- Emision global solo con data publica de mesas.
- Rate limiter in-memory para `SET_REF` y `DELETE_TABLE`.
- CORS controlado por allowlist configurable con env.
- Logging seguro, sin imprimir secretos.

## 4) Diseño de datos y contratos

### 4.1 Tipos/Modelos
- `TableInfo` (interno) mantiene `pin` para logica servidor.
- `TableInfoPublic` (emitido a clientes globales) elimina `pin`.
- `RateLimitKey`: combinacion `event + tableId + socketId`.
- `RateLimitState`: `{ attempts, firstAttemptAt, blockedUntil }`.

### 4.2 Eventos Socket
- `TABLE_LIST` -> envia solo `TableInfoPublic[]`.
- `TABLE_UPDATE` -> envia solo `TableInfoPublic`.
- `SET_REF`:
  - input: `{ tableId, pin }`
  - salida OK: `REF_SET`
  - salida error: `INVALID_PIN` o `RATE_LIMITED`
- `DELETE_TABLE`:
  - input: `{ tableId, pin }`
  - salida error: `INVALID_PIN`, `RATE_LIMITED`, `TABLE_NOT_FOUND`

## 5) Reglas de negocio
- RB-01: Nunca exponer PIN en payloads globales.
- RB-02: El PIN solo se usa para validacion en servidor.
- RB-03: Intentos excesivos activan bloqueo temporal por key de rate-limit.
- RB-04: CORS solo permite origenes declarados.
- RB-05: Logs no deben incluir PIN ni comparaciones sensibles.

## 6) Seguridad y validaciones
- Validar payload minimo en eventos sensibles (`tableId`, `pin`).
- Aplicar rate-limit antes de validar PIN para evitar enumeracion.
- Devolver errores neutros cuando aplique (`RATE_LIMITED`).
- Mantener autorizacion server-side como fuente de verdad.

## 7) Observabilidad
- Logs esperados:
  - `Rate limit hit on SET_REF for table <id>`
  - `Invalid referee auth attempt for table <id>`
- Metricas basicas (in-memory o logs contables):
  - `invalid_pin_count`
  - `rate_limited_count`
  - `set_ref_success_count`

## 8) Plan de implementacion tecnica

### Fase 1 - Payloads y UI
- Backend: remover `pin` de serializacion publica de mesa.
- Frontend: eliminar render de PIN en dashboard y consumo de `table.pin` en listados.

### Fase 2 - Rate limiting
- Crear util in-memory para limites por evento/mesa/socket.
- Integrar en `SET_REF` y `DELETE_TABLE`.

### Fase 3 - CORS y logs
- Reemplazar CORS abierto por allowlist via `HUB_ALLOWED_ORIGINS`.
- Sanitizar logs de `tableManager` y handlers de auth.

## 9) Compatibilidad y rollout
- Compatibilidad: clientes que dependian de `table.pin` en dashboard deben migrar.
- Rollout recomendado:
  1. Deploy en entorno de prueba LAN.
  2. Smoke test con referee + viewer.
  3. Deploy en entorno de torneo.
- Rollback: revertir cambios de payload/rate-limit en caso de bloqueo operativo.

## 10) Plan de pruebas
- Unit:
  - serializacion publica de mesa no incluye `pin`.
  - rate-limit bloquea tras N intentos.
- Integracion:
  - viewer no puede obtener PIN via `TABLE_LIST`.
  - `SET_REF` funciona con PIN correcto.
  - `SET_REF` bloquea tras exceso de intentos.
  - origen no permitido falla en handshake CORS.
- Smoke manual:
  - marcador funcional en vivo sin latencia extra perceptible.

## 11) Riesgos tecnicos y trade-offs
- Riesgo: romper tests/UI existentes al quitar `pin` publico.
  - Mitigacion: actualizar tipos y mocks de frontend.
- Riesgo: bloquear referee legitimo por errores de tipeo.
  - Mitigacion: ventana de rate-limit corta + mensaje claro.
- Riesgo: origen legitimo no incluido en allowlist.
  - Mitigacion: defaults para `localhost`, `orangepi.local`, IP LAN.

## 12) Criterios de aceptacion tecnicos
- [ ] `TABLE_LIST` y `TABLE_UPDATE` no exponen `pin`.
- [ ] `SET_REF` y `DELETE_TABLE` aplican rate-limit efectivo.
- [ ] CORS permite solo origenes configurados.
- [ ] No hay logs con valores de PIN.
- [ ] Flujos de arbitro/espectador siguen operativos en LAN.

## 13) Archivos impactados (estimado)
- `server/src/tableManager.ts`
- `server/src/socketHandler.ts`
- `server/src/index.ts`
- `client/src/components/molecules/TableStatusChip/TableStatusChip.tsx`
- `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx`
- `client/src/pages/DashboardPage/DashboardPage.tsx`
- `shared/types.ts` (si se separa modelo publico/privado)

---

**Estado:** Ready  
**Owner tecnico:** rallyOS-hub team  
**Fecha:** 2026-04-09  
**Version:** v1.0
