# Delta for tournament-lifecycle

## ADDED Requirements

### Requirement: Tournament Status Endpoint
GET /api/tournament/status MUST return `{ exists: boolean, matchCount: number, lastSaved: ISO string | null }`.

#### Scenario: Prior tournament exists
- GIVEN `data/rallyos-state.json` has persisted tables
- WHEN GET /api/tournament/status is called
- THEN response is `{ exists: true, matchCount: <N>, lastSaved: "<ISO>" }`

#### Scenario: No prior tournament
- GIVEN no `data/rallyos-state.json` file or an empty state
- WHEN GET /api/tournament/status is called
- THEN response is `{ exists: false, matchCount: 0, lastSaved: null }`

### Requirement: Post-Login Resume Decision Modal
After owner VERIFY_OWNER succeeds, the client SHALL call GET /api/tournament/status. If `exists` is true, a modal MUST appear with "Load" and "New" options. The modal MUST block dashboard access until resolved.

#### Scenario: Owner logs in, tournament exists
- GIVEN owner passes VERIFY_OWNER
- WHEN GET /api/tournament/status returns `{ exists: true }`
- THEN TournamentResumeModal appears with "Load previous tournament" and "Start new" buttons

#### Scenario: Owner logs in, no tournament
- GIVEN owner passes VERIFY_OWNER
- WHEN GET /api/tournament/status returns `{ exists: false }`
- THEN modal does NOT appear; dashboard renders immediately

#### Scenario: Owner clicks "Load"
- GIVEN TournamentResumeModal is visible
- WHEN owner clicks "Load"
- THEN client calls POST /api/tournament/load
- AND dashboard populates with restored tables

#### Scenario: Owner clicks "New"
- GIVEN TournamentResumeModal is visible
- WHEN owner clicks "New"
- THEN client calls POST /api/tournament/new
- AND state is cleared; dashboard shows empty

### Requirement: Load Tournament
POST /api/tournament/load MUST call StateStore.load() and reconstruct tables via TableManager. On success, existing PINs, scores, and undo history SHALL be intact.

#### Scenario: Valid JSON loaded
- GIVEN valid `data/rallyos-state.json` with 2 LIVE and 1 FINISHED tables
- WHEN POST /api/tournament/load is called
- THEN TableManager contains 3 restored tables
- AND PINs, scores, and undo history match saved state
- AND MatchEngine.fromState() was called for each LIVE/FINISHED table
- AND Socket.io callbacks are rewired; MATCH_UPDATE emits on future mutations

#### Scenario: JSON missing after status said exists
- GIVEN GET /api/tournament/status returned `{ exists: true }`
- WHEN POST /api/tournament/load executes but StateStore.load() returns empty (file deleted mid-session)
- THEN server returns error; client starts clean

### Requirement: New Tournament
POST /api/tournament/new MUST call StateStore.clear(). If tournament data exists at time of call, it SHALL be discarded. The operation is idempotent.

#### Scenario: Prior tournament exists
- GIVEN `data/rallyos-state.json` exists with persisted data
- WHEN POST /api/tournament/new is called
- THEN StateStore.clear() removes all persisted state
- AND response returns success

#### Scenario: No prior data
- GIVEN no `data/rallyos-state.json` exists
- WHEN POST /api/tournament/new is called
- THEN response returns success (idempotent)

### Requirement: Finish Tournament
POST /api/tournament/finish MUST call StateStore.archive() — moving `data/rallyos-state.json` to `data/archive/` with a timestamped filename — then StateStore.clear(). An optional CSV export MAY be triggered before clearing.

#### Scenario: Active tournament with finished matches
- GIVEN tables with at least one FINISHED match exist
- WHEN POST /api/tournament/finish is called
- THEN JSON file is moved to `data/archive/rallyos-state-<ISO>.json`
- THEN StateStore.clear() resets active state
- AND response returns success

#### Scenario: No active tournament
- GIVEN no tournament data exists
- WHEN POST /api/tournament/finish is called
- THEN server returns error

### Requirement: Owner-Only Lifecycle Access
All /api/tournament/* endpoints MUST return 401 when no valid owner session exists.

#### Scenario: Unauthenticated request
- GIVEN no owner session cookie
- WHEN any /api/tournament/* endpoint is called
- THEN HTTP 401 is returned

#### Scenario: Authenticated owner
- GIVEN valid owner session cookie
- WHEN any /api/tournament/* endpoint is called
- THEN request proceeds normally

### Requirement: CSV Export on Tournament Finish
When owner triggers tournament finish, the client SHOULD present a confirmation dialog with an "Exportar CSV" checkbox. If checked, GET /api/export/matches.csv SHALL download BEFORE StateStore.clear() executes.

#### Scenario: Owner finishes with CSV export
- GIVEN owner clicks "Finalizar Torneo"
- WHEN confirm dialog appears with "Exportar CSV" checkbox checked
- AND owner confirms
- THEN CSV downloads before tournament clears
- AND tournament is archived and cleared

#### Scenario: Owner finishes without CSV export
- GIVEN owner clicks "Finalizar Torneo"
- WHEN confirm dialog appears with "Exportar CSV" checkbox unchecked
- AND owner confirms
- THEN tournament is archived and cleared with no CSV download
