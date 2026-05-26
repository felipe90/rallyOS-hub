# Exploration: Multi-Sport Support — Padel as Second Sport

## Current State

### Scoring Model: Deeply Coupled to Point-Based Scoring

The entire codebase assumes a **flat point-counter** scoring model. There is no concept of games, tiebreaks, or hierarchical scoring (point → game → set → match).

**Shared Types (`shared/types.ts`)**:
- `Score` is `{ a: number; b: number }` — a single flat counter. No nesting.
- `MatchConfig` has `pointsPerSet`, `bestOf`, `minDifference`, `handicapA/B`, `initialScore`, `initialServer`. All table-tennis-specific (handicap, initialServer, minDifference=2 deuce).
- `MatchState.score` is `{ sets: Score, currentSet: Score, serving: Player }`. `sets` counts sets won (0-2), `currentSet` is current point count (0-11+). No concept of games-within-sets.
- `MatchEvent` is `SET_WON | MATCH_WON`. No `GAME_WON` event.
- `ScoreChange.action` is `'POINT' | 'CORRECTION' | 'SET_WON'`. No game-level actions.
- `TableInfo.currentScore` and `currentSets` are both `Score | undefined` — assumes single flat score display.

**Server MatchEngine (`server/src/domain/matchEngine.ts`)**:
- `recordPoint()` increments `currentSet.a++` or `currentSet.b++` — a single counter.
- `checkSetWin()` tests `a >= pointsPerSet && abs(a-b) >= minDifference` — threshold-based, not game-based.
- `updateServing()` rotates serve every 2 points (or every 1 in deuce at 10-10). No per-game serve rotation.
- `checkSideSwap()` is ITTF-specific (swap at 5 points in final set).
- `subtractPoint()` decrements the counter — works for flat scores but not for 15-30-40-Game.
- `MatchEngine.fromState()` reconstructs from flat score state.
- `MatchOrchestrator.startMatch()` creates `new MatchEngine({ pointsPerSet: 11, bestOf: 3, minDifference: 2, ... })`.
- `MatchOrchestrator.resetTable()` creates `new MatchEngine(config)` with same point-based config.
- The `PersistedTable.matchState` serializes `MatchState` including the flat `Score` — any nested scoring would require migration.

**Server persistence (`server/src/services/store/types.ts`)**:
- `PersistedMatchState extends MatchState` with `history: ScoreChange[]`. Directly depends on the flat scoring model.

### Frontend: Point Number Display Only

**ScoreboardMain**:
- `PlayerScoreArea` renders a single large integer: `{displayScore}` (font size `clamp(14rem,30vw,26rem)`). No room for "15-30-40" text. 
- `useMatchDisplay` computes `leftScore: number, rightScore: number` — single flat numbers from `currentSet.a/b`.
- `applySideSwap` swaps `currentSet.a` and `currentSet.b` — assumes flat number scores.
- `determineSetWinner(scoreA, scoreB, pointsPerSet)` — threshold-based, no game detection.
- `MatchContext` shows `{pointsPerSet} pts/set` — point terminology hardcoded in UI.

**ScoreboardBar & ScoreboardSidebar**:
- `SetScore` component shows set history as `scoreA - scoreB` pairs — works for any scoring, but labeled with `#` + set number.
- `setHistory` is `Score[]` (flat pair arrays).

**MatchConfigModal**:
- Only offers `bestOf` as 1/3/5 and `handicapA/B`. No sport selection.
- Labels are hardcoded: "Mejor de", "Handicap", "pts/set".

**MatchHistoryTicker & Event Formatting**:
- `formatEvent()` treats `SET_WON`, `POINT`, `CORRECTION` — no `GAME_WON` or sport-specific actions.
- History events always show point-level scores: `{scoreA} - {scoreB}`.

### Socket Events: Point-Based Terminology

- `RECORD_POINT`, `SUBTRACT_POINT` — event names use "point" language.
- `CONFIGURE_MATCH` payload: `{ tableId, playerNames, format (bestOf), ptsPerSet, handicap }`.
- `START_MATCH` payload: `{ tableId, pointsPerSet, bestOf, handicapA, handicapB, playerNameA, playerNameB }`.
- `SET_WON` and `MATCH_WON` — no `GAME_WON` event exists in `SocketEvents.SERVER`.
- `MATCH_UPDATE` broadcasts `MatchState` to the table room.

