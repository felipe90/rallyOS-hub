# PRD - Hardening de Seguridad rallyOS-hub (POC LAN)

## 1) Contexto
- **Problema de negocio u operacion**: El servidor rallyOS-hub opera en red LAN para torneos de tenis de mesa en vivo. Vulnerabilidades criticas de seguridad pueden permitir que cualquier persona en la red tome control de mesas, altere marcadores o revoca árbitros.
- **Situacion actual y por que ahora**: El POC funcional existe y opera correctamente, pero la evaluacion de arquitectura reveló 3 vulnerabilidades CRÍTICAS y 4 IMPORTANTES que deben resolverse antes de probar en campo con usuarios reales.
- **Alcance del entorno**: POC LAN - entorno controlado de torneo local. No expuesto a internet. Múltiples dispositivos conectados via WiFi local al servidor (Orange Pi).

## 2) Problema
- **Que duele hoy**: 
  1. Encriptación XOR del PIN en QR es criptográficamente insegura (brute-force en segundos)
  2. Owner PIN hardcodeado `'00000'` permite que cualquiera se haga "owner" si no se configura la variable de entorno
  3. Rate limiting por socket ID es evadible con reconexiones
  4. No hay validación de tamaño de payloads (DoS potencial)
  5. Logging con `console.log` sin estructura ni niveles
  6. No hay graceful shutdown ni manejo de errores globales
  7. Duplicación de lógica de configuración de match
  
- **Quien lo sufre**: 
  - **Tournament Owner**: Pierde control si alguien usa PIN default
  - **Referee**: Puede ser revocado por atacante con owner PIN
  - **Players/Spectators**: Marcadores alterados por atacantes
  
- **Evidencia o sintomas**: 
  - XOR cipher con sal diaria: clave de 32 bits, espacio de búsqueda de 4 mil millones, pero PIN de solo 4 dígitos (10,000 combinaciones)
  - `process.env.TOURNAMENT_OWNER_PIN || '00000'` en 4 lugares diferentes del código
  - Rate limit resets al reconectar socket (nuevo socket ID)

## 3) Objetivo del producto
Endurecer la seguridad del servidor rallyOS-hub para que sea **seguro para prueba en campo en LAN** sin vulnerabilidades críticas, manteniendo la simplicidad del POC.

## 4) Metas
- **Meta 1**: 0 vulnerabilidades críticas pendientes (XOR, owner PIN, rate limiting)
- **Meta 2**: 100% de validación de payloads implementada en todos los eventos de socket
- **Meta 3**: Logging estructurado con niveles (info, warn, error) implementado
- **Meta 4**: Graceful shutdown y manejo de errores globales funcionando
- **Meta 5**: Tests de seguridad pasando (6 existentes + 4 nuevos para vulnerabilidades corregidas)

## 5) No metas
- Base de datos persistente (nice-to-have posterior)
- Integración con RallyOS main (nice-to-have posterior)
- Offline-first / sync mechanisms (nice-to-have posterior)
- Métricas y monitoring con Prometheus/Grafana (nice-to-have posterior)
- Documentación OpenAPI/Swagger (nice-to-have posterior)
- Tests de carga con artillery.io (nice-to-have posterior)

## 6) Alcance
### En alcance
- Reemplazar XOR cipher con AES-256-GCM para encriptación de PIN
- Hacer `TOURNAMENT_OWNER_PIN` obligatorio con fallback aleatorio seguro
- Implementar rate limiting por IP address
- Agregar validación de tamaño de payloads (max string length, max tables)
- Separar `index.ts` en módulos: `app.ts`, `server.ts`, `socket.ts`
- Reemplazar `console.log` con logger estructurado (`pino`)
- Implementar graceful shutdown (`SIGTERM`, `SIGINT`)
- Agregar `process.on('uncaughtException')` y `process.on('unhandledRejection')`
- Unificar flujo de configuración de match (eliminar duplicación)
- Actualizar tests de seguridad

### Fuera de alcance
- Persistencia de estado (SQLite, JSON file)
- Integración con Supabase
- Offline queue / replay mechanisms
- Payment integration
- React Native client changes

## 7) Requisitos funcionales
- **RF-01**: Encriptación de PIN para QR debe usar AES-256-GCM con clave del servidor, no XOR
- **RF-02**: `TOURNAMENT_OWNER_PIN` debe ser obligatorio; si no se configura, generar uno aleatorio criptográficamente seguro de 8 dígitos y loguearlo en startup
- **RF-03**: Rate limiting debe ser por IP address (`socket.handshake.address`), no por socket ID
- **RF-04**: Todos los eventos de socket deben validar: max string length (256 chars), max payload size, tipos de datos esperados
- **RF-05**: Logger estructurado debe incluir: timestamp, nivel, mensaje, metadata contextual (tableId, socketId)
- **RF-06**: Graceful shutdown debe: cerrar Socket.IO, detener HTTP server, limpiar mesas activas, loguear evento
- **RF-07**: Manejo de errores globales debe: loguear error, no crashear el servidor, enviar ERROR al cliente si aplica
- **RF-08**: Configuración de match debe tener un solo flujo: `CONFIGURE_MATCH` setea nombres y configuración, `START_MATCH` solo inicia
- **RF-09**: Todos los tests de seguridad existentes deben seguir pasando (6 tests)
- **RF-10**: Nuevos tests deben verificar: AES encryption, owner PIN aleatorio, rate limit por IP, payload validation

