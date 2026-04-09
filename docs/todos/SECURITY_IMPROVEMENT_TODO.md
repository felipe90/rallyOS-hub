# TODO - Security Improvement (POC LAN)

## Referencias
- PRD: `docs/prd-plans/SECURITY_IMPROVEMENT_PRD.md`
- SDD: `docs/specs-sdd/SECURITY_IMPROVEMENT_SDD.md`

## Convenciones
- Prioridad: P0 (critico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE

## Fase 1 - P0 (contencion inmediata)

- [ ] (P0) Remover `pin` de payload publico de mesas  
  - Archivo(s): `server/src/tableManager.ts`, `shared/types.ts`  
  - Criterio: `TABLE_LIST` y `TABLE_UPDATE` no incluyen campo `pin`  
  - Estado: TODO

- [ ] (P0) Quitar visualizacion de PIN en dashboard  
  - Archivo(s): `client/src/components/molecules/TableStatusChip/TableStatusChip.tsx`, `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx`  
  - Criterio: UI de dashboard no muestra PIN en tarjetas de mesa  
  - Estado: TODO

- [ ] (P0) Eliminar logs sensibles de PIN  
  - Archivo(s): `server/src/tableManager.ts`, `server/src/socketHandler.ts`  
  - Criterio: no existe log de `expected PIN`/`got PIN`  
  - Estado: TODO

## Fase 2 - P0/P1 (anti abuso)

- [ ] (P0) Implementar rate-limit in-memory para `SET_REF`  
  - Archivo(s): `server/src/socketHandler.ts` (y util auxiliar si aplica)  
  - Criterio: >5 intentos/60s por `tableId+socketId` retorna `RATE_LIMITED`  
  - Estado: TODO

- [ ] (P0) Implementar rate-limit in-memory para `DELETE_TABLE`  
  - Archivo(s): `server/src/socketHandler.ts`  
  - Criterio: >5 intentos/60s por `tableId+socketId` retorna `RATE_LIMITED`  
  - Estado: TODO

- [ ] (P1) Mensajes de error de limite claros para operacion  
  - Archivo(s): `server/src/socketHandler.ts`, `client/src/hooks/useSocket.ts`  
  - Criterio: usuario recibe error comprensible de bloqueo temporal  
  - Estado: TODO

## Fase 3 - P1 (configuracion segura LAN)

- [ ] (P1) Reemplazar CORS abierto por allowlist via env  
  - Archivo(s): `server/src/index.ts`, `.env.example`, `docker-compose.yml`  
  - Criterio: solo origenes en `HUB_ALLOWED_ORIGINS` pueden conectar  
  - Estado: TODO

- [ ] (P1) Definir defaults POC para allowlist  
  - Archivo(s): `.env.example`, docs de despliegue  
  - Criterio: incluye `localhost`, `orangepi.local`, IP LAN configurable  
  - Estado: TODO

## Fase 4 - P1/P2 (calidad y regresion)

- [ ] (P1) Actualizar tipos/mocks/tests por cambio de payload (`pin` removido)  
  - Archivo(s): `client/src/**/*.test.tsx`, `shared/types.ts`  
  - Criterio: suite relevante pasa sin dependencias de `table.pin` publico  
  - Estado: TODO

- [ ] (P2) Agregar pruebas de seguridad minimas (unit/integracion)  
  - Archivo(s): server tests / client tests  
  - Criterio: cobertura de casos `INVALID_PIN`, `RATE_LIMITED`, y no exposicion de `pin`  
  - Estado: TODO

## Casos de prueba minimos (smoke de torneo)
- [ ] Viewer ve mesas pero no PIN
- [ ] Referee con PIN correcto toma control
- [ ] 6 intentos fallidos seguidos bloquean temporalmente
- [ ] Origen no permitido falla por CORS
- [ ] Flujo de partido LIVE sigue estable en LAN

## Checklist de release
- [ ] Cambios implementados
- [ ] Tests ejecutados
- [ ] Logs sin secretos
- [ ] Documentacion actualizada
- [ ] Validacion funcional en entorno LAN objetivo

## Registro de avances
- 2026-04-09 - Documento inicial generado - AI assistant

---

**Owner:** rallyOS-hub team  
**Fecha inicio:** 2026-04-09  
**Estado general:** TODO
