# Design: Security Hardening v2

## Technical Approach

Surgical fixes across 8 items, server-first. No socket contract or shared-type changes. Each fix is an atomic commit. TDD where test infrastructure exists.

## Architecture Decisions

### Decision: VERIFY_OWNER rate limiting

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Reuse `SocketHandlerBase.isRateLimited()` | Zero new code; same sliding-window Map pattern as `SET_REF` | ✅ Chosen |
| External rate limiter (Redis) | Overhead for single-hub LAN topology | ❌ Rejected |
| Socket.io middleware | Breaks existing handler-centric pattern | ❌ Rejected |

**Key detail**: key is `VERIFY_OWNER:{clientIp}` so IPs are isolated.

### Decision: DELETE_TABLE authorization

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `socket.data.isOwner OR tableManager.isReferee(tableId, socket.id)` | Uses existing state; referees can clean up their own tables | ✅ Chosen |
| Require owner PIN for every deletion | Breaks referee UX who creates and deletes tables | ❌ Rejected |
| Require PIN if not owner | Adds payload complexity; current flow omits PIN for owners | ❌ Rejected |

### Decision: Client PIN storage

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `sessionStorage` | Survives F5, dies with tab; limits XSS window | ✅ Chosen |
| React state only | Lost on refresh; poor UX | ❌ Rejected |
| HttpOnly cookie | Requires HTTP endpoint; over-engineering for LAN | ❌ Rejected |

### Decision: resetTable() returns void

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Return `void`, emit `TABLE_UPDATE` with `WAITING` | Caller (`MatchEventHandler`) stops expecting a state object | ✅ Chosen |
| Return `MatchStateExtended` with `WAITING` status | Kept old contract but misleading; table is not LIVE | ❌ Rejected |

### Decision: Hook removal strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Grep usages → migrate → delete files → fix barrel export | Safe, compiler validates zero broken imports | ✅ Chosen |
| Delete first, let compiler find breaks | Risky in untyped test mocks | ❌ Rejected |

**Usage audit**:
- `useAuth.ts`: zero production imports (deprecated, superseded by `useAuthContext`). Test file `useAuth.test.ts` will be deleted.
- `useDashboardAuth.ts`: used in `OwnerDashboardPage.tsx`, `HistoryViewPage.tsx`, and `HistoryViewPage.test.tsx`. Migrate all to `usePermissions()` (same shape: `isOwner`, `isReferee`, `canCreateTable`, etc.).

### Decision: Owner PIN logging

User explicitly wants logging kept for testing. No change to `server/src/index.ts` logger calls.

## Data Flow

### DELETE_TABLE (new auth gate)

```
Client emits DELETE_TABLE { tableId }
        │
        ▼
TableEventHandler.ts
    ├── validateSocketPayload()  ← existing
    ├── isRateLimited()          ← existing
    ├── table = getTable()       ← existing
    │
    ├── [NEW] isOwner = socket.data.isOwner === true
    ├── [NEW] isRef   = tableManager.isReferee(tableId, socket.id)
    │
    ├── if (!isOwner && !isRef)
    │       → emitError(socket, 'UNAUTHORIZED')
    │       → return
    │
    └── deleteTable() → emit TABLE_DELETED → emit TABLE_LIST
```

### VERIFY_OWNER (new rate-limit gate)

```
Client emits VERIFY_OWNER { pin }
        │
        ▼
AuthHandler.ts
    ├── validateSocketPayload()  ← pattern updated to /^\d{8}$/
    │
    ├── [NEW] rateLimitKey = `VERIFY_OWNER:${socket.handshake.address}`
    ├── [NEW] if isRateLimited(key)
    │       → emitError(socket, 'RATE_LIMITED')
    │       → return
    │
    ├── if pin === ownerPin → socket.data.isOwner = true → emit OWNER_VERIFIED
    └── else → emitError INVALID_OWNER_PIN
```

### RESET_TABLE (behavior change)

```
Client emits RESET_TABLE { tableId }
        │
        ▼
MatchEventHandler.ts
    ├── validateSocketPayload()  ← existing
    ├── validateReferee()        ← existing
    │
    ├── [MOD] tableManager.resetTable(tableId, config)  // now void
    │
    ├── [MOD] no `const state = ...` assignment
    ├── [MOD] no `if (state) emit MATCH_UPDATE`
    │
    └── [NEW] emit TABLE_UPDATE with status WAITING
           (tableManager.notifyUpdate already emits this)
```

> `resetTable()` internally creates a fresh `MatchEngine`, sets `table.status = 'WAITING'`, calls `notifyUpdate()`, and returns `undefined`.

## File Changes

### Server

