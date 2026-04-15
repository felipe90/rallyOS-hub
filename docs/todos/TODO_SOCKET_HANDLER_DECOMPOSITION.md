# TODO - Descomposición de SocketHandler

## Referencias
- PRD: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- SDD: `docs/specs-sdd/SDD_SOCKET_HANDLER_DECOMPOSITION.md`

## Convenciones
- Prioridad: P0 (critico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea debe tener criterio de finalizacion verificable.

## Backlog por fases

### Fase 0 - P0: Tests de humo pre-descomposición
- [ ] (P0) Escribir tests de humo para socketHandler.ts actual (antes de tocar)
  - Archivo(s): `server/tests/socketHandler-smoke.spec.ts`
  - Criterio: Tests que emiten eventos clave (CREATE_TABLE, LIST_TABLES, SET_REF, RECORD_POINT) y verifican respuestas básicas
  - Estado: TODO

### Fase 1 - P0: Crear base y estructura
- [ ] (P0) Crear `server/src/handlers/SocketHandlerBase.ts` con rate limiting, toPublicTableInfo, getPublicTableList
  - Archivo(s): `server/src/handlers/SocketHandlerBase.ts` (nuevo)
  - Criterio: Clase abstracta con io, tableManager, ownerPin, isRateLimited, toPublicTableInfo, getPublicTableList
  - Estado: TODO

- [ ] (P0) Crear directorio `server/src/handlers/` y archivo index.ts
  - Archivo(s): `server/src/handlers/index.ts` (nuevo)
  - Criterio: Barrel export de todos los handlers
  - Estado: TODO

### Fase 2 - P0: Extraer TableEventHandler
- [ ] (P0) Crear `server/src/handlers/TableEventHandler.ts` con 6 eventos
  - Archivo(s): `server/src/handlers/TableEventHandler.ts` (nuevo)
  - Criterio: CREATE_TABLE, LIST_TABLES, GET_TABLES_WITH_PINS, JOIN_TABLE, LEAVE_TABLE, DELETE_TABLE. Extiende SocketHandlerBase. ≤200 líneas
  - Estado: TODO

- [ ] (P0) Tests unitarios para TableEventHandler
  - Archivo(s): `server/tests/TableEventHandler.spec.ts` (nuevo)
  - Criterio: ≥70% cobertura, tests para cada evento (happy path + error path)
  - Estado: TODO

### Fase 3 - P0: Extraer MatchEventHandler
- [ ] (P0) Crear `server/src/handlers/MatchEventHandler.ts` con 7 eventos
  - Archivo(s): `server/src/handlers/MatchEventHandler.ts` (nuevo)
  - Criterio: CONFIGURE_MATCH, START_MATCH, RECORD_POINT, SUBTRACT_POINT, UNDO_LAST, SET_SERVER, RESET_TABLE. Extiende SocketHandlerBase. ≤200 líneas
  - Estado: TODO

- [ ] (P0) Tests unitarios para MatchEventHandler
  - Archivo(s): `server/tests/MatchEventHandler.spec.ts` (nuevo)
  - Criterio: ≥70% cobertura, tests para cada evento (happy path + unauthorized)
  - Estado: TODO

### Fase 4 - P1: Extraer AuthHandler
- [ ] (P1) Crear `server/src/handlers/AuthHandler.ts` con 2 eventos
  - Archivo(s): `server/src/handlers/AuthHandler.ts` (nuevo)
  - Criterio: SET_REF, VERIFY_OWNER. Extiende SocketHandlerBase. ≤200 líneas
  - Estado: TODO

- [ ] (P1) Tests unitarios para AuthHandler
  - Archivo(s): `server/tests/AuthHandler.spec.ts` (nuevo)
  - Criterio: ≥70% cobertura, tests para SET_REF (correcto, incorrecto, ref existente, owner takeover), VERIFY_OWNER
  - Estado: TODO

### Fase 5 - P1: Extraer AdminHandler
- [ ] (P1) Crear `server/src/handlers/AdminHandler.ts` con 3 eventos
  - Archivo(s): `server/src/handlers/AdminHandler.ts` (nuevo)
  - Criterio: REGENERATE_PIN, REQUEST_TABLE_STATE, GET_RATE_LIMIT_STATUS. Extiende SocketHandlerBase. ≤200 líneas
  - Estado: TODO

- [ ] (P1) Tests unitarios para AdminHandler
  - Archivo(s): `server/tests/AdminHandler.spec.ts` (nuevo)
  - Criterio: ≥70% cobertura, tests para cada evento
  - Estado: TODO

### Fase 6 - P1: Refactorizar SocketHandler como orchestrador
- [ ] (P1) Reemplazar `socketHandler.ts` con versión orchestradora
  - Archivo(s): `server/src/socketHandler.ts`
  - Criterio: Solo instancia los 4 handlers. Mantiene onTableUpdate y onMatchEvent globales. ≤50 líneas
  - Estado: TODO

- [ ] (P1) Verificar que tests de humo pre-descomposición siguen pasando
  - Archivo(s): `server/tests/socketHandler-smoke.spec.ts`
  - Criterio: Tests pasan sin modificaciones
  - Estado: TODO

- [ ] (P1) Verificar que tests E2E existentes siguen pasando
  - Archivo(s): `server/tests/security.spec.ts`, `server/tests/match-logic.spec.ts`
  - Criterio: Tests pasan sin modificaciones
  - Estado: TODO

## Casos de prueba minimos
- [ ] CREATE_TABLE → TABLE_CREATED emitido, referee seteado
- [ ] LIST_TABLES → TABLE_LIST emitido
- [ ] SET_REF con PIN correcto → REF_SET emitido
- [ ] SET_REF con PIN incorrecto → INVALID_PIN error
- [ ] RECORD_POINT como referee → MATCH_UPDATE emitido
- [ ] RECORD_POINT como no-referee → UNAUTHORIZED error
- [ ] GET_TABLES_WITH_PINS sin owner → NOT_OWNER error

## Checklist de release
- [ ] Cambios implementados (4 handlers extraídos, orchestrador funcionando)
- [ ] Tests ejecutados (`npm run test` — 0 fallos, ≥70% cobertura por handler)
- [ ] Logs sin secretos (rate limiting logs no exponen IPs sensibles)
- [ ] Documentacion actualizada (SDD y PRD marcados como completados)
- [ ] Validacion funcional en entorno objetivo (npm run dev, eventos de socket funcionan)

## Registro de avances
- 2026-04-14 - PRD, SDD y TODO creados - Asistente

---

**Owner:** Por definir
**Fecha inicio:** 2026-04-14
**Estado general:** TODO