### What IS Sport-Agnostic

- **Table management**: `TableManager`, `TableRepository`, `PlayerService`, `PinService`, `QRService` — none have sport-specific logic.
- **Socket infrastructure**: room-based broadcasting, auth, rate limiting — all sport-agnostic.
- **Multi-table dashboard**: `DashboardGrid`, `TableStatusChip`, `StatCard` — don't depend on scoring details.
- **Kiosk notifications**: generic.
- **i18n system**: already supports translations.
- **Side swapping**: could be adapted (padel has different swap rules but the concept exists).
- **Player names, table IDs, PINs, QR codes**: fully generic.

## Affected Areas

| File/Module | Why It Must Change |
|---|---|
| `shared/types.ts` | `Score`, `MatchConfig`, `MatchState`, `MatchEvent`, `ScoreChange`, `TableInfo` — all assume flat point scoring. Need sport-agnostic or union types. |
| `server/src/domain/matchEngine.ts` | Core scoring engine: `recordPoint`, `checkSetWin`, `updateServing`, `checkSideSwap`, `subtractPoint` — all point-based. Needs strategy pattern or split. |
| `server/src/domain/matchEngine.test.ts` | All tests are point-counting scenarios. |
| `server/src/domain/types.ts` | `Table.matchEngine` is typed to `MatchEngine` only. Needs to accept sport-specific engines. |
| `server/src/services/table/MatchOrchestrator.ts` | `startMatch` creates `MatchEngine` with point params. `resetTable` same. Needs sport-aware engine selection. |
| `server/src/services/store/types.ts` | `PersistedMatchState extends MatchState` — any scoring model change breaks persistence. Needs migration strategy. |
| `server/src/handlers/MatchEventHandler.ts` | `CONFIGURE_MATCH`, `START_MATCH` payloads are point-specific. `RECORD_POINT`/`SUBTRACT_POINT` event names. |
| `shared/events.ts` | `RECORD_POINT`, `SUBTRACT_POINT` event names. No `GAME_WON`, `TIEBREAK_START` events. |
| `client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx` | Passes flat `leftScore`/`rightScore` numbers from `useMatchDisplay`. |
| `client/src/components/organisms/ScoreboardMain/components/PlayerScoreArea.tsx` | Renders single large integer. Props: `score: number`. Must support text-based scores (15-30-40-AD). |
| `client/src/components/organisms/ScoreboardMain/components/ScoreboardBar.tsx` | Shows set history with currentSet score — needs game-level display for padel. |
| `client/src/hooks/useMatchDisplay/useMatchDisplay.ts` | Computes `leftScore: number, rightScore: number` from flat `currentSet`. Must compute hierarchical display. |
| `client/src/hooks/useMatchDisplay/useMatchDisplay.types.ts` | `MatchDisplayState` has `leftScore: number`. Needs nested score representation. |
| `client/src/services/match/determineWinner.ts` | `determineSetWinner(scoreA, scoreB, pointsPerSet)` — threshold-based, not game-based. |
| `client/src/services/match/applySideSwap.ts` | Swaps flat `currentSet.a/b` as numbers. |
| `client/src/services/match/calculateSets.ts` | Counts sets from `setHistory: Score[]`. Works for any sport but `Score` type changes. |
| `client/src/services/match/formatEvent.ts` | Formats `SET_WON`, `POINT`, `CORRECTION` — no game-level events. |
| `client/src/components/molecules/MatchConfigModal/MatchConfigModal.tsx` | Only `bestOf` (1/3/5), `handicapA/B`. No sport selection, no padel-specific config. |
| `client/src/components/molecules/MatchContext/MatchContext.tsx` | Shows `{pointsPerSet} pts/set` — point-specific label. |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | `handleStartMatch` passes `{ pointsPerSet: 11 }`. Submits flat config. |

## Approaches

### Approach 1: Strategy Pattern — Sport Rules Interface

Define a `SportRules` interface that encapsulates all sport-specific behavior. `MatchEngine` delegates to the active rules strategy. Separate `TableTennisRules` and `PadelRules` implementations. The UI uses sport-specific score display components selected by sport type.

**Core abstraction**:
```typescript
interface SportRules {
  sport: Sport;
  validateConfig(config: SportConfig): boolean;
  recordScore(state: GameState, player: Player): GameState;
  isSetComplete(state: GameState): boolean;
  isMatchComplete(state: GameState): boolean;
  formatScoreForDisplay(state: GameState): SportDisplayScore;
  getDefaultConfig(): SportConfig;
}
```

