# Auth Architecture — Session Token Persistence

**Status:** Implemented (SDD: `jwt-session-persistence`)
**Last updated:** 2026-07-17

---

## Problem

Previously, admin and tournament-owner authentication lived only in
`socket.data` (server-side per-connection memory). When the page
reloaded, a new socket connected with a fresh `socket.data` and the
user had to re-enter their PIN — even though they had just
authenticated seconds ago.

The old code attempted to fix this with a `sessionToken` middleware
that blindly trusted any string sent in `socket.handshake.auth`. That
was removed as a security vulnerability (CRITICAL finding). This
change replaces it with **signed JWT** session tokens that are
cryptographically verified on reconnect.

---

## Scope

| Flow | Before | After |
|---|---|---|
| **Tournament owner** (VERIFY_OWNER) | UUID stored in in-memory Set; socket auth lost on reload | Signed JWT; socket auth restored on reload |
| **Club admin** (CLUB_VERIFY_ADMIN) | No token at all; socket auth lost on reload | Signed JWT; socket auth restored on reload |
| **Referee** (SET_REF) | State in `courtManager`; CLUB_RECONNECT with PIN | **Not changed** — transient, PIN-based |
| **Club player** (CLUB_JOIN) | Transient kiosk | **Not changed** — no session needed |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        rallyOS-hub                               │
│                                                                  │
│  ┌──────────────────────┐        ┌────────────────────────────┐ │
│  │       CLIENT          │        │          SERVER             │ │
│  │                       │        │                             │ │
│  │  sessionStorage:      │        │  ENCRYPTION_SECRET (env)   │ │
│  │  rallyos.sessionToken │        │  ┌───────────────────────┐  │ │
│  │                       │        │  │ SessionTokenService   │  │ │
│  │  ┌─────────────────┐  │        │  │  signToken()          │  │ │
│  │  │ AuthContext      │  │        │  │  verifyToken()       │  │ │
│  │  │  - role          │  │        │  │  HMAC-SHA256          │  │ │
│  │  │  - sessionToken  │  │        │  └──────────┬───────────┘  │ │
│  │  └────────┬─────────┘  │        │             │              │ │
│  │           │             │        │     ┌───────┴────────┐    │ │
│  │  ┌────────▼─────────┐  │        │     │                │    │ │
│  │  │useSocketConnection│──────────────▶│  io.use()       │    │ │
│  │  │ auth:{sessionToken}│        │     │  (JWT verify)   │    │ │
│  │  └──────────────────┘  │        │     │                │    │ │
│  │                       │        │     └───────┬────────┘    │ │
│  │  ┌─────────────────┐  │        │             │             │ │
│  │  │ useAuthFlow     │◀───────────────────────┘             │ │
│  │  │  OWNER_VERIFIED │        │     ┌───────────────────────┐│ │
│  │  │  {tournamentToken}│      │     │  socket.data           ││ │
│  │  └──────────────────┘        │     │  isOwner: true         ││ │
│  │                              │     │  isAuthenticated: true ││ │
│  │                              │     │  isClubAdmin: true     ││ │
│  └──────────────────────────┘  │     └───────────────────────┘│ │
│                                 └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## JWT Structure

```
header.payload.signature

Header:  { "alg": "HS256", "typ": "JWT" }
Payload: { "sub": "<subject>", "role": "<role>", "iat": <ts>, "exp": <ts> }
Sig:    HMAC-SHA256(header.payload, ENCRYPTION_SECRET)
```

All three segments are `base64url`-encoded and separated by dots.

| Claim | Value | Description |
|---|---|---|
| `sub` | `"owner"` or club config ID | Identifies WHO the token is for |
| `role` | `"tournament_owner"` \| `"club_admin"` | Determines which `socket.data` flags to restore |
| `iat` | Unix timestamp | Issued at |
| `exp` | `iat` + 8h (default) | Expiry; 30s clock-skew leeway on verify |

TTL is configurable via `SESSION_TOKEN_HOURS` env var.

---

## Flow Diagrams

### 1. Owner Login (VERIFY_OWNER)

