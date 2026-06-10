# Tasks: Cancha Destacada (Kiosk Spotlight)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 380-450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: shared+server (~180) → main; PR 2: client (~200+) → main |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shared types + server handlers + server tests | PR 1 → main | Phase 1 + Phase 2 + server tests |
| 2 | Kiosk fullscreen + owner toggle + client tests | PR 2 → main | Phase 3 + Phase 4 + client tests |

## Phase 1: Shared Types & Events (Infrastructure)

- [x] 1.1 Add `featured?: boolean` to `CourtInfo` in `shared/types.ts` (~line 219)
- [x] 1.2 Add `SET_FEATURED`, `SUBSCRIBE_MATCH`, `UNSUBSCRIBE_MATCH` + payload types to `shared/events.ts` CLIENT
- [x] 1.3 Add `featured: boolean` (default false) to `Court` in `server/src/domain/types.ts`
- [x] 1.4 Update `TableFormatter.toPublicInfo()` to map `table.featured` → output

## Phase 2: Server Handler (Core Logic)

- [x] 2.1 Add `SpotlightHandler` with `SET_FEATURED` — validate owner (socket.data.isOwner), table exists, single-featured invariant, broadcast TABLE_UPDATE for previous+new court
- [x] 2.2 Wire `SET_FEATURED` handler in `SpotlightHandler.registerHandlers()` with owner validation
- [x] 2.3 Add `SUBSCRIBE_MATCH` handler in `SpotlightHandler` — validate `court.featured===true`, `socket.join`, emit current MATCH_UPDATE or ERROR FORBIDDEN
- [x] 2.4 Add `UNSUBSCRIBE_MATCH` handler in `SpotlightHandler` — `socket.leave(courtId)`
- [x] 2.5 Add auto-clear in `SocketHandler.onMatchEvent` MATCH_WON branch — if court.featured, set false + broadcast TABLE_UPDATE

## Phase 3: Kiosk Fullscreen UI

- [ ] 3.1 Add `isFeatured` detection + SUBSCRIBE_MATCH/UNSUBSCRIBE_MATCH subscription + MATCH_UPDATE listener in `KioskAllTablesPage`
- [ ] 3.2 Add conditional render: when LIVE/WAITING court is featured → fullscreen `ScoreboardMain` (read-only) with real-time state; else → existing grid; cleanup on unmount
- [ ] 3.3 Add CSS opacity transition 500ms + "Destacado" bar (★ DESTACADO badge, court name, EN VIVO badge) with i18n labels

## Phase 4: Owner Dashboard

- [ ] 4.1 Add `featured?: boolean` + `onToggleFeatured?: () => void` to `TableStatusChipProps`
- [ ] 4.2 Render "Destacar" / "Quitar Destacado" toggle button in `TableStatusChip` (i18n), hidden for FINISHED
- [ ] 4.3 Wire `SET_FEATURED` emit in `OwnerDashboardPage` via `onToggleFeatured`

## Phase 5: Testing

- [x] 5.1 Test `SET_FEATURED` handler: owner sets/clears/switches; non-owner rejected (UNAUTHORIZED); nonexistent table (TABLE_NOT_FOUND)
- [x] 5.2 Test `SUBSCRIBE_MATCH`: validates featured (joins room + emits MATCH_UPDATE), rejects non-featured (FORBIDDEN)
- [x] 5.3 Test `UNSUBSCRIBE_MATCH`: socket.leave on receipt
- [x] 5.4 Test auto-clear: MATCH_WON on featured court → featured=false + TABLE_UPDATE broadcast
- [ ] 5.5 Test kiosk rendering: grid when no featured, fullscreen ScoreboardMain when featured, return to grid on clear/end

## Dependencies

- Phase 1 → Phases 2, 3, 4 (shared types prerequisite)
- Phase 2 → Phase 3 (server handlers required for kiosk subscription)
- Phase 2.1 → Phase 2.5 (auto-clear reuses featured mutation path)
- Phase 5 tests run after their respective implementation phases

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition on rapid toggle | Low | Server atomically clears previous before setting new; both TABLE_UPDATEs in sequence |
| Socket disconnect during fullscreen | Low | useEffect cleanup emits UNSUBSCRIBE_MATCH; reconnect re-evaluates featured from fresh TABLE_LIST |
| Kiosk subscribes before featured set | None | Server validates court.featured===true on SUBSCRIBE_MATCH; only owner can SET_FEATURED |
| ScoreboardMain requires MatchStateExtended | Medium | Kiosk receives only CourtInfo via TABLE_LIST; SUBSCRIBE_MATCH bridge provides MatchStateExtended via MATCH_UPDATE. Must ensure MATCH_UPDATE payload matches ScoreboardMain's expected shape |
