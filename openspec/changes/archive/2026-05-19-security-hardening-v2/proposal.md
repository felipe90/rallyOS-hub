# Proposal: Security Hardening v2

## Intent

Fix 5 critical vulnerabilities and 4 technical debts from the 2026-04-21 audit. **Corrections vs v1**: table PIN stays 4 digits, owner PIN is exactly 8 digits (`/^\d{8}$/`), generation uses `crypto.randomInt(1000, 9999)`.

## Scope

### In Scope
1. **Env var unification**: `REFEREE_PIN` → `TOURNAMENT_OWNER_PIN`
2. **DELETE_TABLE auth**: only owner or active referee can delete; others get `UNAUTHORIZED`
3. **VERIFY_OWNER rate limit**: 5 attempts per 60s per IP
4. **Client PIN storage**: move ownerPin from `localStorage` to `sessionStorage`
5. **Table PIN generation**: `Math.random()` → `crypto.randomInt(1000, 9999)`
6. **Remove deprecated hooks**: delete `useAuth.ts` and `useDashboardAuth.ts`; migrate usages to `usePermissions`
7. **CONFIGURE_MATCH validation**: `format` in [1,9], `ptsPerSet` in [1,99]; reject with `VALIDATION_ERROR`
8. **resetTable()**: no auto `startMatch()`; leave table in `WAITING`; return `void`

### Out of Scope
JWT migration, disk persistence, per-room TABLE_UPDATE, PrivateRoute redesign.

## Capabilities

### New
- `verify-owner-rate-limit`
- `delete-table-authorization`

### Modified
- `env-config`, `table-pin-generation`, `client-auth-storage`, `configure-match-validation`, `reset-table-behavior`

### Removed
- `useAuth` → `useAuthContext`
- `useDashboardAuth` → `usePermissions`

## Approach

Surgical fixes, no architecture refactoring. No socket contract changes. Server first, client second. Atomic commits. TDD where applicable.

## Affected Areas

| Area | Impact |
|------|--------|
| `server/src/index.ts` | Env var naming |
| `server/src/socketHandler.ts` | Rate limit, auth, validation |
| `server/src/matchEngine.ts` | resetTable() void, no auto-start |
| `docker-compose.yml`, `.env` | Rename env var |
| `client/src/hooks/useAuth.ts` | Delete |
| `client/src/hooks/useDashboardAuth.ts` | Delete, migrate usages |
| `client/src/services/storage.ts` | sessionStorage |

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Additive/bugfix changes | Low-Med | Isolated commits |
| sessionStorage breaks localStorage sessions | Med | Intentional — re-auth |
| Hook removal misses usages | Low | Grep all imports first |
| resetTable() void return | Low | Compiler catches it |

## Rollback

Each fix is atomic. Revert the specific commit if needed.

## Dependencies

None.

## Success Criteria

- [ ] `REFEREE_PIN` does not exist anywhere
- [ ] Unauthorized DELETE_TABLE returns `UNAUTHORIZED`
- [ ] 6th VERIFY_OWNER within 60s returns `RATE_LIMITED`
- [ ] ownerPin in sessionStorage, not localStorage
- [ ] Table PINs are 4 digits from `crypto.randomInt`
- [ ] `useAuth.ts` and `useDashboardAuth.ts` deleted; build passes
- [ ] CONFIGURE_MATCH rejects out-of-range with `VALIDATION_ERROR`
- [ ] resetTable() returns void, table in `WAITING`
