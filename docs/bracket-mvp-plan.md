# Plan MVP: Bracket de Torneo (Eliminación Simple)

> Documento de diseño y alcance. MVP para prueba en torneo real.
> Basado en discusión del 29-Jul-2026. Torneo objetivo: viernes 01-Ago-2026.

---

## Contexto

El sistema hoy maneja scorers por mesa en modo torneo, pero no gestiona la
**estructura del torneo** (cruces, avances, bracket). El organizador lo lleva
hoy en papel o en otra app.

Este MVP entrega una herramienta visual para que el **owner** gestione el
bracket a mano — **sin automatización** — y asigne partidos a canchas.

### Restricciones del hardware

Orange Pi Zero 3 con **2 GB RAM**. Stack actual consume ~550-600 MB (Node.js +
Chromium kiosko + hostapd/dnsmasq). Margen sobrado para esta feature.

Sin BD, sin ORM, sin librerías externas. Persistencia por el `StateStore`
existente (JSON en disco) — el bracket sobrevive reinicios.

### Nota de escalabilidad futura

Este MVP es owner-only, pero la **vía de diseño** está abierta a futuro:
emitir `BRACKET_STATE` a un kiosko público para que todos vean el bracket en la
tele. El modelo de eventos full-state actual no escala a 30 celus
sincronizando, pero **eso no es problema ahora**. Cuando abramos la vista
pública habrá que migrar a emisiones parciales (patches por match, no
full-state). Queda documentado pero fuera del alcance del viernes.

---

## Objetivo del MVP

> El owner arma el bracket a mano, asigna participantes a cada rama según los
> resultados de la fase de grupos, asigna cada partido a una cancha, y marca
> ganadores. El bracket avanza visualmente.

**No** es un motor automático. Es una pizarra digital organizada.

---

## Alcance

### ✅ Dentro del MVP

- Single elimination (4, 8, 16 **o 32** participantes — configurable)
- **Byes implícitos** — si un slot queda vacío y el otro tiene jugador, ese jugador avanza automáticamente. No hay botón "BYE" — el slot vacío lo determina.
- Owner ingresa la lista de participantes que pasaron de fase de grupos
- Owner asigna cada participante a un slot del bracket **a mano**
- Owner asigna cada partido a una cancha física existente
- Owner marca el ganador de cada partido → el ganador avanza al siguiente cruce
- **Undo por cascada** — un solo toque revierte un partido y todo lo que dependa de él
- Persistencia del estado del bracket (sobrevive reinicios)
- **Tercer puesto opcional** — toggle al crear el bracket (default off). Genera un match terminal entre perdedores de semis. El owner asigna manualmente los perdedores (si no se fueron)
- Vista del bracket **solo para el owner** (tab dentro del OwnerDashboard)
- Diseño **responsive tablet-first** (portrait + desktop)

### ❌ Fuera del MVP

- Doble eliminación / loser bracket
- Fase de grupos dentro del sistema (se juega afuera)
- **Vista pública / kiosko / tele** (ver nota de escalabilidad)
- Conexión automática con el scoring de los referees
- Siembra algorítmica (seeding por ranking)
- Import/export de participantes (Excel/CSV)
- Programación de horarios
- Tercer puesto forzado (opcional — toggle al crear, default off, match manual)
- Animaciones pesadas (Framer Motion en el bracket)
- Resize del bracket post-creación (inmutable en tamaño)

---

## Modelo de dominio

```typescript
interface TournamentBracket {
  id: string
  name: string                    // "Torneo Viernes"
  numSlots: 4 | 8 | 16 | 32       // tamaño del árbol (slots totales)
  rounds: BracketRound[]
  status: BracketStatus            // ver enum BRACKET_STATUS abajo
  includeThirdPlace?: boolean      // default false — toggle al crear
  createdAt: string
  updatedAt: string
}

interface BracketRound {
  round: number                    // 0 = primera ronda
  name: string                    // dinámico: "R16" | "Cuartos" | "Semis" | "Final"
  matches: BracketMatch[]
}

interface BracketMatch {
  id: string
  round: number
  position: number                // índice dentro de la ronda (0, 1, 2…)
  playerA: string | null          // texto libre — nombre o pareja
  playerB: string | null
  isByeA: boolean                 // true = slot A es BYE (auto-advance del B)
  isByeB: boolean                 // true = slot B es BYE (auto-advance del A)
  winner: Player                   // 'A' | 'B' — reusa el tipo Player de shared
  courtId: string | null          // referencia a cancha física existente
  status: BracketMatchStatus       // ver enum BRACKET_MATCH_STATUS abajo
  scoreNote?: string              // texto libre opcional ("3-1", "6-4 6-2")
}
```

### Enums estilo const-object (siguiendo el patrón de la app)

El codebase **no usa TypeScript `enum`**. Usa `const` object + tipo derivado —
ver `CLUB_STATUS`, `COURT_MODE`, `SESSION_MODE` en `shared/types.ts`. Igual
patrón para los estados del bracket:

```typescript
/** Bracket status const — use instead of magic strings */
export const BRACKET_STATUS = {
  SETUP: 'setup',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

/** Tournament bracket status — derived from BRACKET_STATUS const */
export type BracketStatus = (typeof BRACKET_STATUS)[keyof typeof BRACKET_STATUS];

/** Bracket match status const */
export const BRACKET_MATCH_STATUS = {
  PENDING: 'pending',
  READY: 'ready',
  COMPLETED: 'completed',
} as const;

/** Bracket match status — derived from BRACKET_MATCH_STATUS const */
export type BracketMatchStatus = (typeof BRACKET_MATCH_STATUS)[keyof typeof BRACKET_MATCH_STATUS];
```