| File | Action | Change |
|------|--------|--------|
| `server/src/index.ts` | Modify | No logger changes (user requirement); env var already reads `TOURNAMENT_OWNER_PIN` |
| `server/src/handlers/AuthHandler.ts` | Modify | Add rate limit to `VERIFY_OWNER`; change `pin` pattern to `/^\d{8}$/` |
| `server/src/handlers/TableEventHandler.ts` | Modify | Add `isOwner \|\| isReferee` check to `DELETE_TABLE`; remove optional PIN bypass |
| `server/src/handlers/MatchEventHandler.ts` | Modify | Add `min:1, max:9` / `min:1, max:99` validation to `CONFIGURE_MATCH`; adapt `RESET_TABLE` to void return |
| `server/src/tableManager.ts` | Modify | `generatePin()` → `crypto.randomInt(1000, 9999)`; `resetTable()` → `void` with no `startMatch()` |
| `server/src/utils/validation.ts` | No change | Already supports `min`/`max` numeric rules |
| `docker-compose.yml` | Modify | `REFEREE_PIN` → `TOURNAMENT_OWNER_PIN` |
| `.env` | Modify | `REFEREE_PIN` → `TOURNAMENT_OWNER_PIN` |
| `.env.example` | Modify | `REFEREE_PIN` → `TOURNAMENT_OWNER_PIN` |
| `diagnose.sh` | Modify | grep `REFEREE_PIN` → `TOURNAMENT_OWNER_PIN` |

### Client

| File | Action | Change |
|------|--------|--------|
| `client/src/contexts/AuthContext/AuthContext.tsx` | Modify | `localStorage` → `sessionStorage` for `ownerPin` |
| `client/src/hooks/useSocket.ts` | Modify | `localStorage.getItem('ownerPin')` → `sessionStorage.getItem('ownerPin')` (lines 119, 142) |
| `client/src/hooks/useAuth.ts` | Delete | Deprecated hook; zero prod usages |
| `client/src/hooks/useAuth.test.ts` | Delete | Tests for deleted hook |
| `client/src/hooks/useDashboardAuth.ts` | Delete | Deprecated hook; usages migrated |
| `client/src/hooks/index.ts` | Modify | Remove exports for deleted hooks |
| `client/src/pages/OwnerDashboardPage.tsx` | Modify | Replace `useDashboardAuth()` with `usePermissions()` |
| `client/src/pages/HistoryViewPage.tsx` | Modify | Replace `useDashboardAuth()` with `usePermissions()` |
| `client/src/pages/HistoryViewPage.test.tsx` | Modify | Mock `usePermissions` instead of `useDashboardAuth` |
| `client/src/pages/AuthPage/AuthPage.types.ts` | Modify | Rename `REFEREE_PIN` constant → `DEFAULT_TABLE_PIN` |
| `client/src/pages/AuthPage/index.ts` | Modify | Update export name |

## Interfaces / Contracts

No changes to `shared/events.ts` or `shared/types.ts`.

**Validation rules updated in handlers**:
```typescript
// AuthHandler.ts — VERIFY_OWNER
pin: { required: true, type: 'string', pattern: /^\d{8}$/ }

// MatchEventHandler.ts — CONFIGURE_MATCH
format:   { type: 'number', required: false, min: 1, max: 9 },
ptsPerSet: { type: 'number', required: false, min: 1, max: 99 }
```

**`resetTable()` contract change**:
```typescript
// BEFORE:
public resetTable(tableId: string, config?: MatchConfig): MatchStateExtended | null

// AFTER:
public resetTable(tableId: string, config?: MatchConfig): void
```

## Testing Strategy

| Layer | What to test | Approach |
|-------|-------------|----------|
| Unit | `generatePin()` returns 4 digits; `resetTable()` returns `undefined`; `isRateLimited()` sliding window | Vitest (server) |
| Integration | 6th `VERIFY_OWNER` returns `RATE_LIMITED`; unauthorized `DELETE_TABLE` returns `UNAUTHORIZED`; `CONFIGURE_MATCH` with `format=0` returns `VALIDATION_ERROR` | Socket.io test client |
| Manual | Browser DevTools: verify `sessionStorage` has `ownerPin`, close tab → reopen → `sessionStorage` empty | DevTools + manual QA |

## Migration / Rollout

- **Session loss**: Users with `ownerPin` in `localStorage` will need to re-authenticate after deploy. Intentional — old localStorage sessions are considered potentially compromised.
- **Env var rename**: Operators must update `.env` and `docker-compose.yml` before restart. `diagnose.sh` updated to reflect new var name.
- **No DB migration**: All state is in-memory; no persisted data to migrate.

## Open Questions — Resolved

| # | Question | Resolution |
|---|----------|------------|
| 1 | Rename `REFEREE_PIN` client constant? | ✅ **YES** → rename to `DEFAULT_TABLE_PIN` |
| 2 | Tighten `GET_TABLES_WITH_PINS` to `/^\d{8}$/`? | ❌ **NO** — user explicitly wants table PINs to stay 4 digits. Keep `/^\d{5,8}$/` |
| 3 | Change `useSocket.ts` `validateOwnerPin()` to `/^\d{8}$/`? | ✅ **YES** — owner PIN must be exactly 8 digits |