```
Client                          Server
  │                               │
  │  socket.emit(VERIFY_OWNER,   │
  │    { pin: "12345678" })       │
  │──────────────────────────────▶│
  │                               │  comparePin(pin, ownerPin)
  │                               │  ─── timing-safe compare
  │                               │
  │                               │  if PIN valid:
  │                               │    JWT = SessionTokenService.signToken({
  │                               │      sub: "owner",
  │                               │      role: "tournament_owner"
  │                               │    })
  │                               │    socket.data = {
  │                               │      isOwner: true,
  │                               │      isAuthenticated: true
  │                               │    }
  │                               │
  │  OWNER_VERIFIED {             │
  │    token: "owner-session",    │
  │    tournamentToken: <JWT>     │
  │  }                            │
  │◀──────────────────────────────│
  │                               │
  │  sessionStorage.setItem(      │
  │    "rallyos.sessionToken",    │
  │    <JWT>)                     │
  │                               │
  │  localStorage.setItem(        │
  │    "tournamentToken",         │
  │    <JWT>)  // for HTTP Bearer │
  │                               │
```

### 2. Page Reload — Socket Reconnect

```
Client                          Server
  │                               │
  │  [page reloads]               │
  │  sessionStorage still has JWT │
  │                               │
  │  io({ auth: {                │
  │    sessionToken: <JWT>        │
  │  }})                          │
  │──────────────────────────────▶│
  │                               │
  │                    ┌──────────┤  io.use() middleware #1:
  │                    │          │  rate limiter (existing)
  │                    └──────────┤
  │                               │
  │                    ┌──────────┤  io.use() middleware #2:
  │                    │          │  JWT reconnect (NEW)
  │                    │          │
  │                    │          │  claims = verifyToken(<JWT>)
  │                    │          │  if claims.role === "tournament_owner":
  │                    │          │    socket.data = {
  │                    │          │      isOwner: true,
  │                    │          │      isAuthenticated: true
  │                    │          │    }
  │                    │          │  elif claims.role === "club_admin":
  │                    │          │    socket.data = {
  │                    │          │      isClubAdmin: true
  │                    │          │    }
  │                    │          │  else / null:
  │                    │          │    ⚠️ pass through unauthenticated
  │                    │          │    (client must re-PIN)
  │                    └──────────┤
  │                               │
  │  io.on('connection')         │
  │  ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯│
  │                               │
  │  COURT_LIST + ...             │
  │◀──────────────────────────────│
```

### 3. HTTP Tournament API (Bearer JWT)

```
Client                          Server
  │                               │
  │  GET /api/tournament/status   │
  │  Authorization: Bearer <JWT>  │
  │──────────────────────────────▶│
  │                               │
  │                    ┌──────────┤  ownerAuthMiddleware:
  │                    │          │  claims = verifyToken(<JWT>)
  │                    │          │  if claims?.role === "tournament_owner":
  │                    │          │    next()  ✅
  │                    │          │  else:
  │                    │          │    401 Unauthorized  ❌
  │                    └──────────┤
  │                               │
  │  200 OK { exists: ... }       │
  │◀──────────────────────────────│
```

### 4. Expired / Invalid Token on Reconnect

```
Client                          Server
  │                               │
  │  io({ auth: {                │
  │    sessionToken: <expired>   │
  │  }})                          │
  │──────────────────────────────▶│
  │                               │
  │                    ┌──────────┤  io.use() JWT middleware:
  │                    │          │  claims = verifyToken(<expired>)
  │                    │          │  returns null  ❌
  │                    │          │  → next()  (pass through, no flags)
  │                    └──────────┤
  │                               │
  │  socket.data = {}             │
  │  (no isOwner, no isAuth)      │
  │                               │
  │  Client receives events but   │
  │  CREATE_COURT etc. are        │
  │  rejected (UNAUTHORIZED).    │
  │  UI should prompt for PIN.    │
  │                               │
```

---

## File Map

### Server (new files)

| File | Role |
|---|---|
| `server/src/services/security/SessionTokenService.ts` | JWT sign/verify (HMAC-SHA256) |
| `server/src/services/security/SessionTokenService.test.ts` | Unit tests (sign, verify, tamper, expiry, missing secret) |
| `server/src/handlers/ClubAdminHandler.test.ts` | Club admin JWT issuance tests |

### Server (modified files)

