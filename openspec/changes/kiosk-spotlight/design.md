# Design: Cancha Destacada (Kiosk Spotlight)

## Technical Approach

Add a `featured` field to `CourtInfo`, a new `SET_FEATURED` socket event (owner-only), and a server-enforced single-featured invariant. The kiosk detects featured courts from `CourtInfo.featured` and conditionally renders a full-screen `ScoreboardMain` read-only view instead of the grid. Since the kiosk only receives `CourtInfo` (not `MatchStateExtended` needed by `ScoreboardMain`), it subscribes to the featured court via `SUBSCRIBE_MATCH` / `UNSUBSCRIBE_MATCH` to receive real-time `MATCH_UPDATE` events. The owner dashboard gets a toggle button per court card. The Spanish i18n label "Destacado" / "Destacar" maps to this `featured` field.

## Architecture Decisions

### Decision: Kiosk Match State Acquisition

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `SUBSCRIBE_MATCH` / `UNSUBSCRIBE_MATCH` events | Real-time MATCH_UPDATE via room subscription, explicit court-level events, server validates court is featured | **CHOSEN** |
| Poll `GET_MATCH_STATE` every 3s | 3s latency on venue display, no new events but stale scores | Rejected — not real-time |
| Broadcast all MATCH_UPDATE globally | Too noisy for large venues | Rejected |
| Reuse `JOIN_TABLE` | Requires PIN auth — kiosk is public | Rejected |

**Rationale**: The kiosk only receives `CourtInfo` (via `TABLE_LIST`/`TABLE_UPDATE`), not `MatchStateExtended`. `ScoreboardMain` requires `MatchStateExtended`. `SUBSCRIBE_MATCH` with `socket.join(courtId)` gives real-time `MATCH_UPDATE` without polling. Server-side validation ensures subscription only works if the court is actually featured — no one can spy on non-featured matches.

### Decision: Fullscreen Entry Point

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Conditional render in KioskAllTablesPage | Same URL, single component, minimal changes | **CHOSEN** |
| New route `/scoreboard/all/kiosk/spotlight` | Separate URL, can be linked directly | Rejected — spec says "no new route" |

**Rationale**: Matches the out-of-scope spec. The existing `KioskAllTablesPage` already handles rotation state — adding a `isFeatured` branch is natural.

### Decision: Transition Mechanism

| Option | Tradeoff | Decision |
|--------|----------|----------|
| CSS transitions (`transition-all duration-500`) | Matches existing rotation code, no deps | **CHOSEN** |
| Framer Motion `AnimatePresence` | Smoother but inconsistent with rotation code | Rejected |

**Rationale**: The rotation code already uses CSS `transition-opacity duration-500` with a `fadeState` toggle (visible/hidden). Reusing this pattern keeps the codebase consistent.

### Decision: Destacado Toggle in Owner Dashboard

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Add to `TableStatusChip` | Single component change, reuses existing button pattern | **CHOSEN** |
| New component wrapping TableStatusChip | More files, indirection | Rejected |

**Rationale**: `TableStatusChip` already has action buttons (Clean, Delete) for owner mode. Adding a Destacar toggle alongside them is natural and consistent.

### Decision: Server Auto-Clear Hook Point

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Hook into `onMatchEvent` MATCH_WON in SocketHandler | Already receives MATCH_WON event, minimal new code | **CHOSEN** |
| Hook into `MatchOrchestrator` on status change | Deeper integration but more invasive | Rejected |

**Rationale**: `SocketHandler.ts` already handles `MATCH_WON` in `onMatchEvent` (emits kiosk notification). Adding destacado auto-clear in the same callback is consistent and avoids touching the domain layer.

## UI Design (Primary Focus)

### Kiosk Fullscreen Layout

The fullscreen view is a **public venue display** — no controls, no header, no QR codes, no connection status. Pure match spectacle.

