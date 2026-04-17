# SDD - Security Regression Test Design (POC LAN)

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/SECURITY_TESTING_PRD.md`
- Objetivos cubiertos:
  - Blindar regresiones funcionales causadas por hardening.
  - Validar contratos de seguridad backend.
  - Validar continuidad del flujo de referee.

## 2) Arquitectura actual (AS-IS)
- Backend emite eventos Socket para gestion de mesas y acciones de partido.
- Frontend consume eventos via `useSocket` y flujo de scoreboard.
- Existen tests unitarios/componentes en cliente, pero faltan casos de seguridad de contratos recientes.

## 3) Arquitectura propuesta (TO-BE)
- Agregar una capa de tests de regresion de seguridad en dos niveles:
  1. **Backend contract tests** (payloads/auth/rate-limit/CORS).
  2. **Frontend flow tests** para `CREATE_TABLE -> START_MATCH`.

## 4) Diseño de datos y contratos
### 4.1 Modelos/Tipos bajo prueba
- `TableInfo` publico sin `pin`.
- Eventos de error con `code`:
  - `UNAUTHORIZED`
  - `INVALID_PIN`
  - `RATE_LIMITED`

### 4.2 Contratos/eventos criticos
- `TABLE_LIST` / `TABLE_UPDATE` no incluyen `pin`.
- `CREATE_TABLE` promueve al creador a referee para su mesa.
- `SET_REF` y `DELETE_TABLE` respetan limite de intentos.
- CORS permite solo origenes allowlist.

## 5) Reglas de negocio a validar
- RB-01: Nunca exponer PIN en payloads globales.
- RB-02: Creador de mesa debe poder iniciar partido sin autenticacion manual adicional en POC.
- RB-03: Exceso de intentos en auth/operaciones sensibles debe bloquear temporalmente.
- RB-04: Origen no permitido no debe operar contra el servidor.

## 6) Seguridad y validaciones
- Validacion de errores semanticos (`RATE_LIMITED`, `UNAUTHORIZED`).
- Validacion de sanitizacion de payload.
- Validacion de comportamiento CORS en origen permitido/no permitido.

## 7) Observabilidad de pruebas
- Registrar en test outputs:
  - payload recibido en `TABLE_LIST/TABLE_UPDATE`
  - codigos de error emitidos por servidor
- Evitar logs de secretos en fixtures.

## 8) Plan de implementacion tecnica
### Fase 1 - Backend tests
- Agregar pruebas de contratos en server para:
  - payload publico sin `pin`
  - auto-referee al crear mesa
  - rate-limit en `SET_REF`/`DELETE_TABLE`
  - CORS allow/deny

### Fase 2 - Frontend tests
- Agregar/ajustar prueba de flujo scoreboard:
  - tras crear mesa, `START_MATCH` no deriva en `UNAUTHORIZED`.

### Fase 3 - Estabilizacion
- Ajustar fixtures/utilidades para minimizar flaky tests por timing de sockets.

## 9) Plan de migracion/compatibilidad
- No hay migracion de datos.
- Compatibilidad: actualizar mocks al contrato `TableInfo` sin `pin`.

## 10) Plan de pruebas
- Unit:
  - Sanitizacion de payload de mesa.
  - Rate-limit policy.
- Integracion:
  - Flujo `CREATE_TABLE -> START_MATCH`.
  - CORS allowed/blocked.
- Smoke:
  - corrida completa de unit tests de cliente y pruebas backend nuevas.

## 11) Riesgos tecnicos y trade-offs
- Riesgo: infraestructura backend tests aun limitada.
  - Mitigacion: priorizar pruebas puras de handler/manager con mocks.
- Riesgo: pruebas CORS con comportamiento distinto en entorno local/CI.
  - Mitigacion: parametrizar origins en fixtures.

## 12) Criterios de aceptacion tecnicos
- [ ] Tests backend nuevos pasan localmente.
- [ ] Tests frontend de flujo referee pasan localmente.
- [ ] No flakiness evidente en 2 corridas consecutivas.

## 13) Archivos impactados (estimado)
- `server/src/**/*.test.ts` (nuevos)
- `client/src/pages/ScoreboardPage/ScoreboardPage.test.tsx` (o equivalente)
- `client/src/hooks/useSocket.test.ts` (si aplica)
- `client/src/test/mocks/*` (si aplica)

---

**Estado:** Ready  
**Owner tecnico:** rallyOS-hub team  
**Fecha:** 2026-04-09  
**Version:** v1.0
