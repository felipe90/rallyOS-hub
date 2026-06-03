# Delta for match-persistence

## ADDED Requirements

### Requirement: Sport Field in PersistedMatchState

PersistedMatchState MUST include a `sport` field identifying which sport rules apply. When saving, StateStore SHALL include the sport from the active MatchEngine.

#### Scenario: Padel match saved with sport field

- GIVEN a LIVE padel match
- WHEN StateStore.save() executes
- THEN saved JSON contains `matchState.sport: "padel"`

#### Scenario: Table tennis match saved with sport field

- GIVEN a LIVE table tennis match
- WHEN StateStore.save() executes
- THEN saved JSON contains `matchState.sport: "tableTennis"`

### Requirement: Version Migration v1 to v2

StateStore.save() SHALL write `version: 2`. StateStore.load() MUST detect version 1 state and auto-migrate: iterate all tables, add `sport: "tableTennis"` to each matchState. Migrated state SHALL NOT be written back to disk unless the server later saves it.

#### Scenario: Version 1 state auto-migrated on load

- GIVEN persisted JSON with `version: 1` and no sport fields on any table
- WHEN StateStore.load() executes
- THEN all tables have `matchState.sport: "tableTennis"`
- AND the on-disk file is unchanged (migration is in-memory only)

#### Scenario: Version 2 state loaded directly

- GIVEN persisted JSON with `version: 2` and sport fields present
- WHEN StateStore.load() executes
- THEN tables are loaded with their original sport values, no migration applied

#### Scenario: Saved after migration writes version 2

- GIVEN v1 state was loaded and auto-migrated with `sport: "tableTennis"`
- WHEN a point is recorded and StateStore.save() executes
- THEN persisted JSON has `version: 2` and all sport fields present

### Requirement: Legacy State Auto-Detection

Tables loaded from v1 state or tables where matchState contains no `sport` field SHALL be treated as table tennis. This detection MUST happen in StateStore.load(), not in consuming code.

#### Scenario: Missing sport field defaults to tableTennis

- GIVEN a persisted table where matchState has no `sport` field (corrupt or v1 remnant)
- WHEN StateStore.load() processes it
- THEN that table's matchState is assigned `sport: "tableTennis"`

#### Scenario: Restored match operates correctly

- GIVEN a v1 legacy match restored and migrated to tableTennis
- WHEN referee records a point
- THEN TableTennisRules are used; scoring behaves identically to pre-migration

### Requirement: Migration Failure Graceful Degradation

If migration fails for any individual table, that table SHALL be skipped with a warning logged. Remaining valid tables MUST still be loaded. The server SHALL NOT crash.

#### Scenario: One corrupt table skipped

- GIVEN persist state with 3 tables, 1 has malformed matchState
- WHEN StateStore.load() migrates
- THEN the 2 valid tables are loaded with sport assigned; corrupt table is skipped; warning is logged

#### Scenario: All tables fail migration

- GIVEN all tables have malformed matchState
- WHEN StateStore.load() executes
- THEN an empty tables array is returned; warning is logged; server starts cleanly

## MODIFIED Requirements

### Requirement: Persisted Data Completeness

The saved JSON MUST include sufficient state to fully reconstruct tables and matches: table identity (id, number, name), PIN, playerNames, status, createdAt, and matchState. matchState MUST include sport, config, score, setHistory, undo history, swappedSides, midSetSwapped, winner, and match status.
(Previously: matchState did not include a `sport` field.)

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

#### Scenario: Sport field survives restart

- GIVEN a padel match is saved with sport field
- WHEN server restarts and state is restored
- THEN the restored match uses PadelRules for scoring
