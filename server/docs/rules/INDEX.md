# RallyOS Server Architecture Rules

**Location:** `server/src/`  
**Stack:** Node.js + TypeScript + Express + Socket.IO  
**Test Framework:** Jest

---

## Quick Navigation

| Document | What It Covers |
|----------|---------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layer definitions, responsibilities, data flow |
| [DOMAIN.md](DOMAIN.md) | Domain layer rules (MatchEngine, pure logic) |
| [APPLICATION.md](APPLICATION.md) | Application layer rules (TableManager, orchestration) |
| [INFRASTRUCTURE.md](INFRASTRUCTURE.md) | Infrastructure layer (handlers, HTTP, sockets) |
| [TESTING.md](TESTING.md) | Server testing rules and patterns |

---

## The Golden Rule

> **Business logic (game rules) lives in the Domain layer. It knows nothing about HTTP, Socket.IO, or databases.**

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────┐
│              INFRASTRUCTURE LAYER            │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Express    │  │   Socket.IO Handlers │ │
│  │   (app.ts)   │  │  (Table,Match,Auth)  │ │
│  └──────────────┘  └──────────────────────┘ │
│                                              │
│  Rules: I/O only. No business logic.         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│             APPLICATION LAYER                │
│  ┌────────────────────────────────────────┐ │
│  │         TableManager (orchestrator)    │ │
│  │  - Table CRUD                          │ │
│  │  - Player management                   │ │
│  │  - Match orchestration                 │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Rules: Orchestrates domain. No I/O.         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│               DOMAIN LAYER                   │
│  ┌────────────────────────────────────────┐ │
│  │         MatchEngine (game rules)       │ │
│  │  - Score calculation                   │ │
│  │  - Set/match winner detection          │ │
│  │  - Side swap logic                     │ │
│  │  - History tracking                    │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Rules: Pure game logic. No Socket.IO.       │
│  Testable without server running.            │
└─────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Single Source of Truth for Types

**All API types that cross the wire (client ↔ server) MUST live in `shared/types.ts`.**

`server/src/types.ts` is ONLY for server-internal types (e.g., `Table` with internal callbacks). Never duplicate a type definition.

See [ARCHITECTURE.md#shared-types--single-source-of-truth](ARCHITECTURE.md#shared-types--single-source-of-truth) for details.

### 2. Domain Layer is Pure

The Domain layer contains **game rules only**. It doesn't know about:
- Socket.IO
- HTTP
- Express
- Filesystem
- Environment variables

**MatchEngine** is the core domain object. It should be testable in isolation:
```typescript
const engine = new MatchEngine({ pointsPerSet: 11, bestOf: 3 })
engine.recordPoint('A')
expect(engine.getState().score.currentSet.a).toBe(1)
```

### 2. Application Layer Orchestrates

The Application layer (TableManager) coordinates domain objects but doesn't contain game logic:
- Creates tables
- Manages players
- Delegates scoring to MatchEngine
- Publishes events (via callbacks)

### 3. Infrastructure Layer Handles I/O

Infrastructure handles all I/O:
- Socket event handlers receive data
- Validate input (using validation service)
- Call application layer
- Emit responses via sockets

**Handlers should be thin.** They validate, delegate, and respond. No business logic.

### 4. Single Responsibility

Each module has ONE reason to change:
- `MatchEngine` — changes when game rules change
- `TableManager` — changes when table lifecycle changes
- `TableEventHandler` — changes when table socket events change
- `AuthHandler` — changes when auth requirements change

---

## Current Codebase Status

| Area | Status | Notes |
|------|--------|-------|
| `MatchEngine` | **Good** | Pure domain logic. Testable. |
| `TableManager` | **Needs work** | 449 lines. Violates SRP (CRUD + players + match orchestration + QR + PIN gen) |
| `SocketHandlerBase` | **Needs work** | Mixes rate limiting + table transformation + validation + auth |
| `Handlers` | **Good** | Well-structured, thin, delegate to TableManager |
| `Validation` | **Model** | Excellent. Pure functions, reusable. |
| `pinEncryption` | **Good** | Pure utility. No side effects. |

---

## Enforcement

1. **Code review** — PRs should reference the relevant rule
2. **Tests** — Domain tests must run without Socket.IO
3. **Lint** — Max 200 lines per class (TableManager needs splitting)

---

## Related

- `client/docs/rules/` — Client architecture rules
- `openspec/changes/refactor-client-architecture/` — Client refactor SDD
