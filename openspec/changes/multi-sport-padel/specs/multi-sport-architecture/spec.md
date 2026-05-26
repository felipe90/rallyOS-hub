# multi-sport-architecture Specification

## Purpose

Pluggable sport architecture using Strategy pattern. MatchEngine delegates scoring to sport-specific rules. Discriminated union types enable multiple sports while preserving backward compatibility with existing table tennis.

## Requirements

### Requirement: SportRules Interface Contract

The system MUST define a `SportRules` interface that encapsulates all sport-specific scoring behavior. Every sport implementation SHALL implement:

| Method | Returns | Purpose |
|--------|---------|---------|
| `sport` | `Sport` (string union) | Sport identifier |
| `recordScore(state, player)` | `SportScoreState` | Score a point for `player` |
| `subtractScore(state, player)` | `SportScoreState` | Undo a point for `player` |
| `isGameComplete(state)` | `boolean` | Current game/set finished? |
| `isMatchComplete(state)` | `boolean` | Match finished? |
| `getDisplayScore(state)` | `SportDisplayScore` | UI-ready score representation |
| `getDefaultConfig()` | `SportConfig` | Default match parameters |
| `needsHandicap()` | `boolean` | Supports handicap scoring? |
| `checkSideSwap(state)` | `boolean` | Should sides swap now? |
| `updateServing(state)` | `Player` | Next server after point |

#### Scenario: TableTennisRules implements full contract

- GIVEN the `SportRules` interface is defined
- WHEN `TableTennisRules` implements all methods
- THEN existing point-based scoring (11pt, best-of-3, 2pt deuce) behaves identically to current MatchEngine

#### Scenario: PadelRules implements full contract

- GIVEN the `SportRules` interface is defined
- WHEN `PadelRules` implements all methods
- THEN 15-30-40-AD hierarchical scoring is available via the same interface

### Requirement: MatchEngine Delegation

`MatchEngine` MUST delegate scoring, side-swap, and serving logic to the active `SportRules` instance. It SHALL remain the authoritative state container and undo-history manager.

#### Scenario: MatchEngine delegates recordPoint

- GIVEN MatchEngine is configured with TableTennisRules
- WHEN `recordPoint('A')` is called
- THEN MatchEngine calls `tableTennisRules.recordScore(state, 'A')` and updates its state from the result

#### Scenario: MatchEngine delegates side swap check

- GIVEN MatchEngine is configured with PadelRules
- WHEN a point is recorded and `padelRules.checkSideSwap(state)` returns true
- THEN MatchEngine swaps `swappedSides` in its state

### Requirement: Sport Registry

A `SportRegistry` SHALL map sport identifiers to `SportRules` implementations. `MatchOrchestrator` MUST select the rules from the registry at match creation via `START_MATCH`.

#### Scenario: Sport selection via START_MATCH

- GIVEN `CONFIGURE_MATCH` payload includes `sport: 'padel'`
- WHEN `START_MATCH` fires
- THEN MatchOrchestrator retrieves `PadelRules` from registry and creates MatchEngine with it

#### Scenario: Default sport is table tennis

- GIVEN `CONFIGURE_MATCH` payload has no `sport` field
- WHEN `START_MATCH` fires
- THEN MatchOrchestrator defaults to `TableTennisRules`

### Requirement: Discriminated Union Type System

`MatchConfig`, `MatchState`, and `Score` SHALL become discriminated unions keyed by `sport`. Legacy consumers receiving state with no `sport` field MUST default to `'tableTennis'`.

#### Scenario: Backward-compatible MatchState deserialization

- GIVEN a socket message contains `MatchState` with no `sport` field
- WHEN client receives and parses it
- THEN it treats the state as `TableTennisState` with flat `Score`

#### Scenario: Padel MatchState transmission

- GIVEN an active padel match
- WHEN `MATCH_UPDATE` broadcasts state
- THEN payload includes `sport: 'padel'` and hierarchical score structure

### Requirement: Sport Plugin Contract

Adding a new sport SHALL require only: (1) a `SportRules` implementation, (2) registration in `SportRegistry`, (3) a sport-specific display component. No changes to MatchEngine, socket infrastructure, or table management are needed.

#### Scenario: Adding a third sport

- GIVEN tennis rules need to be added
- WHEN only `TennisRules implements SportRules` + registry registration + `TennisPointDisplay` component are created
- THEN tennis matches are fully functional without touching MatchEngine or socket events

### Requirement: Table → Court Rename (Cross-Cutting)

All UI labels and types SHALL use "court" (cancha) instead of "table" (mesa). The `Table` type MAY remain as alias. Socket event wire names (TABLE_UPDATE, etc.) are excluded.

#### Scenario: UI uses court

- GIVEN MatchConfigModal
- THEN all labels reference "court", not "table"