**Pros**:
- Clean separation of sport logic — adding tennis, badminton, squash means implementing one interface.
- MatchEngine doesn't need to know about individual sports — it delegates to the strategy.
- Each sport's rules can be tested in isolation.
- Sport-specific config types stay type-safe via discriminated unions.
- Persistence can serialize the sport identifier alongside config/state.

**Cons**:
- Higher initial design effort — the `SportRules` interface must be flexible enough for fundamentally different scoring models.
- UI still needs sport-specific components (15-30-40 display vs large number display).
- Migration of existing `PersistedTable` state needs versioning.
- The `Score` type must become generic or sport-aware, which propagates to all event types.

**Effort**: High (2-3 weeks for full implementation with tests)

### Approach 2: Discriminated Union + Inline Switching

Keep the current architecture but make every affected type a discriminated union by `sport`. Switch on `sport` everywhere — in the engine, in the UI, in events.

```typescript
type MatchConfig = TableTennisConfig | PadelConfig;
type MatchState = TableTennisState | PadelState;
```

**Pros**:
- Familiar pattern, no new abstraction layer.
- TypeScript discriminated unions give good type narrowing.
- Less upfront design — start coding immediately.

**Cons**:
- Every `switch(sport)` becomes a maintenance burden — adding tennis means finding every switch.
- `MatchEngine` becomes a god class with mixed logic.
- UI components grow `if (sport === 'padel')` branches everywhere.
- Poor extensibility — each new sport is a PR that touches 15+ files.
- Difficult to test sport-specific logic in isolation.
- Type narrowing can be verbose in deeply nested code.

**Effort**: Medium initially, but grows with each sport.

### Approach 3: Independent MatchEngines + Shared Table Infrastructure

Create a completely separate `PadelMatchEngine` class and select which engine to use at table creation time. Keep the existing `MatchEngine` (could be renamed `TableTennisMatchEngine`) and the rest of the infrastructure (table management, sockets, auth) shared.

**Pros**:
- No risk of breaking existing table tennis scoring.
- Can be developed and tested entirely independently.
- Each engine is free to use its own internal state representation.
- Clear ownership — TT bugs don't affect padel.

**Cons**:
- Duplication — both engines need `fromState()`, `getState()`, similar infrastructure.
- The Table type (`matchEngine: MatchEngine`) needs to accept multiple types.
- Socket events must work with two different state shapes.
- Persistence must handle two different serialization formats.
- UI must still handle two rendering paths — the `MatchState` type would be a union anyway.
- More code to maintain overall.

**Effort**: Medium-High (less design, more implementation)

## Recommendation

**Approach 1 (Strategy Pattern) with a hybrid of Approach 3 for the display layer.**

### Architecture Outline

1. **Core abstraction — `SportRules` interface** lives in a new `server/src/domain/sports/` directory:
   - `types.ts`: shared sport interfaces (`SportConfig`, `GameState`, `SportRules`, `SportDisplayScore`)
   - `tableTennis.rules.ts`: existing scoring logic extracted
   - `padel.rules.ts`: new padel scoring
   - `sport.registry.ts`: map of sport ID → rules factory

2. **MatchEngine refactor**:
   - `MatchEngine` becomes a thin orchestrator that delegates to `SportRules`.
   - State shapes become sport-specific (`TableTennisState`, `PadelState`) but share a common `MatchLifecycle` interface (start, record, undo, getDisplayState).
   - `MatchState` becomes a discriminated union: `{ sport: 'tableTennis'; ... } | { sport: 'padel'; ... }`.

3. **Shared types (`shared/types.ts`)**:
   - `Score` becomes a union type or a generic `SportScore`.
   - `MatchConfig` becomes sport-aware: `{ sport: Sport; config: SportConfig }`.
   - `MatchEvent` adds `GAME_WON`, `TIEBREAK_START`, `DEUCE`.
   - `ScoreChange` adds `action: 'GAME_WON' | 'TIEBREAK_POINT'`.
   - Backward-compatible: existing clients receiving `MatchState` with no `sport` field default to `'tableTennis'`.

