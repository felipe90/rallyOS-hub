# Design: Multi-Sport Support — Padel

## Technical Approach

Strategy Pattern (`SportRules` interface) isolates sport-specific scoring from a thin `MatchEngine` orchestrator. `MatchState` becomes a discriminated union by `sport`. Frontend selects display components via sport discriminator. The `Score` type gains an optional `detailScore` to preserve backward-compat with flat-number consumers. Table→Court rename is interleaved across all phases to minimize the diff surface.

## Architecture Decisions

| # | Decision | Options | Choice | Rationale |
|---|----------|---------|--------|-----------|
| 1 | Scoring isolation | Strategy, Discriminated-unions-switch, Independent-engines | **Strategy Pattern** | Single interface, testable in isolation, adding tennis adds 1 file. Independent engines duplicate infrastructure. Switch-everywhere doesn't scale. |
| 2 | Score type evolution | Full union rewrite, Add `detailScore` alongside flat `Score` | **Add `detailScore`** | Existing ~25 files read `Score.a/b` as numbers. A full union rewrite touches all of them. Adding `detailScore?: SportDetailScore` as an optional field lets padel consumers read it while TT consumers keep reading flat numbers. |
| 3 | MatchState shape | Discriminated union on `sport` inside `score`, Separate top-level variants, Generic `GameState` | **Separate top-level variants: `TableTennisState \| PadelState`** | Different sports have structurally different state (TT has no game nesting; padel has game/point/set hierarchy). A single unified `GameState` would be an awkward superset with many optional fields. |
| 4 | MatchEngine refactor | Rewrite entirely, Extract-TT-first | **Extract TT first** | Creates `TableTennisRules.ts` capturing all existing logic. MatchEngine tests pass unchanged. Then thin orchestrator wraps `SportRules`. |
| 5 | Table→Court rename | Separate PR, Interleaved with refactor | **Interleaved** | Renaming alongside the refactor avoids creating invalid intermediate states (e.g., `tableId` on a padel court). Each file touched once. |
| 6 | Event backward compat | Add `RECORD_SCORE`, Keep `RECORD_POINT` as alias, Replace entirely | **Keep RECORD_POINT, add RECORD_SCORE** | Existing mobile clients emit `RECORD_POINT`. Must not break. New events co-exist; `RECORD_POINT` maps to `recordScore()` internally. |

## Data Flow

### RECORD_POINT → Display

```
Client                Server                   Domain Layer
  │                     │                          │
  ├─RECORD_POINT───────►│                          │
  │                     ├─recordScore('A')────────►│ MatchEngine
  │                     │                          ├─this.rules.recordScore(state,'A')
  │                     │                          │  └─ PadelRules: 0→15, 15→30, ...
  │                     │                          ├─rules.isSetComplete()?
  │                     │                          ├─rules.isMatchComplete()?
  │                     │                          ◄─ new GameState
  │                     ◄─MATCH_UPDATE─────────────┤
  ◄─MATCH_UPDATE────────│                          │
  │                     │                          │
  │ useMatchDisplay:    │                          │
  │  sport==='padel'?   │                          │
  │   →PadelPointDisplay│                          │
  │  sport==='tableTennis'?                        │
  │   →TTPointDisplay   │                          │
```

### Padel Deuce/Advantage State Machine

```
40-40 ──A scores──► AD-A ──A scores──► Game A
  │                   │
  │                   └──B scores──► 40-40
  │
  └──B scores──► AD-B ──A scores──► 40-40
                    │
                    └──B scores──► Game B
```

### Tiebreak Flow

```
6-6 games ──► tiebreak mode ──► first to 7 (or super-tiebreak: first to 10)
                  │
                  └── 2-point lead required ──► Set winner
```

### Persistence Migration

```
StateStore.load()
  ├─ version==1, sport missing ──► auto-set sport='tableTennis'
  ├─ version==2 ──► direct load
  └─ save always writes version=2
```

## Type System Design

