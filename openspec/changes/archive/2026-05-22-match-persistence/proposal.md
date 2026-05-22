# Proposal: Match Persistence & CSV Export

## Intent

All match data lives exclusively in-memory (`Map<string, Table>`). A server restart destroys every table, score, PIN, and undo history. Tournament operators need survival across restarts and a way to export finished match results.

## Scope

### In Scope
- JSON file persistence: auto-save on every mutation, restore on startup
- Atomic writes via tmp+rename to prevent corruption on crash
- Persist only LIVE/FINISHED tables (WAITING/CONFIGURING are ephemeral)
- Reconstruct Table + MatchEngine from JSON on startup, rewire callbacks
- Undo history (last 20 ScoreChange[]) survives restarts
- PINs survive restarts — referees reconnect without PIN regeneration
- Tournament lifecycle: owner decides "Load previous" or "Start new" via modal after login
- "Finish Tournament" action: archive JSON, optional CSV export, reset state
- Tournament status endpoint: GET /api/tournament/status
- GET /api/export/matches.csv endpoint serving finished matches as CSV
- Export CSV button in OwnerDashboardPage header (Download icon)

### Out of Scope
- SQLite, LevelDB, or any database dependency
- Persisting WAITING/CONFIGURING tables
- Persisting spectator/player socket connections
- CSV export format customization (columns, delimiter)
- Stadium Compete adapter (deferred — architecture designed with adapter interface to support it)
- Migration tooling (adapter pattern leaves door open)

## Capabilities

> This section is the CONTRACT between proposal and specs phases.

### New Capabilities
- `match-persistence`: JSON-based persistence layer with atomic writes. Saves/restores match state on disk. StateStore injected into TableManager. Auto-save on every mutation.
- `tournament-lifecycle`: Owner controls tournament session: load previous or start new, finish tournament with archive + export. HTTP endpoints for lifecycle commands. Modal UI after login.
- `csv-match-export`: Export finished matches as CSV from owner dashboard or at tournament finish. First adapter implementation.

### Modified Capabilities
- None (purely additive)

## Approach

**StateStore** class: atomic JSON read/write to `data/rallyos-state.json`. Injected into `TableManager` constructor. `notifyUpdate()` triggers `StateStore.save()`. On explicit load (owner choice), `StateStore.load()` returns snapshot, `TableManager` reconstructs `Table` objects and `MatchEngine` instances via `MatchEngine.fromState()`. Missing/corrupt file → start clean (no crash). `StateStore.checkExists()` queries file presence; `StateStore.clear()` resets to empty; `StateStore.archive()` moves file to `data/archive/`.

**Tournament lifecycle**: TableManager starts EMPTY on server boot — no auto-load. After owner login, client calls `GET /api/tournament/status`. If prior tournament exists, a `TournamentResumeModal` appears: "Load previous tournament (N matches) or start new?" Post-login modal interrupts normal flow until answered. Load calls `POST /api/tournament/load`; New calls `POST /api/tournament/new` (exports CSV if data present, clears state). "Finish Tournament" button in dashboard header calls `POST /api/tournament/finish` → archives JSON to `data/archive/`, optional CSV export, clears state.

**Export adapter pattern**: Exporters read from `TableManager` (via `StateStore`) and transform to output formats. `CsvExporter` is the first concrete adapter. Future adapters (Stadium Compete, JSON dump, etc.) follow the same interface — read tables, transform, return output. Zero changes to persistence layer required.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/store/` | New | StateStore.ts, types.ts, CsvExporter.ts |
| `server/src/domain/matchEngine.ts` | Modified | Add `fromState()` static factory |
| `server/src/domain/tableManager.ts` | Modified | Accept StateStore, auto-save in notifyUpdate, restore via loadTournament() |
| `server/src/index.ts` | Modified | Bootstrap StateStore, pass to TableManager |
| `server/src/app.ts` | Modified | Add /api/tournament/status, /load, /new, /finish, /api/export/matches.csv |
| `client/src/pages/OwnerDashboardPage/` | Modified | Export CSV button, Finalizar Torneo button, tournament loading state |
| `client/src/components/molecules/TournamentResumeModal/` | New | Post-login modal: "Load previous or start new?" |
| `client/src/pages/AuthPage/` | Modified | After login, check tournament status, show resume modal |
| `docker-compose.yml` | Modified | Volume mount `./data:/app/data` |
| `scripts/dev.sh` | Modified | `mkdir -p data/ data/archive/` |
| `.gitignore` | Modified | Add `data/rallyos-state.json`, `data/archive/` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JSON grows with many tables/history | Low | 20 tables ≈ 15KB; rotation cap at 20 undo entries already exists |
| Partial write on crash corrupts state | Low | Atomic tmp+rename pattern prevents partial writes |
| Schema drift: old JSON incompatible after updates | Low | Missing/corrupt JSON → clean start; future migration via adapter pattern |
| MatchEngine.fromState() diverges from constructor | Med | Unit test that round-trips save→restore→save produces identical JSON |

## Rollback Plan

1. Remove `data/rallyos-state.json` and `data/` directory
2. Revert `TableManager` constructor to not accept StateStore
3. Remove `GET /api/export/matches.csv` route from app.ts
4. Remove Export button from OwnerDashboardPage
5. Revert docker-compose.yml volume and dev.sh mkdir
6. Remove `data/rallyos-state.json` from .gitignore
7. Delete `server/src/services/store/` directory

## Dependencies

- Node.js built-in `fs` (already available)
- Existing `MatchEngine.getState()` (already returns JSON-safe snapshot)

## Success Criteria

- [ ] Server restart restores all LIVE/FINISHED tables with correct scores, history, and PINs
- [ ] Referee can reconnect with same PIN after restart without regenerating
- [ ] Simulated crash during save leaves previous valid state intact (atomic write)
- [ ] Missing or corrupt JSON → server starts clean, no crash
- [ ] GET /api/export/matches.csv returns valid CSV with correct columns
- [ ] Export button visible in OwnerDashboardPage for authenticated owners
- [ ] Existing tests pass (no regression)
