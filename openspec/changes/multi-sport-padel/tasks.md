# Tasks: Multi-Sport Support — Padel

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

## Phase 1: Shared Types + Events Foundation

- [x] 1.1 Add `Sport`, `PadelPoint`, `SportConfig`, `SportDisplayScore` to `shared/types.ts`
- [x] 1.2 Add `sport` to `MatchConfig`; `detailScore` to `Score`; `MatchState`→discriminated union
- [x] 1.3 Rename `TableInfo`→`CourtInfo` with `type TableInfo = CourtInfo` alias; socket strings unchanged
- [x] 1.4 Add `GAME_WON`,`TIEBREAK_START`,`DEUCE` to `SERVER`;`RECORD_SCORE` to `CLIENT` in `shared/events.ts`
- [x] 1.5 Add i18n keys for sport names, deuce, advantage, tiebreak, game to `es.json` and `en-US.json`
- [x] 1.6 `tsc --noEmit` clean, existing shared tests pass

## Phase 2: SportRules Interface + TT Extraction

- [x] 2.1 Create `server/src/domain/sports/types.ts`: `SportRules` interface (11 methods + sport property), `ScoreResult`, `GameState`
- [x] 2.2 Extract scoring from `matchEngine.ts` → `tableTennis.rules.ts` as `TableTennisRules implements SportRules`
- [x] 2.3 Create `tableTennis.rules.test.ts` with 20 tests covering all SportRules methods
- [x] 2.4 Rename `Table`→`Court` in `server/src/domain/types.ts` with legacy alias; `matchEngine`→`sportRules`
- [x] 2.5 `pnpm --filter server run test`; 207 tests pass (187 existing + 20 new)

## Phase 3: MatchEngine Refactor + Registry + Migration

- [x] 3.1 Refactor `matchEngine.ts` to thin delegator: constructor takes `SportRules`, delegates scoring, keeps history
- [x] 3.2 Create `sport.registry.ts` (Sport→factory map) + `sport.registry.test.ts`
- [x] 3.3 Add `sport: Sport` to `PersistedMatchState`; bump version→2 in `store/types.ts`
- [x] 3.4 Create `migration.ts`: `migrateV1toV2()` — in-memory v1→v2; per-table error skip; `migration.test.ts`
- [x] 3.5 `StateStore.save()` writes v2; `load()` calls migration; TT tests pass through delegator

## Phase 4: PadelRules Implementation

- [x] 4.1 Create `padel.rules.ts`: 15-30-40-AD, deuce/advantage, golden-point, games/sets/tiebreak, serve/swap
- [x] 4.2 `subtractScore`: 40→30, AD→Deuce, Deuce→pre-deuce; undo snapshots
- [x] 4.3 Create `padel.rules.test.ts`: progression, deuce cycles, tiebreaks, side swap, undo edge cases
- [x] 4.4 Padel tests pass; TT tests unaffected

## Phase 5: Server Wiring + Socket Events

- [x] 5.1 `MatchOrchestrator`: accept `sport`, resolve rules from registry, default='tableTennis'
- [x] 5.2 `MatchEventHandler`: `CONFIGURE_MATCH` accepts `sport`/`tiebreakPoints`/`goldenPoint`; `RECORD_POINT`→`recordScore`
- [x] 5.3 Emit `GAME_WON`, `TIEBREAK_START`, `DEUCE` from engine callback; broadcast via socket
- [x] 5.4 Rename `tableManager.ts`→`courtManager.ts`; update internal refs
- [x] 5.5 Create TT match (no sport→defaults); create padel match; socket emits correct events

## Phase 6: Frontend Sport Display

- [x] 6.1 Extract number display → `TTPointDisplay.tsx`; create `PadelPointDisplay.tsx` (game+15-30-40-AD+sets)
- [x] 6.2 Create `SportDisplaySelector.tsx`: switch by `match.state.sport`
- [x] 6.3 Update `useMatchDisplay`/types: add `sport`, compute `SportDisplayScore`; add padel test cases
- [x] 6.4 Wire `ScoreboardMain` to selector; update `ScoreDisplay` molecule for sport-aware props
- [x] 6.5 RTL: "30-40" visible, AD indicator; 829 client tests pass (+36 new)

## Phase 7: Frontend SportDisplayAdapter + Config + Rename

### 7A: SportDisplayAdapter Foundation (Strategy Pattern)

- [x] 7.1 Create `SportDisplayAdapter` interface in `client/src/adapters/SportDisplayAdapter.ts` (10 methods matching spec `frontend-sport-adapter`)
- [x] 7.2 Create `TableTennisDisplayAdapter` — extract TT logic from current `useMatchDisplay`/`applySideSwap`/`SportDisplaySelector`
- [x] 7.3 Create `PadelDisplayAdapter` — extract padel logic from current `useMatchDisplay`/`applySideSwap`/`SportDisplaySelector`
- [x] 7.4 Create `SportDisplayRegistry` (`Map<Sport, SportDisplayAdapter>` + `resolve(sport)` with TT fallback)
- [x] 7.5 Create `useSportAdapter` hook — `useMemo` keyed on `match.sport`, returns adapter from registry
- [x] 7.6 Unit tests: both adapters (TDD), registry resolution + fallback, hook memoization

### 7B: Eliminate all `if (isPadel)` branching (10+ branches across 6 files)

- [ ] 7.7 Refactor `applySideSwap.ts`: accept `SportDisplayAdapter`, replace 5 `isPadel` ternaries with `adapter.getCurrentScores()`/`getServing()`/`needsHandicap()`
- [ ] 7.8 Refactor `useMatchDisplay.ts`: `sportDisplayScore` via `adapter.computeDisplayData()`, remove `isPadel` branches
- [ ] 7.9 Refactor `SportDisplaySelector.tsx`: render `<adapter.DisplayComponent />` directly, remove `if (isPadelState)` switch
- [ ] 7.10 Refactor `validateMatchConfig()`: dispatch to `adapter.validateConfig()` instead of `if (isTableTennisConfig)` branch
- [ ] 7.11 Refactor `ScoreboardBar.tsx`: replace `score: any`/`setHistory: any[]` with `formattedSets: FormattedSet[]` from `adapter.formatSetHistory()`
- [ ] 7.12 Refactor `ScoreboardMain.tsx`: use `useSportAdapter`, pass formatted data to ScoreboardBar, remove direct `match.score`/`match.setHistory` access

### 7C: Config Modal + Events + Rename

- [ ] 7.13 `MatchConfigModal`: sport dropdown, dynamic fields from `adapter.getConfigFields()`, handicap hidden for padel, tiebreak 7/10pt + golden-point toggle
- [ ] 7.14 `useScoreboardEvents`: sport-aware `handleStartMatch` payload from `adapter.getConfigDefaults()`
- [ ] 7.15 Rename `TableStatusChip`→`CourtStatusChip`; "table"→"court", "mesa"→"cancha" in client UI (socket wire names excluded)
- [ ] 7.16 Remove legacy type aliases (`TableInfo`, `TableInfoWithPin`, `TableTennisConfig`, `PadelConfig`) after all consumers migrated
- [ ] 7.17 Integration: full padel flow config→display→scoring→undo; Open/Closed proof (adding pickleball = new adapter only, zero existing changes); all ~1,200 tests pass