```
┌────────────────────────────────────────────────────────┐
│ ★ DESTACADO           Cancha 3           EN VIVO       │
│────────────────────────────────────────────────────────│
│                                                        │
│                                                        │
│     ╔══════════════════════════════════════════╗        │
│     ║           María González                 ║        │
│     ║               vs                         ║        │
│     ║           Carlos Pérez                   ║        │
│     ╠══════════════════════════════════════════╣        │
│     ║                                          ║        │
│     ║          11      7      (scores)         ║        │
│     ║          ───  :  ───                     ║        │
│     ║           9     11                       ║        │
│     ║                                          ║        │
│     ║          Sets: 2 - 1                     ║        │
│     ║                                          ║        │
│     ╚══════════════════════════════════════════╝        │
│                                                        │
│────────────────────────────────────────────────────────│
│  S1: 11-9   S2: 7-11   S3: 11-5                       │
│  ◉ Live stats / match events                           │
└────────────────────────────────────────────────────────┘
```

**Section breakdown (top to bottom):**

1. **Destacado Bar** (thin, 48px):
   - Left: `★ DESTACADO` badge — subtle star icon + text, gold/amber color (`text-primary` or `text-amber-400`)
   - Center: Table/court name (`"Cancha 3"`)
   - Right: Status indicator (`"EN VIVO"` badge, green)
   - Background: slightly elevated from main (`bg-surface-low`)
   - This replaces the header/QR/connection status that would normally appear in grid mode

2. **Main Score Area** (flex-1, centered):
   - Reuses `SportDisplaySelector` inside `ScoreboardMain` as-is
   - Sport-aware: Table Tennis shows points/sets, Padel shows 15-30-40-AD
   - Player names: bold, large (text-4xl+), centered
   - Scores: huge numbers (text-8xl or larger), sport-dependent
   - Sets indicator below scores
   - Dark background (`bg-surface`)

3. **ScoreboardBar** (bottom, compact):
   - Set history showing all completed sets
   - No status badge, no landscape toggle
   - Compact layout

### Visual States

| State | Render | Transition |
|-------|--------|------------|
| No featured | Grid with rotation | Fade in 500ms (existing) |
| Featured court-A | Fullscreen ScoreboardMain(court-A) | Grid fade-out 500ms → SS fade-in 500ms |
| Switch to court-B | Fullscreen ScoreboardMain(court-B) | SS(court-A) fade-out 500ms → SS(court-B) fade-in 500ms |
| Match ends / featured clears | Grid with rotation | SS fade-out 500ms → Grid fade-in 500ms |

### Color & Theme

- All existing dark theme tokens reused (`bg-surface`, `text-text`, `text-text-h`, `bg-primary`, etc.)
- `★ DESTACADO` badge: uses `bg-primary/20` + `text-primary` for glow
- EN VIVO badge: existing `LiveBadge` component

## Component Architecture

### Modified Components

| Component | File | Change |
|-----------|------|--------|
| `CourtInfo` (shared) | `shared/types.ts` | Add `featured?: boolean` field |
| `SocketEvents` (shared) | `shared/events.ts` | Add `SET_FEATURED`, `SUBSCRIBE_MATCH`, `UNSUBSCRIBE_MATCH` to CLIENT events |
| `Court` (server) | `server/src/domain/types.ts` | Add `featured: boolean` field (default false) |
| `TableFormatter` | `server/src/services/table/TableFormatter.ts` | Map `table.featured` → `CourtInfo.featured` |
| `SocketHandler` | `server/src/handlers/SocketHandler.ts` | Add `SET_FEATURED` handler + auto-clear in MATCH_WON |
| `SpotlightHandler` | `server/src/handlers/SpotlightHandler.ts` | **New** — SET_FEATURED + SUBSCRIBE_MATCH + UNSUBSCRIBE_MATCH |
| `KioskAllTablesPage` | `client/src/pages/KioskAllTablesPage/` | Conditional fullscreen branch, subscription via SUBSCRIBE_MATCH/UNSUBSCRIBE_MATCH, transition logic, MATCH_UPDATE listener |
| `TableStatusChip` | `client/src/components/molecules/TableStatusChip/` | Add `featured` prop + toggle button |
| `TableStatusChipProps` | `client/src/components/molecules/TableStatusChip/` | Add `featured?: boolean`, `onToggleFeatured?: () => void` |

### Created Components

*None.* The subscription logic is handled inline in `KioskAllTablesPage` via `useEffect` — no new hook needed.

