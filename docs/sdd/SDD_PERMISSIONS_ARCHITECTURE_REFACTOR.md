# SDD: Permissions Architecture Refactor

**Date**: 2026-04-17
**Status**: ✅ COMPLETED

---

## Problem

Authorization logic was scattered across multiple React hooks and components:
- `useScoreboardAuth()` mixed permissions with hook lifecycle
- `useDashboardAuth()` mixed permissions with hook lifecycle
- `useScoreboardUrl()` mixed business logic (PIN decryption) with React state/effects
- No centralized permission rules
- Hard to test in isolation

## Solution

Separate concerns following the pattern:
- **Services** (= pure business logic, no React dependencies)
- **Hooks** (= React-specific lifecycle)

### Architecture

```
src/
├── services/permissions/rules/   # Pure functions
│   ├── scoreboard.ts            # canEdit, canConfigure, canViewHistory
│   ├── dashboard.ts           # canCreateTable, showPinColumn
│   └── url.ts                 # parseEncryptedPin
│
└── hooks/                     # React hooks
    ├── usePermissions.ts      # Unified hook
    ├── useCan.ts            # Granular permission check
    ├── useScoreboardAuth.ts # Refactored (backward compat)
    ├── useDashboardAuth.ts # Refactored (backward compat)
    └── useScoreboardUrl.ts  # Refactored (backward compat)
```

---

## Files Created (9)

| File | Description |
|------|-------------|
| `services/permissions/rules/index.ts` | Barrel exports |
| `services/permissions/rules/scoreboard.ts` | Scoreboard permission rules |
| `services/permissions/rules/dashboard.ts` | Dashboard permission rules |
| `services/permissions/rules/url.ts` | URL parsing rules |
| `services/permissions/rules/scoreboard.test.ts` | 15 unit tests |
| `services/permissions/rules/dashboard.test.ts` | 12 unit tests |
| `services/permissions/rules/url.test.ts` | 7 unit tests |
| `hooks/usePermissions.ts` | Unified permissions hook |
| `hooks/useCan.ts` | Granular permission check hook |

## Files Modified (3)

| File | Change |
|------|--------|
| `hooks/useScoreboardAuth.ts` | Now imports from services |
| `hooks/useDashboardAuth.ts` | Now imports from services |
| `hooks/useScoreboardUrl.ts` | Split business logic from React |

---

## Tests

- **34 new unit tests** for permission rules (100% coverage)
- **356 total tests** passing
- No breaking changes to existing tests

---

## Key Decisions

1. **Option A vs Option B**: User chose Option A (services/ + hooks/ separate) instead of domain module
2. **Include useScoreboardUrl refactor**: Initially not planned, but it had the same problem (MEZCLA business + React)
3. **Backward compatibility**: Old hooks still work via re-exports

---

## Verification

- Build: ✅ Passed
- Tests: 356 passed
- Spec compliance: 100%
- Issues: None

---

## Pattern for Future SDDs

After archiving an SDD, create a markdown document in `docs/sdd/`:
- What problem was solved
- Solution approach
- Files created/modified
- Tests
- Key decisions

This serves as documentation for future developers.