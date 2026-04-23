# Design: Audit Remediation Full

## Technical Approach

Phased implementation: Critical Security → Security Hardening → Scalability → Code Quality. Server-first, then client. Each phase independently mergeable.

---

## Architecture Decisions

### Decision 1: PIN Encryption — AES-256-GCM in Browser

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Web Crypto API (AES-GCM) | Native browser support; no dependencies; matches server | ✅ Chosen |
| crypto-js library | Adds ~120KB bundle; easier API | ❌ Rejected — bundle size |
| Keep XOR | Simple but insecure | ❌ Rejected — security risk |

**Implementation**: Use `window.crypto.subtle` for AES-256-GCM encryption/decryption. The key is derived from `ENCRYPTION_SECRET` (shared between server and client via QR URL parameter or pre-shared config).

**Key derivation**: The QR URL will include the encrypted PIN directly. The client receives the `ENCRYPTION_SECRET` via a separate secure channel (owner dashboard) or derives it from a shared passphrase.

**Migration**: During transition, support both XOR and AES. Detect encryption type by prefix (`aes:` vs legacy format). After 2 weeks, remove XOR support.

### Decision 2: Session Token Storage

| Option | Tradeoff | Decision |
|--------|----------|----------|
| httpOnly cookies | Best security; requires HTTP endpoint | ❌ Rejected — over-engineering for LAN |
| sessionStorage | Survives F5, dies with tab; XSS window | ❌ Rejected — still stores sensitive data |
| In-memory React state | Lost on refresh; best security | ✅ Chosen for PINs |
| Short-lived JWT in memory | Survives reconnect; expires quickly | ✅ Chosen for session tokens |

**Implementation**: Generate a short-lived session token (JWT with 24h expiry) on successful PIN verification. Store in React context (in-memory). On socket reconnect, send the token for re-authentication. No browser storage for any authentication data.

### Decision 3: Socket.io Authentication

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Middleware on every event | Comprehensive; adds latency | ❌ Rejected — too much overhead |
| Auth on connection only | Simple; doesn't handle token expiry | ❌ Rejected — insufficient |
| Auth on sensitive events only | Targeted; minimal overhead | ✅ Chosen |
| Socket.io auth middleware (built-in) | Official pattern; clean separation | ✅ Chosen — use Socket.io 4.x auth middleware |

**Implementation**: Use Socket.io's built-in `auth` middleware. Clients send `{ sessionToken }` in the handshake. Server validates and attaches user data to `socket.data`. Sensitive events check `socket.data.isAuthenticated` before processing.

### Decision 4: RateLimiter Cleanup

| Option | Tradeoff | Decision |
|--------|----------|----------|
| setInterval cleanup every 60s | Simple; small overhead | ✅ Chosen |
| Lazy cleanup on access | No background task; inconsistent | ❌ Rejected |
| TTL-based Map (node-cache) | External dependency | ❌ Rejected |

**Implementation**: Add `startCleanup()` method called on server startup. Runs every 60s, prunes entries older than 2x the max window (120s).

### Decision 5: Room-Based Broadcasts

| Option | Tradeoff | Decision |
|--------|----------|----------|
| io.to(tableId).emit() | Native Socket.io; efficient | ✅ Chosen |
| Manual client filtering | More code; same result | ❌ Rejected |
| Separate Socket.io namespace | Complex; over-engineering | ❌ Rejected |

**Implementation**: On table authentication, socket joins `table-{tableId}` room. `TABLE_UPDATE` uses `io.to(tableId).emit()`. `TABLE_LIST` and `TABLE_CREATED` stay as `io.emit()`.

### Decision 6: Table List Pagination

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Cursor-based pagination | Complex; unnecessary for this scale | ❌ Rejected |
| Offset-based pagination | Simple; familiar pattern | ✅ Chosen |
| Max limit only | Simplest; no pagination needed | ✅ Chosen — max 50 tables, no pagination UI needed |

**Implementation**: Cap at 50 tables. Return all tables if under 50. If over 50, return first 50 with `{ hasMore: true }`. Add `MAX_TABLES` env var (default 50).

### Decision 7: Timing-Safe PIN Comparison

