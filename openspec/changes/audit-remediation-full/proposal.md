# Proposal: Audit Remediation Full

## Intent

Address all critical, high, and medium severity findings from the 2026-04-22 architecture audit that are NOT covered by `security-hardening-v2`. This change focuses on security hardening, scalability improvements, and code quality fixes to make rallyOS-hub production-ready beyond a trusted LAN.

## Scope

### In Scope

#### Critical Security Fixes
1. **Remove default owner PIN fallback** — docker-compose.yml must fail if `TOURNAMENT_OWNER_PIN` is not set
2. **Remove default table PIN fallback** — `useRefAuth.ts` must not default to `'12345'`
3. **Fix PIN submission timeout** — `usePinSubmission.ts` must resolve as FAILURE on timeout, not success
4. **Stop logging owner PIN in plaintext** — remove `ownerPin` from pino log context
5. **Replace XOR "encryption" with AES-256-GCM** — client must use server-encrypted PINs only
6. **Remove PINs from browser storage** — use short-lived session tokens instead of localStorage/sessionStorage

#### High Priority Security
7. **Add Socket.io authentication middleware** — token-based auth for sensitive operations
8. **Fix `matchEngine: any` type** — import and use proper `MatchEngine` type
9. **Re-enable `no-explicit-any` ESLint rule** — enable as `warn` for new code
10. **Define proper `SocketData` interface** — replace `(socket as any).data` with typed socket extensions
11. **Add rate limiting on CREATE_TABLE** — prevent memory exhaustion attacks
12. **Fix RateLimiter memory leak** — add periodic cleanup of old entries
13. **Add Socket.io connection limits** — `maxHttpBufferSize`, per-IP limits, global cap

#### High Priority Scalability
14. **Use rooms for table-specific broadcasts** — `io.to(tableId).emit()` instead of `io.emit()`
15. **Add pagination/limits on table list** — prevent large payloads on connect

#### Medium Priority Security
16. **Use `crypto.timingSafeEqual()` for PIN comparisons** — prevent timing attacks
17. **Require `ENCRYPTION_SECRET` in production** — fail startup if not set
18. **Add Content Security Policy headers** — via `helmet` middleware
19. **Sanitize player names** — strip HTML/script tags on input
20. **Generic error messages to clients** — log detailed errors server-side only

#### Medium Priority Architecture
21. **Decouple validation from Socket.io** — `validateSocketPayload` accepts callback instead of socket
22. **Add React Error Boundaries** — prevent full app crash on component errors
23. **Consolidate validation logic in `shared/`** — PIN validation rules shared between client/server

#### Low Priority Code Quality
24. **Re-enable `no-unused-vars` ESLint rule**
25. **Remove dead code** — `_emit` unused variables, `eventOrPin?: any` parameter
26. **Unify Node version** — CI and Docker both use Node 22
27. **Update deprecated GitHub action** — `actions/create-release@v1` → `softprops/action-gh-release@v1`
28. **Make `NODE_OPTIONS` configurable** — document hardware-specific constraint

### Out of Scope
- **Persistence layer** — requires separate architectural change (SQLite/event sourcing)
- **API versioning** — requires socket contract versioning strategy
- **TableManager refactoring** — requires architectural redesign
- **`shared/` as proper workspace** — requires monorepo tooling changes
- **JWT migration** — requires authentication system redesign

## Capabilities

### New
- `socket-authentication` — token-based auth for Socket.io operations
- `rate-limit-create-table` — rate limiting on table creation
- `connection-limits` — Socket.io connection throttling
- `room-based-broadcasts` — per-table event routing
- `timing-safe-pin-comparison` — constant-time PIN validation
- `error-boundaries` — React error boundary components
- `csp-headers` — Content Security Policy enforcement
- `input-sanitization` — player name sanitization

