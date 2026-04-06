# Tasks: add-multi-table-system

## Overview

Implementar sistema multi-mesa para rallyOS-hub con waiting room, undo history, player names, y QR generation.

---

## PHASE 1: Infrastructure

### 1.1 Create types.ts
- **File**: `server/src/types.ts`
- **Dependencies**: Ninguna
- **Tasks**:
  - [ ] Table interface (id, number, name, status, pin, matchEngine, players, etc.)
  - [ ] PlayerConnection interface
  - [ ] ScoreChange interface
  - [ ] MatchConfigExtended (con playerNames)
  - [ ] MatchStateExtended (con history, undoAvailable, tableId)
  - [ ] TableStatus type
  - [ ] Socket event types (ClientToServer, ServerToClient)
  - [ ] TableInfo interface (para UI)
  - [ ] QRData interface
  - [ ] MatchEvent types (SET_WON, MATCH_WON)

### 1.2 Extend MatchEngine
- **File**: `server/src/matchEngine.ts`
- **Dependencies**: types.ts
- **Tasks**:
  - [ ] Importar tipos de types.ts
  - [ ] Agregar playerNames al estado
  - [ ] Agregar history array (ScoreChange[])
  - [ ] Agregar tableId al estado
  - [ ] Implementar setPlayerNames(names)
  - [ ] Implementar recordPoint con history tracking
  - [ ] Implementar subtractPoint con history (action='CORRECTION')
  - [ ] Implementar undoLast()
  - [ ] Implementar canUndo()
  - [ ] Agregar eventCallback para SET_WON y MATCH_WON
  - [ ] Actualizar getState() para incluir nuevos campos

---

## PHASE 2: Core Logic

### 2.1 Create TableManager
- **File**: `server/src/tableManager.ts`
- **Dependencies**: types.ts, matchEngine.ts
- **Tasks**:
  - [ ] TableManager class
  - [ ] createTable(name?) → Table
  - [ ] getTable(tableId) → Table | undefined
  - [ ] getAllTables() → TableInfo[]
  - [ ] joinTable(tableId, socketId, name) → boolean
  - [ ] leaveTable(tableId, socketId) → void
  - [ ] setReferee(tableId, socketId, pin) → boolean
  - [ ] deleteTable(tableId) → boolean
  - [ ] tableToInfo(table) → TableInfo
  - [ ] Callbacks: onTableUpdate, onMatchEvent

### 2.2 Refactor SocketHandler
- **File**: `server/src/socketHandler.ts`
- **Dependencies**: types.ts, tableManager.ts, matchEngine.ts
- **Tasks**:
  - [ ] Importar TableManager
  - [ ] Reemplazar matchEngine individual por TableManager
  - [ ] Implementar CREATE_TABLE handler
  - [ ] Implementar LIST_TABLES handler
  - [ ] Implementar JOIN_TABLE handler
  - [ ] Implementar LEAVE_TABLE handler
  - [ ] Implementar SET_REF handler
  - [ ] Implementar CONFIGURE_MATCH handler
  - [ ] Implementar START_MATCH handler
  - [ ] Implementar RECORD_POINT con tableId
  - [ ] Implementar SUBTRACT_POINT con tableId
  - [ ] Implementar UNDO_LAST handler
  - [ ] Implementar SET_SERVER con tableId
  - [ ] Implementar RESET_TABLE handler
  - [ ] Implementar REQUEST_TABLE_STATE handler
  - [ ] Conectar TableManager callbacks a socket emissions
  - [ ] Mantener backward compatibility (single table fallback)

### 2.3 Update index.ts
- **File**: `server/src/index.ts`
- **Dependencies**: Ninguna (solo orquestación)
- **Tasks**:
  - [ ] Importar TableManager (si se necesita acceso global)
  - [ ] Mantener SSL/HTTPS config
  - [ ] Mantener static file serving

---

## PHASE 3: QR Generator

### 3.1 Create QR Generator
- **File**: `server/src/utils/qrGenerator.ts`
- **Dependencies**: qrcode package
- **Tasks**:
  - [ ] Instalar qrcode: `npm install qrcode @types/qrcode`
  - [ ] generateQRDataUrl(data: QRData): Promise<string>
  - [ ] parseQRCode(qrString: string): QRData | null
  - [ ] Generar QR con logo RallyOS (opcional)

### 3.2 Integrate QR in SocketHandler
- **File**: `server/src/socketHandler.ts`
- **Dependencies**: qrGenerator.ts
- **Tasks**:
  - [ ] Importar qrGenerator
  - [ ] Generar QR al crear mesa
  - [ ] Emitir QR_DATA al cliente que creó la mesa

---

## PHASE 4: UI Web

