# Feature: Club Session Lifecycle — Modo Libre + Post-Match Continuity

> Documento de diseño y alcance. Pendiente de revisión.
> Basado en discusión del 17-Jul-2026.

---

## Problema

Hoy cuando un partido en modo club termina, la cancha pasa automáticamente a
`FINISHED` y la sesión se corta. Los jugadores no pueden:

- Seguir jugando después de un match (reset o nuevo partido)
- Jugar sin puntuación (entrada en calor, práctica libre)
- Ver cuánto tiempo llevan

El admin cobra por tiempo, no por partido. Cortar la sesión al terminar el
match es incorrecto para el modelo de negocio.

---

## Solución propuesta

Dos modos de juego dentro de una sesión en cancha de club:

| Modo | Descripción | Timer | Marcador |
|---|---|---|---|
| **Libre** | Juego sin puntuación. Solo timer + nombres | ✅ Corre | ❌ No |
| **Match** | Partido con puntuación | ✅ Corre | ✅ Sí |

La sesión dura lo que los jugadores quieran. Solo Terminar Sesión la finaliza.

### Flujo general

```
[ClubPlayPage]
     │
     │ JOIN con PIN
     ▼
┌──────────────────────────────────────┐
│  Configuración inicial               │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │  🎯 Modo Libre                   │ │
│  │     Sin puntuación               │ │
│  ├─────────────────────────────────┤ │
│  │  🏆 Modo Match                   │ │
│  │     Partido con puntuación       │ │
│  └─────────────────────────────────┘ │
│                                      │
│         [Comenzar]                   │
└──────────┬───────────────────────────┘
           │
     ┌─────┴────────────────┐
     │                      │
     ▼                      ▼
┌──────────────┐   ┌──────────────────────────────────┐
│ MODO LIBRE   │   │ Configuración del Match          │
│              │   │                                  │
│ Timer corre  │   │  Puntos por set: [15  ▼]         │
│ Sin marcador │   │  Al mejor de:    [3   ▼]         │
│              │   │  Handicap A: [0]    B: [0]       │
│ [Jugar match]│   │  ────────────────────────────    │
│ [Terminar]   │   │  Jugador A: [__________]         │
│              │   │  Jugador B: [__________]         │
│              │   │                                  │
│              │   │        [Empezar partido]         │
└──────────────┘   └──────────────┬───────────────────┘
                                  │
                                  ▼
                         ┌───────────────────────┐
                         │   MODO MATCH           │
                         │   Marcador + Timer     │
                         │                        │
                         │   [⏹ Terminar sesión] │
                         └───────┬───────────────┘
                                 │
                            Match termina
                                 │
                                 ▼
                         ┌──────────────────────────────┐
                         │       Post-Match              │
                         │                              │
                         │  ┌────────────────────────┐  │
                         │  │ 🔄 Reset (0-0)         │  │
                         │  ├────────────────────────┤  │
                         │  │ 🆕 Nuevo partido       │  │
                         │  ├────────────────────────┤  │
                         │  │ 🎯 Ir a modo libre     │  │
                         │  ├────────────────────────┤  │
                         │  │ ⏹ Terminar sesión      │  │
                         │  └────────────────────────┘  │
                         └──────────────┬───────────────┘
                                        │
                            ╔═══════════╧══════════════╗
                            ║  ⏹ ¿Terminar sesión?    ║
                            ║  Tiempo: 45:12          ║
                            ║                          ║
                            ║  [Sí]        [Cancelar]  ║
                            ╚══════════════╤═══════════╝
                                           │ Sí
                                           ▼
                                 ┌──────────────────────────┐
                                 │   Sesión finalizada       │
                                 │   Tiempo: 45 min          │
                                 │                          │
                                 │   [Volver a inicio]       │
                                 └──────────────────────────┘
```

---

## Timer

### Cómo funciona

- Lo lleva el **server**, no el cliente ni el admin
- Arranca cuando la cancha pasa a `OCCUPIED` (al activar o al primer JOIN)
- Se calcula como `elapsed = now - sessionStart` al recibir `CLUB_END_SESSION`
- El cliente muestra un timer visual sincronizado:
  - Al conectar: recibe `elapsed` via `CLUB_RECONNECT_RESULT`
  - En tiempo real: el cliente calcula localmente desde `sessionStart`
  - No se muestra valor monetario, solo tiempo

### Display en móvil

```
┌─────────────────────────┐
│    ⏱ 15:23             │
│                         │
│  [Jugador A] [Jugador B]│
│                         │
│  ┌───────────────────┐ │
│  │  Botones de acción │ │
│  └───────────────────┘ │
└─────────────────────────┘
```

Timer visible **siempre** en el scoreboard, ambos modos.

---

## UI / Screens

### Configuración inicial (al hacer JOIN)

Primera pantalla: solo selector de modo. Sin nombres.