| Option | Tradeoff | Decision |
|--------|----------|----------|
| crypto.timingSafeEqual() | Node.js built-in; constant-time | ✅ Chosen |
| Custom constant-time comparison | Reinventing the wheel | ❌ Rejected |

**Implementation**: Convert PINs to Buffers, then use `crypto.timingSafeEqual()`. Handle different lengths by padding to same length before comparison.

### Decision 8: CSP Headers

| Option | Tradeoff | Decision |
|--------|----------|----------|
| helmet middleware | Comprehensive; well-maintained | ✅ Chosen |
| Manual headers | More control; more code | ❌ Rejected |

**Implementation**: Add `helmet` to Express middleware stack. Configure CSP to allow `'self'` scripts, inline styles (for Tailwind), and Socket.io connection.

### Decision 9: Player Name Sanitization

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Strip HTML tags (DOMPurify) | Comprehensive; adds dependency | ❌ Rejected — server-side |
| Regex strip `<[^>]*>` | Simple; no dependency | ✅ Chosen |
| Reject names with HTML | Strict; may reject valid names | ❌ Rejected |

**Implementation**: Server-side regex `/\<[^>]*\>/g` to strip HTML tags. Client-side React already escapes output, but server-side sanitization prevents log injection.

### Decision 10: Error Boundaries

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Class component ErrorBoundary | React official pattern | ✅ Chosen |
| react-error-boundary library | Simpler API; adds dependency | ❌ Rejected — class component is sufficient |

**Implementation**: Create `ErrorBoundary` class component. Wrap each route in `App.tsx`. Display fallback UI with "Reload" button.

---

## Data Flow

### Socket.io Authentication Flow

```
Client connects with { sessionToken }
        │
        ▼
Socket.io auth middleware
    ├── if no token → allow connection (unauthenticated)
    ├── if token → validate JWT
    │       ├── valid → socket.data = { isAuthenticated: true, roles: [...] }
    │       └── invalid → disconnect with reason
    │
        ▼
Sensitive event (CREATE_TABLE, DELETE_TABLE, VERIFY_OWNER)
    ├── check socket.data.isAuthenticated
    │       ├── true → process
    │       └── false → emit UNAUTHORIZED
```

### Room-Based Broadcast Flow

```
Referee authenticates with table-1
        │
        ▼
socket.join('table-1')
        │
        ▼
Point scored → TABLE_UPDATE
        │
        ▼
io.to('table-1').emit(TABLE_UPDATE, data)
        │
        ├── Clients in table-1 room → receive update
        └── Clients in other rooms → do NOT receive
```

### PIN Encryption Flow (AES-256-GCM)

```
Server creates table with PIN "1234"
        │
        ▼
encryptPin("1234", ENCRYPTION_SECRET)
        │
        ▼
AES-256-GCM encrypted → "aes:iv:tag:ciphertext"
        │
        ▼
QR URL: https://192.168.4.1:3000/scoreboard?pin=aes:iv:tag:ciphertext
        │
        ▼
Client parses URL → decryptPin("aes:iv:tag:ciphertext", ENCRYPTION_SECRET)
        │
        ▼
Original PIN "1234" → authenticate
```

---

## File Changes

### Server

| File | Action | Change |
|------|--------|--------|
| `server/src/index.ts` | Modify | Remove PIN logging; require ENCRYPTION_SECRET in prod |
| `server/src/app.ts` | Modify | Add helmet middleware |
| `server/src/server.ts` | Modify | Add connection limits, maxHttpBufferSize |
| `server/src/socketHandler.ts` | Modify | Room-based broadcasts, auth middleware |
| `server/src/handlers/AuthHandler.ts` | Modify | timingSafeEqual for PIN, session tokens |
| `server/src/handlers/TableEventHandler.ts` | Modify | Rate limit CREATE_TABLE, room joins |
| `server/src/handlers/MatchEventHandler.ts` | Modify | Player name sanitization |
| `server/src/services/security/RateLimiter.ts` | Modify | Add cleanup interval |
| `server/src/services/security/PinService.ts` | Modify | timingSafeEqual comparison |
| `server/src/utils/validation.ts` | Modify | Decouple from Socket.io, generic errors |
| `server/src/utils/pinEncryption.ts` | Modify | Require secret in production |
| `server/src/types.ts` | Modify | MatchEngine type, SocketData interface |
| `server/.eslintrc.json` | Modify | Enable no-explicit-any (warn), no-unused-vars |
| `server/package.json` | Modify | Add helmet dependency |

