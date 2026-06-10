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

`MatchConfig` and `MatchState` SHALL be true discriminated unions keyed by `sport`. `Score` SHALL use an additive `detailScore` field for sport-specific data, preserving the flat `{a, b}` shape for backward compatibility with ~25 consumers.

#### Design: MatchConfig

```typescript
// Shared base — fields common to all sports
interface MatchConfigBase {
  bestOf: number;
  initialScore?: Score;
  initialServer?: Player;
}

interface TableTennisMatchConfig extends MatchConfigBase {
  sport: 'tableTennis';
  pointsPerSet: number;
  minDifference: number;
  handicapA?: number;
  handicapB?: number;
}

interface PadelMatchConfig extends MatchConfigBase {
  sport: 'padel';
  tiebreakPoints: 7 | 10;
  gamesPerSet: number;
  goldenPoint?: boolean;
}

export type MatchConfig = TableTennisMatchConfig | PadelMatchConfig;
```

#### Design: MatchState

```typescript
interface MatchStateBase {
  config: MatchConfig;
  status: CourtStatus;
  winner: Player | null;
  swappedSides: boolean;
  midSetSwapped: boolean;
}

interface TableTennisMatchState extends MatchStateBase {
  sport: 'tableTennis';
  score: { sets: Score; currentSet: Score; serving: Player };
  setHistory: Score[];
}

interface PadelMatchState extends MatchStateBase {
  sport: 'padel';
  gamePoints: { a: PadelPoint; b: PadelPoint };
  games: { a: number; b: number };
  sets: { a: number; b: number };
  isTiebreak: boolean;
  tiebreakPoints: { a: number; b: number };
  tiebreakTarget: 7 | 10;
  goldenPoint: boolean;
  serving: Player;
  setHistory: Score[];
}

export type MatchState = TableTennisMatchState | PadelMatchState;
```

#### Design: MatchStateExtended

`MatchStateExtended` adds runtime fields (tableId, history) on top of the union using an intersection:

```typescript
export type MatchStateExtended = MatchState & {
  tableId: string;
  tableName: string;
  playerNames: { a: string; b: string };
  history: ScoreChange[];
  undoAvailable: boolean;
};
```

TypeScript distributes the intersection over the union: `(TT | Padel) & Extra` becomes `(TT & Extra) | (Padel & Extra)`. Consumers access common fields directly; sport-specific fields require a type guard.

#### Design: Type Guard Helpers

```typescript
export function isTableTennisConfig(c: MatchConfig): c is TableTennisMatchConfig {
  return c.sport === 'tableTennis' || !('sport' in c);
}

export function isPadelConfig(c: MatchConfig): c is PadelMatchConfig {
  return c.sport === 'padel';
}

export function isTableTennisState(s: MatchState): s is TableTennisMatchState {
  return s.sport === 'tableTennis';
}

export function isPadelState(s: MatchState): s is PadelMatchState {
  return s.sport === 'padel';
}
```

#### Design: Score (additive approach)

`Score` keeps the flat `{a, b}` shape for backward compat with ~25 consumers. Sport-specific display data lives in `detailScore`:

```typescript
export interface Score {
  a: number;
  b: number;
  detailScore?: SportDisplayScore;
}
```

For TT: `a` and `b` are points (0-11+), `detailScore` is undefined.
For padel: `a` and `b` are games (0-6+), `detailScore` has `PadelPointDisplay` with the 15-30-40-AD data.

This avoids changing every `score.a` / `score.b` accessor across the codebase while supporting sport-specific rendering.

#### Scenario: Backward-compatible MatchState deserialization

- GIVEN a socket message contains `MatchState` with no `sport` field
- WHEN client receives and parses it
- THEN it treats the state as `TableTennisMatchState` with flat `Score`

#### Scenario: Padel MatchState transmission

- GIVEN an active padel match
- WHEN `MATCH_UPDATE` broadcasts state
- THEN payload includes `sport: 'padel'`, `games`, `gamePoints`, and hierarchical score structure

#### Scenario: Consumer reads score across sports

- GIVEN a consumer that only needs set-level scores (e.g., set history bar)
- WHEN it reads `matchState.setHistory`
- THEN it receives `Score[]` with flat `{a, b}` regardless of sport — no type guard needed
- WHEN it needs padel-specific display (15-30-40-AD)
- THEN it uses `isPadelState(matchState)` guard before accessing `gamePoints`

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
