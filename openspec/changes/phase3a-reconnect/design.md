# Design: Phase 3a — Session Init + Alias (Reconnection + Bridge Ownership)

## Technical Approach

Dedicated `CLUB_RECONNECT` socket event for re-establishing bridge ownership after page refresh, reusing `registerClubReferee()` path. `setRefereeDirect()` surfaces the displaced socket ID so the handler emits `REF_REVOKED` to the old socket. Server-side: three interface changes (return types) + one new handler + two filter expansions. Client-side: one new emit sequence in `useClubPlay` + one new event listener in `ClubPlayPage`.

## Architecture Decisions

### Decision: Surface oldSocketId from setRefereeDirect

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Return old socket ID from `setRefereeDirect` | Caller must handle emit; cleanest separation | **Chosen** |
| Pass `io` into PlayerService | Tight coupling to Socket.io in a domain service | Rejected |
| Emit inside PlayerService via injected callback | Adds complexity for one site | Rejected |

**Rationale**: PlayerService is a domain service that should not know about Socket.io. By changing return type from `void` → `string | null`, the caller (ClubPlayerHandler) owns the emit at the handler level, keeping domain logic clean.

### Decision: CLUB_RECONNECT bypasses PinRateLimiter

| Option | Tradeoff | Decision |
|--------|----------|----------|
| No rate limiting | Reconnection is authenticated by being in the room + holding courtId from URL | **Chosen** |
| Reuse PinRateLimiter | Would block legitimate refreshes after previous failed PIN attempts | Rejected |

**Rationale**: Reconnection does not involve PIN entry — the client already proved ownership before the refresh. Rate limiting would create false positives.

### Decision: Add mode/clubStatus to MatchStateExtended

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extend MatchStateExtended type | Single MATCH_UPDATE payload; client detects OCCUPIED reconnection in the same handler | **Chosen** |
| Return mode/clubStatus in CLUB_RECONNECT_RESULT only | Client would need two different paths to detect OCCUPIED state | Rejected |
| Separate event for club status | Extra event with no benefit | Rejected |

**Rationale**: The client already listens for MATCH_UPDATE on mount (via GET_MATCH_STATE). Including mode/clubStatus in that same payload is the minimal change to enable reconnection detection.

### Decision: Both CLUB_JOIN and CLUB_RECONNECT emit REF_REVOKED

CLUB_JOIN currently calls `registerClubReferee` silently — if Player B enters the PIN while Player A holds bridge, Player A gets silently displaced. The same fix applies: capture `registerClubReferee`'s return and emit `REF_REVOKED` to the old socket. Consistent behavior regardless of how the displacement happens.

## Data Flow

### Reconnection Flow

```
ClubPlayPage mount
      │
      ▼
useClubPlay: emit GET_MATCH_STATE
      │
      ▼
MatchEventHandler → MatchOrchestrator.getMatchState(court)
      │  returns MatchStateExtended + mode/clubStatus
      ▼
useClubPlay: on MATCH_UPDATE
      │  detects mode='club' && clubStatus='OCCUPIED'
      ▼
useClubPlay: emit CLUB_RECONNECT { courtId }
      │
      ▼
ClubPlayerHandler: CLUB_RECONNECT handler
      │  1. Validate courtId
      │  2. Check court exists, is club, clubStatus=OCCUPIED
      │  3. Call courtManager.registerClubReferee(courtId, socket.id)
      │  4. If oldSocketId returned → this.io.to(oldSocketId).emit(REF_REVOKED, { courtId })
      │  5. Emit CLUB_RECONNECT_RESULT { success: true, courtId, matchState }
      ▼
useClubPlay: on CLUB_RECONNECT_RESULT success
      │  update matchState, clear reconnecting, clear error
      ▼
ClubPlayPage: scoring buttons active
```

### REF_REVOKED Flow (enter PIN while occupied)

