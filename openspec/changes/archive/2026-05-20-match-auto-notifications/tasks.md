# Tasks: Auto Kiosk Notifications on Match Lifecycle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100 (2 handlers ~20, 1 test file ~80) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (size:exception pre-granted) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Tests + implementation + verify | PR 1 | Single PR; all ~100 lines; size:exception granted |

## Phase 1: RED — Write Failing Tests

- [x] 1.1 Create `server/tests/matchAutoNotifications.spec.ts` with mocks (`createMockIo`, `createMockTableManager`, `createMockSocket`)
- [x] 1.2 Test: START_MATCH handler emits `KIOSK_NOTIFICATION` with type `info`, duration 10s, message `"Match started: {A} vs {B}"`
- [x] 1.3 Test: MATCH_WON via `onMatchEvent` callback emits `KIOSK_NOTIFICATION` with type `important`, duration 10s, message `"Winner: {name}!"`
- [x] 1.4 Test: Fallback names `"Player A"` / `"Player B"` when `playerNames` undefined (both START_MATCH and MATCH_WON)
- [x] 1.5 Test: Existing `MATCH_UPDATE` / `MATCH_WON` emission counts unchanged (no regressions)

## Phase 2: GREEN — Inject Notifications

- [x] 2.1 `MatchEventHandler.ts` — After `startMatch()` and `MATCH_UPDATE` emission (~line 152), inside the `if (state)` block, emit `KIOSK_NOTIFICATION` with `state.playerNames` and `type: 'info'`
- [x] 2.2 `SocketHandler.ts` — Inside `onMatchEvent` `MATCH_WON` block, after existing `MATCH_WON` emission (~line 64), resolve winner name via `getMatchState()` and emit `KIOSK_NOTIFICATION` with `type: 'important'`

## Phase 3: VERIFY

- [x] 3.1 Run `cd server && npm test` — all tests pass, new + existing
- [x] 3.2 Confirm MATCH_UPDATE, MATCH_WON, SET_WON emission counts from Phase 1 tests are preserved
- [x] 3.3 Verify no client changes were made (`client/` untouched)
