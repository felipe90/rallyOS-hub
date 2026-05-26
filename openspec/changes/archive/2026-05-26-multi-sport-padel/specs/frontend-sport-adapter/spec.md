# frontend-sport-adapter Specification

## Purpose

Frontend Strategy pattern mirroring the backend's `SportRules` interface. A `SportDisplayAdapter` encapsulates all sport-specific UI logic — score computation, component selection, config validation, side-swap extraction — eliminating every `if (isPadel)` branch from the client codebase. Adding a new sport requires only a new adapter implementation + registry registration; existing adapters remain untouched (Open/Closed).

## Requirements

### Requirement: SportDisplayAdapter Interface Contract

The system MUST define a `SportDisplayAdapter` interface that encapsulates all sport-specific frontend behavior. Every sport implementation SHALL implement:

| Method | Returns | Purpose |
|--------|---------|---------|
| `sport` | `Sport` | Sport identifier |
| `computeDisplayData(state, swapped)` | `SportDisplayScore` | Transform MatchStateExtended → UI-ready display data (points, games, sets, AD indicator) |
| `DisplayComponent` | `React.ComponentType<SportDisplayProps>` | The React component that renders this sport's score visual |
| `getCurrentScores(state)` | `{ a: number; b: number }` | Extract the "current scoring unit" values (TT: points, padel: games) for side-swap/display |
| `getServing(state)` | `Player` | Extract the serving player from match state |
| `needsHandicap()` | `boolean` | Whether this sport supports handicap scoring |
| `getConfigDefaults()` | `Partial<MatchConfig>` | Default match configuration parameters |
| `validateConfig(config)` | `string[]` | Validate sport-specific config fields; returns error messages |
| `getConfigFields()` | `ConfigField[]` | Config fields for the MatchConfigModal (name, type, min, max, visible condition) |
| `formatSetHistory(setHistory)` | `FormattedSet[]` | Transform `Score[]` set history into sport-appropriate display format |

#### Scenario: TableTennisDisplayAdapter implements full contract

- GIVEN the `SportDisplayAdapter` interface is defined
- WHEN `TableTennisDisplayAdapter` implements all methods
- THEN `computeDisplayData` returns `{ type: 'tableTennis', leftScore, rightScore, leftSets, rightSets }`
- AND `getCurrentScores` extracts `score.currentSet.{a,b}`
- AND `getServing` extracts `score.serving`
- AND `needsHandicap` returns `true`
- AND `DisplayComponent` is `TTPointDisplay`
- AND `validateConfig` checks `pointsPerSet`, `minDifference`, `handicapA`, `handicapB`
- AND `getConfigFields` returns `pointsPerSet` (number, 1-99), `bestOf` (number, 1-9 odd), `handicapA` (number, 0-20), `handicapB` (number, 0-20)

#### Scenario: PadelDisplayAdapter implements full contract

