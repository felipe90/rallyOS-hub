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

- [ ] 4.1 Create `padel.rules.ts`: 15-30-40-AD, deuce/advantage, golden-point, games/sets/tiebreak, serve/swap
- [ ] 4.2 `subtractScore`: 40→30, AD→Deuce, Deuce→pre-deuce; undo snapshots
- [ ] 4.3 Create `padel.rules.test.ts`: progression, deuce cycles, tiebreaks, side swap, undo edge cases
- [ ] 4.4 Padel tests pass; TT tests unaffected

## Phase 5: Server Wiring + Socket Events

- [ ] 5.1 `MatchOrchestrator`: accept `sport`, resolve rules from registry, default='tableTennis'
- [ ] 5.2 `MatchEventHandler`: `CONFIGURE_MATCH` accepts `sport`/`tiebreakPoints`/`goldenPoint`; `RECORD_POINT`→`recordScore`
- [ ] 5.3 Emit `GAME_WON`, `TIEBREAK_START`, `DEUCE` from engine callback; broadcast via socket
- [ ] 5.4 Rename `tableManager.ts`→`courtManager.ts`; update internal refs
- [ ] 5.5 Create TT match (no sport→defaults); create padel match; socket emits correct events

## Phase 6: Frontend Sport Display

- [ ] 6.1 Extract number display → `TTPointDisplay.tsx`; create `PadelPointDisplay.tsx` (game+15-30-40-AD+sets)
- [ ] 6.2 Create `SportDisplaySelector.tsx`: switch by `match.state.sport`
- [ ] 6.3 Update `useMatchDisplay`/types: add `sport`, compute `SportDisplayScore`; add padel test cases
- [ ] 6.4 Wire `ScoreboardMain` to selector; update `ScoreDisplay` molecule for sport-aware props
- [ ] 6.5 RTL: "30-40" visible, AD indicator; 763 client tests pass

## Phase 7: Frontend Config + Match Logic + Rename Finish

- [ ] 7.1 `MatchConfigModal`: sport dropdown; handicap hidden for padel; tiebreak 7/10pt, golden-point toggle
- [ ] 7.2 Dynamic labels "pts/set" vs "games/set"; `determineWinner` sport-aware; `formatEvent` sport-aware
- [ ] 7.3 Rename `TableStatusChip`→`CourtStatusChip`; "table"→"court", "mesa"→"cancha" in client
- [ ] 7.4 Remove legacy type aliases after all consumers migrated
- [ ] 7.5 Config modal RTL (padel hides handicap, shows tiebreak); no "table"/"mesa" in UI; all tests pass
