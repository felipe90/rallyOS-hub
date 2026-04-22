# Proposal: Refactor Client Architecture

## Intent

The client codebase mixes business logic with presentation across hooks, components, and pages. This violates the architecture rules documented in `client/docs/rules/`. This refactor extracts business logic into pure `services/`, splits God Object hooks, and makes components presentation-only.

## Scope

### In Scope
- Extract `services/match/` (sets, winner detection, formatting, side swap)
- Extract `services/dashboard/` (stats calculation)
- Extract `services/validation/` (PIN, auth, match config)
- Extract `services/url/` (URL building for scoreboard/QR)
- Extract `services/errors/` (centralized error messages)
- Refactor `useSocket.ts` (256 lines) into focused hooks
- Extract `usePinSubmission.ts` (DRY: duplicated in Owner/Referee dashboards)
- Refactor `AuthContext` (remove direct localStorage access)
- Fix `QRCodeImage.tsx` (move encryption out of component)
- Fix `MatchHistoryTicker.tsx` and `HistoryDrawer.tsx` (move formatting to services)
- Remove deprecated `useScoreboardAuth`, replace with `useCan`

### Out of Scope
- Server-side changes
- New features or UI redesign
- E2E test changes (existing must pass)
- State management library migration (Context stays)

## Capabilities

### New Capabilities
None — pure refactor, no behavioral changes.

### Modified Capabilities
None — no spec-level requirement changes.

## Approach

Phase 1: **Services** — Create pure functions with tests (no React).
Phase 2: **Hooks** — Split `useSocket.ts`, extract `usePinSubmission`, create thin wrappers.
Phase 3: **Contexts** — Move localStorage access to `services/storage/authStorage.ts`.
Phase 4: **Components** — Replace inline logic with service calls via hooks.
Phase 5: **Cleanup** — Delete deprecated code, verify all tests pass.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/services/` | New | `match/`, `dashboard/`, `validation/`, `url/`, `errors/`, `storage/` |
| `client/src/hooks/` | Modified | Split `useSocket.ts`, add `usePinSubmission.ts`, update imports |
| `client/src/contexts/` | Modified | `AuthContext.tsx` uses storage service |
| `client/src/components/` | Modified | `QRCodeImage`, `MatchHistoryTicker`, `HistoryDrawer`, `DashboardGrid` |
| `client/src/pages/` | Modified | Remove inline stats/calculations, use new hooks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Socket behavior regression | Medium | Keep existing event names, add integration tests before refactor |
| Auth flow breakage | Medium | Test login/logout manually after AuthContext change |
| Test failures | Low | Run full test suite after each phase |

## Rollback Plan

Each phase is a separate commit. If anything breaks:
1. Revert the last commit (`git revert HEAD`)
2. Run tests to confirm stable state
3. Fix issue in isolation, re-commit

## Dependencies

- Existing tests must pass before starting (✅ confirmed)
- Architecture rules docs (`client/docs/rules/`) are the reference

## Success Criteria

- [ ] All existing tests pass (29 server + ~35 client tests)
- [ ] New services have `.test.ts` files (90%+ coverage)
- [ ] `useSocket.ts` split into 3+ hooks, each <80 lines
- [ ] No business logic in components (calculations, validations, URL building)
- [ ] No `localStorage`/`sessionStorage` in contexts (only in services)
- [ ] `useScoreboardAuth` removed, replaced by `useCan`
- [ ] `OwnerDashboardPage` and `RefereeDashboardPage` share `usePinSubmission`
- [ ] Build compiles without errors (`npm run build`)