```typescript
// ── Sport enum ──
type Sport = 'tableTennis' | 'padel';

// ── Sport rules interface ──
interface SportRules {
  readonly sport: Sport;
  validateConfig(config: SportConfig): boolean;
  recordScore(state: GameState, player: Player): ScoreResult;
  subtractScore(state: GameState, player: Player): GameState;
  isSetComplete(state: GameState): boolean;
  isMatchComplete(state: GameState): boolean;
  formatDisplayScore(state: GameState): SportDisplayScore;
  getDefaultConfig(sport: Sport): SportConfig;
}

// ── Config discriminated union ──
type SportConfig = TableTennisConfig | PadelConfig;
interface TableTennisConfig { sport: 'tableTennis'; pointsPerSet: number; bestOf: number; minDifference: number; handicapA?: number; handicapB?: number; }
interface PadelConfig { sport: 'padel'; bestOf: number; tiebreakPoints: 7 | 10; gamesPerSet: number; goldenPoint?: boolean; }

// ── State discriminated union ──
type GameState = TableTennisGameState | PadelGameState;
interface TableTennisGameState { sport: 'tableTennis'; sets: Score; currentSet: Score; serving: Player; /* existing flat state */ }
interface PadelGameState { sport: 'padel'; sets: Score; currentGame: PadelPointScore; games: Score; serving: Player; isTiebreak: boolean; }

// ── Padel point types ──
type PadelPoint = 0 | 15 | 30 | 40 | 'AD';
type PadelGameScore = { a: PadelPoint; b: PadelPoint; isDeuce: boolean };

// ── ScoreResult: what recordScore returns ──
interface ScoreResult { state: GameState; events: MatchEvent[]; }
// Events can be: { type: 'POINT_SCORED' } | { type: 'DEUCE' } | { type: 'GAME_WON' } | { type: 'TIEBREAK_START' } | { type: 'SET_WON' } | { type: 'MATCH_WON' }

// ── SportDisplayScore: what the frontend receives ──
type SportDisplayScore = TTPointDisplay | PadelPointDisplay;
interface TTPointDisplay { type: 'tableTennis'; leftScore: number; rightScore: number; leftSets: number; rightSets: number; }
interface PadelPointDisplay { type: 'padel'; leftPoint: string; rightPoint: string; leftGames: number; rightGames: number; leftSets: number; rightSets: number; }
```

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `server/src/domain/sports/types.ts` | `SportRules`, `SportConfig`, `GameState`, `SportDisplayScore`, `ScoreResult` |
| `server/src/domain/sports/tableTennis.rules.ts` | Extracted TT logic: `TableTennisRules implements SportRules` |
| `server/src/domain/sports/padel.rules.ts` | Padel scoring: 15-30-40-AD, games, tiebreaks, deuce |
| `server/src/domain/sports/sport.registry.ts` | `{ tableTennis: () => new TableTennisRules(), padel: () => new PadelRules() }` |
| `server/src/domain/sports/tableTennis.rules.test.ts` | Extracted tests (matches existing suite) |
| `server/src/domain/sports/padel.rules.test.ts` | Padel scoring tests: point progression, deuce, tiebreak |
| `server/src/domain/sports/sport.registry.test.ts` | Registry lookup and factory tests |
| `client/src/components/molecules/TTPointDisplay.tsx` | Large-number display (current PlayerScoreArea extracted) |
| `client/src/components/molecules/PadelPointDisplay.tsx` | Game+15-30-40-AD+set indicator display |
| `server/src/services/store/migration.ts` | `migrateV1toV2(state: PersistedState): PersistedState` |

### Modified Files

| File | Change | Rationale |
|------|--------|-----------|
| `shared/types.ts` | Add `Sport`, `SportConfig` union, `PadelPointScore`, `MatchEvent` union extended | API contract for sport-aware types |
| `shared/events.ts` | Add `GAME_WON`, `TIEBREAK_START`, `DEUCE` to `SERVER`; add `RECORD_SCORE` to `CLIENT` | New event types |
| `server/src/domain/types.ts` | Import new shared types; `Table.matchEngine` → `Table.sportRules: SportRules` (keeps `matchEngine` delegating) | Server internal wiring |
| `server/src/domain/matchEngine.ts` | Becomes thin orchestrator: delegates to `this.rules`; `fromState()` detects sport via `state.sport` | Core refactor |
| `server/src/domain/tableManager.ts` | `createTable()` accepts `sport`; `recordPoint()` calls `engine.recordScore()` | Sport-aware table lifecycle |
| `server/src/services/table/MatchOrchestrator.ts` | `startMatch()` selects engine from registry by sport; passes `SportConfig` | Sport-aware engine creation |
| `server/src/services/store/types.ts` | `PersistedMatchState` gains `sport: Sport`; `PersistedState.version` → `2` | Migration schema |
| `server/src/services/store/StateStore.ts` | `load()` calls `migrateV1toV2()`; `save()` writes `version: 2` | Auto-migration |
| `server/src/handlers/MatchEventHandler.ts` | `START_MATCH`/`CONFIGURE_MATCH` accept `sport` field; `RECORD_POINT` maps to `recordScore` | Sport-aware socket handling |
| `client/src/hooks/useMatchDisplay/` | Returns `SportDisplayScore` discriminated union; computes from `MatchState.sport` | Sport-aware display data |
| `client/src/components/organisms/ScoreboardMain/` | Renders `SportDisplaySelector` → `TTPointDisplay \| PadelPointDisplay` | Rendering switch |
| `client/src/components/molecules/MatchConfigModal/` | Sport dropdown; conditional handicap/tiebreak fields | Sport-aware config UI |
| `client/src/components/molecules/MatchContext/` | Dynamic labels: "pts/set" vs "games/set" | Sport-aware terminology |
| `client/src/services/match/determineWinner.ts` | `determineSetWinner` accepts `sport` parameter | Sport-conditional logic |