## Data Flow

### SET_FEATURED Flow

```
Owner clicks "Destacar" on court-A card
       │
       ▼
TableStatusChip.onToggleFeatured()
       │
       ▼
OwnerDashboardPage emits:
  socket.emit('SET_FEATURED', { targetTableId: "court-A" })
       │
       ▼
Server validates:
  ┌─ owner auth (socket.data.isOwner)
  ├─ table exists
  └─ status is LIVE or WAITING
       │
       ▼ (atomic operation)
  ┌─────────────────────────────────────┐
│ 1. If previous featured exists:    │
│    court-A.featured = false         │
│    broadcast TABLE_UPDATE(court-A)   │
│                                      │
│ 2. Set new featured:                │
│    court-B.featured = true          │
│    broadcast TABLE_UPDATE(court-B)   │
  └─────────────────────────────────────┘
       │
       ▼
All clients receive:
  TABLE_LIST (global broadcast, updated)
  TABLE_UPDATE(court-A) → room "court-A"
  TABLE_UPDATE(court-B) → room "court-B"
       │
       ▼
KioskAllTablesPage recalculates:
  activeTables.filter(t => t.featured && ACTIVE_STATUSES.includes(t.status))
  → found court-A → enter fullscreen mode
       │
       ▼
Kiosk emits SUBSCRIBE_MATCH({ courtId: "court-A" })
  → Server validates court-A.featured === true ✅
  → socket.join("court-A")
  → Server emits current MATCH_UPDATE(court-A) to this socket
  → Kiosk stores state locally
  → ScoreboardMain renders fullscreen with match state
  → From now on, kiosk receives real-time MATCH_UPDATE for court-A
```

### Null / Clear Flow

```
Owner clicks "Quitar Destacado"
       │
       ▼
socket.emit('SET_FEATURED', { targetTableId: null })
       │
       ▼
Server: court-A.featured = false, broadcast TABLE_UPDATE(court-A)
       │
       ▼
Kiosk: no featured court found
  → socket.emit(UNSUBSCRIBE_MATCH, { courtId: "court-A" })
  → server: socket.leave("court-A")
  → return to grid
```

### Auto-Clear on FINISHED

```
Match engine fires MATCH_WON event (via onMatchEvent callback)
       │
       ▼
SocketHandler.onMatchEvent():
  if event.type === 'MATCH_WON':
    │
    ├─ emit MATCH_WON to room (existing)
    ├─ emit kiosk notification (existing)
    │
    └─ NEW: if court.featured === true:
         court.featured = false
         broadcast TABLE_UPDATE(court)
               │
               ▼
         Kiosk receives → no featured court
           → UNSUBSCRIBE_MATCH → return to grid
```

## Sequence Diagrams

### Sequence 1: Owner sets court-A as featured

```
OwnerDashboard    Server                Kiosk
    │               │                     │
    │─SET_FEATURED──│                     │
    │ {court-A}     │                     │
    │               │                     │
    │               ├─ validate owner ✅  │
    │               ├─ validate table     │
    │               ├─ court-A.featured = true
    │               │                     │
    │               │─TABLE_UPDATE────────│─► detect featured
    │               │  (court-A)          │    court-A
    │               │                     │
    │               │  TABLE_LIST ────────│─► recalc pages
    │               │  (global)           │
    │               │                     │
    │               │                     ├─ SUBSCRIBE_MATCH
    │               │◄────────────────────│   {courtId: "court-A"}
    │               │                     │
    │               ├─ validate:          │
    │               │  court-A.featured=✓ │
    │               ├─ socket.join(court) │
    │               │                     │
    │               │─MATCH_UPDATE────────│─► initial match state
    │               │  (to socket)        │
    │               │                     ├─ fade grid out (500ms)
    │               │                     ├─ render ScoreboardMain
    │               │                     ├─ fade in (500ms)
    │               │                     │
    │               │ [real-time]         │
    │               │─MATCH_UPDATE────────│─► via room subscription
    │               │  (to room)          │
    │               │  ...                │
    ```

### Sequence 2: Owner switches to court-B