**`Player`** (`'A' | 'B'`) ya existe en `shared/types.ts` y se reusa para
`winner`. **No** se inventa un enum nuevo para algo que ya está tipado.
```

### Nombres de ronda dinámicos

Calculados desde `log2(numSlots)`. **No** se hardcodean.

| numSlots | Rondas sin 3er puesto | Rondas con 3er puesto |
|---|---|---|---|
| 4 | Semis, Final | Semis, 3er Puesto, Final |
| 8 | Cuartos, Semis, Final | Cuartos, Semis, 3er Puesto + Final |
| 16 | R16, Cuartos, Semis, Final | R16, Cuartos, Semis, 3er Puesto + Final |
| 32 | R32, R16, Cuartos, Semis, Final | R32, R16, Cuartos, Semis, 3er Puesto + Final |

### Tercer puesto (opcional)

Cuando `includeThirdPlace=true`, al crear el bracket se genera una ronda
terminal adicional entre la última ronda de semis y la final. Contiene un solo
match (posición 0 de esa ronda) que no avanza a ningún lado — es terminal.

El owner asigna manualmente los perdedores de cada semi a los slots del match
de tercer puesto (igual que cualquier otro slot). Si un perdedor se fue antes
de jugar, el owner simplemente deja ese slot vacío (bye implícito para el otro)
o lo saltea. El match no bloquea la final — se juega (o no) en paralelo.

### Reglas de avance

- Un `BracketMatch` pasa a `ready` cuando `playerA` y `playerB` están ambos
  asignados (no `null`), **o** uno es BYE y el otro asignado.
- **BYE handling (implícito):** si un partido tiene exactamente un slot ocupado
  (player con nombre) y el otro vacío (`null`), el jugador del slot ocupado
  avanza automáticamente. El owner no marca nada. Si ambos slots están vacíos,
  el match queda `pending`. Si ambos tienen nombre, el match pasa a `ready`.
  `isByeA`/`isByeB` son **derivados** en runtime (`!playerA && !!playerB`
  o viceversa), no se persisten.
- Al marcar `winner`, el match pasa a `completed` y el ganador se copia al
  slot correspondiente del **siguiente cruce**:
  - Match `round=R, position=P` avanza al match `round=R+1, position=floor(P/2)`
  - Si `P` es par → va a `playerA` del siguiente; si impar → `playerB`.
- El siguiente cruce solo se puede "jugar" cuando ambos slots del partido están
  llenos y este match está `completed`.
- El bracket pasa a `completed` cuando la final tiene `winner`.

### Undo por cascada (operación atómica)

**No** es 6 pasos manuales. Es **un toque**.

`BRACKET_UNDO_MATCH` recibe `{ matchId }` y hace, atomically en el server:

1. Revoca `winner` del match → vuelve a `ready`.
2. **Borra** del siguiente cruce el jugador que vino de este match.
3. Si el siguiente cruce ya estaba `completed`, recursivamente deshace ese
   match también (cascada hacia la final).
4. Resuelve los byes que apliquen en la nueva rama.
5. Persiste y emite el nuevo estado.

El owner toca "Deshacer" en el QF-2 → la SF-2 y la final se revertiden solas
si ya habían avanzado. **Un gesto, consistencia garantizada por el server.**

### Validaciones

- `numSlots` ∈ {4, 8, 16, 32} — validado en runtime en el handler, **no**
  asumir que TypeScript protege (Socket.IO manda `any`).
- `name` (jugador) max 50 chars, texto plano, sin HTML.
- `winner` solo `'A' | 'B'`.
- `matchId` debe existir en el bracket actual.
- `courtId` debe referenciar una cancha existente (validar contra
  `CourtManager.getAllTournamentCourts()` — ver sección *Canchas* abajo).
- **No** se valida duplicidad de nombres de jugador. En torneos reales los
  nombres se repiten. El bracket trabaja con texto libre.
- No se puede cambiar el ganador de un match si ya avanzó — usar `BRACKET_UNDO_MATCH`.

---

## Canchas — separación torneo vs club + bug real

### Estado actual (verificado en código)

El `CourtManager` separa por modo en sus métodos de listado:

- `getAllTournamentCourts()` → filtra `!isClubCourt(c)` → usado por
  `CourtEventHandler.getPublicCourtList()` → emitido como `COURT_LIST /
  COURT_LIST_WITH_PINS` → consumido por `OwnerDashboardPage` vía
  `useSocketContext().courts`.
- `getClubKioskPayload()` → filtra `isClubCourt(c)` → emitido como
  `CLUB_KIOSK_DATA` → consumido por `ClubAdminPage` vía
  `useClubCourtManagement`.

Pero **hay un bug real** que el OwnerDashboard mezcla canchas del club —
el usuario lo está viendo en producción. Investigado a fondo:

### 🔴 Root cause del bug — `COURT_UPDATE` broadcast global

`useSocketState.handleCourtUpdate` (línea 32-37 del hook) hace un **upsert**
ingenuo: si la cancha no está en `courts[]`, la **agrega**. Sin filtro por
modo. Si el server emite un `COURT_UPDATE` de una cancha del club a un socket
que alimenta el OwnerDashboard esa cancha entra en la lista.

El server **filtra bien** los lists (`COURT_LIST`), pero los **updates
individuales** se hacen globales en varios handlers:

- `SpotlightHandler.ts:79, 100, 108` — `this.io.emit(COURT_UPDATE,
  courtInfo)` al toggle featured. Si la cancha es de club, se broadcastea a
  todos (incluido el owner).
- `AuthHandler.ts:85` — `this.io.emit(COURT_UPDATE, ...)` al asignar referee.
  Si `courtId` refiere a una cancha de club, sin filtrowise leak.
- `MatchEventHandler.ts:115, 165` — `this.io.emit(COURT_UPDATE, courtInfo)`
  en `CONFIGURE_MATCH` y `START_MATCH`. Mismo riesgo para canchas de club.
- `SocketHandler.ts:173` — `this.io.emit(COURT_UPDATE, updatedInfo)` en
  auto-clear featured post match-won (este caso es post-match de torneo, no
  filtra modo, pero el court probablemente sea torneo — bajo riesgo).

`SocketHandler` (línea 127-141) rodea el `onTableUpdate` del `CourtManager`
con un patrón correcto (scoped `io.to(tableInfo.id)` + split por modo). Pero
several handlers **no usan** ese patrón — emiten globales directamente.

El impacto: el owner ve canchas del club aparecer en su grid durante un
torneo, especialmente cuando un admin del club toca "Destacar" o termina un
partido de club.

### Fix — dos capas

**Capa 1: Defensa en profundidad client-side (obligatoria, simple)**

`useSocketState.handleCourtUpdate` debe rechazar canchas de club antes de
upsert. Filtro por `mode === COURT_MODE.CLUB` (discriminador presente en
`CourtInfo`). Una sola línea de guard. Conservador: **sólo aceptar
tournament courts** en el state del Owner.

Esto protege contra cualquier future leak server-side. Aunque arreglemos todos
los emite globales hoy, mañana alguien agrega otro handler y se vuelve a
mezclar. La defensa client-side cierra la entrada de una vez.

```typescript
// useSocketState.ts — handleCourtUpdate con filtro
import { COURT_MODE } from '@shared/types'
import type { CourtInfo } from '@shared/types'