```
┌──────────────────────────────────────┐
│  ┌─────────────────────────────────┐ │
│  │  🎯 Modo Libre                   │ │
│  │     Sin puntuación               │ │
│  ├─────────────────────────────────┤ │
│  │  🏆 Modo Match                   │ │
│  │     Partido con puntuación       │ │
│  └─────────────────────────────────┘ │
│                                      │
│         [Comenzar]                   │
└──────────────────────────────────────┘
```

- Si seleccionan **Modo Libre** → va directo a la pantalla de modo libre, sin pedir nada
- Si seleccionan **Modo Match** → pasa a la configuración del match

### Configuración del Match (antes de empezar)

Aparece al seleccionar "Modo Match" en la config inicial, al tocar
"Jugar partido" desde modo libre, o al elegir "Nuevo partido" post-match.
Aquí recién se piden los nombres de los jugadores (solo en match tiene
sentido tenerlos).

```
┌──────────────────────────────────┐
│  Configuración del partido        │
│                                   │
│  Puntos por set: [15  ▼]         │
│  Al mejor de:    [3   ▼]         │
│  Handicap A: [0]    B: [0]       │
│  ─────────────────────────────    │
│  Jugador A: [__________]         │
│  Jugador B: [__________]         │
│                                   │
│        [Empezar partido]          │
└──────────────────────────────────┘
```

| Campo | Valores típicos | Descripción |
|---|---|---|
| Puntos por set | 15 (default), 21, 11, 6 | Puntos necesarios para ganar un set |
| Al mejor de | 1, 3 (default), 5 | Cantidad de sets para ganar el partido |
| Handicap A / B | 0 (default), 2, 4, 6 | Puntos de ventaja inicial |
| Jugador A / B | Texto libre | Nombres visibles en el scoreboard |

### Modo Libre — pantalla en móvil

```
┌─────────────────────────────┐
│         ⏱ 15:23            │
│                             │
│   🟢 En cancha — Modo Libre │
│                             │
│   [Jugador A] [Jugador B]  │
│                             │
│  ┌───────────────────────┐ │
│  │  🏆 Jugar partido     │ │
│  ├───────────────────────┤ │
│  │  ⏹ Terminar sesión    │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

Sin marcador. Botón "Jugar partido" abre la pantalla de
configuración del match (puntos por set, handicap, nombres) sin terminar
la sesión (timer sigue corriendo). Una vez configurado, arranca el
partido.

### Modo Match — pantalla en móvil

```
┌─────────────────────────────┐
│     ⏱ 15:23                │
│   🏆 Partido en curso       │
│                             │
│  ┌─────────────────────────┐│
│  │   Marcador (como hoy)    ││
│  │   Puntos, sets, etc.    ││
│  └─────────────────────────┘│
│                             │
│  ┌───────────────────────┐ │
│  │  ⏹ Terminar sesión    │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

Cuando el match termina, aparece el modal post-match con opciones.

### Modal post-match

| Opción | Acción |
|---|---|
| 🔄 Reset | Misma config del match, marcador 0-0. Vuelve a LIVE |
| 🆕 Nuevo partido | Abre la pantalla de configuración del match (puntos, handicap, nombres). Vuelve a LIVE |
| 🎯 Modo Libre | Sale del match, entra a modo libre (timer sigue, sin marcador) |
| ⏹ Terminar sesión | Abre confirmación con tiempo transcurrido |

### Confirmación al Terminar sesión

```
┌──────────────────────────┐
│  ⏹ Terminar sesión       │
│                          │
│  Tiempo transcurrido:    │
│       45:12              │
│                          │
│  [Sí, terminar]  [Cancelar]│
└──────────────────────────┘
```

---

## Cambios en Server

### Estados de cancha (club mode)

No se agregan nuevos estados. Se agrega campo `sessionMode`.

```
AVAILABLE → OCCUPIED { sessionMode: free | match }
```

| Evento | Comportamiento actual | Comportamiento nuevo |
|---|---|---|
| Match termina (club) | `OCCUPIED → FINISHED` | Sigue `OCCUPIED`, `sessionMode=match`, espera acción del jugador |
| CLUB_END_SESSION | Ya existe para admin | También lo emite el jugador desde el scoreboard |
| CLUB_FORCE_END | Admin fuerza fin | Sin cambios |
| Disconnect de todos los jugadores | Nada | Marcar "sin jugadores" |

### Nuevos eventos cliente → server

A definir en `shared/events.ts`:

| Evento | Payload | Descripción |
|---|---|---|
| `CLUB_START_FREE` | `{ courtId }` | Inicia modo libre en la cancha |
| `CLUB_RESET_MATCH` | `{ courtId }` | Reinicia marcador 0-0 (misma config) |
| `CLUB_NEW_MATCH` | `{ courtId, playerNameA, playerNameB }` | Nuevo partido con posibles nuevos jugadores |

