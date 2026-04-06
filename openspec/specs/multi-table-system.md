# Spec: Multi-Table Tournament System

> **Change**: add-multi-table-system  
> **Version**: 1.0.0  
> **Status**: Draft  
> **Last Updated**: 2026-04-06

---

## 1. Concept & Vision

**Multi-Table Tournament System** extiende rallyOS-hub para soportar múltiples mesas de juego concurrentes en un mismo torneo. Cada mesa opera de forma independiente con su propio match engine, esperando room, y PIN de referee.

**Core Value**: "Un hub, muchos partidos"

---

## 2. Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         rallyOS-hub                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              TableManager                                │    │
│  │                                                         │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │    │
│  │  │ Table 1 │ │ Table 2 │ │ Table 3 │ │ Table N │     │    │
│  │  │ LIVE    │ │ WAITING │ │ CONFIG  │ │FINISHED │     │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘     │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              ConnectionManager                            │    │
│  │  - Map<socketId, {tableId, role, name}>                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Table States

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| `WAITING` | Mesa creada, esperando jugadores | → CONFIGURING |
| `CONFIGURING` | Referee configurando match | → LIVE, → WAITING |
| `LIVE` | Match en progreso | → FINISHED |
| `FINISHED` | Match completado | → WAITING (reset) |

### 2.3 Data Model

```typescript
interface Table {
  id: string;                    // UUID
  number: number;                // 1, 2, 3...
  name: string;                  // "Mesa 1" or custom
  status: TableStatus;
  pin: string;                   // 4-digit PIN for referee
  matchEngine: MatchEngine;
  playerNames: { a: string; b: string };
  history: ScoreChange[];        // For undo
  players: PlayerConnection[];
  createdAt: number;
}

interface PlayerConnection {
  socketId: string;
  name: string;
  role: 'REFEREE' | 'PLAYER_A' | 'PLAYER_B' | 'SPECTATOR';
  joinedAt: number;
}

interface ScoreChange {
  id: string;
  player: Player;
  action: 'POINT' | 'CORRECTION';
  pointsBefore: { a: number; b: number };
  pointsAfter: { a: number; b: number };
  timestamp: number;
}

type TableStatus = 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';
```

---

## 3. Socket.io Events

### 3.1 Client → Server Events

| Event | Payload | Description | Auth |
|-------|---------|-------------|------|
| `CREATE_TABLE` | `{ name?: string }` | Crear nueva mesa | — |
| `LIST_TABLES` | — | Obtener todas las mesas | — |
| `JOIN_TABLE` | `{ tableId: string, name: string }` | Unirse a mesa | — |
| `LEAVE_TABLE` | `{ tableId: string }` | Salir de mesa | — |
| `SET_REF` | `{ tableId: string, pin: string }` | Autenticarse como referee | PIN |
| `CONFIGURE_MATCH` | `{ tableId: string, config: MatchConfig }` | Configurar match | Referee |
| `START_MATCH` | `{ tableId: string }` | Iniciar match | Referee |
| `RECORD_POINT` | `{ tableId: string, player: Player }` | Marcar punto | Referee |
| `SUBTRACT_POINT` | `{ tableId: string, player: Player }` | Descontar punto | Referee |
| `UNDO_LAST` | `{ tableId: string }` | Deshacer último punto | Referee |
| `SET_SERVER` | `{ tableId: string, player: Player }` | Cambiar servicio | Referee |
| `RESET_TABLE` | `{ tableId: string, config?: MatchConfig }` | Reset match | Referee |
| `REQUEST_TABLE_STATE` | `{ tableId: string }` | Obtener estado actual | — |

### 3.2 Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `TABLE_LIST` | `TableInfo[]` | Lista actualizada de mesas |
| `TABLE_CREATED` | `TableInfo` | Nueva mesa creada |
| `TABLE_UPDATE` | `TableInfo` | Mesa actualizada |
| `TABLE_DELETED` | `{ tableId: string }` | Mesa eliminada |
| `MATCH_UPDATE` | `{ tableId: string, state: MatchState }` | Estado del match |
| `PLAYER_JOINED` | `{ tableId: string, player: PlayerConnection }` | Jugador entró |
| `PLAYER_LEFT` | `{ tableId: string, socketId: string }` | Jugador salió |
| `SET_WON` | `{ tableId: string, winner: Player, score: Score, setNumber: number }` | Set ganado |
| `MATCH_WON` | `{ tableId: string, winner: Player, finalScore: Score[], sets: Score }` | Match ganado |
| `ERROR` | `{ code: string, message: string }` | Error |
| `QR_DATA` | `{ tableId: string, dataUrl: string }` | QR para unirse |