```
Player B: CLUB_JOIN { pin }
      │
      ▼
ClubPlayerHandler: CLUB_JOIN handler
      │  ... occupyClubCourt → clusterStatus already OCCUPIED → return current state
      │  registerClubReferee(court.id, socket.id)
      │    → setRefereeDirect displaces Player A → returns oldSocketId
      │  this.io.to(oldSocketId).emit(REF_REVOKED, { courtId, reason: 'replaced' })
      │
      ├──→ Player A's ClubPlayPage: on REF_REVOKED
      │     set refereeReplaced = true → disable scoring buttons
      │     show "Alguien más tomó el control del marcador"
      │
      └──→ Player B: CLUB_JOIN_RESULT { success: true, ... }
```

### autoSave Fix

```
autoSave() filter BEFORE:
  court.status === 'LIVE' || 'FINISHED'
        → skips all club courts (status is always 'WAITING')

autoSave() filter AFTER:
  court.status === 'LIVE' || 'FINISHED'
  || (court.mode === 'club' && (court.clubStatus === 'OCCUPIED' || 'FINISHED'))
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `shared/events.ts` | Modify | Add `CLUB_RECONNECT` (CLIENT) + `CLUB_RECONNECT_RESULT` (SERVER) |
| `shared/types.ts` | Modify | Add optional `mode?: string` and `clubStatus?: string` to `MatchStateExtended` |
| `server/src/services/table/PlayerService.ts` | Modify | `setRefereeDirect()` return type `void` → `string \| null` (returns displaced socketId) |
| `server/src/domain/courtManager.ts` | Modify | `registerClubReferee()` returns `string \| null`; `autoSave()` filter expanded; `loadTournament()` filter expanded; `toPersistedCourt()` includes `mode`+`clubStatus` |
| `server/src/domain/courtManager.ts` | Modify | `registerClubReferee()` returns `string \| null` (propagates displaced socketId) |
| `server/src/domain/matchEngine.ts` | Modify | `getState()` includes `mode` and `clubStatus` from engine internal state if present |
| `server/src/services/table/MatchOrchestrator.ts` | Modify | `getMatchState(court)` attaches `court.mode` and `court.clubStatus` to returned state |
| `server/src/services/store/types.ts` | Modify | `PersistedCourt` gets optional `mode` and `clubStatus` fields |
| `server/src/handlers/ClubPlayerHandler.ts` | Modify | Add `CLUB_RECONNECT` handler; emit `REF_REVOKED` from both `CLUB_JOIN` and `CLUB_RECONNECT` on displacement |
| `client/src/hooks/useClubPlay.ts` | Modify | Listen for `CLUB_RECONNECT_RESULT`, `REF_REVOKED`; emit `CLUB_RECONNECT` after detecting OCCUPIED; expose `reconnecting`, `refereeReplaced` state |
| `client/src/pages/ClubPlayPage/ClubPlayPage.tsx` | Modify | Handle `refereeReplaced` state (disable scoring, show indicator); show reconnecting loading state |

## Interfaces / Contracts

### Type Changes

```typescript
// shared/events.ts — add to CLIENT section
CLUB_RECONNECT: 'CLUB_RECONNECT',

// shared/events.ts — add to SERVER section
CLUB_RECONNECT_RESULT: 'CLUB_RECONNECT_RESULT',

// shared/types.ts — extend MatchStateExtended
export type MatchStateExtended = MatchState & {
  courtId: string;
  courtName: string;
  playerNames: { a: string; b: string };
  history: ScoreChange[];
  undoAvailable: boolean;
  mode?: CourtMode;        // NEW — 'club' for club-mode courts
  clubStatus?: ClubStatus;  // NEW — discriminator for club courts
};

// server/src/services/store/types.ts — extend PersistedCourt
export interface PersistedCourt {
  id: string;
  number: number;
  name: string;
  status: CourtStatus;
  pin: string;
  playerNames: { a: string; b: string };
  createdAt: number;
  matchState: PersistedMatchState;
  mode?: string;       // NEW — restore club-mode courts
  clubStatus?: string;  // NEW — restore club status
}
```

### Return Type Changes

```typescript
// PlayerService.setRefereeDirect: void → string | null
setRefereeDirect(court: Court, socketId: string, name: string): string | null {
  const existingReferee = court.players.find(p => p.role === 'REFEREE');
  if (existingReferee && existingReferee.socketId !== socketId) {
    court.players = court.players.filter(p => p.socketId !== existingReferee.socketId);
    return existingReferee.socketId;  // ← return displaced socketId
  }
  // ... rest of method
  return null;  // no displacement
}