### Nuevos eventos server → cliente

| Evento | Payload | Descripción |
|---|---|---|
| `CLUB_FREE_STARTED` | `{ courtId }` | Confirma modo libre activo |
| `CLUB_MATCH_RESET` | `{ courtId, matchState }` | Confirma reset con marcador en 0 |
| `CLUB_SESSION_TIMER` | `{ courtId, elapsedSeconds }` | Sincronización periódica del timer (opcional) |

### Handlers a modificar

| Handler | Cambio |
|---|---|
| `ClubPlayerHandler.ts` | `CLUB_RECONNECT` devuelve `sessionMode` y `elapsed` |
| `ClubCourtHandler.ts` | `CLUB_END_SESSION` calcula elapsed antes de pasar a FINISHED |
| Nuevo handler o en `ClubPlayerHandler.ts` | Manejar `CLUB_START_FREE`, `CLUB_RESET_MATCH`, `CLUB_NEW_MATCH` |

---

## Cambios en Client

### Hooks

| Hook | Cambio |
|---|---|
| `useClubPlay.ts` | Agregar `sessionMode`, `elapsedSeconds`, handlers nuevos |
| Nuevo: `useClubTimer.ts` | Timer local sincronizado con server |

### Componentes nuevos

| Componente | Descripción |
|---|---|
| `ClubSessionConfig` | Pantalla de configuración inicial: nombres + selector Libre/Match (al JOIN) |
| `ClubMatchConfig` | Pantalla de configuración del match: puntos, sets, handicap, nombres |
| `ClubFreePlay` | Pantalla de modo libre: timer + nombres + botones (Jugar match, Terminar) |
| `ClubSessionTimer` | Display de timer con sincronización |
| `ClubEndSessionConfirm` | Confirmación al terminar sesión: tiempo transcurrido + Sí/No |

### Páginas

| Página | Cambio |
|---|---|
| `ClubPlayPage.tsx` | Integrar modal de config, alternar entre Libre/Match, botón Terminar siempre visible |

---

## Casos borde

### 1. Admin termina sesión a voluntad

Ya existe (`CLUB_FORCE_END` / `CLUB_DEACTIVATE_COURT`). El admin fuerza
`FINISHED`. El jugador recibe `CLUB_SESSION_ENDED` con `reason: 'force'` y ve
"Finalizada por el admin".

### 2. Más de un jugador en modo libre

El server soporta múltiples sockets por mesa. En modo libre se muestran
nombres sin marcador. Sin restricción técnica.

### 3. Timer manipulable

No. El timer lo lleva el server:
- `startTime` se guarda cuando la cancha pasa a `OCCUPIED`
- `CLUB_END_SESSION` calcula `now - startTime`
- El cliente nunca envía elapsed, solo lo muestra

### 4. Admin como autoridad

El admin puede forzar fin de cualquier sesión desde su dashboard. Ya existe.

### 5. Jugador cierra navegador sin terminar sesión

| Evento | Reacción |
|---|---|
| Se desconectan TODOS los jugadores | Server inicia timer de gracia (ej. 5 min) |
| Vuelven antes | Reconexión normal, timer sigue |
| No vuelven | Admin ve "Ocupado — sin jugadores" en dashboard |
| Admin decide | Termina la sesión manualmente |

No se auto-termina para no cobrar de más.

---

## Archivos a tocar (estimado)

| Archivo | Cambio |
|---|---|
| `shared/events.ts` | Agregar eventos nuevos (5-6) |
| `shared/types.ts` | Agregar `sessionMode` a `ClubCourt` / `ClubKioskCourtInfo` |
| `server/src/domain/courtManager.ts` | Lógica de match termina en club (no auto-FINISHED) |
| `server/src/handlers/ClubPlayerHandler.ts` | CLUB_RECONNECT con sessionMode + elapsed |
| `server/src/handlers/ClubCourtHandler.ts` | CLUB_END_SESSION para jugadores |
| `server/src/handlers/SocketHandler.ts` | Registrar nuevos handlers |
| `client/src/hooks/useClubPlay.ts` | sessionMode, timer, nuevos eventos |
| `client/src/hooks/useClubTimer.ts` | (nuevo) timer local sincronizado |
| `client/src/pages/ClubPlayPage/ClubPlayPage.tsx` | Integrar modos y timer |
| `client/src/components/molecules/ClubSessionConfigModal.tsx` | (nuevo) |
| `client/src/components/molecules/ClubEndSessionConfirm.tsx` | (nuevo) |

---

## Pendiente para mañana

- [ ] Revisar y ajustar este documento
- [ ] Definir si arrancamos con SDD o directo a implementar
- [ ] Evaluar si el timer de gracia (desconexión) se implementa en esta iteración o después
- [ ] Confirmar comportamiento de CLUB_RECONNECT con `sessionMode` y `elapsed`
