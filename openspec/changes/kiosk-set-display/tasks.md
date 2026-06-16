# Tasks: Kiosk Set Display Redesign

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 350–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: KioskPointDisplay component + unit tests; PR 2: KioskScoreboard wiring + regression tests |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Add `KioskPointDisplay` component with TT/padel layouts and unit tests | PR 1 | Self-contained; mocks `useSportAdapter` and `framer-motion` |
| 2 | Refactor `KioskScoreboard` to wire `KioskPointDisplay` and remove old bars/selectors | PR 2 | Base on PR 1; verify finished-match/grid behavior preserved |

## Phase 1: Infrastructure

| ID | Title | Description | Dependencies | Effort | Acceptance Criteria |
|---|---|---|---|---|---|
| [x] 1.1 | Create component directory | Add `client/src/components/molecules/KioskPointDisplay/` | None | 5m | Directory exists |
| [x] 1.2 | Stub component file | Create `KioskPointDisplay.tsx` exporting `KioskPointDisplayProps` and empty component | 1.1 | 10m | File compiles |
| [x] 1.3 | Stub test file | Create `KioskPointDisplay.test.tsx` with Vitest harness and mocks for `framer-motion` and `useSportAdapter` | 1.1 | 15m | Test file runs and mocks resolve |

## Phase 2: Implementation

| ID | Title | Description | Dependencies | Effort | Acceptance Criteria |
|---|---|---|---|---|---|
| [x] 2.1 | RED: TT layout tests | Write failing tests for large point digits, names, center set panels, finished set strip | 1.3 | 20m | Tests fail for expected reasons |
| [x] 2.2 | GREEN: TT layout | Implement main score area and set-history strip for table tennis using semantic tokens | 2.1 | 45m | TT tests pass |
| [x] 2.3 | RED: padel layout tests | Write failing tests for games counter, point string, center panels, finished set strip | 1.3 | 20m | Tests fail for expected reasons |
| [x] 2.4 | GREEN: padel layout | Add padel branching via `adapter.computeDisplayData(match)` | 2.3 | 30m | Padel tests pass |
| [x] 2.5 | RED: edge-case tests | Write failing tests for empty-name fallback, side-swap, reduced motion, light theme | 1.3 | 25m | Tests fail for expected reasons |
| [x] 2.6 | GREEN: edge cases | Apply fallback labels, honor `useReducedMotion`, use theme tokens, mirror swapped sides | 2.5 | 35m | Edge-case tests pass |
| [x] 2.7 | Wire `KioskScoreboard` | Remove `ScoreboardBar`/`SportDisplaySelector`; render `KioskPointDisplay` with `useMatchDisplay` values | 2.2, 2.4, 2.6 | 30m | KioskScoreboard renders without old components |

## Phase 3: Testing & Verification

| ID | Title | Description | Dependencies | Effort | Acceptance Criteria |
|---|---|---|---|---|---|
| [x] 3.1 | Run component tests | Execute Vitest for `KioskPointDisplay` and fix failures | 2.7 | 20m | Component tests green |
| [x] 3.2 | `KioskScoreboard` regression tests | Assert `ScoreboardBar` and `SportDisplaySelector` absent and `KioskPointDisplay` present | 2.7 | 20m | New tests pass |
| [x] 3.3 | Full client suite | Run `pnpm --filter client run test`; confirm no changes to `TTPointDisplay`, `PadelPointDisplay`, or `ScoreboardMain` | 3.1, 3.2 | 20m | All client tests pass |
| [x] 3.4 | Spec acceptance audit | Compare every spec scenario and acceptance criterion against implementation; update task checkboxes | 3.3 | 15m | All acceptance criteria checked |

## Commit / Work-Unit Plan

1. `feat(kiosk): add KioskPointDisplay component with TT/padel layouts and tests`
   - Includes `KioskPointDisplay.tsx` and `KioskPointDisplay.test.tsx`
2. `refactor(kiosk): wire KioskPointDisplay into KioskScoreboard and remove legacy bars`
   - Modifies `KioskScoreboard.tsx` and adds regression tests
