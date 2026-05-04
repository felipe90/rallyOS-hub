# Design: Security Hardening v3

## Technical Approach

Server-only changes, no socket contract or shared-type modifications. Implement in dependency order: shared utilities first → service layer → handlers → middleware → Dockerfile → final wiring.

## Architecture Decisions

### Decision: Timing-safe PIN — utility function in SocketHandlerBase

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Move `comparePin()` to `SocketHandlerBase` | All handlers inherit it; single source of truth | ✅ Chosen |
| Inject PinService into PlayerService | More DI wiring; follows existing pattern | ❌ Rejected — overkill for one method |
| Duplicate comparePin in each handler | DRY violation; maintenance burden | ❌ Rejected |

**Rationale**: `AuthHandler` already has a correct `comparePin()` using `crypto.timingSafeEqual`. Move it to `SocketHandlerBase` so `AdminHandler` and `TableEventHandler` inherit it. For `PlayerService`, pass `PinService` into constructor (the service already exists in `TableManager`).

### Decision: Input sanitization — move to shared utility

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract `sanitizeInput()` to `server/src/utils/validation.ts` | Single import; all modules can use it | ✅ Chosen |
| Keep in MatchEventHandler, copy to others | Code duplication; easy to miss new handlers | ❌ Rejected |

**Rationale**: `sanitizeInput()` is already a pure function in `MatchEventHandler.ts`. Extract to `validation.ts` and call it in `PlayerService.joinTable()` and `tableManager.createTable()`.

### Decision: Socket.IO connection rate limit — io.use() middleware

| Option | Tradeoff | Decision |
|--------|----------|----------|
| io.use() middleware + existing RateLimiter | Zero new deps; consistent with event rate limits | ✅ Chosen |
| express-rate-limit npm package | New dependency; only needed for socket | ❌ Rejected |
| Simple counter in SocketHandler | Works but less reusable | ❌ Rejected |

**Rationale**: Same `RateLimiter` class used by event handlers. New instance in `SocketHandler`, called from `io.use()` middleware before connection is established.

### Decision: `/api/owner-pin` rate limiting — express middleware

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Reuse RateLimiter via express middleware | No new deps; rate limiter already works | ✅ Chosen |
| express-rate-limit package | More standard for HTTP | ❌ Rejected — inconsistency with other rate limits |

**Rationale**: Create a thin express middleware that wraps `RateLimiter.isRateLimited()` using client IP as key.

### Decision: Host header validation — express middleware

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Simple middleware checking `req.hostname` against allowedOrigins | Reuses existing config; zero new code | ✅ Chosen |
| Separate HUB_ALLOWED_HOSTS env var | More flexible but more config | ❌ Rejected — allowed origins already define valid hosts |

**Rationale**: The `allowedOrigins` whitelist already defines valid hosts. Extract hostname from each origin and compare against `req.hostname`.

### Decision: IP masking — utility in logger.ts

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `maskIp()` utility in logger.ts; apply in SocketHandlerBase | Single call site; easy to find | ✅ Chosen |
| Pino `redact` path with custom censor | More complex; risks breaking structured logs | ❌ Rejected |

## Data Flow

```
SocketHandler.io.use() middleware:
    Client connects → check RateLimiter(ip) → reject or accept

Express middleware chain:
    Request → hostHeaderCheck() → rateLimitOwnerPin() → helmet() → route handler
    
Pin comparison flow (all paths):
    Handler receives PIN → comparePin(input, stored) [timingSafeEqual] → result
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/utils/validation.ts` | Modify | Add exported `sanitizeInput()` function |
| `server/src/utils/logger.ts` | Modify | Add `maskIp()` utility |
| `server/src/services/security/PinService.ts` | Modify | Make `validatePin()` accessible; consider static |
| `server/src/services/table/PlayerService.ts` | Modify | Accept `PinService` in constructor; sanitize names on joinTable() |
| `server/src/domain/tableManager.ts` | Modify | Pass `pinService` to `PlayerService`; sanitize table names in createTable() |
| `server/src/handlers/SocketHandlerBase.ts` | Modify | Add `comparePin()` from AuthHandler; use `maskIp()` in logRateLimitBlocked() |
| `server/src/handlers/SocketHandler.ts` | Modify | Add `io.use()` connection rate limiting middleware |
| `server/src/handlers/AuthHandler.ts` | Modify | Remove `comparePin()` (moved to SocketHandlerBase) |
| `server/src/handlers/AdminHandler.ts` | Modify | Use inherited `comparePin()` instead of `===` |
| `server/src/handlers/TableEventHandler.ts` | Modify | Use inherited `comparePin()` instead of `===` |
| `server/src/handlers/MatchEventHandler.ts` | Modify | Import `sanitizeInput` from validation.ts (remove local) |
| `server/src/app.ts` | Modify | Add host header middleware, CSP report-uri, HSTS |
| `Dockerfile` | Modify | Add `USER node` before CMD; fix log dir permissions |

## Interfaces / Contracts

No socket event or shared type changes. All changes are internal.

```typescript
// SocketHandlerBase — new method (moved from AuthHandler)
protected comparePin(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// server/src/utils/validation.ts — new export
export function sanitizeInput(value: string, maxLength: number = 100): string;

// server/src/utils/logger.ts — new export
export function maskIp(ip: string): string;

// PlayerService — new constructor parameter
constructor(private pinService: PinService) {}
```

## Testing Strategy

| Layer | What to test | Approach |
|-------|-------------|----------|
| Unit | `comparePin()` with equal/different/length-mismatched PINs | Jest |
| Unit | `sanitizeInput()` strips HTML, respects maxLength | Jest |
| Unit | `maskIp()` masks last octet correctly | Jest |
| Integration | 21st socket connection from same IP rejected | Socket.IO test client |
| Integration | `/api/owner-pin` returns 429 after 10 requests | supertest/fetch |
| Manual | `docker compose up` → `whoami` inside container returns `node` | Docker exec |

## Migration / Rollout

No migration required. Container rebuild needed for `USER node` change. All other changes are hot-reloadable.

## Open Questions

None.