// CourtManager.registerClubReferee: boolean → string | null
registerClubReferee(courtId: string, socketId: string): string | null {
  const court = this.repository.get(courtId);
  if (!court) return null;
  if (court.mode !== COURT_MODE.CLUB) return null;
  const oldSocketId = this.playerService.setRefereeDirect(court, socketId, 'Club Player');
  this.notifyUpdate(court);
  return oldSocketId;
}
```

### CLUB_RECONNECT Payload

```typescript
// Client → Server
interface ClubReconnectPayload {
  courtId: string;
}

// Server → Client (success)
interface ClubReconnectResultSuccess {
  success: true;
  courtId: string;
  matchState: MatchStateExtended;
}

// Server → Client (failure)
interface ClubReconnectResultError {
  success: false;
  error: 'COURT_NOT_FOUND' | 'NOT_CLUB_MODE' | 'COURT_NOT_OCCUPIED';
}

// Server → Client (REF_REVOKED)
interface RefRevokedPayload {
  courtId: string;
  reason: 'replaced';          // always 'replaced' for club displacement
}
```

### useClubPlay Extended Interface

```typescript
interface UseClubPlayReturn {
  // Existing
  matchState: MatchStateExtended | null;
  loading: boolean;
  error: string | null;
  finished: boolean;
  scorePoint: (player: 'A' | 'B') => void;
  subtractPoint: (player: 'A' | 'B') => void;
  undoLast: () => void;
  swapSides: () => void;
  startMatch: (nameA: string, nameB: string) => void;
  // NEW
  reconnecting: boolean;        // true while CLUB_RECONNECT is in flight
  refereeReplaced: boolean;     // true after REF_REVOKED received
  isReferee: boolean;           // false after REF_REVOKED
}
```

## Client Reconnection Sequence

```
1. Mount: socket connects → emits GET_MATCH_STATE
2. MATCH_UPDATE arrives:
   a. If mode === 'club' && clubStatus === 'OCCUPIED'
      → set reconnecting = true
      → emit CLUB_RECONNECT { courtId }
   b. Otherwise (WAITING, RESERVED, FINISHED)
      → normal flow, no reconnection
3. CLUB_RECONNECT_RESULT:
   a. success=true → clear reconnecting, update matchState, clear error
   b. success=false → clear reconnecting, set error, show error view
4. REF_REVOKED arrives at any time:
   → set refereeReplaced = true
   → scoring buttons disabled immediately
   → scoreboard stays visible (read-only spectator view)
```

### ClubPlayPage State Machine

```
       ┌──────────┐
       │  loading  │ ← initial mount + GET_MATCH_STATE
       └────┬─────┘
            │ MATCH_UPDATE arrives
            ▼
       ┌──────────┐
       │ detecting │ ← matchState present, checking mode/clubStatus
       └────┬─────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌─────────┐  ┌────────────┐
│reconnect│  │   normal   │ ← WAITING → name prompt, etc.
│(OCCUPIED)│  │   flow     │
└────┬────┘  └────────────┘
     │
     ▼
┌──────────┐
│ emitting │ ← CLUB_RECONNECT sent, reconnecting=true
└────┬─────┘
     │
     ├──→ CLUB_RECONNECT_RESULT success → playing (isReferee=true)
     ├──→ CLUB_RECONNECT_RESULT error   → error view
     └──→ REF_REVOKED arrives            → spectator (isReferee=false)
```

## autoSave & loadTournament Filter Changes

```typescript
// autoSave() filter — include OCCUPIED + FINISHED club courts
const persisted: PersistedCourt[] = allCourts
  .filter((c) =>
    c.status === 'LIVE' ||
    c.status === 'FINISHED' ||
    (c.mode === COURT_MODE.CLUB && (
      c.clubStatus === CLUB_STATUS.OCCUPIED ||
      c.clubStatus === CLUB_STATUS.FINISHED
    ))
  )
  .map((c) => this.toPersistedCourt(c));

