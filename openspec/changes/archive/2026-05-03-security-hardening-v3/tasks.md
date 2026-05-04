# Tasks: Security Hardening v3

## Phase 1: Shared Utilities

- [x] **1.1** Extract `sanitizeInput()` from `MatchEventHandler.ts` to `server/src/utils/validation.ts` as exported function
- [x] **1.2** Add `maskIp(ip: string): string` to `server/src/utils/logger.ts` (mask last octet, handle IPv4/IPv6)
- [x] **1.3** Add `getEntriesForIp()` method to `RateLimiter.ts` (already existed — used by AdminHandler)

## Phase 2: Service Layer — Timing-Safe + Sanitization

- [x] **2.1** Make `PinService.validatePin()` accesible from `PlayerService` (injected via constructor)
- [x] **2.2** Update `PlayerService` — accept `PinService` via constructor; replace `table.pin !== pin` with `pinService.validatePin()` in `joinTable()` and `setReferee()`
- [x] **2.3** Update `PlayerService.joinTable()` — sanitize player name via `sanitizeInput()` before storing
- [x] **2.4** Update `TableManager` — pass `pinService` to `PlayerService` constructor; sanitize table name in `createTable()`

## Phase 3: Handlers + Middleware

- [x] **3.1** Move `comparePin()` from `AuthHandler.ts` to `SocketHandlerBase.ts`; update `AuthHandler` to use inherited version
- [x] **3.2** Update `AdminHandler.ts` — replace `data.pin === this.ownerPin` with `this.comparePin()` (REGENERATE_PIN)
- [x] **3.3** Update `TableEventHandler.ts` — replace `data?.ownerPin === this.ownerPin` with `this.comparePin()` (GET_TABLES_WITH_PINS); fix `SocketHandlerBase.isOwner()` same pattern
- [x] **3.4** Update `MatchEventHandler.ts` — remove local `sanitizeInput()`, import from `validation.ts`
- [x] **3.5** Update `SocketHandlerBase.logRateLimitBlocked()` — use `maskIp()` on client IP
- [x] **3.6** Add connection rate limiting middleware in `SocketHandler.ts` — `io.use()` uses RateLimiter (max 20/IP/60s)
- [x] **3.7** Add host header validation middleware in `app.ts` — extract hosts from `allowedOrigins`, reject mismatches with 400
- [x] **3.8** Add `reportUri` to helmet CSP config and enable HSTS in `app.ts`

## Phase 4: Infrastructure

- [x] **4.1** Update `Dockerfile` — add `RUN chown -R node:node /app/logs` then `USER node` before CMD
- [x] **4.2** Update `server/docs/rules/ARCHITECTURE.md` (already done in propose phase)

## Phase 5: Tests + Verification

- [x] **5.1** Unit test: `comparePin()` with equal, different, length-mismatched inputs (via PinService tests)
- [x] **5.2** Unit test: `sanitizeInput()` strips HTML, respects maxLength (in validation.spec.ts)
- [x] **5.3** Unit test: `maskIp()` masks IPv4 (`192.168.1.100` → `192.168.1.x`) (in logger.spec.ts)
- [ ] **5.4** Integration: 21st socket connection from same IP in 60s rejected with `connect_error`
- [ ] **5.5** Integration: `/api/owner-pin` returns 429 after 10 requests from same IP
- [ ] **5.6** Manual: `docker compose up` → `whoami` inside container returns `node`

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 — Utilities | 3 | Extract sanitizeInput, add maskIp, add getEntriesForIp |
| 2 — Services | 4 | Timing-safe PIN in PlayerService, sanitization in joinTable/createTable |
| 3 — Handlers | 8 | comparePin migration, rate limit middleware, host header, CSP/HSTS |
| 4 — Infra | 2 | Docker USER node, docs |
| 5 — Tests | 6 | Unit + integration + manual |
| **Total** | **23** | |
