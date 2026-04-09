# PRD - Security Regression Testing for POC LAN

## 1) Contexto
- Se implemento hardening de seguridad (ocultamiento de PIN, rate-limit, CORS restringido, logs sanitizados).
- Detectamos una regresion real de autorizacion (`UNAUTHORIZED` al iniciar partido) luego de los cambios.
- El entorno objetivo sigue siendo POC LAN con foco en continuidad operativa de torneo.

## 2) Problema
- La suite actual valida funcionalidad general, pero no cubre de forma explicita los nuevos controles de seguridad.
- Cambios de seguridad pueden romper flujos criticos sin deteccion temprana.

## 3) Objetivo del producto
- Agregar cobertura de pruebas enfocada en seguridad/regresion para evitar que hardening rompa el flujo de arbitraje en torneo.

## 4) Metas
- Cubrir con tests los contratos criticos de seguridad backend (payloads, auth, rate-limit, CORS).
- Cubrir con tests el flujo funcional del referee luego de crear mesa.
- Reducir riesgo de regresiones silenciosas en cada release.

## 5) No metas
- Redisenar arquitectura de autenticacion completa.
- Introducir infraestructura compleja de testing distribuido.
- Reescribir toda la suite existente.

## 6) Alcance
### En alcance
- Tests backend de eventos Socket sensibles.
- Tests frontend/integracion de flujos referee afectados por hardening.
- Verificacion de no exposicion de `pin` en payloads publicos.

### Fuera de alcance
- Auditoria de performance de tests.
- E2E exhaustivo cross-browser para esta iteracion.

## 7) Requisitos funcionales
- RF-01: Debe existir test que garantice que `TABLE_LIST`/`TABLE_UPDATE` no exponen `pin`.
- RF-02: Debe existir test para flujo `CREATE_TABLE -> referee autorizado -> START_MATCH` sin `UNAUTHORIZED`.
- RF-03: Debe existir test de rate-limit para `SET_REF` y `DELETE_TABLE`.
- RF-04: Debe existir test de CORS permitido/no permitido.

## 8) Requisitos no funcionales
- RNF-01: Tests deben ser deterministas y rapidos.
- RNF-02: Sin exponer secretos en fixtures/logs de test.
- RNF-03: Compatibles con entorno local de desarrollo.

## 9) Trade-offs
- Mas cobertura implica mas tiempo de mantenimiento de tests.
- Tests de sockets/CORS pueden ser mas fragiles si no se aislan bien.

## 10) Riesgos y mitigaciones
- Riesgo: tests flaky por timing de sockets -> Mitigacion: helpers de espera y timeouts controlados.
- Riesgo: cambios de contratos rompen muchos mocks -> Mitigacion: centralizar fixtures de `TableInfo`.

## 11) Criterios de aceptacion (DoD)
- [ ] Nuevos tests de seguridad/regresion agregados y pasando en CI/local.
- [ ] Caso de regresion `UNAUTHORIZED` tras `CREATE_TABLE` cubierto por test.
- [ ] Caso de no exposicion de `pin` cubierto por test.
- [ ] Casos de rate-limit y CORS cubiertos por test.

## 12) Plan de rollout
- Etapa 1: agregar tests backend de contratos de seguridad.
- Etapa 2: agregar tests frontend de flujo referee.
- Etapa 3: ejecutar suite y ajustar flakiness.

## 13) Dependencias
- Infra de test existente (Vitest).
- Posibles utilidades de mock para sockets y contexto.

## 14) Backlog posterior
- Agregar smoke E2E de seguridad en pipeline release.
- Métricas de cobertura por categoria (auth, transport, payloads).

---

**Estado:** Ready  
**Owner:** rallyOS-hub team  
**Fecha:** 2026-04-09  
**Version:** v1.0