### 4.1 Hub Dashboard Screen
- **File**: `server/public/index.html` (nueva sección)
- **Dependencies**: Socket.io
- **Tasks**:
  - [ ] Header con logo y "Nueva Mesa" button
  - [ ] Lista de mesas con estados (color coding)
  - [ ] Cada mesa: nombre, estado, jugadores, acciones
  - [ ] Botones: Ver, QR, Eliminar
  - [ ] Socket listeners: TABLE_LIST, TABLE_CREATED, TABLE_UPDATE, TABLE_DELETED

### 4.2 Table Waiting Room Screen
- **File**: `server/public/index.html`
- **Dependencies**: Socket.io, QR display
- **Tasks**:
  - [ ] Volver al Hub button
  - [ ] Table info (nombre, PIN)
  - [ ] QR display (canvas)
  - [ ] Lista de jugadores conectados
  - [ ] Botón "Configurar Partido"
  - [ ] Socket listeners: PLAYER_JOINED, PLAYER_LEFT, TABLE_UPDATE

### 4.3 Match Setup Modal
- **File**: `server/public/index.html`
- **Dependencies**: Ninguna
- **Tasks**:
  - [ ] Inputs para nombre Jugador A y B
  - [ ] Radio para servicio inicial
  - [ ] Radio para formato (1/3/5 sets)
  - [ ] Radio para puntos (11/15/21)
  - [ ] Botón "Iniciar Partido"
  - [ ] Emitir CONFIGURE_MATCH y luego START_MATCH

### 4.4 Scoreboard Updates
- **File**: `server/public/index.html`
- **Tasks**:
  - [ ] Mostrar playerNames en vez de "Jugador A/B"
  - [ ] Agregar botón "Historial"
  - [ ] Agregar History Drawer (slide-up)
  - [ ] Agregar Set Won Overlay
  - [ ] Agregar Match Won Overlay
  - [ ] Botón "Deshacer" funcional
  - [ ] Socket listeners: SET_WON, MATCH_WON

### 4.5 Pin Entry Modal
- **File**: `server/public/index.html`
- **Tasks**:
  - [ ] Input de PIN
  - [ ] Botón "Confirmar"
  - [ ] Emitir SET_REF

---

## PHASE 5: Testing

### 5.1 E2E Tests - Table Management
- **File**: `server/tests/multi-table.spec.ts`
- **Tasks**:
  - [ ] test: create_table_generates_id_and_pin
  - [ ] test: table_list_shows_all_tables
  - [ ] test: delete_table_removes_from_list

### 5.2 E2E Tests - Player Flow
- **File**: `server/tests/multi-table.spec.ts`
- **Tasks**:
  - [ ] test: join_table_adds_player
  - [ ] test: player_joined_notification
  - [ ] test: leave_table_removes_player

### 5.3 E2E Tests - Referee Auth
- **File**: `server/tests/multi-table.spec.ts`
- **Tasks**:
  - [ ] test: set_ref_with_correct_pin
  - [ ] test: set_ref_with_wrong_pin_error

### 5.4 E2E Tests - Match Flow
- **File**: `server/tests/multi-table.spec.ts`
- **Tasks**:
  - [ ] test: configure_match_updates_status
  - [ ] test: start_match_changes_to_live
  - [ ] test: record_point_increments_score
  - [ ] test: undo_reverts_last_point

### 5.5 E2E Tests - Events
- **File**: `server/tests/multi-table.spec.ts`
- **Tasks**:
  - [ ] test: set_won_event_fired
  - [ ] test: match_won_event_fired

---

## PHASE 6: Polish

### 6.1 Documentation
- **Tasks**:
  - [ ] README.md actualizado con nuevas features
  - [ ] Agregar sección de Socket API al README
  - [ ] Documentar nuevos eventos

### 6.2 Cleanup
- **Tasks**:
  - [ ] Remover console.logs de debug
  - [ ] Agregar comentarios JSDoc
  - [ ] Verificar TypeScript compilation

---

## Dependencies Graph

```
types.ts
  └── matchEngine.ts
  └── tableManager.ts
  └── socketHandler.ts

matchEngine.ts
  └── tableManager.ts

tableManager.ts
  └── socketHandler.ts

qrGenerator.ts
  └── socketHandler.ts

socketHandler.ts
  └── index.ts
```

---

## Estimated Time

| Phase | LOC Est. | Priority |
|-------|----------|----------|
| Phase 1: Infrastructure | +200 | P0 |
| Phase 2: Core Logic | +400 | P0 |
| Phase 3: QR Generator | +50 | P1 |
| Phase 4: UI Web | +500 | P1 |
| Phase 5: Testing | +300 | P1 |
| Phase 6: Polish | +50 | P2 |

**Total**: ~1500 LOC
