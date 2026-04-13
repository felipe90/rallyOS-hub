# PRD - Arquitectura de Tres Entradas (Organizador, Árbitro, Espectador)

## 1) Contexto
- **Problema de negocio o de operación:** En un torneo offline/LAN de RallyOS no hay "cuentas de usuario" ni base de datos, porque queremos fricción cero. Sin embargo, necesitamos distinguir entre *quién gestiona el torneo y crea las mesas* (Organizador) y *quién anota los puntos en una mesa específica* (Árbitro), además del público general (Espectador).
- **Situación actual y por qué ahora:** Hoy entrar como "Árbitro" en la pantalla de inicio te lleva al Dashboard para crear mesas, y el usuario que crea la mesa recibe autoridad sobre ella automáticamente. Esto impide que un referí físico entre directamente a controlar su mesa independiente del organizador.
- **Alcance del entorno:** Producción LAN (Stateless, Fricción Cero sin BD).

## 2) Problema
- **Qué duele hoy:** No existe un flujo para que Pepito (Árbitro) pueda agarrar su celular, entrar a RallyOS, seleccionar "Mesa 1", poner el PIN y empezar a sumar puntos, si no es él el mismo que la creó.
- **Quién lo sufre:** El staff del torneo.
- **Evidencia o síntomas:** La sesión y la autoridad están acopladas al que dispara el evento `CREATE_TABLE` en lugar de autenficarse por mesa.

## 3) Objetivo del producto
- Separar la Navegación y el Control de Acceso en **3 Frentes / Accesos** sin necesitar almacenar usuarios en disco:
  1. Acceso de Organización.
  2. Acceso de Árbitro de Mesa.
  3. Acceso de Espectador libre.

## 4) Metas
- Modificar el `AuthPage` original para ofrecer 3 botones/rutas.
- El Tournament Owner es el único rol corporativo y el único que se loguea en AuthPage mediante un PIN global fijo otorgado en el mundo físico.
- El Árbitro aterriza en el Dashboard sin necesidad de loguearse en AuthPage. Puede visualizar mesas, pero `no puede crear mesas`. También puede **escanear un QR generado por el Organizador** para saltarse el Dashboard y unirse como árbitro directamente a una mesa concreta.
- El Espectador entra directamente al Waiting Room.

## 5) No metas
- *No* se usarán Bases de Datos ni guardaremos identidades de usuarios. Todo operará bajo validaciones de socket temporales (Auth Stateless).

## 6) Alcance
### En alcance
- **UI:** Rediseño del `AuthPage.tsx` con opciones claras.
- **Flujo de Árbitro:** Listado de mesas vivas para que un nuevo celular pueda unirse ingresando el PIN de mesa e inicie la pantalla de control de partido.
- **Backend (`tableManager.ts` / `socketHandler.ts`):** Validar que el login de `JOIN_TABLE` como árbitro autorice correctamente a un socket si proporciona el `table.pin`.

### Fuera de alcance
- Persistencia entre reinicios de servidor.

## 7) Requisitos funcionales

- **RF-01**: **Flujo Tournament Owner**: Al clickear "Tournament Owner" en AuthPage, se pide el único PIN Global Maestro. Si es correcto, el usuario entra al `/dashboard` con todos los privilegios habilitados. Cuando el Organizer crea una mesa, **la tarjeta de la mesa en su Dashboard exhibirá un Código QR** (ej: `http://[IP-LOCAL]/scoreboard/ID?pin=1234`).
- **RF-02**: **Flujo Árbitro Manual**: Al clickear "Árbitro" en AuthPage, el usuario entra sin loguearse directamente al `/dashboard`. Verá las mesas vivas y podrá clickear sobre ellas para gestionarlas ingresando el PIN manualmente, pero el botón de Crear Mesa estará inhabilitado.
- **RF-03**: **Flujo Árbitro por Escaneo (Deep Linking)**: Si un árbitro escanea el QR del dispositivo de la Organización con la cámara de su celular, el link lo rutea a `/scoreboard/:tableId?pin=1234`. El cliente extrae el PIN, se enlaza directamente con el socket de esa mesa otorgando privilegios locales, y el árbitro comienza a anotar de forma instantánea. **POST-HANDSHAKE: El cliente ejecuta URL Scrubbing** (`history.replaceState`) para quitar el PIN de la barra de direcciones visibles.
- **RF-04**: **Flujo Espectador**: Al clickear "Espectador" en AuthPage, el usuario navega a `/waiting-room`.

