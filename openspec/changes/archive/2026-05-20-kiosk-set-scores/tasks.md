# Tasks: kiosk-set-scores

**Review Workload**: Low (~20 lines changed, single file + test)  
**PR Strategy**: single-pr (size: exception applies — trivial change)

## Phase 1: Implementation (TDD)

- [x] 1.1 **RED** — Add test cases to `KioskTableCard.test.tsx` for set scores display: renders when `currentSets` present, hidden when absent, hidden when both zero, rendered in condensed mode
- [x] 1.2 **GREEN** — Add set scores rendering in `KioskTableCard.tsx` below point scores, following `TableStatusChip` pattern (lines 121-129), with condensed/normal sizing
- [x] 1.3 **VERIFY** — Run `cd client && npx vitest run src/components/organisms/KioskTableCard/` — all tests pass, set score tests pass