```
OwnerDashboard    Server                Kiosk
    │               │                     │
    │─SET_FEATURED──│                     │
    │ {court-B}     │                     │
    │               │                     │
    │               ├─ court-A.featured = false
    │               ├─ court-B.featured = true
    │               │                     │
    │               │─TABLE_UPDATE────────│─► court-A.featured=false
    │               │  (court-A)          │
    │               │                     │
    │               │─TABLE_UPDATE────────│─► court-B.featured=true
    │               │  (court-B)          │
    │               │                     │
    │               │  TABLE_LIST ────────│─► recalc
    │               │                     │
    │               │                     ├─ UNSUBSCRIBE_MATCH(court-A)
    │               │◄────────────────────│
    │               ├─ socket.leave(A)    │
    │               │                     │
    │               │                     ├─ fade SS out (500ms)
    │               │◄────────────────────│─ SUBSCRIBE_MATCH(court-B)
    │               ├─ validate (✓)      │
    │               ├─ socket.join(B)    │
    │               │                     │
    │               │─MATCH_UPDATE────────│─► initial match state B
    │               │  (to socket)        │
    │               │                     ├─ render SS(court-B)
    │               │                     ├─ fade in (500ms)
    │               │                     │
    ```

### Sequence 3: Match ends (auto-clear)

```
MatchEngine       Server                Kiosk
    │               │                     │
    │─MATCH_WON─────│                     │
    │               │                     │
    │               ├─ emit MATCH_WON     │
    │               ├─ emit notification  │
    │               │                     │
    │               ├─ court-A.featured = false
    │               │                     │
    │               │─TABLE_UPDATE────────│─► court-A featured=false
    │               │  (court-A)          │
    │               │  TABLE_LIST ────────│─► no featured court left
    │               │                     │
    │               │                     ├─ UNSUBSCRIBE_MATCH(court-A)
    │               │◄────────────────────│
    │               ├─ socket.leave(A)    │
    │               │                     │
    │               │                     ├─ fade SS out (500ms)
    │               │                     ├─ render grid
    │               │                     ├─ fade in (500ms)
    │               │                     │
    ```

## Transition Design

### Grid → Fullscreen

```
KioskAllTablesPage state:

isFeatured = false → true (court-A detected as featured)

Step 1: Emit SUBSCRIBE_MATCH({ courtId: "court-A" })
         → Server validates court-A.featured===true, socket.join("court-A"), returns MATCH_UPDATE
Step 2: On MATCH_UPDATE response:
         - Set featuredMatchState = received match state
         - Set `fadeState = 'hidden'` on grid wrapper
         → CSS transition 500ms opacity to 0
Step 3: After 500ms (setTimeout):
         - Render ScoreboardMain with featuredMatchState and opacity-0
         - After render (rAF), set opacity-100
         → CSS transition 500ms opacity to 1
```

### Fullscreen → Grid

```
isFeatured = true → false (featured cleared or match ended)

Step 1: Emit UNSUBSCRIBE_MATCH({ courtId: "court-A" })
         → Server: socket.leave("court-A")
Step 2: Set `featuredFadeState = 'hidden'` on ScoreboardMain wrapper
         → CSS transition 500ms opacity to 0
Step 3: After 500ms:
         - Clear featuredMatchState
         - Set isFeatured = false
         - Set fadeState = 'visible' on grid wrapper
         → Grid renders with opacity transition to 1
```

### Switch Between Courts

```
Featured court changes from A → B:

Step 1: Set `featuredFadeState = 'hidden'` on current ScoreboardMain
         → CSS transition 500ms opacity to 0
Step 2: After 500ms:
         - Emit UNSUBSCRIBE_MATCH({ courtId: "court-A" })
         - Emit SUBSCRIBE_MATCH({ courtId: "court-B" })
         - On MATCH_UPDATE response, update featuredMatchState
         - Render new ScoreboardMain with opacity-0
Step 3: After render:
         - Set opacity-100
         → CSS transition 500ms opacity to 1
```

The same transition pattern from rotation (`fadeState` + `transition-opacity duration-500` + `setTimeout`) is reused, just applied to the fullscreen wrapper instead of the page grid.

## Interfaces / Contracts

### Shared Types Addition