### 3.3 MatchState Extended

```typescript
interface MatchStateExtended {
  tableId: string;
  tableName: string;
  config: MatchConfig;
  playerNames: { a: string; b: string };
  score: {
    sets: Score;
    currentSet: Score;
    serving: Player;
  };
  swappedSides: boolean;
  midSetSwapped: boolean;
  setHistory: Score[];
  history: ScoreChange[];
  undoAvailable: boolean;
  status: TableStatus;
  winner: Player | null;
}
```

---

## 4. User Flows

### 4.1 Flow: Crear Mesa

```
[Organizador] → [CREATE_TABLE] → [Hub genera ID + PIN]
                                    ↓
                              [TABLE_CREATED]
                                    ↓
                              [QR generado]
                                    ↓
                              [Espera jugadores]
```

**Scenario: Crear mesa exitosamente**
```
Given el Hub está activo
When usuario envía CREATE_TABLE con name="Mesa 1"
Then el Hub crea Table con id, number, pin
And emite TABLE_CREATED a todos los clientes
And genera QR_DATA con datos de conexión
```

### 4.2 Flow: Unirse a Mesa

```
[Jugador] → [JOIN_TABLE(tableId, "Miguel")]
              ↓
        [Valida mesa existe]
              ↓
        [Agrega a players]
              ↓
        [PLAYER_JOINED + TABLE_UPDATE]
              ↓
        [Jugador recibe MATCH_UPDATE]
```

**Scenario: Jugador se une a mesa en espera**
```
Given Mesa 1 existe con status=WAITING
And hay 0 jugadores
When jugador envía JOIN_TABLE con tableId y name="Miguel"
Then jugador es agregado como SPECTATOR
And TABLE_UPDATE es emitido a todos
And jugador recibe MATCH_UPDATE con estado actual
```

**Scenario: Mesa llena**
```
Given Mesa 1 tiene 2 jugadores (PLAYER_A y PLAYER_B)
And 3 spectators
When nuevo jugador envía JOIN_TABLE
Then jugador es agregado como SPECTATOR
And spectators no prevent join
```

### 4.3 Flow: Autenticación Referee

```
[Jugador] → [SET_REF(tableId, pin)]
              ↓
        [Valida PIN]
              ↓
        [Actualiza rol → REFEREE]
              ↓
        [TABLE_UPDATE]
```

**Scenario: PIN correcto**
```
Given Mesa 1 tiene PIN="4821"
And jugador está como SPECTATOR
When jugador envía SET_REF con pin="4821"
Then rol cambia a REFEREE
And TABLE_UPDATE es emitido
And jugador puede enviar comandos de referee
```

**Scenario: PIN incorrecto**
```
Given Mesa 1 tiene PIN="4821"
When jugador envía SET_REF con pin="1234"
Then ERROR es emitido con code="INVALID_PIN"
And rol permanece SPECTATOR
```

### 4.4 Flow: Configurar Match

```
[Referee] → [CONFIGURE_MATCH(tableId, {playerNames, config})]
              ↓
        [MatchEngine.setConfig()]
              ↓
        [status → CONFIGURING]
              ↓
        [TABLE_UPDATE + MATCH_UPDATE]
```

**Scenario: Configurar con nombres de jugadores**
```
Given referee está autenticado en Mesa 1
When envía CONFIGURE_MATCH con playerNames={a:"Miguel", b:"Pablo"}
Then MatchEngine actualiza playerNames
And status cambia a CONFIGURING
And MATCH_UPDATE es emitido a todos
```

### 4.5 Flow: Iniciar Match

```
[Referee] → [START_MATCH(tableId)]
              ↓
        [MatchEngine.startMatch()]
              ↓
        [status → LIVE]
              ↓
        [MATCH_UPDATE a todos]
```

**Scenario: Iniciar match con 2 jugadores**
```
Given Mesa 1 tiene status=CONFIGURING
And playerNames están configurados
When referee envía START_MATCH
Then MatchEngine.startMatch() es llamado
And status cambia a LIVE
And MATCH_UPDATE es emitido con status=LIVE
```

### 4.6 Flow: Marcar Punto con Undo

```
[Referee] → [RECORD_POINT(tableId, 'A')]
              ↓
        [MatchEngine.recordPoint('A')]
              ↓
        [ScoreChange creado]
              ↓
        [MATCH_UPDATE + (opcional SET_WON)]
              ↓
        [Undo disponible]
```