## 8) Requisitos no funcionales
- **RNF-01 (Rendimiento)**: Latencia de eventos de socket < 50ms p95 (sin cambios significativos vs actual)
- **RNF-02 (Seguridad)**: PIN encriptado debe ser resistente a brute-force (AES-256 con salt aleatorio por QR)
- **RNF-03 (Compatibilidad)**: Mantener compatibilidad con clientes existentes (eventos de socket no deben cambiar nombre ni estructura de respuesta)
- **RNF-04 (Operabilidad)**: Logs deben ser legibles en consola del servidor Orange Pi sin herramientas adicionales
- **RNF-05 (Mantenibilidad)**: Código TypeScript, tipado estricto, sin `any` explícitos

## 9) Trade-offs
- **Decision 1**: AES-256-GCM vs bcrypt para PIN -> **AES-256-GCM** porque necesitamos encriptar/desencriptar (bcrypt es one-way). Beneficio: seguro y reversible. Costo: complejidad ligeramente mayor vs XOR.
- **Decision 2**: `pino` vs `winston` para logging -> **`pino`** porque es más rápido y ligero (importante para Orange Pi con recursos limitados). Beneficio: bajo overhead. Costo: ecosistema de plugins menor que winston.
- **Decision 3**: Rate limit en memoria vs Redis -> **En memoria por IP** porque es POC LAN sin infraestructura adicional. Beneficio: sin dependencias externas. Costo: rate limit se resets al reiniciar servidor (aceptable para POC).
- **Decision 4**: Owner PIN aleatorio vs obligatorio -> **Aleatorio con fallback** porque obliga a configurar pero no bloquea si no se configura. Beneficio: nunca se queda sin owner PIN. Costo: puede olvidarse el PIN si no se anota.

## 10) Riesgos y mitigaciones
- **Riesgo**: AES-256-GCM requiere `crypto` module de Node.js -> **Mitigacion**: Ya disponible en Node 20, sin dependencias adicionales
- **Riesgo**: Rate limit por IP puede bloquear usuarios detras de NAT -> **Mitigacion**: En LAN cada dispositivo tiene IP única, no es problema
- **Riesgo**: Separar `index.ts` puede introducir bugs de inicialización -> **Mitigacion**: Tests E2E después de refactor para verificar funcionamiento
- **Riesgo**: Cambio en flujo de configuración de match rompe UX existente -> **Mitigacion**: Mantener compatibilidad hacia atrás en eventos de socket
- **Riesgo**: Owner PIN aleatorio se pierde si servidor reinicia -> **Mitigacion**: Loguear PIN en startup y permitir override via env var

## 11) Criterios de aceptacion (DoD)
- [ ] XOR cipher eliminado completamente del código, reemplazado por AES-256-GCM
- [ ] `TOURNAMENT_OWNER_PIN` hardcodeado `'00000'` eliminado, reemplazado por generación aleatoria o env var obligatoria
- [ ] Rate limiting implementado por IP, verificado en tests
- [ ] Validación de payloads en todos los eventos de socket (17 eventos)
- [ ] Logger estructurado (`pino`) reemplaza todos los `console.log/warn/error`
- [ ] Graceful shutdown implementado y probado (SIGTERM/SIGINT)
- [ ] Manejo de errores globales implementado (uncaughtException, unhandledRejection)
- [ ] Flujo de configuración de match unificado (sin duplicación)
- [ ] 6 tests de seguridad existentes pasando
- [ ] 4 nuevos tests de seguridad pasando (AES, owner PIN, rate limit IP, payload validation)
- [ ] `index.ts` refactorizado en `app.ts`, `server.ts`, `socket.ts`
- [ ] Documentación de cambios en `docs/`

## 12) Plan de rollout
- **Etapa 1 (P0 - Crítico)**: Encriptación AES, owner PIN aleatorio, rate limit por IP (3 días)
- **Etapa 2 (P1 - Alto)**: Validación de payloads, logger estructurado, graceful shutdown (2 días)
- **Etapa 3 (P2 - Medio)**: Refactor de `index.ts`, unificación de configuración de match, manejo de errores globales (2 días)
- **Etapa 4 (Testing)**: Actualizar tests existentes, agregar nuevos tests, E2E completo (1 día)
- **Etapa 5 (Release)**: Deploy a Orange Pi, validación en LAN, documentación (1 día)

## 13) Dependencias
- **Dependencia tecnica**: Node.js 20+ (ya cumplida, package.json usa `node:20-alpine` en Docker)
- **Dependencia tecnica**: `crypto` module de Node.js (built-in, sin instalación)
- **Dependencia de package**: `pino` (nueva dependencia, ligera ~200KB)
- **Dependencia operativa**: Acceso al servidor Orange Pi para deploy y testing
- **Dependencia operativa**: Clientes existentes no deben requerir cambios (compatibilidad de eventos)

## 14) Backlog posterior
- Persistencia de estado en SQLite local para recovery tras reinicios
- Integración con RallyOS main via Supabase o API bridge
- Offline-first mechanisms (TanStack Query, Zustand sync)
- Métricas y monitoring (Prometheus, Grafana)
- Tests de carga (artillery.io)
- Documentación OpenAPI/Swagger
- Payment integration (Stripe/MercadoPago)
- Mobile UI improvements (React Native)

---

**Estado:** Draft
**Owner:** raikenwolf
**Fecha:** 2026-04-11
**Version:** v0.1