### Client

| File | Action | Change |
|------|--------|--------|
| `client/src/shared/crypto/pinEncryption.ts` | Replace | XOR → AES-256-GCM |
| `client/src/hooks/usePinSubmission.ts` | Modify | Fix timeout → failure |
| `client/src/pages/ScoreboardPage/useRefAuth.ts` | Modify | Remove default PIN |
| `client/src/contexts/AuthContext/AuthContext.tsx` | Modify | Session tokens, no storage |
| `client/src/components/ErrorBoundary.tsx` | Create | Error boundary component |
| `client/src/App.tsx` | Modify | Wrap routes in ErrorBoundary |
| `client/src/hooks/useSocket.ts` | Modify | Session token on reconnect |
| `shared/validation.ts` | Create | Shared PIN validation rules |
| `client/eslint.config.js` | Modify | Enable no-explicit-any (warn), no-unused-vars |

### Infrastructure

| File | Action | Change |
|------|--------|--------|
| `docker-compose.yml` | Modify | Remove default PIN, configurable NODE_OPTIONS |
| `.github/workflows/ci.yml` | Modify | Node 22, server tests |
| `.github/workflows/release.yml` | Modify | Update deprecated action |

---

## Interfaces / Contracts

### SocketData Interface

```typescript
interface SocketData {
  isOwner?: boolean;
  isAuthenticated?: boolean;
  sessionToken?: string;
  tableId?: string;
  roles?: string[];
}
```

### Session Token Payload

```typescript
interface SessionToken {
  sub: string;        // socket ID
  roles: string[];    // ['owner', 'referee']
  tableId?: string;   // for referee sessions
  iat: number;        // issued at
  exp: number;        // expires at (24h)
}
```

### Shared Validation Rules

```typescript
// shared/validation.ts
export const PIN_RULES = {
  ownerPin: { pattern: /^\d{8}$/, minLength: 8, maxLength: 8 },
  tablePin: { pattern: /^\d{4}$/, minLength: 4, maxLength: 4 },
};

export const PLAYER_NAME_RULES = {
  maxLength: 50,
  disallowHtml: true,
};
```

### Validation Result

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

## Testing Strategy

| Layer | What to test | Approach |
|-------|-------------|----------|
| Unit | `timingSafeEqual` comparison; RateLimiter cleanup; AES encryption/decryption | Vitest (server), Vitest (client) |
| Unit | `validateSocketPayload` with callback; player name sanitization | Vitest (server) |
| Integration | Socket.io auth middleware; room-based broadcasts; rate limiting | Socket.io test client |
| E2E | Full auth flow with session tokens; error boundary recovery | Playwright |
| Manual | CSP headers in browser DevTools; timing attack measurement | DevTools + manual QA |

---

## Migration / Rollout

### Phase 1: Critical Security (Week 1)
- Requirements 1-5: Default PINs, timeout, logging, AES encryption, browser storage
- **Breaking change**: Existing QR URLs with XOR-encrypted PINs will stop working. Document migration path.

### Phase 2: Security Hardening (Week 2)
- Requirements 6-9, 15-19: Socket auth, types, timing-safe, CSP, sanitization
- **Breaking change**: Unauthenticated sockets lose access to sensitive operations.

### Phase 3: Scalability (Week 3)
- Requirements 10-14: Rate limiting, connection limits, rooms, pagination
- **Breaking change**: Clients expecting global TABLE_UPDATE will miss table-specific updates.

### Phase 4: Code Quality (Week 4)
- Requirements 20-27: Validation decoupling, error boundaries, ESLint, Node version
- **Non-breaking**: Internal improvements only.

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | How to distribute ENCRYPTION_SECRET to clients for AES decryption? | TODO — consider including in QR URL as encrypted payload |
| 2 | Should session tokens be JWT or opaque tokens? | TODO — JWT preferred for stateless validation |
| 3 | What's the acceptable rate limit for CREATE_TABLE? | Proposed: 10 tables/min per IP |
| 4 | Should we support both XOR and AES during transition? | Proposed: Yes, with 2-week deprecation window |
