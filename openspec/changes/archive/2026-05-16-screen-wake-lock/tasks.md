# Tasks: Screen Wake Lock

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | 100–150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

## Phase 1: Tests — RED (TDD)

- [x] 1.1 Create `client/src/hooks/useWakeLock.test.ts` — mock `navigator.wakeLock.request` returning a sentinel, verify `isActive: true` on mount via `renderHook`
- [x] 1.2 Add test: sentinel `.release()` called on `unmount()`
- [x] 1.3 Add test: re-acquire on `visibilitychange` (document.hidden → visible) verifies new `request()` call
- [x] 1.4 Add test: graceful no-op when `navigator.wakeLock` is undefined — `isSupported: false`, no thrown errors
- [x] 1.5 Add test: `request()` rejection sets `isActive: false` without throwing

## Phase 2: Implementation — GREEN

- [x] 2.1 Create `client/src/hooks/useWakeLock.ts` — `useWakeLock()` hook with `navigator.wakeLock.request('screen')`, `visibilitychange` re-acquisition via ref'd sentinel, cleanup on unmount, silent try/catch degradation
- [x] 2.2 Export `useWakeLock` from `client/src/hooks/index.ts`
- [x] 2.3 Integrate `useWakeLock()` at top of `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` — one call, both referee and viewer paths covered

## Phase 3: Verification

- [x] 3.1 Run `npm test` in client — all 5 tests pass
- [x] 3.2 Run `npm run build` — no type errors, ScoreboardPage compiles with new import
- [x] 3.3 Mark all tasks complete in this file
