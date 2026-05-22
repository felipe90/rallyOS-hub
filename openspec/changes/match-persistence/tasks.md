# Tasks: Match Persistence & CSV Export

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1100–1300 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | StateStore core + types + tests | PR 1 | Standalone; zero deps |
| 2 | MatchEngine.fromState() + TableManager integration + tests | PR 2 | Base: PR 1 |
| 3 | Tournament endpoints + auth middleware + bootstrap + tests | PR 3 | Base: PR 2 |
| 4 | CsvExporter + export endpoint + tests | PR 4 | Base: PR 2 (shared auth) |
| 5 | Client modal + dashboard buttons + i18n + config | PR 5 | Base: PR 3 + PR 4 |

## Phase 1: StateStore Core

- [x] 1.1 Create `server/src/services/store/types.ts` — `PersistedTable`, `PersistedMatchState` interfaces
- [x] 1.2 Create `server/src/services/store/StateStore.ts` — `save()`, `load()`, `checkExists()`, `clear()`, `archive()` with atomic `tmp+rename` write
- [x] 1.3 Create `server/src/services/store/StateStore.test.ts` — test save/load round-trip, corrupt JSON → `[]`, crash during write preserves prior state, LIVE/FINISHED filter

## Phase 2: MatchEngine Restoration

- [x] 2.1 Add `MatchEngine.fromState(state: PersistedMatchState)` static factory to `server/src/domain/matchEngine.ts`
- [x] 2.2 Add unit test to `server/src/domain/matchEngine.test.ts` — round-trip `getState()` → `fromState()` → `getState()` produces identical JSON

## Phase 3: TableManager Integration

- [x] 3.1 Refactor `TableManager` constructor to accept optional `StateStore` param in `server/src/domain/tableManager.ts`
- [x] 3.2 Call `stateStore?.save()` in `notifyUpdate()` after each mutation
- [x] 3.3 Add `loadTournament()` → `stateStore.load()` → `MatchEngine.fromState()` per table → rewire callbacks
- [x] 3.4 Add TableManager integration tests — load restores PINs/scores/undo history; callbacks fire after restore

## Phase 4: Tournament Lifecycle Endpoints

- [ ] 4.1 Create `server/src/middleware/ownerAuth.ts` — validates `X-Tournament-Token` against in-memory `Set`
- [ ] 4.2 Modify `AuthHandler.VERIFY_OWNER` in `server/src/handlers/AuthHandler.ts` — generate `crypto.randomUUID()`, store in `activeTokens`, emit in `OWNER_VERIFIED`
- [ ] 4.3 Create `server/src/routes/tournament.ts` — Express router with `GET /status`, `POST /load`, `POST /new`, `POST /finish`
- [ ] 4.4 Wire routes and auth middleware in `server/src/app.ts`
- [ ] 4.5 Bootstrap `StateStore` in `server/src/index.ts`, pass to `TableManager`, inject into tournament routes
- [ ] 4.6 Create `server/src/routes/tournament.test.ts` — integration tests for all endpoints; 401 when unauthenticated; load restores PINs/scores; finish archives + clears

## Phase 5: CSV Export

- [ ] 5.1 Create `server/src/services/store/CsvExporter.ts` — export FINISHED tables as CSV with columns: table_number, table_name, player_a, player_b, sets_won_a, sets_won_b, set_scores, winner
- [ ] 5.2 Create `server/src/services/store/CsvExporter.test.ts` — verify row structure, empty player names, only FINISHED tables
- [ ] 5.3 Add `GET /api/export/matches.csv` to tournament routes — `Content-Type: text/csv`, `Content-Disposition: attachment`, owner-auth protected

## Phase 6: Client — Tournament Resume Modal

- [ ] 6.1 Create `client/src/components/molecules/TournamentResumeModal/TournamentResumeModal.tsx` — modal with match count, "Load" and "New" buttons; blocks dismissal
- [ ] 6.2 Create `client/src/components/molecules/TournamentResumeModal/TournamentResumeModal.test.tsx`
- [ ] 6.3 Modify `client/src/hooks/useAuthFlow.ts` — store `tournamentToken` from `OWNER_VERIFIED`; after login fetch `GET /api/tournament/status`; if `exists`, block navigation with modal
- [ ] 6.4 Wire modal into `client/src/pages/AuthPage/AuthPage.tsx` — show when `exists` flag set after owner verification
- [ ] 6.5 Add i18n keys to `client/src/i18n/locales/es.json` and `en-US.json` — modal title, load button, new button, match count label

## Phase 7: Client — Dashboard Buttons

- [ ] 7.1 Add "Finalizar Torneo" button (Trophy icon) + ConfirmDialog with "Exportar CSV" checkbox to `OwnerDashboardPage`
- [ ] 7.2 Add Export CSV button (Download icon) to `OwnerDashboardPage` — `GET /api/export/matches.csv` as blob download
- [ ] 7.3 Update `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.test.tsx` — new buttons render for owners, hidden for non-owners

## Phase 8: Config

- [ ] 8.1 Add `./data:/app/data` volume to `docker-compose.yml` under hub service
- [ ] 8.2 Add `mkdir -p data/ data/archive/` to `scripts/dev.sh` after "Checking project structure"
- [ ] 8.3 Add `data/rallyos-state.json` and `data/archive/` to `.gitignore`