**Scenario: Marcar punto**
```
Given Mesa 1 tiene status=LIVE
And currentSet={a: 5, b: 3}
When referee envía RECORD_POINT con player='A'
Then MatchEngine.recordPoint('A') es llamado
And currentSet.a incrementa a 6
And ScoreChange es creado con action='POINT'
And MATCH_UPDATE es emitido
And undoAvailable=true
```

**Scenario: Undo de último punto**
```
Given Mesa 1 tiene history=[{action: 'POINT', ...}]
And currentSet={a: 6, b: 3}
When referee envía UNDO_LAST
Then último ScoreChange es removido
And puntos son revertidos
And currentSet={a: 5, b: 3}
And MATCH_UPDATE es emitido
```

---

## 5. UI Screens

### 5.1 Hub Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  🏓 RALLYOS HUB                                        │
│  ═════════════════════════════════════════════════════ │
│                                                         │
│  [+ Nueva Mesa]                                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🟢 Mesa 1 (LIVE)              PIN: 4821       │   │
│  │ Miguel vs Pablo  │  8 - 11  │  2-1 sets       │   │
│  │ [Ver] [QR]                              [×]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🟡 Mesa 2 (CONFIGURING)         PIN: 7392       │   │
│  │ Esperando: Juan, María                         │   │
│  │ [Ver] [QR]                              [×]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⚪ Mesa 3 (WAITING)                PIN: 1154     │   │
│  │ Sin jugadores                                 │   │
│  │ [Ver] [QR]                              [×]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Table Waiting Room

```
┌─────────────────────────────────────────────────────────┐
│  ← Volver al Hub                                       │
│  ═════════════════════════════════════════════════════ │
│                                                         │
│  🏓 MESA 1                                             │
│  PIN Referee: 4821        [📷 QR] [📋 Copiar]        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │              [QR CODE]                          │   │
│  │         rallyhub://join/table-123               │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ───────────────────────────────────────────────────── │
│  JUGADORES                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ⭘ Esperando Jugador A...                       │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ✅ Juan (como Espectador)         [Subir ↑]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ESPECTADORES (1)                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  👁 María                                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ───────────────────────────────────────────────────── │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🔒 CONFIGURAR PARTIDO                           │   │
│  │  (Necesitás ser referee con PIN)                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Match Setup Modal

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  CONFIGURAR PARTIDO                                     │
│  ────────────────────────────────────────────────────  │
│                                                         │
│  Jugador A                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Juan                                             │   │
│  └─────────────────────────────────────────────────┘   │
│  ○ Servicio inicial                                     │
│                                                         │
│  Jugador B                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Pablo                                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Formato                                               │
│  ○ 1 Set  │  ● 3 Sets  │  ○ 5 Sets                   │
│                                                         │
│  Puntos por set                                        │
│  ● 11  │  ○ 15  │  ○ 21                             │
│                                                         │
│  ────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              ▶ INICIAR PARTIDO                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.4 Scoreboard (Live)

```
┌─────────────────────────────────────────────────────────┐
│  Mesa 1  │  ● 3 conectados  │  PIN: 4821              │
│  ═════════════════════════════════════════════════════ │
│                                                         │
│                    ⬆️ JUGADOR A                        │
│                      Miguel                            │
│                      ★ Sirviendo                      │
│                                                         │
│                    SET   GAME   PTS                     │
│                    ─────────────────                    │
│                      2      4     12                    │
│                                                         │
│           ┌──────────┐        ┌──────────┐             │
│           │          │        │          │             │
│           │   -1     │        │   +1     │             │
│           │  (error) │        │  (punto) │             │
│           │          │        │          │             │
│           └──────────┘        └──────────┘             │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│           ┌──────────┐        ┌──────────┐             │
│           │          │        │          │             │
│           │   -1     │        │   +1     │             │
│           │  (error) │        │  (punto) │             │
│           │          │        │          │             │
│           └──────────┘        └──────────┘             │
│                                                         │
│                    SET   GAME   PTS                     │
│                    ─────────────────                    │
│                      1      3      8                  │
│                                                         │
│                    ⬇️ JUGADOR B                        │
│                      Pablo                             │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📜 Historial                    [↩ Deshacer]   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                   [🏁 Fin Match]                        │
└─────────────────────────────────────────────────────────┘
```

### 5.5 History Drawer

```
┌─────────────────────────────────────────────────────────┐
│  HISTORIAL DE PUNTOS                           [CERRAR] │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🔴 CORRECCIÓN -1 para Miguel         hace 5s   │   │
│  │     10 → 9                                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🟢 PUNTO para Pablo                  hace 12s  │   │
│  │     10 ← 11                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🟢 PUNTO para Miguel                hace 18s   │   │
│  │     9 ← 10                                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              ↩ DESHACER ÚLTIMO                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.6 Set Won Overlay

