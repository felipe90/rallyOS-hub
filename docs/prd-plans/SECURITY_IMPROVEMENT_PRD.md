# PRD - Plan de Mejora de Seguridad (POC LAN)

## 1) Contexto

`rallyOS-hub` se ejecutara en un servidor local (LAN) para un torneo como POC.  
El objetivo de este PRD es definir un plan de seguridad pragmatico: reducir riesgos reales de abuso durante el torneo sin sobredisenar el sistema en esta etapa.

## 2) Problema

La implementacion actual tiene controles funcionales para el flujo de torneo, pero existen debilidades de seguridad que permiten:

- Exposicion de PIN de mesa a clientes no autorizados.
- Escalada de privilegios a referee con bajo esfuerzo.
- Intentos ilimitados de PIN (fuerza bruta).
- Superficie CORS excesivamente abierta.
- Fuga de secretos en logs.

## 3) Objetivo del producto

Mejorar la seguridad operativa del POC en LAN con cambios de bajo riesgo y alta relacion impacto/esfuerzo, manteniendo velocidad de uso para arbitros.

## 4) Metas

- Evitar que espectadores obtengan/controlen PIN de mesa por eventos UI globales.
- Reducir significativamente riesgo de fuerza bruta en acciones sensibles.
- Eliminar exposicion de secretos en logs.
- Mantener experiencia fluida en torneo (sin friccion excesiva para arbitros).

## 5) No metas (para esta iteracion)

- Rediseno completo de identidad/autenticacion con JWT/OAuth.
- Infraestructura de seguridad enterprise (WAF, SIEM, secrets manager).
- Persistencia distribuida de rate-limit (Redis u otro).
- Cobertura E2E extensa de seguridad en CI.

## 6) Alcance

### En alcance (P0 - implementar ahora)

1. **Ocultar PIN en payloads/eventos globales y UI general**
   - Quitar `pin` de `TABLE_LIST` y `TABLE_UPDATE` para clientes no autenticados como referee de la mesa.
   - Quitar visualizacion de PIN en dashboard general.

2. **Sanitizacion de logs**
   - Remover cualquier log de `expected`/`got` PIN.
   - Reemplazar por mensajes neutros y utiles para debug sin secretos.

3. **Rate limit basico in-memory**
   - Aplicar en `SET_REF` y `DELETE_TABLE`.
   - Politica inicial sugerida:
     - 5 intentos por 60 segundos por combinacion `tableId + socketId`.
     - Cooldown de 60 segundos al exceder.

4. **CORS basico con allowlist**
   - Configuracion por variable de entorno (`HUB_ALLOWED_ORIGINS`).
   - Incluir origenes del POC (ej: `https://localhost:3000`, `https://orangepi.local:3000`, IP LAN del hub).

### Fuera de alcance (P1/P2 - post POC)

- Sesion efimera avanzada de referee con TTL y renovacion.
- Hardening web avanzado (CSP estricta, politica de headers completa, etc.).
- Observabilidad de seguridad y tableros dedicados.
- Bateria amplia de pruebas automatizadas de seguridad.

## 7) Requisitos funcionales

### RF-01 - Ocultamiento de PIN

- El sistema NO debe enviar PIN en eventos globales de lista/actualizacion de mesas.
- El sistema NO debe mostrar PIN en dashboard general.
- El PIN solo puede circular en flujos de autenticacion de referee y/o contexto de mesa autorizado.

### RF-02 - Rate limiting en operaciones sensibles

- Debe limitar intentos fallidos para `SET_REF`.
- Debe limitar intentos para `DELETE_TABLE`.
- Debe devolver error explicito de limite temporal cuando corresponda.

### RF-03 - CORS controlado

- El backend debe aceptar solo origenes configurados en allowlist.
- Debe existir fallback razonable para entorno de desarrollo.

### RF-04 - Logs seguros

- No se deben loggear secretos (PIN, valores de comparacion sensibles).

## 8) Requisitos no funcionales

- Cambios compatibles con operacion en SBC (Orange Pi/Raspberry Pi).
- Implementacion simple, sin dependencias pesadas adicionales.
- Sin degradar perceptiblemente latencia de scoring en tiempo real.

## 9) Trade-offs aceptados

- Menor visibilidad operativa del PIN en UI global a cambio de mayor seguridad.
- Riesgo de bloquear temporalmente a arbitros que ingresen mal el PIN muchas veces.
- Mayor configuracion inicial por CORS allowlist en LAN con IPs variables.

## 10) Efectos de borde esperados

1. **Rotura de contratos de UI/tests**
   - Componentes o tests que asumen `table.pin` en `TableInfo` pueden fallar.
2. **Bloqueo accidental por rate-limit**
   - En escenarios de reconexion o errores repetidos de tipeo.
3. **Origen no contemplado en allowlist**
   - Clientes legitimos podrian no conectar hasta ajustar configuracion.

## 11) Mitigaciones

- Introducir cambios de payload con validacion de compatibilidad en cliente.
- Mensajes de error de rate-limit claros para operador/arbitro.
- Defaults de allowlist orientados al POC + documentacion de ajuste rapido.
- Smoke tests manuales antes de torneo.

## 12) Criterios de aceptacion (DoD P0)

1. **PIN oculto**
   - Un usuario espectador no ve PIN en dashboard ni lo recibe en eventos globales.

2. **Autorizacion intacta**
   - Referee legitimo con PIN correcto conserva capacidad de:
     - iniciar partido
     - puntuar
     - deshacer
     - resetear

3. **Fuerza bruta mitigada**
   - Tras exceder limite de intentos, el sistema bloquea temporalmente nuevas pruebas.

4. **Logs sanitizados**
   - No aparecen PINs en logs del servidor.

5. **CORS operativo**
   - Clientes del torneo (origenes permitidos) conectan correctamente.
   - Origen no permitido es rechazado.

## 13) Plan de rollout

### Etapa 1 - Implementacion tecnica

- Ajustes de eventos/payloads.
- Rate-limit in-memory.
- CORS allowlist.
- Limpieza de logs.

### Etapa 2 - Validacion interna

- Prueba manual de referee/espectador.
- Prueba de limites de intentos.
- Prueba de conexion desde origen permitido/no permitido.

### Etapa 3 - Ensayo pre torneo

- Simulacion con 2-3 dispositivos en LAN real.
- Verificacion de UX de arbitro bajo presion (sin friccion excesiva).

## 14) Riesgos abiertos

- Cambio futuro de arquitectura de auth puede requerir refactor de estos controles.
- Si la operacion escala (mas mesas/dispositivos), el rate-limit in-memory puede ser insuficiente.

## 15) Backlog posterior al POC

- Sesion de referee robusta (token efimero + TTL + revocacion).
- Hardening avanzado de headers y politicas browser.
- Pruebas automatizadas de seguridad en CI.
- Telemetria de seguridad (metricas de intentos invalidos, bloqueos, etc.).

---

**Estado:** Aprobado para implementacion P0  
**Prioridad:** Alta  
**Ambiente objetivo:** Torneo LAN (POC local)
