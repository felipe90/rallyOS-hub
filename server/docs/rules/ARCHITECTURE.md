# Server Architecture

**Applies to:** All code in `server/src/`

---

## Layer Overview

### 1. Domain Layer (`matchEngine.ts`)

**Responsibility:** Game rules and match state.

**Rules:**
- No Socket.IO references
- No Express references
- No file system access
- No environment variables
- Testable with simple unit tests

**Current state:** `MatchEngine` follows these rules well. It contains pure game logic:
- Score tracking
- Set/match winner detection
- Side swap (ITTF rules)
- Serving rotation
- History tracking

**Model code:**
```typescript
// Pure game logic
engine.recordPoint('A')
engine.subtractPoint('B')
engine.undoLast()
const state = engine.getState()
```

---

### 2. Application Layer (`tableManager.ts`)

**Responsibility:** Orchestrate tables, players, and matches.

**Current problem:** 449 lines, violates SRP. It does:
- Table CRUD (create, delete, get)
- Player management (join, leave, set referee)
- Match orchestration (start, configure, reset)
- PIN generation
- QR data generation
- Table info transformation (3 methods: tableToInfo, getTableWithPin, getPublicTableList)

**Should be split into:**
```
TableManager/          -- Table lifecycle only
  TableRepository.ts   -- CRUD operations
  PlayerService.ts     -- Join/leave/setReferee
  MatchService.ts      -- Start/configure/reset
  TableFormatter.ts    -- Transform Table -> TableInfo
  PinService.ts        -- Generate PINs
  QRService.ts         -- Generate QR data
```

**Rule:** Each service < 150 lines.

---

### 3. Infrastructure Layer (handlers, app, server)

**Responsibility:** I/O and protocol handling.

**Rules:**
- Receive socket events
- Validate input (using `utils/validation`)
- Call Application layer
- Emit responses
- No business logic

**Good example:** `MatchEventHandler`
```typescript
socket.on('RECORD_POINT', (data) => {
  // 1. Validate
  if (!validatePayload(data, rules)) return
  
  // 2. Check auth
  if (!this.validateReferee(socket, data.tableId)) return
  
  // 3. Delegate to application layer
  const state = this.tableManager.recordPoint(data.tableId, data.player)
  
  // 4. Emit response
  if (state) {
    this.io.to(data.tableId).emit('MATCH_UPDATE', state)
  }
})
```

---

### 4. Shared Utilities (`utils/`)

**Responsibility:** Cross-cutting concerns.

**Current utilities:**
- `validation.ts` — Input validation (model: pure functions)
- `pinEncryption.ts` — Encryption/decryption (model: pure functions)
- `logger.ts` — Logging
- `qrGenerator.ts` — QR generation

**Rules:**
- Utilities are stateless
- No business logic
- No I/O (except logger)

---

## Data Flow

```
Client Socket.IO
       │
       ▼
┌─────────────────┐
│ Socket Handler  │  -- Validate input, check auth
│ (Infrastructure)│
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ TableManager    │  -- Orchestrate
│ (Application)   │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ MatchEngine     │  -- Game rules
│ (Domain)        │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ State returned  │  -- Back up the stack
│ to client       │
└─────────────────┘
```

---

## Key Metrics

| Module | Lines | Target | Action |
|--------|-------|--------|--------|
| MatchEngine | 272 | < 300 | ✅ Good |
| TableManager | 449 | < 200 | ❌ Split |
| SocketHandlerBase | 110 | < 150 | ✅ OK |
| TableEventHandler | 179 | < 200 | ✅ OK |
| MatchEventHandler | 292 | < 250 | ⚠️ Close |
| AuthHandler | 123 | < 150 | ✅ OK |

---

## Refactoring Priorities

### Priority 1: Split TableManager
Extract into focused services:
1. `TableRepository` — CRUD + storage
2. `PlayerService` — Join/leave/referee management
3. `MatchOrchestrator` — Start/configure/reset
4. `TableFormatter` — Transformations
5. `PinService` — PIN generation
6. `QRService` — QR data generation

### Priority 2: Extract Rate Limiting
Move from SocketHandlerBase to a dedicated `RateLimiter` service.

### Priority 3: Clean up MatchEventHandler
At 292 lines, close to limit. Consider extracting common patterns.

---

## Anti-Patterns

| Anti-Pattern | Example | Fix |
|--------------|---------|-----|
| God Class | TableManager (449 lines) | Split into services |
| Mixed concerns | Rate limiting in base handler | Extract to RateLimiter service |
| Direct dependency | TableManager creates MatchEngine | Inject via factory |
| Validation in handler | Inline validation checks | Use validatePayload utility |
| Duplicate transformations | 3 tableToInfo variants | Single formatter |
| **Duplicated API types** | `server/src/types.ts` copies `shared/types.ts` | Import from `../../shared/types` |

---

## Shared Types — Single Source of Truth

### The Rule

**All API types that cross the wire (client ↔ server) MUST live in `shared/types.ts`.**

`server/src/types.ts` is ONLY for server-internal types (e.g., `Table` with internal callbacks).

### Why

When client and server duplicate type definitions, they drift silently. A field renamed on one side breaks the other at **runtime** with no TypeScript error.

### What belongs where

| Location | What goes there |
|----------|-----------------|
| `shared/types.ts` | `TableInfo`, `MatchState`, `Score`, `QRData`, `MatchEvent`, `ErrorResponse`, etc. |
| `server/src/types.ts` | `Table` (with internal callbacks like `onTableUpdate`), server-only helpers |

### How to import

```typescript
// ✅ Correct — import shared API types from shared
import { TableInfo, MatchStateExtended } from '../../shared/types';

// ✅ Correct — import server-internal types from local types
import { Table } from './types';

// ❌ Wrong — never duplicate a type definition
// ❌ Wrong — never define TableInfo in server/src/types.ts
```

### Enforcement

- `server/src/types.ts` re-exports everything from `shared/types.ts` for backward compatibility, but new code should import directly from `shared/types.ts`.
- If you need a type on both sides, add it to `shared/types.ts`, not `server/src/types.ts`.