### Table→Court Rename (interleaved)

| Order | Files | Approach |
|-------|-------|----------|
| 1 | `shared/types.ts`, `shared/events.ts` | `TableInfo`→`CourtInfo`, `TABLE_UPDATE`→`COURT_UPDATE`, etc. Keep socket event string values unchanged (wire compat). |
| 2 | `server/src/domain/types.ts` | `Table`→`Court`, `TableStatus`→`CourtStatus` (type alias: `type Table = Court` for legacy imports) |
| 3 | `server/src/domain/tableManager.ts`→`courtManager.ts` | Rename file; update all internal refs |
| 4 | `server/src/handlers/` | Update type refs; socket event string values unchanged |
| 5 | `client/src/` | `tableName`→`courtName`, `TableStatusChip`→`CourtStatusChip` |
| 6 | Remove legacy aliases | After all consumers migrated |

## Persistence Migration

```typescript
// server/src/services/store/migration.ts
function migrateV1toV2(state: PersistedState): PersistedState {
  if (state.version >= 2) return state;
  return {
    ...state,
    version: 2,
    tables: state.tables.map(t => ({
      ...t,
      matchState: {
        ...t.matchState,
        sport: (t.matchState as any).sport || 'tableTennis',
        config: { ...t.matchState.config, sport: 'tableTennis' },
      }
    }))
  };
}
```

- **Trigger**: `StateStore.load()` calls migration unconditionally before returning.
- **Error handling**: If migration fails on one table, log warning and skip it; load succeeds with remaining tables.
- **Rollback**: Remove `sport` and `config.sport` fields, set version back to 1. One-line script.

## Frontend Component Tree

```
ScoreboardMain
├─ ScoreboardBar (set history, court name, status)
├─ SportDisplaySelector  ← NEW: switches by match.state.sport
│   ├─ TTPointDisplay (extracted from PlayerScoreArea)
│   │   └─ AnimatePresence number flip
│   └─ PadelPointDisplay
│       ├─ GameIndicator: "Games: 3-2"
│       ├─ PointDisplay: "30-40" or "AD-A"
│       └─ SetIndicators: filled circles
├─ VSDivider (unchanged)
├─ MatchHistoryTicker (formatEvent detects sport)
└─ MatchConfigModal
    ├─ Sport Dropdown: "Table Tennis" | "Padel"
    ├─ [sport=='tableTennis']: handicap +/- controls
    └─ [sport=='padel']: tiebreak selector (7pt / 10pt), golden-point toggle
```

## Test Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit — TT rules | Extracted `TableTennisRules` | Move existing `matchEngine.test.ts` scenarios into `tableTennis.rules.test.ts`. Preserves all 187 assertions. |
| Unit — Padel rules | `PadelRules` scoring, deuce, tiebreak | `padel.rules.test.ts`: point progression (0→15→30→40→Game), deuce cycles (40-40⇄AD), tiebreak completion, set/match win. |
| Unit — Registry | `sport.registry.ts` | `sport.registry.test.ts`: lookup by sport, factory creates correct rules, unknown sport throws. |
| Unit — Migration | `migration.ts` | `migration.test.ts`: v1→v2 transforms sport field, version bump, idempotency. |
| Integration — MatchEngine | Orchestrator delegates to rules | Existing `matchEngine.test.ts` refactored: test through MatchEngine but assert against TT rules behavior. |
| Frontend — Display | `PadelPointDisplay` renders correct points | RTL test: render with mock padel state, assert "30-40" visible, AD indicator, game counter. |
| Frontend — Config | `MatchConfigModal` sport selector | RTL test: select padel, assert handicap fields hidden, tiebreak selector visible. |
| E2E — Full flow | Create padel match, score, complete | Playwright: configure padel match, record points through game, set, match end. |

**Preservation**: TT test suite must pass identically after extraction. `MatchEngine` tests wrap the thin orchestrator. No TT behavior changes.

## Migration / Rollout

1. **Phase 1**: Extract `TableTennisRules`, refactor `MatchEngine` to delegate. All tests pass. No user-visible change.
2. **Phase 2**: Add `PadelRules`, registry, sport-aware types. Padel match creation functional but non-blocking (behind sport selector).
3. **Phase 3**: Table→Court rename, persistence migration, frontend display components.
4. **Rollback**: Remove padel from registry (`sport.registry.ts`). MatchEngine remains functional for TT. Revert `PadelPointDisplay` import in `ScoreboardMain`. Drop `sport` field from saved state.

## Open Questions

- [ ] Does padel use golden-point (no-advantage) scoring? Affects `PadelConfig.goldenPoint`.
- [ ] Is the super-tiebreak (10pt) for 3rd set always used or configurable?
- [ ] Kiosk scoreboard: sport-aware rendering? (Out of scope per proposal but affects design if needed soon.)
