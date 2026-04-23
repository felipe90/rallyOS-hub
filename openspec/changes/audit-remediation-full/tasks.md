# Tasks: Audit Remediation Full

> **Change:** `audit-remediation-full`
> **Depends on:** `security-hardening-v2` (must be merged first)
> **Mode:** TDD where applicable — Vitest for server, Vitest + RTL for client

---

## Phase 1: Critical Security Fixes
*Sequential — these fix production-risk issues.*

- [ ] **1.1** Remove default `TOURNAMENT_OWNER_PIN` fallback in `docker-compose.yml:18`. Server MUST fail if not set.
- [ ] **1.2** Add startup validation in `server/src/index.ts`: exit with code 1 if `TOURNAMENT_OWNER_PIN` is empty.
- [ ] **1.3** Remove default `'12345'` PIN in `client/src/pages/ScoreboardPage/useRefAuth.ts:19`. Show auth-required screen instead.
- [ ] **1.4 [RED]** Write test: PIN submission timeout resolves as `{ success: false, error: 'Timeout' }`. File: `client/src/hooks/usePinSubmission.test.ts`.
- [ ] **1.5 [GREEN]** Fix `usePinSubmission.ts:68`: resolve as failure on timeout. Also handle socket disconnect.
- [ ] **1.6** Remove `ownerPin` from pino log context in `server/src/index.ts:19,22`. Log existence only, not value.
- [ ] **1.7 [RED]** Write test: AES-256-GCM encrypt/decrypt roundtrip. File: `client/src/shared/crypto/pinEncryption.test.ts`.
- [ ] **1.8 [GREEN]** Replace XOR encryption in `client/src/shared/crypto/pinEncryption.ts` with Web Crypto API AES-256-GCM.
- [ ] **1.9 [RED]** Write test: Server AES encryption matches client decryption. File: `server/src/utils/pinEncryption.test.ts`.
- [ ] **1.10** Remove PINs from localStorage/sessionStorage in `client/src/contexts/AuthContext/AuthContext.tsx`. Use in-memory React state only.
- [ ] **1.11** Update `client/src/hooks/useSocket.ts` to use in-memory session token instead of localStorage.

---

## Phase 2: Security Hardening
*Server-first, then client. Can parallelize within phase.*

- [ ] **2.1 [RED]** Write test: Socket.io auth middleware rejects unauthenticated sensitive operations.
- [ ] **2.2 [GREEN]** Add Socket.io auth middleware in `server/src/socketHandler.ts`. Validate session token on connection.
- [ ] **2.3 [GREEN]** Add auth guards to sensitive events: `CREATE_TABLE`, `DELETE_TABLE`, `VERIFY_OWNER`.
- [ ] **2.4** Fix `matchEngine: any` type in `server/src/types.ts:90`. Import and use `MatchEngine` type.
- [ ] **2.5 [RED]** Write test: `crypto.timingSafeEqual()` for PIN comparison. File: `server/src/services/security/PinService.test.ts`.
- [ ] **2.6 [GREEN]** Update `PinService.ts:16` to use `crypto.timingSafeEqual()`. Handle different-length PINs.
- [ ] **2.7 [GREEN]** Update `AuthHandler.ts:45` owner PIN comparison to use `crypto.timingSafeEqual()`.
- [ ] **2.8** Define `SocketData` interface in `server/src/types.ts`. Replace all `(socket as any).data` casts.
- [ ] **2.9 [RED]** Write test: RateLimiter cleanup removes old entries. File: `server/src/services/security/RateLimiter.test.ts`.
- [ ] **2.10 [GREEN]** Add `startCleanup()` to RateLimiter. Run every 60s, prune entries older than 120s.
- [ ] **2.11 [RED]** Write test: CREATE_TABLE rate limit enforced. File: `server/src/handlers/TableEventHandler.test.ts`.
- [ ] **2.12 [GREEN]** Add rate limiting to CREATE_TABLE in `TableEventHandler.ts:30-51`. Limit: 10 tables/min per IP.
- [ ] **2.13 [GREEN]** Add `ENCRYPTION_SECRET` requirement in `server/src/utils/pinEncryption.ts`. Exit if not set in production.
- [ ] **2.14** Add `helmet` middleware in `server/src/app.ts`. Configure CSP for `'self'` scripts, inline styles, Socket.io.
- [ ] **2.15** Add player name sanitization in `server/src/handlers/MatchEventHandler.ts:51-97`. Strip HTML tags with regex.
- [ ] **2.16** Make error messages generic in `server/src/utils/validation.ts`. Log detailed errors server-side only.

