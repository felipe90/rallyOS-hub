# match-persistence Specification

## Purpose

Server-side JSON file persistence for Table and MatchEngine state. Enables match survival across server restarts with atomic writes and adapter interface for future export formats.

## Requirements

### Requirement: Auto-Save on Mutation

The system MUST persist all LIVE and FINISHED tables to disk after every state-changing operation. StateStore.save() SHALL be called from the TableManager mutation hook (notifyUpdate) after each operation.

#### Scenario: Point scored triggers save

- GIVEN a LIVE table exists
- WHEN referee records a point via RECORD_POINT
- THEN StateStore.save() writes all LIVE/FINISHED tables to `data/rallyos-state.json`

#### Scenario: Table transitions from CONFIGURING to LIVE

- GIVEN a table with status CONFIGURING
- WHEN START_MATCH succeeds and status becomes LIVE
- THEN StateStore.save() includes the newly LIVE table

### Requirement: On-Demand State Restoration

TableManager SHALL start empty on construction — no automatic load. State restoration MUST occur only via explicit POST /api/tournament/load. When triggered, StateStore.load() reads persisted JSON; TableManager reconstructs Table objects and MatchEngine instances via `MatchEngine.fromState()`. Socket.io callbacks MUST be rewired after restoration.
(Previously: State restored automatically on server startup / TableManager constructor.)

#### Scenario: Tournament loaded on explicit request

- GIVEN `data/rallyos-state.json` contains 2 LIVE tables and 1 FINISHED
- WHEN owner sends POST /api/tournament/load
- THEN TableManager contains 3 tables with correct scores, PINs, and undo history
- AND MatchEngine.fromState() was called for each table with LIVE/FINISHED status

#### Scenario: TableManager starts empty

- GIVEN `data/rallyos-state.json` contains persisted tables
- WHEN server boots and TableManager is constructed
- THEN TableManager has zero tables
- AND state is NOT auto-loaded

#### Scenario: Callbacks rewired after restoration

- GIVEN tables restored via POST /api/tournament/load
- WHEN referee records a point
- THEN MATCH_UPDATE is emitted via wired callback

### Requirement: Atomic Write Guarantee

StateStore.save() SHALL write to a temporary file first (`data/rallyos-state.json.tmp`), then atomically replace the main file via `fs.rename()`. If the process crashes mid-write, the previous valid state file MUST remain intact.

#### Scenario: Crash during save preserves previous state

- GIVEN `data/rallyos-state.json` contains valid state
- WHEN server crashes while StateStore.save() is writing to the .tmp file
- THEN `data/rallyos-state.json` remains unchanged and valid
- AND next startup loads the previous uncorrupted state

### Requirement: Graceful Degradation on Invalid State

If the JSON file is missing, empty, or contains malformed JSON, StateStore.load() MUST return an empty array. The server SHALL NOT crash or throw an unhandled error.

#### Scenario: No state file exists

- GIVEN no `data/rallyos-state.json` file
- WHEN server starts
- THEN StateStore.load() returns [] (empty tables array)
- AND server starts cleanly

#### Scenario: Corrupt JSON file

- GIVEN `data/rallyos-state.json` contains invalid JSON
- WHEN server starts
- THEN StateStore.load() returns [] without throwing

### Requirement: Persistence Filter — LIVE and FINISHED Only

StateStore.save() MUST ONLY persist tables with status LIVE or FINISHED. Tables in WAITING or CONFIGURING status SHALL be excluded from the saved state.

#### Scenario: WAITING table excluded

- GIVEN tables: 1 LIVE, 1 WAITING, 1 FINISHED
- WHEN StateStore.save() executes
- THEN JSON contains the LIVE and FINISHED tables only
- AND WAITING table is absent

### Requirement: Persisted Data Completeness

The saved JSON MUST include sufficient state to fully reconstruct tables and matches: table identity (id, number, name), PIN, playerNames, status, createdAt, and matchState. matchState MUST include config, score, setHistory, undo history, swappedSides, midSetSwapped, winner, and match status.

#### Scenario: PIN survives restart

- GIVEN table "t1" has PIN "4821"
- WHEN server restarts and state is restored
- THEN table "t1" still has PIN "4821"
- AND referee can reconnect with PIN "4821" without regeneration

#### Scenario: Undo history survives restart

- GIVEN table "t1" has 3 ScoreChange entries in undo history
- WHEN server restarts and state is restored
- THEN table "t1" still has 3 undo entries
- AND UNDO_LAST works normally

### Requirement: Non-Persisted Field Exclusion

StateStore.save() MUST NOT persist runtime-only fields: MatchEngine instances, PlayerConnection.socketId values, and Socket.io callback references.

#### Scenario: socketId excluded from save

- GIVEN a LIVE table with connected players
- WHEN StateStore.save() executes
- THEN saved JSON contains no socketId fields