### Modified
- `pin-encryption` — XOR → AES-256-GCM
- `pin-storage` — browser storage → session tokens
- `rate-limiter` — add TTL-based cleanup
- `validation` — decouple from Socket.io, move to shared
- `eslint-config` — re-enable `no-explicit-any`, `no-unused-vars`
- `error-handling` — generic client messages, detailed server logs
- `node-version` — unify to Node 22

## Approach

Phased implementation with server-first priority:

1. **Phase 1: Critical Security** — Fix issues that could cause immediate production incidents
2. **Phase 2: Security Hardening** — Add missing security controls
3. **Phase 3: Scalability** — Fix broadcast patterns and connection limits
4. **Phase 4: Code Quality** — Enable lint rules, fix types, remove dead code

Each phase is independently mergeable. Server changes first, then client.

## Affected Areas

| Area | Impact |
|------|--------|
| `server/src/handlers/*.ts` | Auth, rate limiting, validation, PIN comparison |
| `server/src/services/security/RateLimiter.ts` | Memory leak fix |
| `server/src/socketHandler.ts` | Room-based broadcasts, connection limits |
| `server/src/index.ts` | PIN logging removal, ENCRYPTION_SECRET requirement |
| `server/src/utils/validation.ts` | Decouple from Socket.io |
| `server/src/utils/pinEncryption.ts` | Require secret in production |
| `client/src/shared/crypto/pinEncryption.ts` | Replace XOR with AES |
| `client/src/hooks/usePinSubmission.ts` | Fix timeout behavior |
| `client/src/pages/ScoreboardPage/useRefAuth.ts` | Remove default PIN |
| `client/src/contexts/AuthContext/` | Session token storage |
| `client/src/components/ErrorBoundary.tsx` | New component |
| `shared/validation.ts` | New shared validation |
| `docker-compose.yml` | Remove default PIN, configurable NODE_OPTIONS |
| `.github/workflows/*.yml` | Node version, deprecated action |
| `server/.eslintrc.json`, `client/eslint.config.js` | Re-enable rules |

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| XOR → AES breaks existing QR URLs | High | Version the encryption; support both during transition |
| Removing browser storage breaks active sessions | Medium | Intentional — sessions considered potentially compromised |
| `no-explicit-any` breaks existing code | Medium | Enable as `warn` first, fix incrementally |
| Room-based broadcasts miss some clients | Low | Only table-specific events use rooms; TABLE_LIST stays global |
| Rate limiting blocks legitimate table creation | Low | Generous limits (10 tables/min per IP) |

## Rollback

Each phase is independently revertible. Critical security fixes should NOT be rolled back.

## Dependencies

- Depends on: `security-hardening-v2` (must be merged first for env var consistency)
- No external dependencies

## Success Criteria

- [ ] No default PINs anywhere in codebase
- [ ] PIN submission timeout resolves as failure
- [ ] Owner PIN never appears in logs
- [ ] Client uses AES-256-GCM for PIN encryption
- [ ] No PINs in localStorage/sessionStorage
- [ ] Socket.io has auth middleware for sensitive operations
- [ ] `matchEngine` properly typed (no `any`)
- [ ] `no-explicit-any` ESLint rule enabled (at least `warn`)
- [ ] `SocketData` interface defined and used
- [ ] CREATE_TABLE has rate limiting
- [ ] RateLimiter cleans up old entries
- [ ] Socket.io has connection limits
- [ ] Table updates use rooms, not global broadcast
- [ ] Table list has pagination or max limit
- [ ] PIN comparison uses `crypto.timingSafeEqual()`
- [ ] `ENCRYPTION_SECRET` required in production
- [ ] CSP headers present in HTTP responses
- [ ] Player names sanitized on input
- [ ] Error messages to clients are generic
- [ ] `validateSocketPayload` decoupled from Socket.io
- [ ] React Error Boundary prevents full app crash
- [ ] PIN validation rules in `shared/`
- [ ] `no-unused-vars` ESLint rule enabled
- [ ] No `_emit` dead code
- [ ] Node version unified (22)
- [ ] GitHub action updated to maintained version
- [ ] `NODE_OPTIONS` configurable via env var