| File | Change |
|---|---|
| `server/src/handlers/AuthHandler.ts` | Inject `SessionTokenService`; sign JWT on VERIFY_OWNER |
| `server/src/handlers/ClubAdminHandler.ts` | Inject `SessionTokenService`; sign JWT on CLUB_VERIFY_ADMIN |
| `server/src/handlers/SocketHandler.ts` | New `io.use()` JWT reconnect middleware; `applySessionClaims()` |
| `server/src/middleware/ownerAuth.ts` | Factory `createOwnerAuthMiddleware(service)`; removed `activeTokens` Set + `generateToken()` |
| `server/src/middleware/ownerAuth.test.ts` | Updated for JWT-based auth |
| `server/src/handlers/AuthHandler.tournamentToken.test.ts` | Updated for JWT shape |
| `server/src/utils/pinEncryption.ts` | Exported `getServerSecret` (shared secret source) |
| `server/src/index.ts` | Composition root: `SessionTokenService` → `AuthHandler` + `ownerAuthMiddleware` |

### Client (modified files)

| File | Change |
|---|---|
| `client/src/services/storage/authStorage.ts` | `getSessionToken()` / `setSessionToken()` (sessionStorage) |
| `client/src/contexts/AuthContext/AuthContext.tsx` | Restore JWT on mount; expire check |
| `client/src/contexts/AuthContext/AuthContext.types.ts` | `sessionToken` field |
| `client/src/hooks/useSocketConnection.ts` | Send `auth.sessionToken` on connect |
| `client/src/hooks/useAuthFlow.ts` | Store JWT from OWNER_VERIFIED |
| `client/src/hooks/useClubAdmin.ts` | Store JWT from CLUB_ADMIN_VERIFIED |
| Associated test files | Updated for new contracts |

---

## Security Properties

| Property | How |
|---|---|
| **HMAC-SHA256** | Cannot forge without `ENCRYPTION_SECRET` |
| **Constant-time compare** | `crypto.timingSafeEqual` on signature |
| **Null on failure** | `verifyToken()` never throws — returns `null` |
| **Pass-through on invalid** | Reconnect middleware never rejects connection |
| **Production secret enforcement** | Throws if `ENCRYPTION_SECRET` unset or < 32 bytes |
| **No token content in logs** | Log reasons only (`bad_signature`, `expired`, etc.) |
| **Claims limited** | Only `sub`, `role`, `iat`, `exp` — no sensitive data |
| **sessionStorage** | Tab-scoped; cleared when tab closes |
| **30s clock-skew leeway** | Prevents spurious rejections |

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `ENCRYPTION_SECRET` | (required in prod) | HMAC secret (shared with `pinEncryption.ts`) |
| `SESSION_TOKEN_HOURS` | `8` | JWT TTL in hours |
| `NODE_ENV` | — | `production` enforces secret validation |

---

## Known Deviations (from verify report)

1. **REQ-12 dual-storage**: JWT also persists in `localStorage` as legacy
   `tournamentToken` for HTTP Bearer. Spec said "not localStorage".
   Follow-up: migrate HTTP Bearer to read from sessionStorage instead.

2. **SESSION_TOKEN_HOURS** vs spec's `SESSION_TOKEN_TTL_HOURS`:
   Orchestrator override. Reconcile if strict spec naming required.

3. **Three `SessionTokenService` instances**: `index.ts`, `SocketHandler`
   constructor, and `SocketHandler.setupListeners`. Design said "build
   once". Functionally safe (stateless, shared secret) but minor
   design-coherence drift.

4. **Club admin client `isAdmin`**: Server-side `socket.data.isClubAdmin`
   IS restored on reconnect, but the client's `isAdmin` React state is
   not restored on reload. The UI may re-show the PIN screen.

---

## SDD Artifacts

All SDD artifacts for this change are stored in Engram:

| Artifact | Topic Key |
|---|---|
| Proposal | `sdd/jwt-session-persistence/proposal` |
| Spec | `sdd/jwt-session-persistence/spec` |
| Design | `sdd/jwt-session-persistence/design` |
| Tasks | `sdd/jwt-session-persistence/tasks` |
| Apply progress | `sdd/jwt-session-persistence/apply-progress` |
| Verify report | `sdd/jwt-session-persistence/verify-report` |

SDD cycle: propose → spec → design → tasks → apply → verify — all phases completed.