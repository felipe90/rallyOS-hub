# TODO - Security Regression Testing (POC LAN)

## Referencias
- PRD: `docs/prd-plans/SECURITY_TESTING_PRD.md`
- SDD: `docs/specs-sdd/SECURITY_TESTING_SDD.md`

## Convenciones
- Prioridad: P0 (critico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE

## Backlog por fases

### Fase 1 - P0 (backend contracts)
- [ ] (P0) Test: `TABLE_LIST`/`TABLE_UPDATE` no exponen `pin`  
  - Archivo(s): `server/src/socketHandler.test.ts` (nuevo)  
  - Criterio: asserts sobre payload sin campo `pin`  
  - Estado: TODO

- [ ] (P0) Test: creador de mesa queda autorizado como referee  
  - Archivo(s): `server/src/socketHandler.test.ts` (nuevo)  
  - Criterio: tras `CREATE_TABLE`, `START_MATCH` no retorna `UNAUTHORIZED` para mismo socket  
  - Estado: TODO

- [ ] (P0) Test: rate-limit en `SET_REF`  
  - Archivo(s): `server/src/socketHandler.test.ts` (nuevo)  
  - Criterio: intento 6 devuelve `RATE_LIMITED`  
  - Estado: TODO

- [ ] (P0) Test: rate-limit en `DELETE_TABLE`  
  - Archivo(s): `server/src/socketHandler.test.ts` (nuevo)  
  - Criterio: intento 6 devuelve `RATE_LIMITED`  
  - Estado: TODO

### Fase 2 - P1 (transport and frontend flow)
- [ ] (P1) Test de CORS allow/deny con origins representativos  
  - Archivo(s): `server/src/index.test.ts` (nuevo o adaptado)  
  - Criterio: origin permitido pasa, origin no permitido falla  
  - Estado: TODO

- [ ] (P1) Test frontend: flujo referee post-create no cae en `UNAUTHORIZED`  
  - Archivo(s): `client/src/pages/ScoreboardPage/ScoreboardPage.test.tsx`  
  - Criterio: simula flujo y valida que se emite `START_MATCH` en contexto autorizado  
  - Estado: TODO

### Fase 3 - P2 (stability and quality)
- [ ] (P2) Refactor de fixtures de `TableInfo` para contrato publico sin `pin`  
  - Archivo(s): `client/src/test/mocks/*`, tests relacionados  
  - Criterio: evitar duplicacion y drift de contratos  
  - Estado: TODO

- [ ] (P2) Ejecutar doble corrida de tests de seguridad para detectar flakiness  
  - Archivo(s): pipeline local/CI  
  - Criterio: 2 corridas seguidas verdes  
  - Estado: TODO

## Casos de prueba minimos
- [ ] Caso feliz: crear mesa e iniciar partido como creador
- [ ] Caso error esperado: `SET_REF` incorrecto repetido termina en `RATE_LIMITED`
- [ ] Caso borde: payload de mesa siempre sin `pin`
- [ ] Caso borde: origin no permitido bloqueado por CORS

## Checklist de release
- [ ] Tests backend agregados y pasando
- [ ] Tests frontend ajustados y pasando
- [ ] Suite completa sin regresiones
- [ ] Documentacion de testing actualizada

## Registro de avances
- 2026-04-09 - TODO inicial generado - AI assistant

---

**Owner:** rallyOS-hub team  
**Fecha inicio:** 2026-04-09  
**Estado general:** TODO