// loadTournament() filter — restore OCCUPIED club courts
if (pt.status !== 'LIVE' && pt.status !== 'FINISHED') {
  // NEW: also restore OCCUPIED club courts
  const isClubOccupied = pt.mode === 'club' && pt.clubStatus === 'OCCUPIED';
  if (!isClubOccupied) {
    continue;
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `setRefereeDirect` returns displaced socketId | Call with existing referee → assert return value is old socketId; call without existing referee → assert null |
| Unit | `registerClubReferee` propagates old socketId | Stub `setRefereeDirect` to return mock socketId; assert `registerClubReferee` returns it |
| Unit | autoSave filter includes OCCUPIED/FINISHED club courts | Create courts with various status/mode/clubStatus combos; call autoSave; assert correct set persisted |
| Unit | loadTournament filter restores OCCUPIED club courts | Create PersistedCourt with mode=club, clubStatus=OCCUPIED; call loadTournament; assert court restored |
| Unit | `getMatchState` includes mode/clubStatus | Call with club court; assert returned state has mode+clubStatus; call with tournament court; assert absent |
| Integration | CLUB_RECONNECT happy path | Mock socket; emit CLUB_RECONNECT → assert registerClubReferee called → assert CLUB_RECONNECT_RESULT emitted |
| Integration | CLUB_RECONNECT error paths | Mock court not found / not club / not OCCUPIED → assert correct error emitted |
| Integration | REF_REVOKED emitted on displacement | CLUB_JOIN twice → first socket receives REF_REVOKED; CLUB_RECONNECT with stale socket → REF_REVOKED emitted |
| Integration | Client reconnection emit | Mount useClubPlay → mock MATCH_UPDATE with mode=club, clubStatus=OCCUPIED → assert CLUB_RECONNECT emitted |

## Migration / Rollout

**No data migration required**. The autoSave filter change is additive — courts that were already excluded continue to be excluded until they transition to OCCUPIED. The `PersistedCourt` type change is backward-compatible: existing persisted files without `mode`/`clubStatus` fields will restore as regular tournament courts (no mode → `loadTournament` skips them with existing filter).

Rollback: revert all commits in the PR. Club mode continues working as Phase 2 without reconnection.

## Implementation Order

1. `shared/events.ts` — add CLUB_RECONNECT + CLUB_RECONNECT_RESULT
2. `shared/types.ts` — add mode/clubStatus to MatchStateExtended
3. `server/src/services/store/types.ts` — add mode/clubStatus to PersistedCourt
4. `server/src/services/table/PlayerService.ts` — change `setRefereeDirect` return type
5. `server/src/domain/courtManager.ts` — change `registerClubReferee` return type + autoSave/loadTournament filters + toPersistedCourt
6. `server/src/services/table/MatchOrchestrator.ts` — attach mode/clubStatus in getMatchState
7. `server/src/handlers/ClubPlayerHandler.ts` — add CLUB_RECONNECT handler + REF_REVOKED emit in CLUB_JOIN
8. `client/src/hooks/useClubPlay.ts` — reconnection emit + REF_REVOKED/CLUB_RECONNECT_RESULT listeners
9. `client/src/pages/ClubPlayPage/ClubPlayPage.tsx` — refereeReplaced state + reconnecting indicator
10. Tests

## Verified Codebase Facts

- ✅ `PlayerService.setRefereeDirect()` returns `void` — **must change to `string | null`**
- ✅ `PlayerService.setRefereeDirect()` already filters out existing referee by socketId — the displace logic exists, only the return value is missing
- ✅ `ClubPlayerHandler` extends `SocketHandlerBase` which `protected io: Server` — `this.io.to(oldSocketId).emit(...)` works
- ✅ `occupyClubCourt` already handles reconnection on OCCUPIED courts (returns current match state, no re-init)
- ✅ `MatchStateExtended` does NOT currently include `mode`/`clubStatus` — must add
- ✅ `PersistedCourt` does NOT currently include `mode`/`clubStatus` — must add
- ❌ `forceEndSession` sets `clubStatus: FINISHED` but does NOT call `autoSave` — `notifyUpdate()` is called which triggers `autoSave()` via the private helper, but current filter excludes FINISHED club courts. After the fix, they'll be persisted.
- ✅ Court `status` is always `'WAITING'` for club courts — status is not a discriminator for club mode, only `clubStatus` is

## Open Questions

- [ ] None — all design decisions resolved against verified codebase facts