4. **Socket events**:
   - Keep existing `RECORD_POINT` → maps to `recordScore()` generically.
   - Add `RECORD_SCORE` as a sport-agnostic name; deprecate `RECORD_POINT` (keep for backward compat).
   - Add `GAME_WON` event alongside existing `SET_WON`, `MATCH_WON`.
   - `CONFIGURE_MATCH` adds optional `sport` field (defaults to `'tableTennis'`).

5. **Frontend display**:
   - **Score display**: The `ScoreboardMain` receives `MatchState` (union). A sport-aware wrapper selects the correct display component:
     - `TTPointDisplay`: current large-number design (0-11+)
     - `PadelPointDisplay`: game counter + 15-30-40-AD text within current game
   - `useMatchDisplay` returns sport-specific display data (discriminated union on `sport`).
   - `MatchConfigModal` gains a "Sport" dropdown (Table Tennis / Padel) with sport-conditional config fields.
   - `MatchContext` adapts labels: "pts/set" → "games/set" for padel.

6. **Persistence migration**:
   - `PersistedMatchState` gains `sport: Sport` field.
   - `StateStore.load()` auto-migrates: if no `sport` field, treats as `'tableTennis'`.
   - New version: `version: 2` in `PersistedState`.

### Why this approach

- The scoring models are **fundamentally different structures** — not just different parameters. Padel's hierarchical (point→game→set→match) vs TT's flat (points→set→match) won't fit in the same code path.
- Strategy pattern isolates differences where they matter (rules engine) while keeping shared infrastructure (table management, auth, persistence) untouched.
- The display layer naturally needs different components per sport — there's no way around that. The discriminator at the top (in `ScoreboardMain`) keeps the branching contained.
- Adding tennis (same scoring model as padel but different set structure) becomes adding a `TennisRules` class — regression risk is contained to one file plus its tests.

## Risks

- **Score type propagation**: Changing `Score` from `{ a: number; b: number }` to a union will touch every file that reads scores. Scope is ~25 files. Mitigation: keep `Score` but add an additional `detailScore` field for hierarchical sports; existing code continues to read the flat `Score` for set-level display.
- **Persistence backward compatibility**: Existing saved tournament data won't have a `sport` field. Must auto-migrate in `StateStore.load()`. If migration fails, the tournament data is lost.
- **Test coverage regression**: The existing `matchEngine.test.ts` is thorough for TT. The refactor must preserve this coverage while adding padel coverage. Risk: if we rewrite rather than extract, we lose test safety.
- **Socket event compatibility**: Existing mobile clients may send `RECORD_POINT` events. Must continue to handle them. New `RECORD_SCORE` must coexist.
- **UI complexity**: Padel score display (games + 15-30-40-AD) is fundamentally different from TT's large single number. The `PlayerScoreArea` component cannot be simply parametrized — it needs a sibling component. This doubles the UI's score rendering surface area.
- **Side-swap rules differ**: Padel has different side-swap rules than ITTF. The `checkSideSwap` logic and `swappedSides`/`midSetSwapped` state must be sport-aware.
- **Deuce/Advantage**: Neither the engine nor the UI has any concept of "deuce" (40-40) or "advantage" (AD). This is entirely new state that must be represented, displayed, and undo-able.

## Key Unknowns

1. **Does padel allow handicap scoring?** If not, the handicap config fields should be hidden/disabled for padel. Needs clarification from the user.
2. **Padel serve rotation rules**: In padel, serve changes each game (not every 2 points). Does `serving` state matter for padel display or is it irrelevant?
3. **Tiebreak details**: Padel uses a 7-point tiebreak at 6-6. Does it use the "Super Tiebreak" (10 points) for the 3rd set in some formats? Need clarification.
4. **Doubles consideration**: Padel is always doubles (2v2). Current system has `playerNames: { a, b }` — is this sufficient for doubles or do we need 4 player names?
5. **Kiosk display**: The kiosk notification system announces match winners. Does the kiosk scoreboard view also need sport-specific rendering?

## Ready for Proposal

**Yes.** The exploration has identified all affected areas, the fundamental architectural mismatch (flat vs hierarchical scoring), and a clear recommended approach. The next step is `sdd-propose` to formalize scope, approach, and rollback plan.

The biggest architectural decision that needs user input before proposal:
- **Should padel support doubles player names (4 players) or stay with 2-sided naming?** Padel is always doubles. If we need 4 names, that affects the `playerNames` type, the config modal, and the display.
