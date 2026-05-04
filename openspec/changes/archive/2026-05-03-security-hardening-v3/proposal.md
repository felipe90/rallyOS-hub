# Proposal: Security Hardening v3

## Intent

Complete the unfinished timing-safe PIN migration (Req 15 from audit-remediation-full), fix container security, apply consistent input sanitization, add Socket.IO connection rate limiting, protect the `/api/owner-pin` endpoint, and address remaining medium-severity hardening gaps across the stack.

## Scope

### In Scope
1. **Timing-safe PIN everywhere** — `PinService.validatePin()` exists but is never called. Replace all `===`/`!==` PIN comparisons with `crypto.timingSafeEqual()` across `PlayerService`, `AdminHandler`, `TableEventHandler`, `SocketHandlerBase.isOwner()`.
2. **Container non-root** — Add `USER node` directive in Dockerfile.
3. **Consistent input sanitization** — Move sanitization into `PlayerService` so JOIN_TABLE, CREATE_TABLE, and all name inputs are covered, not just MatchEventHandler.
4. **Socket.IO connection rate limit** — Reject new connections from IPs exceeding threshold.
5. **`/api/owner-pin` hardening** — Add rate limiting and IP-based restriction.
6. **Host header validation** — Reject requests with unexpected Host values.
7. **CSP report-uri + HSTS** — Add `report-uri` to CSP, enable HSTS via helmet.
8. **IP logging mask** — Truncate last octet of IPs in logs.

### Out of Scope
- JWT migration (deferred to future change)
- Disk persistence / SQLite
- Full auth middleware redesign
- Client-side rework (sessionStorage already done in v2)

## Capabilities

### New
- `timing-safe-pin-comparison-complete` — all PIN comparisons use constant-time
- `container-non-root` — Dockerfile USER directive
- `input-sanitization-consistent` — all user name inputs sanitized
- `socket-connection-rate-limit` — per-IP connection throttling
- `owner-pin-endpoint-protection` — rate limited /api/owner-pin
- `host-header-validation` — reject invalid Host headers
- `security-headers-extended` — CSP report-uri + HSTS

### Modified
- `pin-validation` (from audit-remediation-full) — complete the partial implementation

## Approach

Server-only changes, no socket contract modifications, no shared type changes. Each fix is an atomic commit. Implement in dependency order: infrastructure first, then service layer, then handlers, then final wiring.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/security/PinService.ts` | Modify | Already has `validatePin()` — export for use |
| `server/src/services/table/PlayerService.ts` | Modify | Use `PinService.validatePin()` instead of `!==` |
| `server/src/handlers/AdminHandler.ts` | Modify | Use `crypto.timingSafeEqual` for owner PIN |
| `server/src/handlers/TableEventHandler.ts` | Modify | Use `crypto.timingSafeEqual` for owner PIN |
| `server/src/handlers/SocketHandlerBase.ts` | Modify | Fix `isOwner()` to use timing-safe comparison |
| `server/src/handlers/MatchEventHandler.ts` | No change | Already uses `sanitizeInput()` correctly |
| `server/src/handlers/SocketHandler.ts` | Modify | Add connection rate limiting middleware |
| `server/src/app.ts` | Modify | Add host header validation, CSP report-uri, HSTS |
| `server/src/services/table/PlayerService.ts` | Modify | Move sanitizeInput() here |
| `server/src/utils/logger.ts` | Modify | Add IP masking utility |
| `server/src/utils/validation.ts` | Modify | Add `sanitizeInput()` as shared utility |
| `Dockerfile` | Modify | Add `USER node` directive |
| `docker-compose.yml` | No change | Already correct from v2 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PinService refactor misses a comparison site | Low | Grep all `=== this.ownerPin`, `.pin !==`, `!== pin` patterns |
| Connection rate limit blocks legitimate users | Low | Set generous limit (20 connections/IP), log warnings only first |
| Host header validation breaks proxy setups | Low | Configurable via env var (whitelist) |
| `USER node` breaks file write permissions | Med | Ensure logs dir has correct ownership before USER directive |

## Rollback

Each fix is atomic. Revert the specific commit. No schema or contract changes — rollback is zero-risk for clients.

## Dependencies

- None. Independent from all previous changes.

## Success Criteria

- [ ] Every `===`/`!==` PIN comparison replaced with `crypto.timingSafeEqual`
- [ ] Container process runs as `node` user, not root
- [ ] `JOIN_TABLE` and `CREATE_TABLE` inputs sanitized for XSS
- [ ] 21st Socket.IO connection from same IP in <60s is rejected
- [ ] `/api/owner-pin` rate limited (10 req/min/IP)
- [ ] Invalid Host header returns 400
- [ ] CSP response includes `report-uri`
- [ ] HSTS header present in HTTPS responses
- [ ] IPs in logs have last octet masked (e.g. `192.168.1.x`)