```typescript
// In CourtInfo (shared/types.ts), add:
export interface CourtInfo {
  // ... existing fields ...
  featured?: boolean;  // i18n label: "Destacado"
}
```

### Socket Events Addition

```typescript
// In SocketEvents.CLIENT (shared/events.ts):
SET_FEATURED: 'SET_FEATURED',              // client→server, payload: { targetTableId: string | null }
SUBSCRIBE_MATCH: 'SUBSCRIBE_MATCH',        // client→server, payload: { courtId: string }
UNSUBSCRIBE_MATCH: 'UNSUBSCRIBE_MATCH',    // client→server, payload: { courtId: string }

// Payload types (used by both client and server):
interface SetDestacadoPayload {
  targetTableId: string | null;  // null = clear all
}
interface SubscribeMatchPayload {
  courtId: string;
}
interface UnsubscribeMatchPayload {
  courtId: string;
}
```

### Server Court Type Addition

```typescript
// In Court (server/src/domain/types.ts):
export interface Court {
  // ... existing fields ...
  featured: boolean;  // default: false; i18n "Destacado"
}
```

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Race condition on rapid toggle** | Low | Server processes SET_FEATURED atomically — previous featured is cleared FIRST, then new one set. Both TABLE_UPDATEs emitted in sequence. Kiosk only sees final state. |
| **Flash between grid and fullscreen** | Low | CSS transitions with 500ms timeout. Grid fades out completely before fullscreen fades in. Both never visible simultaneously. |
| **Subscription not cleaned up** | Low | Kiosk emits UNSUBSCRIBE_MATCH on: (1) featured cleared, (2) switch court, (3) match ends, (4) component unmount (useEffect cleanup) |
| **Socket disconnect during fullscreen** | Low | Existing disconnect handler reloads page after 10s. On reconnect, kiosk re-evaluates featured from fresh TABLE_LIST and re-subscribes. |
| **Kiosk subscribes to non-featured court** | None | Server rejects SUBSCRIBE_MATCH if court.featured !== true. Only owner can set featured. |

## Implementation Order

### Phase 1: Shared Types & Events (Infrastructure)
1. Add `featured?: boolean` to `CourtInfo` in `shared/types.ts`
2. Add `SET_FEATURED`, `SUBSCRIBE_MATCH`, `UNSUBSCRIBE_MATCH` to `SocketEvents.CLIENT` in `shared/events.ts`
3. Add `featured: boolean` to `Court` in `server/src/domain/types.ts`
4. Update `TableFormatter.toPublicInfo()` to include `featured`

### Phase 2: Server Handler
5. Create `SpotlightHandler` class — `SET_FEATURED` (owner-only, single-featured invariant, broadcast) + `SUBSCRIBE_MATCH` (validate, join, emit) + `UNSUBSCRIBE_MATCH` (leave)
6. Wire `SpotlightHandler` in `SocketHandler` (or handler index)
9. Add auto-clear logic in `SocketHandler.onMatchEvent` `MATCH_WON` branch

### Phase 3: Kiosk Fullscreen UI
10. Update `KioskAllTablesPage` with `isFeatured` detection, subscription logic (SUBSCRIBE_MATCH/UNSUBSCRIBE_MATCH), and local MATCH_UPDATE listener
11. Add transition logic (CSS opacity fades, timeouts, cleanup on unmount/switch)
12. Style "Destacado" bar (★ DESTACADO badge, court name, EN VIVO — i18n)

### Phase 4: Owner Dashboard
13. Add `featured` prop and `onToggleFeatured` callback to `TableStatusChipProps`
14. Render "Destacar" / "Quitar Destacado" button in `TableStatusChip` (i18n labels)
15. Wire `SET_FEATURED` emit in `OwnerDashboardPage`

### Phase 5: Testing
16. Unit tests for server SET_FEATURED handler
17. Unit tests for SUBSCRIBE_MATCH (validates featured, rejects non-featured)
18. Unit tests for UNSUBSCRIBE_MATCH (cleans up subscription)
19. Unit tests for kiosk conditional rendering
20. Unit tests for auto-clear on MATCH_WON
21. Integration test: owner toggles → kiosk subscribes → switches mode