```
┌─────────────────────────────────────────────────────────┐
│█████████████████████████████████████████████████████████│
│█████████████████████████████████████████████████████████│
│█████████████████████████████████████████████████████████│
│████                                               ██████│
│████                                               ██████│
│████        🎉 ¡SET PARA MIGUEL! 🎉               ██████│
│████                                               ██████│
│████              11 - 7                           ██████│
│████                                               ██████│
│████            Sets: 2 - 1                        ██████│
│████                                               ██████│
│█████████████████████████████████████████████████████████│
│█████████████████████████████████████████████████████████│
└─────────────────────────────────────────────────────────┘
```

### 5.7 Match Won Overlay

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              🎉 ¡FELICIDADES! 🎉                       │
│                                                         │
│               MIGUEL GANA EL                            │
│                  MATCH!                                 │
│                                                         │
│               Sets: 3-1                                │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │    Miguel          Pablo                        │   │
│  │      11   -    6                               │   │
│  │      11   -    9                               │   │
│  │       9   -   11                               │   │
│  │      11   -    8                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Ver Resumen                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Nueva Mesa                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. QR Protocol

### 6.1 QR Data Format

```json
{
  "hubSsid": "RallyOS_Court_1",
  "hubIp": "192.168.4.1",
  "hubPort": 3000,
  "tableId": "abc-123-def",
  "tableName": "Mesa 1",
  "pin": "4821",
  "url": "rallyhub://join/abc-123-def?pin=4821"
}
```

### 6.2 Deep Link Schema

```
rallyhub://join/{tableId}?pin={pin}
```

---

## 7. Error Handling

### 7.1 Error Codes

| Code | Message | Cause |
|------|---------|-------|
| `TABLE_NOT_FOUND` | Mesa no encontrada | tableId inválido |
| `INVALID_PIN` | PIN incorrecto | Auth fallida |
| `UNAUTHORIZED` | No autorizado | No es referee |
| `MATCH_NOT_LIVE` | Match no está activo | Acción inválida |
| `CANNOT_UNDO` | No hay puntos para deshacer | History vacía |

### 7.2 Reconnection Strategy

1. Cliente se reconecta con mismo socket
2. Cliente envía `JOIN_TABLE` con tableId previo
3. Hub restaura conexión y envía `MATCH_UPDATE`
4. Si el match terminó, envía `MATCH_WON`

---

## 8. Out of Scope (P0)

- Persistencia en SQLite (viene en v2)
- Cloud sync (viene en v2)
- Voice scoring
- Multiple tournaments simultaneously

---

## 9. Acceptance Criteria

### 9.1 Table Management

- [ ] CREAR_TABLE genera ID único y PIN de 4 dígitos
- [ ] TABLE_CREATED es emitido a todos los clientes
- [ ] LIST_TABLES retorna todas las mesas con estado
- [ ] Mesa puede ser eliminada (solo si no está LIVE)

### 9.2 Player Connection

- [ ] JOIN_TABLE agrega jugador a mesa
- [ ] PLAYER_JOINED es emitido a todos
- [ ] JOIN_TABLE funciona sin auth (spectator por defecto)
- [ ] LEAVE_TABLE remove jugador

### 9.3 Referee Auth

- [ ] SET_REF con PIN correcto cambia rol a REFEREE
- [ ] SET_REF con PIN incorrecto emite ERROR
- [ ] Solo REFEREE puede ejecutar comandos de match

### 9.4 Match Flow

- [ ] CONFIGURE_MATCH actualiza playerNames y status
- [ ] START_MATCH cambia status a LIVE
- [ ] RECORD_POINT incrementa score y emite MATCH_UPDATE
- [ ] SUBTRACT_POINT decrementa score
- [ ] UNDO_LAST revierte último cambio

### 9.5 Events

- [ ] SET_WON emitido cuando set se completa
- [ ] MATCH_WON emitido cuando match termina
- [ ] TABLE_UPDATE emitido en cada cambio de estado

### 9.6 UI

- [ ] Hub Dashboard muestra todas las mesas
- [ ] Waiting Room muestra QR y jugadores
- [ ] Match Setup permite configurar nombres y formato
- [ ] Scoreboard muestra score y permite marcar puntos
- [ ] History drawer muestra últimos cambios
- [ ] Set/Match Won overlays aparecen correctamente

---

*Document created for Spec-Driven Development.*