- GIVEN the `SportDisplayAdapter` interface is defined
- WHEN `PadelDisplayAdapter` implements all methods
- THEN `computeDisplayData` returns `{ type: 'padel', leftPoint: "15"|"30"|"40"|"AD", rightPoint, leftGames, rightGames, leftSets, rightSets }`
- AND `getCurrentScores` extracts `games.{a,b}` (padel's "current scoring unit" is games, not points)
- AND `getServing` extracts top-level `serving`
- AND `needsHandicap` returns `false`
- AND `DisplayComponent` is `PadelPointDisplay`
- AND `validateConfig` checks `tiebreakPoints` (7 or 10), `gamesPerSet` (≥1)
- AND `getConfigFields` returns `gamesPerSet` (number, ≥1), `tiebreakPoints` (select, 7|10), `goldenPoint` (boolean)

#### Scenario: Padel computeDisplayData with advantage

- GIVEN padel match state with `padelPoints: { a: 'AD', b: 40 }`
- WHEN `PadelDisplayAdapter.computeDisplayData(state)` is called
- THEN `leftPoint` is `"AD"` and `rightPoint` is `"40"`

### Requirement: SportDisplayRegistry

A `SportDisplayRegistry` SHALL map `Sport` identifiers to `SportDisplayAdapter` instances. It MUST provide a `resolve(sport)` method that returns the adapter or falls back to `TableTennisDisplayAdapter` for unknown/missing sports.

#### Scenario: Registry resolves padel adapter

- GIVEN `SportDisplayRegistry` is initialized with both adapters
- WHEN `registry.resolve(SPORT.PADEL)` is called
- THEN `PadelDisplayAdapter` instance is returned

#### Scenario: Registry defaults to table tennis for unknown sport

- GIVEN `SportDisplayRegistry` is initialized
- WHEN `registry.resolve('pickleball' as any)` is called
- THEN `TableTennisDisplayAdapter` instance is returned (safe fallback)

#### Scenario: Registry defaults when sport is undefined

- GIVEN a legacy match state with no `sport` field
- WHEN `registry.resolve(undefined)` or `registry.resolve()`
- THEN `TableTennisDisplayAdapter` instance is returned

### Requirement: useSportAdapter Hook

A `useSportAdapter(match)` React hook SHALL resolve the correct `SportDisplayAdapter` from the registry based on `match.sport`. The hook MUST memoize the adapter instance using `useMemo` keyed on `match.sport`.

```typescript
function useSportAdapter(match: MatchStateExtended): SportDisplayAdapter
```

#### Scenario: Hook returns TT adapter for TT match

- GIVEN a table tennis match state with `sport: 'tableTennis'`
- WHEN `useSportAdapter(match)` is called
- THEN the returned adapter's `sport` is `SPORT.TABLE_TENNIS`
- AND `adapter.needsHandicap()` is `true`

#### Scenario: Hook returns padel adapter for padel match

- GIVEN a padel match state with `sport: 'padel'`
- WHEN `useSportAdapter(match)` is called
- THEN the returned adapter's `sport` is `SPORT.PADEL`
- AND `adapter.needsHandicap()` is `false`

#### Scenario: Hook re-memoizes only on sport change

- GIVEN `useSportAdapter` is called with a padel match
- WHEN the match state updates (points change) but `sport` remains `'padel'`
- THEN the same adapter instance reference is returned (no re-creation)

### Requirement: Eliminate Sport Branching in applySideSwap

`applySideSwap()` SHALL accept a `SportDisplayAdapter` parameter instead of internally checking `match.sport === SPORT.PADEL`. All `isPadel ? ... : ...` ternaries MUST be replaced with adapter method calls.

#### Scenario: applySideSwap uses adapter for score extraction

- GIVEN `applySideSwap(match, setsA, setsB, adapter)` with `PadelDisplayAdapter`
- WHEN it computes `leftScore` and `rightScore`
- THEN it calls `adapter.getCurrentScores(match)` — returns `{ a: gamesA, b: gamesB }`
- AND no `isPadel` ternary is evaluated

#### Scenario: applySideSwap uses adapter for serving

- GIVEN `applySideSwap(match, setsA, setsB, adapter)` with `TableTennisDisplayAdapter`
- WHEN it determines `leftServing` and `rightServing`
- THEN it calls `adapter.getServing(match)` — returns `score.serving` from TT state
- AND no `isPadel ? m.serving : m.score?.serving` expression exists

#### Scenario: applySideSwap uses adapter for handicap

- GIVEN `applySideSwap(match, setsA, setsB, adapter)`
- WHEN `adapter.needsHandicap()` returns `false` (padel)
- THEN `leftHandicap` and `rightHandicap` are `undefined`
- WHEN `adapter.needsHandicap()` returns `true` (TT)
- THEN handicap values are extracted from `config.handicapA` / `config.handicapB` (swapped-aware)

### Requirement: Eliminate Sport Branching in useMatchDisplay

`useMatchDisplay()` SHALL compute `sportDisplayScore` via `adapter.computeDisplayData(match)` instead of the `if (isPadel)` branch. Sport-specific config access (e.g., `pointsPerSet`) SHALL come from `adapter.getConfigDefaults()`.

#### Scenario: useMatchDisplay delegates display computation

- GIVEN `useMatchDisplay(match)` with a padel match
- WHEN it computes the return value
- THEN `sportDisplayScore` is set to `adapter.computeDisplayData(match)`
- AND no `if (isPadel && isPadelStateExtended(match))` block exists
- AND no `sportDisplayScore.type = SPORT.PADEL` assignment exists (handled by adapter)

#### Scenario: useMatchDisplay delegates config access

- GIVEN `useMatchDisplay(match)` needs `pointsPerSet` for `determineSetWinner`
- WHEN sport is table tennis
- THEN it reads from `adapter.getConfigDefaults()` or accesses `config` directly via discriminated union
- WHEN sport is padel
- THEN `pointsPerSet` is irrelevant — `determineSetWinner` is only called when applicable

### Requirement: Eliminate Sport Branching in SportDisplaySelector

`SportDisplaySelector` SHALL render `adapter.DisplayComponent` directly instead of the `if (isPadelState(match))` switch. Props SHALL be computed via `adapter.computeDisplayData(match)`.

#### Scenario: SportDisplaySelector renders via adapter

- GIVEN `SportDisplaySelector({ match, ...commonProps })`
- WHEN the component renders
- THEN it calls `const adapter = useSportAdapter(match)`
- THEN it renders `<adapter.DisplayComponent sportDisplay={adapter.computeDisplayData(match)} ...commonProps />`
- AND no `if (isPadelState(match))` or `if (isTableTennisState(match))` branch exists
- AND no `TTPointDisplay` or `PadelPointDisplay` import exists in this file

### Requirement: Eliminate Sport Branching in Validation

`validateMatchConfig()` SHALL dispatch to `adapter.validateConfig(config)` instead of the `if (isTableTennisConfig(config))` branch. The adapter SHALL be resolved from the config's `sport` field.

#### Scenario: Validation delegates to adapter

- GIVEN `validateMatchConfig({ sport: 'padel', tiebreakPoints: 5, gamesPerSet: 0 })`
- WHEN validation runs
- THEN it resolves `PadelDisplayAdapter` and calls `adapter.validateConfig(config)`
- THEN returns errors: `"Tiebreak points must be 7 or 10"` and `"Games per set must be at least 1"`

#### Scenario: Validation defaults to TT adapter for missing sport

- GIVEN `validateMatchConfig({ pointsPerSet: 200 })` with no `sport` field
- WHEN validation runs
- THEN it defaults to `TableTennisDisplayAdapter` and validates `pointsPerSet` (fails: max 99)

### Requirement: Eliminate Sport Branching in ScoreboardBar

`ScoreboardBar` SHALL receive pre-formatted sport-appropriate data instead of raw `match.score` and `match.setHistory` (both typed `any`). The parent SHALL use `adapter.formatSetHistory(setHistory)` to produce display-ready data.

#### Scenario: ScoreboardBar receives formatted data

- GIVEN a padel match with `setHistory: [{a: 6, b: 4}, {a: 3, b: 6}, {a: 6, b: 2}]`
- WHEN `ScoreboardBar` renders
- THEN it receives `formattedSets: [{left: 6, right: 4, label: "Set 1"}, ...]`
- AND no direct access to `match.score` or `match.padelPoints` occurs in ScoreboardBar
- AND the `score` and `setHistory` props are no longer typed `any`

### Requirement: Eliminate Sport Branching in ScoreboardMain

`ScoreboardMain` SHALL use `useSportAdapter(match)` and pass `adapter.formatSetHistory()` to `ScoreboardBar`. It SHALL NOT access `match.score` or `match.setHistory` directly (both TT-specific properties).

#### Scenario: ScoreboardMain delegates to adapter for bar data

- GIVEN `ScoreboardMain({ match, ... })`
- WHEN it renders `ScoreboardBar`
- THEN it calls `adapter.formatSetHistory(match.setHistory)` and passes the result
- AND `match.score` is no longer passed as a prop to ScoreboardBar
- AND `match.setHistory` is no longer passed raw to ScoreboardBar

### Requirement: Eliminate Sport Branching in useScoreboardEvents

`handleStartMatch` SHALL accept a sport-aware config payload. Config fields SHALL be derived from `adapter.getConfigFields()` in the MatchConfigModal, not hardcoded to `{ pointsPerSet, handicapA, handicapB }`.

#### Scenario: Start match payload is sport-aware

- GIVEN a padel match being started
- WHEN `handleStartMatch` is called
- THEN the emitted payload includes `sport: 'padel'`, `tiebreakPoints`, `gamesPerSet`, `goldenPoint`
- AND does NOT include `pointsPerSet`, `handicapA`, or `handicapB`

#### Scenario: Config fields come from adapter

- GIVEN `MatchConfigModal` renders for a padel match
- WHEN it builds the config form
- THEN it calls `adapter.getConfigFields()` which returns `[{ name: 'gamesPerSet', type: 'number', min: 1 }, { name: 'tiebreakPoints', type: 'select', options: [7, 10] }, { name: 'goldenPoint', type: 'boolean' }]`
- AND no sport-specific fields are hardcoded in the modal component

### Requirement: Open/Closed — Adding a New Sport

Adding a third sport (e.g., pickleball) SHALL require ONLY: (1) a `PickleballDisplayAdapter implements SportDisplayAdapter`, (2) registration in `SportDisplayRegistry`, (3) a `PickleballPointDisplay` React component. NO changes to existing adapters, hooks, or components are required.

#### Scenario: Pickleball added without touching existing code

- GIVEN the system has TT and padel adapters working
- WHEN `PickleballDisplayAdapter` is created and registered
- THEN `SportDisplaySelector`, `useMatchDisplay`, `applySideSwap`, `validateMatchConfig`, `ScoreboardBar`, `ScoreboardMain`, and `useScoreboardEvents` all work with pickleball
- AND zero lines of code in existing adapters or components are modified
- AND all existing TT and padel tests continue to pass

### Requirement: Performance — Adapter Instance Reuse

Adapter instances SHALL be created once at module load (singletons) and reused across all match instances. The registry SHALL NOT create new adapter instances per match or per render.

#### Scenario: Same adapter instance for two padel matches on different courts

- GIVEN court 1 and court 2 both have active padel matches
- WHEN `useSportAdapter(match1)` and `useSportAdapter(match2)` are called
- THEN both return the SAME `PadelDisplayAdapter` instance (reference equality)
- AND no new adapter object is allocated per call

### Requirement: TypeScript Type Safety

All adapter methods SHALL be strictly typed. `computeDisplayData` SHALL return the correct `SportDisplayScore` variant for each sport. `getConfigFields` SHALL return `ConfigField[]` with typed `type` discriminant. No method SHALL use `any` in its signature.

#### Scenario: TypeScript narrows SportDisplayScore correctly

- GIVEN `const data = padelAdapter.computeDisplayData(padelState)`
- WHEN accessing `data.leftPoint`
- THEN TypeScript allows it (narrowed to `PadelPointDisplay`)
- WHEN accessing `data.leftScore`
- THEN TypeScript errors (not present on `PadelPointDisplay`)

#### Scenario: ScoreboardBar props are strictly typed

- GIVEN the `ScoreboardBarProps` interface
- THEN `score` prop is removed (no longer needed)
- THEN `setHistory` prop is replaced with `formattedSets: FormattedSet[]`
- AND no `any` type appears in the props interface