## 8) Criterios de aceptación (DoD)
- [ ] La Landing Page (`AuthPage`) muestra 3 botones claros: Tournament Owner, Árbitro y Espectador.
- [ ] Solo "Tournament Owner" te frena pidiendo un PIN de acceso global. Tras ingresarlo, te redirecciona al Dashboard con privilegios totales.
- [ ] "Árbitro" omite el login y redirige directamente a un Dashboard restringido (sin posibilidad de despachar el evento `CREATE_TABLE`).
- [ ] "Espectador" omite login y envia de cabeza al Waiting Room.
- [ ] El PIN en el URL se encripta (no es texto plano) para evitar shoulder surfing fácil.
- [ ] Solo un árbitro puede estar ACTIVO por mesa. Si ya hay uno, los intentos de otros sockets con PIN son rechazados.
- [ ] El Organizador puede regenerar el PIN de una mesa (Kill-Switch), lo que desconecta al árbitro anterior forzosamente.
- [ ] Post-handshake, el PIN se remueve de la URL visible (Scrubbing).

## 9) Trade-offs y mitigaciones

| Trade-off | Descripción | Mitigación |
|-----------|-------------|------------|
| **URL Pin Exposure** | El PIN de 4 dígitos queda visible en la barra de direcciones | URL Scrubbing post-handshake (`history.replaceState`) + Encriptación del PIN en el link |
| **Fuerza Bruta LAN** | Solo 10.000 combinaciones - ataque desde red local | Rate Limiting: 5 intentos máximos, luegosilencio temporal (ya implementado) |
| **Co-Arbitraje no intencional** | Múltiples sockets con mismo PIN pueden sumar puntos | Un solo Árbitr@ ACTIVO por mesa (RF-03 actualizado) |
| **Árbitr@ zonasado** | El órgano sale de la mesa pero sigue conectado desdegradas | Kill-Switch: Regenerar PIN desconecta alanterior y obliga a nuevo escaneo |

## 9) Trade-offs y mitigaciones

| Trade-off | Descripción | Mitigación |
|-----------|-------------|------------|
| **URL Pin Exposure** | El PIN de 4 dígitos queda visible en la barra de direcciones | URL Scrubbing post-handshake (`history.replaceState`) + Encriptación del PIN en el link |
| **Fuerza Bruta LAN** | Solo 10.000 combinaciones - ataque desde red local | Rate Limiting: 5 intentos máximos, luego silencio temporal (ya implementado) |
| **Co-Arbitraje no intencional** | Múltiples sockets con mismo PIN pueden sumar puntos | Un solo Árbitr@ ACTIVO por mesa (RF-03 actualizado) |
| **Árbitr@ zonificado** | El órgano sale de la mesa pero sigue conectado desde las gradas | Kill-Switch: Regenerar PIN desconecta al anterior y obliga a nuevo escaneo |

## 10) Plan de rollout (Estrategia PRD -> SDD -> Tasks)
1. **PRD:** Definición de la fricción cero (Aprobación).
2. **SDD:** Mapping técnico de los eventos del socket requeridos y re-ensamblaje de vistas de React.
3. **Tasks:** Ejecución en el frontend y validación.

---

**Estado:** Finalizado ✅  
**Owner:** Antigravity / Felipe  
**Fecha:** 2026-04-09  
**Versión:** v1.0
