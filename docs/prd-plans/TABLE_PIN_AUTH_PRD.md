# PRD - Autenticación de Mesa por PIN + Visualización de QR para Owner

## 1) Contexto
- **Problema de negocio o de operación:** El Owner del torneo necesita poder ver el PIN y código QR de cada mesa para poder entregarlos a los árbitros de forma física. También necesitamos que cualquier usuario que quiera entrar a gestionar una mesa (como árbitro) deba autenticarse con el PIN de esa mesa.
- **Situación actual y por qué ahora:** Hoy el dashboard muestra las mesas pero sin PIN ni QR. Además, cualquier persona con acceso puede hacer click en cualquier mesa y entrar directamente al scoreboard sin ningún tipo de autenticación.
- **Alcance del entorno:** Producción LAN (Torneos offline, Fricción Cero).

## 2) Problema
- **Qué duele hoy:** 
  1. El Owner no puede ver el PIN de las mesas para entregarlas a los árbitros
  2. El Owner no puede generar un QR code para que el árbitro escanee y entre directamente
  3. Cualquier persona puede entrar a cualquier mesa sin saber el PIN
- **Quién lo sufre:** El staff del torneo (Owner y árbitros).
- **Evidencia o síntomas:** El código actual (`socketHandler.ts` línea 470-472) explícitamente excluye el PIN de `TableInfo` por seguridad, pero el Owner necesita verlo.

## 3) Objetivo del producto
- El Owner puede ver el PIN y QR de cada mesa en su dashboard.
- Al hacer click en una mesa desde el dashboard, se solicita el PIN para permitir el acceso.
- Solo el Owner puede crear mesas (no los árbitros).

## 4) Metas
- [ ] El Owner ve el PIN de cada mesa en su dashboard (siempre visible)
- [ ] El Owner ve el QR code de cada mesa en su dashboard (siempre visible)
- [ ] Solo el Owner puede crear mesas (no referees)
- [ ] Click en mesa → pide PIN antes de permitir acceso
- [ ] PIN incorrecto → error y reintentar, no permite navegación
- [ ] PIN correcto → navega al scoreboard como árbitro

## 5) No metas
- QR code para espectadores (fuera de alcance)
- Flujo de "olvidé mi PIN" (el Owner puede regenerar desde el dashboard)
- Crear nuevas mesas desde otra vista que no sea el dashboard del Owner

## 6) Alcance
### En alcance
- **Backend:** Nuevo socket event para obtener mesas con PIN solo para Owner
- **Frontend Owner Dashboard:** Mostrar PIN y QR para cada mesa
- **Frontend Dashboard:** Modal de PIN al hacer click en cualquier mesa
- **Frontend Scoreboard:** Guardar PIN en localStorage para auth automática

### Fuera de alcance
- Flujo de espectador sin cambios
- Modificación del sistema de sesiones existente

## 7) Requisitos funcionales
- **RF-01**: **Ver PIN de mesa (Owner)**: Al estar logueado como Owner, el dashboard muestra el PIN de 4 dígitos de cada mesa junto al nombre.
- **RF-02**: **Ver QR de mesa (Owner)**: Al estar logueado como Owner, el dashboard muestra un código QR escaneable por cada mesa.
- **RF-03**: **Crear mesa (Owner)**: Solo el Owner tiene el botón "Nueva Mesa" habilitado. Los árbitros no pueden crear mesas.
- **RF-04**: **Acceso con PIN**: Al hacer click en cualquier mesa, se abre un modal pidiendo el PIN. Solo si es correcto, navega al scoreboard.
- **RF-05**: **Validación de PIN**: El modal valida el PIN contra el servidor mediante el evento SET_REF existente.

## 8) Requisitos no funcionales
- **RNF-01**: Seguridad - El PIN nunca se muestra en logs ni URLs visibles
- **RNF-02**: UX - El modal debe ser simple y rápido (máximo 2 acciones)
- **RNF-03**: Compatibilidad - Mantener backward compatibility con viewers existentes

## 9) Trade-offs
- **Seguridad vs Conveniencia**: Mostrar el PIN siempre visible es menos seguro, pero es necesario para que el Owner pueda dárselo al árbitro. Se mitiga mostrando solo al Owner.
- **Nuevo endpoint vs复用**: Crear un nuevo socket event (GET_TABLES_WITH_PINS) es más limpio que reutilizar uno existente.

## 10) Riesgos y mitigaciones
- **Riesgo:** PIN expuesto en UI → **Mitigación:** Solo para Owner, no se guarda en localStorage público.
- **Riesgo:** UX friction (más clicks) → **Mitigación:** Modal simple con input + ENTER o click.

## 11) Criterios de aceptación (DoD)
- [ ] El dashboard muestra el PIN de cada mesa para Owner
- [ ] El dashboard muestra el QR code de cada mesa para Owner
- [ ] El botón "Nueva Mesa" solo aparece para Owner (no para árbitros)
- [ ] Click en cualquier mesa abre modal de PIN
- [ ] Ingresar PIN correcto permite navegar al scoreboard
- [ ] Ingresar PIN incorrecto muestra error y permite reintentar
- [ ] El scoreboard recibe el PIN y se autentica automáticamente

## 12) Plan de rollout
- **Etapa 1 - Backend:** Agregar socket `GET_TABLES_WITH_PINS` y tipos.
- **Etapa 2 - Frontend Owner:** Dashboard muestra PIN y QR.
- **Etapa 3 - PIN Modal:** Agregar modal al hacer click en mesa.
- **Etapa 4 - Testing:** Verificar flujo completo.

## 13) Dependencias
- **Técnica:** `SET_REF` socket event existente funciona correctamente.
- **Tipos:** `QRData` tipo ya existe con `pin`, `tableId`, `tableName`.

## 14) Backlog posterior
- QR code interactivo (hover para mostrar/ocultar)
- Historial de árbitros por mesa
- Notificaciones cuando un árbitro entra/sale

---

**Estado:** Draft  
**Owner:** Raiken  
**Fecha:** 2026-04-10  
**Version:** v0.1