const handleCourtUpdate = (court: CourtInfo) => {
  // Rechazar canchas de club — el OwnerDashboard solo muestra torneo.
  if (court.mode === COURT_MODE.CLUB) return
  setCourts(prev => ...)
}
```

**Capa 2: Root cause server-side (recomendada, limita scope del emit)**

Los handlers que emiten `COURT_UPDATE` global deben respetar el patrón de
`SocketHandler.onTableUpdate`: si la cancha es de club, NO hacer `io.emit`
global del `CourtInfo` — usar el bus ya establecido (emitir `CLUB_KIOSK_DATA`
es el canal correcto para estado de club).

Específicamente, en `SpotlightHandler` (los puntos 79, 100, 108), el flujo
featured de club ya emite `CLUB_KIOSK_DATA` via `broadcastClubKioskData`
(línea 52) — el **bug** es que también hace el `COURT_UPDATE` global. La
fix: cuando `isClubCourt(court)`, **no** emitir `COURT_UPDATE` global — ya
se emite correctamente via `CLUB_KIOSK_DATA`. Sólo emitir `COURT_UPDATE`
cuando la cancha es de torneo.

Para `AuthHandler:85` y `MatchEventHandler:115,165` — añadir el mismo guard:
si es club court, no hacer `io.emit(COURT_UPDATE)`. Las updates de club van
por `CLUB_KIOSK_DATA` emitidas desde el `onTableUpdate` del `CourtManager`.

### Files que toca el fix del bug

| Archivo | Cambio |
|---|---|
| `client/src/hooks/useSocketState.ts` | `handleCourtUpdate` + `handleCourtCreated` filtran `mode === CLUB` |
| `server/src/handlers/SpotlightHandler.ts` | Los tres `io.emit(COURT_UPDATE)` se envuelven en `if (!isClubCourt(court))` |
| `server/src/handlers/AuthHandler.ts` | Misma guard antes del emit line 85 |
| `server/src/handlers/MatchEventHandler.ts` | Misma guard antes del emit lines 115, 165 |

**Tests nuevos:**
- `useSocketState.test.ts` — añadir caso: `COURT_UPDATE` de club no agrega a `courts[]`
- `SpotlightHandler.test.ts`, `AuthHandler.test.ts`, `MatchEventHandler.test.ts` — assert: `COURT_UPDATE` **no** emitido global para canchas de club.

### Implicación para el bracket

El bracket consume `useSocketContext().courts` (canchas de torneo) para
poblar el modal de asignación de cancha. Con el fix del bug, este array
está **garantizado** libre de canchas de club. El bracket nunca ofrecerá
una cancha de club al owner. No necesita filtro adicional.

### courtId huérfano — defensa en profundidad

Si el owner borra una cancha que estaba asignada a un partido del bracket:
la UI del bracket no debe romper. Defensa:

- Al renderizar el partido, si `courtId` referencia una cancha que ya no está
  en `courts` (la lista del OwnerDashboard), mostrar el tag **"Cancha
  eliminada"** en gris, sin crash.
- El match sigue jugable (la cancha es informativa, no bloqueante).
- El owner puede re-asignar otra cancha o dejarlo así.

No se bloquea el delete de cancha desde la tab Canchas — solo se defiende la
UI del bracket. Bloquear el delete añadiría fricción innecesaria en medio
de un torneo.

---

## Seguridad

### 1. Validación de payload en runtime (NO asumir TypeScript)

Socket.IO entrega `any` en runtime. Cada handler del `BracketHandler` valida
antes de tocar el `BracketEngine`:

| Evento | Validación |
|---|---|
| `BRACKET_CREATE` | `name` string ≤ 50 chars; `numSlots` ∈ {4,8,16,32}; `includeThirdPlace` boolean opcional |
| `BRACKET_ASSIGN_PLAYER` | `matchId` existe; `slot` ∈ {'A','B'}; `name` string ≤ 50, trim ≠ '' (o `""` para limpiar slot) |
| `BRACKET_SET_WINNER` | `matchId` existe; `winner` ∈ {'A','B'}; match está `ready` |
| `BRACKET_ASSIGN_COURT` | `matchId` existe; `courtId` string; court existe en `getAllTournamentCourts()` |
| `BRACKET_UNDO_MATCH` | `matchId` existe; match está `completed` o `ready` |
| `BRACKET_RESET` | ver token de confirmación abajo |
| `BRACKET_GET` | (solo auth) |

Ante cualquier falla → `BRACKET_ERROR { code, message }` y **no mutar estado**.

### 2. Auth field verificado

Confirmado en código: `socket.data.isOwner === true` es el campo exacto
(ver `SpotlightHandler.ts:67` y `AuthHandler.ts:116`). El `BracketHandler`
usa **exactamente** ese campo. Non-owner sockets reciben `UNAUTHORIZED`.

### Bracket de 32 y consumo del sistema

Un bracket de 32 son 31 partidos, 5 rondas. En memoria: ~5 KB. En JSON en
disco: ~10 KB. El `StateStore` serializa ya todo (tournament + club) —
sumar 10 KB de bracket es despreciable. El límite real de 32 es por
**usabilidad en tablet**, no por hardware. 64 sería inviable de leer en una
pantalla, no de procesar.

### 3. BRACKET_RESET con token de confirmación

`BRACKET_RESET` es destructivo. Un solo evento socket puede borrar todo el
torneo. La confirmación UI no protege el server (segundo dispositivo,
reconexión fantasma, cliente buggy).

**Mecanismo:** el reset es dos pasos.

1. El owner emite `BRACKET_RESET` → el server responde con un token
   `BRACKET_RESET_CONFIRM { token, expiresIn: 30s }` y **no** borra nada.
2. El owner debe emitir `BRACKET_RESET` de nuevo con `{ confirmToken }`
   adentro en los 30 segundos siguientes → ahí borra.

Esto protege contra eventos accidentales sin fricción para el owner (que
toca "Borrar todo" dos veces en la UI, igual que un `ConfirmDialog`).

### 4. XSS en player names — antipatrón a evitar

React escapa strings por defecto. **Nunca** usar `dangerouslySetInnerHTML`
para renderizar nombres de jugadores. El nombre viene por socket sin
sanitización y debe mostrarse siempre como texto plano children. Cualquier
feature futura que quiera "formatear" nombres (negrita, emojis custom) debe
sanitizar explicitamente, no bypassar el escape de React.

Validación server: `name` se trunca a 50 chars antes de guardar. No se
restringen caracteres (los emojis y acentos son válidos en torneos reales),
solo se limita el largo.

---

## Edge cases — tratamiento

### 1. Byes implícitos (PUEDE pasar el viernes) — SOPORTADO

Si pasan 6 jugadores de fase de grupos a un bracket de 8, el owner asigna
jugadores a **6 slots** y deja **2 slots vacíos**. El sistema detecta
automáticamente que esos matches tienen solo 1 jugador → lo avanzan sin
que el owner tenga que hacer nada.

No hay botón "BYE" ni toggle explícito. Un slot vacío + un slot ocupado = bye.
Si ambos slots están vacíos, el match queda `pending`. Si ambos tienen nombre,
pasa a `ready`.

Si el owner después quiere llenar un slot vacío (para cancelar el bye), solo
asigna un nombre al slot vacío y el match pasa a `ready` — sin undo, sin
pasos extra.

### 2. Nombres duplicados — PERMITIDOS

Sin validación de duplicidad. El bracket es texto libre. El owner es
responsable de no poner "Juan" dos veces por error. Warning visual opcional
(sutil), nunca bloqueo.

### 3. Undo cascade — UN TOQUE

Como se detalló arriba. `BRACKET_UNDO_MATCH` revierte en cascada. No es
complejo para el owner, **es un gesto**. La complejidad vive en el
`BracketEngine` (un método, recursivo), no en la UI.

### 4. Cancha OCCUPIED en el court manager — WARNING VISUAL

Si `courtId` referencia una cancha que está `OCCUPIED` en tiempo real (en
la lista `courts` del OwnerDashboard), el card del bracket muestra un ícono
de advertencia sutil. **El bracket no bloquea** — el owner decide si espera
o cambia al partido. El bracket no sincroniza con el court manager porque en
este MVP no hay conexión automática. Es informativo.

### 5. Participante tardío — SLot REPLACE

Un bracket de 8 ya creado. Llega el jugador 9. El MVP no soporta resize
(`numSlots` es inmutable). **Solución:** el owner reemplaza un slot
existente. Borra el texto "TBD" o un nombre equivocado, pone "Luis".
Si el partido ya está `completed`, debe `BRACKET_UNDO_MATCH` primero.

No `BRACKET_RESET` para un solo cambio. El replace es la vía.

### 6. Reconexión — ESTADO ES LO QUE SE GUARDÓ

Si el owner está asignando en el modal y se corta el WiFi antes de
completar la asignación, el cambio **no llegó al server**, **no se guardó**.
Al reconectar, `BRACKET_STATE` manda el estado persistido (sin el cambio
incompleto). La UI cierra el modal y muestra el estado real.

**Sin** complejidad de "merge local + server". La regla es simple: lo que
se guardó es lo que hay. Menos código, menos bugs, más predecible. El owner
rehace el gesto. Aceptable para MVP.

### 7. Bracket activo sin completar a final — SIN PROBLEMA

El owner deja el bracket a mitad. Estado `active`. En reinicio del server,
se restaura y aparece half-completed. No es bug. El owner puede
`BRACKET_RESET` cuando quiera empezar de nuevo, o seguir donde lo dejó.

### 8. StateStore serialization en cada mutación — DEBOUNCE

Cada mutación del bracket dispara un `stateStore.save()` que serializa
todo (tournament + club + bracket) a SD card. Si el owner asigna 16 nombres
seguido en setup, son 16 writes en pocos segundos.

**Mitigación (MVP):** debouncear el save del bracket — mutar en memoria
siempre, persistir en batch cada **2 segundos** o en cambios significantes
(match `completed` → guarda immediatamente; asignación de slot → debounce 2s).

El riesgo: si se corta la luz en el medio de los 2 segundos del debounce,
se pierde el último cambio de slot (no un match completado, esos guardan ya).
Aceptable para MVP — el owner rehace un nombre, no pierde resultados.

---

## Persistencia — archivo separado (NO para el viernes)

El `StateStore` actual serializa todo junto. Separar el bracket en su propio
`bracket.json` sería más limpio (writes aislados, no contamina el state
principal), **pero** introduce complejidad de infraestructura (nuevo store,
migración del schema, tests). No es momento para el viernes.

**Decisión:** el bracket vive dentro del `StateStore` existente como un
campo `bracket: TournamentBracket | null`. Cuando el bracket crezca o haya
múltiples brackets simultáneos, se migra a archivo propio. Documentado, no
bloqueante.

---

## Eventos Socket

Toda la gestión es owner-only. El referee flow **no se toca**.

| Evento (Client → Server) | Payload | Acción |
|---|---|---|
| `BRACKET_CREATE` | `{ name, numSlots }` | Crea bracket vacío con rondas generadas |
| `BRACKET_ASSIGN_PLAYER` | `{ matchId, slot, name }` | Asigna participante a un slot. `name=""` limpia el slot |
| `BRACKET_SET_WINNER` | `{ matchId, winner }` | Marca ganador, avanza |
| `BRACKET_ASSIGN_COURT` | `{ matchId, courtId }` | Asigna cancha al partido |
| `BRACKET_UNDO_MATCH` | `{ matchId }` | Revoca resultado + cascada descendente |
| `BRACKET_GET` | `{}` | Solicita el bracket actual |
| `BRACKET_RESET` | `{}` o `{ confirmToken }` | Borra el bracket (dos pasos) |

| Evento (Server → Client) | Payload | Acción |
|---|---|---|
| `BRACKET_STATE` | `TournamentBracket \| null` | Estado completo, se emite en cambios |
| `BRACKET_ERROR` | `{ code, message }` | Errores de validación |
| `BRACKET_RESET_CONFIRM` | `{ token, expiresIn }` | Primer paso de reset — confirma token |

### Autorización

Todos los eventos `BRACKET_*` requieren `socket.data.isOwner === true`
(verificado en `SpotlightHandler.ts:67`, `AuthHandler.ts:116`). Non-owner
sockets reciben `BRACKET_ERROR { code: 'UNAUTHORIZED' }`. No hay broadcast
público en este MVP.

---

## UI — Tab nueva dentro del OwnerDashboard

El bracket es una **tab permanente** en el `OwnerDashboardPage`, junto a
"Canchas" e "Historial". Tercera tab con icono **Trophy** (lucide-react),
`flex-1` para repartir ancho (33% cada una con tres tabs). Usa el **mismo
`Tab` atom** que ya existe — sin estilos nuevos para los headers de tab.
Pequeña diferencia visual admitida: el contenido del tab "Torneo" tiene
**secciones internas por ronda** con un header de ronda con icono y label.

### Convenciones de diseño — reuso de átomos/moléculas existentes

El plan **no inventa diseño nuevo**. Antes de añadir cualquier estilo,
revisar `client/src/components/atoms/` y `client/src/components/molecules/`
para reutilizar lo que ya existe y que el bracket no choque visualmente con
el resto de la app.

Componentes existentes a **reusar tal cual**:

| Componente | Uso en el bracket |
|---|---|
| `atoms/Tab` (existent) | Header de tabs en OwnerDashboard |
| `atoms/Button` (variants: primary/secondary/outline/ghost/danger) | botones de cancha, slot tap, ganador A/B, cancelar |
| `atoms/Input` | texto del nombre de jugador en modal |
| `atoms/Badge` | PIN/estado de cancha en tarjeta de partido |
| `atoms/Typography` (Headline/Title/Body/Label/Caption) | headers de ronda y labels |
| `atoms/FloatingActionButton` | Acciones de reset del bracket (no FAB en este caso — usar Button) |
| `molecules/ConfirmDialog` | Confirmar ganador + confirmar reset |
| `molecules/PageHeader` | header externo del OwnerDashboard (ya está) |

Estilos de tarjetas: usar las clases utilitarias **existentes** del tema
(`card-light`, `bg-surface-low`, `border-l-4`, `--radius-md`, etc.) verificados
en `ClubAdminPage.tsx` y `OwnerDashboardPage.tsx`. No introducir clases
ad-hoc. La tarjeta de partido usa el mismo `card-light` + `border-l-4` del
`CourtCard` existente — coherencia visual.

### Nuevos componentes a crear

**Atomo nuevo: `Modal`** — en el codebase no existe un `Modal` genérico. Hoy
los modales se construyen ad-hoc (con un overlay + Card). Se **crea** un
átomo `Modal` reutilizable (`client/src/components/atoms/Modal/`) con props
`isOpen, onClose, title, children, fullscreen?: boolean`. Documentado con
tests. Este átomo servirá para el bracket **y para futuros modales de la app**
(FAB de crear cancha, configurar match, etc.) — alinea la consistencia.

Diseño del `Modal`:
- Base: overlay semi-transparente (`bg-black/50`), Card centrada con
  `max-w-md` y clase `card-light`, header con `Headline` + Cierre (X),
  contenido `children`, padding consistente con la app.
- `fullscreen: true` — solo en breakpoints `< 768px` (tablet portrait).
  En desktop el modal es `max-w-md` centrado aunque se pida fullscreen — el
  full-screen en desktop es negativo para UX.
- Transición con `framer-motion` (`AnimatePresence`, igual que AuthPage).
  Respetar `useReducedMotion` como hace `Button`.
- Cerrar por backdrop click, tecla Escape, o botón X.

**Molécula nueva: `BracketMatchCard`** — tarjeta de un partido del bracket
(`client/src/components/molecules/BracketMatchCard/`). Props:
`match: BracketMatch`, `courtLabel?: string`, `onAssignSlot`, `onSetBye`,
`onSetWinner`, `onAssignCourt`, `onUndo`. Renderiza:
- Slot A (Button variant ghost/outline full-width, label = playerA o
  "Tocá para asignar")
- "vs" (Caption)
- Slot B (idem A)
- Botón de cancha (Button variant secondary, icon MapPin lucide, label =
  courtLabel o "Sin cancha", o "Cancha eliminada" en gris si `courtLabel`
  no resuelve)
- Si `ready` no-bye: dos Buttons `danger` full-width para "Ganó A" / "Ganó B"
- Si `completed`: Badge "Completado" + Button ghost `Undo2` "Deshacer"
- Si un slot está vacío y el otro tiene jugador (bye implícito): el slot vacío
  se muestra como espacio inactivo (gris, sin texto), y el slot ocupado muestra
  un badge "Avanza directo" + Caption "sin oponente"
- Si ambos slots están vacíos: ambos se muestran como "Tocá para asignar"
- Warning visual sutil (ícono `AlertTriangle` amarillo, no bloqueante) si
  `courtLabel` refiere cancha OCCUPIED — informado por el parent via prop
  `courtOccupied: boolean`

Reuse de `Button` atoms y clases `card-light` para coherencia.

**Organismo nuevo: `BracketView`** — el árbol completo, secciones por ronda.
(`client/src/components/organisms/BracketView/`). Usa `Headline` para el
header de cada ronda, `motion.div` con `layout` (igual que el grid de
`ClubAdminPage`), y renderiza `BracketMatchCard` por match. Estado empty si
`bracket === null` → formulario de setup. Memoizado por ronda para evitar
re-renders innecesarios en el Orange Pi.

### Layout responsive — una sola estructura

| Ancho | Layout partidos en BracketView | Modal |
|---|---|---|
| < 768px (tablet portrait, móvil) | 1 columna, cards full-width apiladas por ronda | `fullscreen: true` |
| 768-1024px (tablet landscape) | 1 columna, tarjetas anchas | `fullscreen: true` |
| ≥ 1024px (desktop) | **2 columnas** dentro de cada ronda (grid responsive) | `max-w-md` centrado |

Tap targets mínimo **56px** en todos. Buttons existentes: `size="md"` ≈ 40px,
`size="lg"` ≈ 48px, `size="xl"` ≈ 56px — usar `size="lg"` para slots/canchas
y `size="md"` para acciones secundarias (deshacer, cancelar).

Invariable entre breakpoints: estructura vertical por ronda (nunca árbol
horizontal), modales (`Modal` atom, nunca dropdowns nativos), botones
"Ganó A / Ganó B" `fullWidth` dentro de la tarjeta, contraste alto, clases
del tema.

### Flujo del owner

1. **Tab "Torneo"** (icono Trophy) en el OwnerDashboard. Si `bracket ===
   null` → muestra vista setup: `Input` para nombre + `Button` group para
   `numSlots` (4/8/16/32) + toggle "Incluir 3er puesto" (default off) +
   `Button` primary "Crear".
2. **Asignar participantes**: tap en cada slot vacío (Button outline con
   placeholder "Tocá para asignar") → abre `Modal` con `Input` autofocus +
   Buttons "Guardar" / "Cancelar". Si se guarda vacío (`""`), el slot se limpia.
   Un slot vacío + slot ocupado al otro lado = bye implícito (auto-avance).
3. **Asignar canchas**: tap en el botón "Sin cancha" / cancha actual del
   `BracketMatchCard` → abre `Modal` con lista de canchas (Button secondary
   full-width grande) + "Sin cancha" + "Cancelar". La lista proviene de
   `useSocketContext().courts` (canchas de torneo, filtradas en el server).
   **No** escribe IDs a mano.
4. **Marcar ganador**: botones "Ganó A" / "Ganó B" (Button danger
   `fullWidth`) cuando el match está `ready`. Confirmación con
   `ConfirmDialog` (molécula existente) antes de marcar.
5. **Deshacer**: botón `Undo2` "Deshacer" (`Button` ghost) en matches
   `completed` — un toque, cascada automática. `ConfirmDialog` antes.
6. **El bracket se actualiza solo** via `BRACKET_STATE` tras cada cambio.
   Re-render memoizado por ronda.

---

## Archivos a tocar

### Tier 0 — Bug fix: canchas mezcladas en OwnerDashboard (PREREQUISITO)

Se hace **antes** del bracket porque el bracket consume `useSocketContext().courts`
y debe estar garantizado libre de canchas de club.

| Archivo | Tipo | Cambio |
|---|---|---|
| `client/src/hooks/useSocketState.ts` | **EDIT** | `handleCourtUpdate` y `handleCourtCreated` filtran `mode === COURT_MODE.CLUB` antes de upsert |
| `server/src/handlers/SpotlightHandler.ts` | **EDIT** | líneas 79/100/108: envolver `io.emit(COURT_UPDATE)` en `if (!isClubCourt(court))` |
| `server/src/handlers/AuthHandler.ts` | **EDIT** | línea 85: misma guard antes del emit |
| `server/src/handlers/MatchEventHandler.ts` | **EDIT** | líneas 115/165: misma guard antes del emit |
| `client/src/hooks/useSocketState.test.ts` | **EDIT/ADD** | caso: `COURT_UPDATE` club no agrega a `courts[]` |
| `server/src/handlers/SpotlightHandler.test.ts` | **EDIT/ADD** | assert: no `COURT_UPDATE` global para club court |
| `server/src/handlers/AuthHandler.test.ts` | **EDIT/ADD** | assert: no `COURT_UPDATE` global para club court (si aplica) |
| `server/src/handlers/MatchEventHandler.test.ts` | **EDIT/ADD** | assert: no `COURT_UPDATE` global para club court |

### Tier 1 — Shared (2 archivos)

| Archivo | Tipo de cambio |
|---|---|
| `shared/types.ts` | Agregar `BRACKET_STATUS`, `BracketStatus`, `BRACKET_MATCH_STATUS`, `BracketMatchStatus` (const-object + derived type, como `CLUB_STATUS`), `TournamentBracket`, `BracketRound`, `BracketMatch` (con `isByeA`, `isByeB`, `winner: Player`) |
| `shared/events.ts` | Agregar eventos `BRACKET_*` al const de SocketEvents (crear, asignar, bye, winner, court, undo, reset, get + state, error, reset_confirm) |
| `shared/__tests__/bracket-types.test.ts` | **NUEVO** — tests de tipos y enum |

### Tier 2 — Server (4 nuevos + 2 edits) — strictly TDD

| Archivo | Tipo |
|---|---|
| `server/domain/BracketEngine.ts` | **NUEVO** — lógica pura: crear, asignar, bye, avanzar, undo-cascade, validar, toJSON/fromJSON. Sin dependencias a Socket.IO. |
| `server/domain/BracketEngine.test.ts` | **NUEVO** — tests TDD (crear, asignar, bye, avanzar, undo, validaciones de tamaño y nombres, persistencia) |
| `server/handlers/BracketHandler.ts` | **NUEVO** — eventos socket, gate `socket.data.isOwner === true`, validación de payload runtime, reset en 2 pasos con token 30s |
| `server/handlers/BracketHandler.test.ts` | **NUEVO** — tests TDD (eventos, auth, validación, error codes, reset tokens, UNAUTHORIZED para no-owner) |
| `server/domain/courtManager.ts` | **EDIT** — `getAllTournamentCourts()` ya existe, solo wire al handler |
| `server/handlers/index.ts` o `server/socket.ts` | **EDIT** — registrar `BracketHandler` con el `ownerPin` |

**Persistencia:** campo opcional `bracket: TournamentBracket | null` en el esquema del StateStore. Default `null`, sin migración. Save con **debounce 2s** para asignar-slot/bye, **inmediato** para `match.completed` y `RESET`.

### Tier 3 — Client átomos/moléculas/organismos nuevos (siguiendo patrones existentes)

| Archivo | Tipo | Notas |
|---|---|---|
| `client/src/components/atoms/Modal/Modal.tsx` | **NUEVO** | Átomo genérico reutilizable — `isOpen, onClose, title, children, fullscreen?`. Overlay + Card + framer-motion AnimatePresence / useReducedMotion (igual que Button). Solo desktop podría ser `max-w-md`. |
| `client/src/components/atoms/Modal/Modal.test.tsx` | **NUEVO** | tests del átomo (renderer, escape, backdrop, fullscreen prop) |
| `client/src/components/atoms/Modal/index.ts` | **NUEVO** | export |
| `client/src/components/atoms/index.ts` | **EDIT** | exportar `Modal` y `ModalProps` |
| `client/src/components/molecules/BracketMatchCard/BracketMatchCard.tsx` | **NUEVO** | Tarjeta de un partido — reusa `Button`, `Badge`, `Typography`, clases `card-light` del tema |
| `client/src/components/molecules/BracketMatchCard/BracketMatchCard.test.tsx` | **NUEVO** | tests |
| `client/src/components/molecules/BracketMatchCard/index.ts` | **NUEVO** | export |
| `client/src/components/molecules/index.ts` | **EDIT** | exportar `BracketMatchCard` |
| `client/src/components/organisms/BracketView/BracketView.tsx` | **NUEVO** | secciones por ronda, usa `Headline` + `BracketMatchCard` por match + `Modal` para slots y canchas + `ConfirmDialog` para ganador/undo. Memoizar por ronda. |
| `client/src/components/organisms/BracketView/BracketView.test.tsx` | **NUEVO** | tests |
| `client/src/components/organisms/BracketView/index.ts` | **NUEVO** | export |
| `client/src/hooks/useBracket.ts` | **NUEVO** | hook: emite eventos, escucha `BRACKET_STATE`/`BRACKET_ERROR`, estado local |
| `client/src/hooks/useBracket.test.ts` | **NUEVO** | tests del hook |
| `client/src/hooks/index.ts` | **EDIT** | exportar `useBracket` |
| `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx` | **EDIT** | Tercera tab "Torneo" (icono Trophy, `flex-1`), wire del `useBracket` + `BracketView`. Vacío/setup si `bracket === null`. |
| `client/src/i18n/locales/es.json`, `en-US.json` | **EDIT** | claves para bracket, rondas, byes, setup, errores (nota: archivo es `es.json`, no `es-AR.json`) |

### Docs

| Archivo | Tipo |
|---|---|
| `docs/bracket-mvp-plan.md` | Este documento |

**Total: ~22 archivos, 13 nuevos, ~9 edits.** Estimado ~1100-1400 líneas (incluye bug fix, tests, byes, undo-cascade, validaciones, átomo Modal y molécula BracketMatchCard).

---

## Plan de implementación

Orden estricto. `strict_tdd: true` en `openspec/config.yaml`.

### Tier 0 — Bug fix (PREREQUISITO, sin depender el bracket)

1. **Client defense** — `useSocketState.handleCourtUpdate` y `handleCourtCreated`
   filtran `mode === COURT_MODE.CLUB` antes de upsert. Tests.
2. **Server root cause** — en `SpotlightHandler`, `AuthHandler`,
   `MatchEventHandler`, envolver los `io.emit(COURT_UPDATE)` globales con
   guard `if (!isClubCourt(court))`. Tests: assert NO emitido para club court.
3. **Smoke manual** — owner conectado, admin del club toca featured, owner
   NO ve cancha de club en su grid.

### Tier 1 — Shared

4. **Shared types + events** (`shared/types.ts`, `shared/events.ts`)
   - Tipos con const-object + derived type. Eventos en el const de SocketEvents.
   - Tests de tipos en `shared/__tests__/bracket-types.test.ts`.

### Tier 2 — Server (TDD)

5. **BracketEngine domain + tests** (`server/domain/BracketEngine.ts`)
   - TDD: tests primero — crear, asignar, bye, avanzar, undo-cascade,
     validaciones de tamaño, nombres edge, toJSON/fromJSON.
6. **Persistencia** — agregar `bracket` opcional al esquema del StateStore.
   Save con debounce 2s para slots, inmediato para completed/reset.
   Test de persist + restauración post-reinicio.
7. **BracketHandler + tests** (`server/handlers/BracketHandler.ts`)
   - TDD: tests primero — eventos, gate owner (`isOwner === true`), validación
     de payload (tamaño, nombre, winner, slot), reset en 2 pasos (token 30s),
     errores.
8. **Wire handler** (`server/handlers/index.ts`, `server/socket.ts`)

### Tier 3 — Client (TDD)

9. **Modal atom** (`client/src/components/atoms/Modal/`) — átomo genérico +
   tests. Reutilizable para toda la app.
10. **useBracket hook** (`client/src/hooks/useBracket.ts`) + tests
11. **BracketMatchCard molecule** (`client/src/components/molecules/BracketMatchCard/`)
    + tests.
12. **BracketView organism** (`client/src/components/organisms/BracketView/`)
    + tests — secciones verticales responsive, modales, byes, undo, warning
    cancha occupied, memoización por ronda.
13. **OwnerDashboardPage integration** — tercera tab (icono Trophy, `flex-1`),
    wire del hook, vista setup si `bracket === null`.
14. **i18n** — claves de bracket en `es.json` y `en-US.json`.

### Tier 4 — Smoke manual final

15. **End-to-end smoke** — arrancar, crear bracket de 8 con 2 byes, asignar
    6 nombres, asignar 3 canchas, marcar ganadores, deshacer uno, reiniciar
    server, verificar persistencia. Probar reset (2 pasos, token caduca 30s).
    Touch targets ≥ 56px en tablet portrait.

Tiempo estimado: **5-6 horas** de sesión enfocada (bug fix + átomo Modal +
byes + undo-cascade + validaciones).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Byes implícitos — match con 2 slots vacíos | Se queda `pending`, no es error. El owner lo llena después o avanza manual si corresponde |
| Undo cascade recursivo infinito | Cap: si `round` es la final, no hay siguiente — caso base del recursión |
| Edición en cascada manual | **Eliminada** — `BRACKET_UNDO_MATCH` hace la cascada atomically en el server |
| Participante duplicado | **Eliminada** — no se valida, texto libre |
| Corte de luz en mitad de debounce de 2s | Aceptable — se pierde el último cambio de slot (no un match completed, esos guardan ya). El owner rehace un nombre. |
| Orange Pi renderiza lento el bracket | CSS grid plano, sin animaciones, sin re-render de todo el árbol (memoizar por ronda) |
| Owner se equivoca de ganador | `ConfirmDialog` antes de marcar + `BRACKET_UNDO_MATCH` disponible |
| courtId huérfano (cancha borrada) | UI del bracket muestra "Cancha eliminada" en gris, no rompe |
| Cancha duplicada en la misma ronda | **Warning visual sutil** (ícono amarillo) en ambos partidos, no bloqueo. El owner decide. |
| Cancha OCCUPIED en tiempo real | Warning visual en el card del bracket. No bloquea. |
| Reset accidental | Reset en 2 pasos con token 30s — segundo evento socket con el token para confirmar |

---

## Verificación para el viernes

Checklist funcional antes del torneo:

### Bug fix de canchas (prerequisito)

- [ ] Owner conectado + admin del club toca "Destacar" en una cancha de club
      → el OwnerDashboard **NO** muestra cancha de club en su grid.
- [ ] Referee flow de club sigue funcionando sin errores de broadcast.

### Bracket

- [ ] Crear bracket de 8 desde la tab "Torneo" del OwnerDashboard
- [ ] Asignar 6 nombres, dejar 2 slots vacíos → los 2 matches con un solo jugador auto-avanzan (byes implícitos), dejando 6 en cuartos
- [ ] Asignar canchas a los 4 partidos de QF (modal de botones grandes)
- [ ] Marcar ganadores → avanzan a SF automáticamente
- [ ] Deshacer un QF ya avanzado → SF y (si avanzó) Final se revierten solos
- [ ] Completar SF → final con los 2 ganadores
- [ ] Marcar ganador de la final → bracket `completed`
- [ ] Crear bracket con 3er puesto ON → semifinalistas perdedores aparecen como slots en match de 3er puesto
- [ ] Dejar vacío un slot del 3er puesto → el otro gana automático (bye implícito)
- [ ] Crear bracket con 3er puesto OFF → no aparece el match extra
- [ ] Confirmar que `BRACKET_STATUS` se muestra como Badge (no como magic string)
- [ ] Reiniciar el server → bracket persiste y se restaura
- [ ] Confirmar que referees **no ven** nada del bracket
- [ ] Abrir en tablet portrait — todos los tap targets ≥ 56px, modales full-screen
- [ ] Abrir en desktop — 2 columnas por ronda, modales centrados `max-w-md`
- [ ] Probar el reset (2 pasos, token caduca a los 30s)
- [ ] Probar que un non-owner socket no puede crear/asignar/marcar (UNAUTHORIZED)
- [ ] Probar el modal de asignar cancha con una cancha OCCUPIED → warning visual amarillo, no bloqueo
- [ ] Borrar una cancha asignada desde la tab Canchas → bracket muestra "Cancha eliminada" en gris, no rompe
- [ ] UI del bracket respeta clases del tema (`card-light`, `border-l-4`, variants de Button existentes) — no choca visualmente con el resto de OwnerDashboard

---

## Out of scope explícito (para futura iteración)

- **Vista pública del bracket en kiosko/tele** — requiere emisión de patches
  parciales (no full-state) para escalar a múltiples viewers. Modelo de
  eventos open: un evento `BRACKET_PUBLIC_STATE` broadcast-only, readonly.
- Conexión automática bracket ↔ scoring referee (cuando termina un partido
  en la cancha X, el bracket lo detecta y avanza solo).
- Doble eliminación / loser bracket.
- Fase de grupos integrada.
- Bracket de consolación.
- Resize del bracket post-creación (cambiar de 8 a 16 jugadores sin reset).
- Múltiples brackets simultáneos (MVP es single bracket global).
- Export de resultados a CSV/PDF.
- Notificaciones "tu partido arranca en cancha X".
- Archivo de persistencia separado del StateStore (cuando el bracket crezca).