---

## Phase 3: Scalability Improvements
*Can parallelize with Phase 2 (no contract changes block these).*

- [ ] **3.1 [RED]** Write test: TABLE_UPDATE only reaches clients in table room.
- [ ] **3.2 [GREEN]** Update `socketHandler.ts:49`: change `io.emit()` to `io.to(tableId).emit()` for TABLE_UPDATE.
- [ ] **3.3 [GREEN]** Add `socket.join(tableId)` on table authentication in `TableEventHandler.ts`.
- [ ] **3.4** Keep `io.emit()` for TABLE_LIST and TABLE_CREATED (global broadcasts).
- [ ] **3.5 [GREEN]** Add connection limits in `server/src/server.ts`: `maxHttpBufferSize: 1e6`, per-IP limit (10), global cap (500).
- [ ] **3.6** Add max table limit (50) in `TableEventHandler.ts`. Return `MAX_TABLES_REACHED` if exceeded.

---

## Phase 4: Code Quality
*Non-breaking changes. Can parallelize.*

- [ ] **4.1 [RED]** Write test: `validateSocketPayload` with callback returns `{ valid, errors }`. File: `server/src/utils/validation.test.ts`.
- [ ] **4.2 [GREEN]** Refactor `validateSocketPayload` in `server/src/utils/validation.ts:161-181`. Accept `emitError` callback instead of socket.
- [ ] **4.3** Create `shared/validation.ts` with PIN rules and player name rules. Import in both client and server.
- [ ] **4.4** Create `client/src/components/ErrorBoundary.tsx`. Class component with fallback UI.
- [ ] **4.5** Wrap routes in `ErrorBoundary` in `client/src/App.tsx`.
- [ ] **4.6** Enable `@typescript-eslint/no-explicit-any: 'warn'` in `server/.eslintrc.json` and `client/eslint.config.js`.
- [ ] **4.7** Enable `no-unused-vars` in both ESLint configs.
- [ ] **4.8** Remove `_emit` dead code in `OwnerDashboardPage.tsx:34` and `RefereeDashboardPage.tsx:30`.
- [ ] **4.9** Fix `handlePinSubmit` parameter type in `AuthPage.tsx:82`. Replace `any` with proper type.
- [ ] **4.10** Update CI workflow `.github/workflows/ci.yml`: Node 20 → Node 22. Add server test job.
- [ ] **4.11** Update Dockerfile: ensure Node 22-alpine (already set, verify consistency).
- [ ] **4.12** Update `.github/workflows/release.yml:38`: `actions/create-release@v1` → `softprops/action-gh-release@v1`.
- [ ] **4.13** Make `NODE_OPTIONS` configurable in `docker-compose.yml:22`. Use `NODE_OPTIONS_MEMORY` env var.

---

## Phase 5: Regression & Validation
*Sequential — verify nothing broke.*

- [ ] **5.1** Run server tests: `cd server && npm test`
- [ ] **5.2** Run client tests: `cd client && npm test`
- [ ] **5.3** Type-check server: `cd server && npx tsc --noEmit`
- [ ] **5.4** Type-check client: `cd client && npx tsc --noEmit`
- [ ] **5.5** Lint server: `cd server && npm run lint`
- [ ] **5.6** Lint client: `cd client && npm run lint`
- [ ] **5.7** Build client: `cd client && npm run build`
- [ ] **5.8** Build server: `cd server && npm run build`
- [ ] **5.9** Run E2E tests: `cd client && npm run test:e2e`
- [ ] **5.10** Manual: `docker-compose up` — verify server starts, no PIN in logs
- [ ] **5.11** Manual: Create table → verify QR URL has AES-encrypted PIN
- [ ] **5.12** Manual: Scan QR → verify client decrypts and authenticates
- [ ] **5.13** Manual: Verify CSP headers in browser DevTools
- [ ] **5.14** Manual: Verify TABLE_UPDATE only reaches table room (check Network tab)

---

## Summary

| Phase | Tasks | Focus | Parallel? |
|-------|-------|-------|-----------|
| 1 | 11 | Critical security fixes | Tests parallel; impl sequential |
| 2 | 16 | Security hardening | Tests parallel; impl sequential per file |
| 3 | 6 | Scalability improvements | Parallel with Phase 2 |
| 4 | 13 | Code quality | Parallel |
| 5 | 14 | Regression + validation | Sequential |
| **Total** | **60** | | |
