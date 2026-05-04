# Delta for Multi-Table System

## ADDED Requirements

### Requirement: MatchConfigModal Overlay

The system MUST render match configuration as a modal overlay (PinModal pattern: backdrop, absolute positioning, Escape dismissal) instead of a full-page panel.

#### Scenario: Modal opens for referee

- GIVEN referee is authenticated on a table with status WAITING or CONFIGURING
- WHEN ScoreboardPage mounts
- THEN MatchConfigModal overlays the scoreboard
- AND backdrop dims the scoreboard content behind it

#### Scenario: Dismiss with Escape

- GIVEN MatchConfigModal is open
- WHEN user presses Escape key
- THEN modal closes and referee returns to hub dashboard

#### Scenario: Dismiss with Cancel button

- GIVEN MatchConfigModal is open
- WHEN user clicks Cancelar
- THEN modal closes and referee returns to hub dashboard

### Requirement: CONFIGURING Visual State

When the MatchConfigModal is open on a table, ScoreboardMain MUST display a CONFIGURING visual indicator (via ScoreboardBar) instead of the dead config panel.

#### Scenario: CONFIGURING state visible

- GIVEN MatchConfigModal is open for a table
- THEN ScoreboardMain renders ScoreboardBar with status badge "CONFIGURING"
- AND no MatchConfigPanel is rendered inside ScoreboardMain

## MODIFIED Requirements

### Requirement: START_MATCH Carries Full Config

The client SHALL send all match configuration (bestOf, handicapA, handicapB, playerNameA, playerNameB) in the START_MATCH payload (Client→Server). The server MUST forward these params to MatchOrchestrator.startMatch() so the MatchEngine is initialized with the referee's chosen values.

(Previously: server START_MATCH handler ignored bestOf/handicap params — always created MatchEngine with hardcoded defaults.)

#### Scenario: bestOf reaches match engine

- GIVEN referee selects bestOf=5 in modal and clicks "Iniciar Partido"
- WHEN client emits START_MATCH with bestOf: 5
- THEN server calls tableManager.startMatch(tableId, {bestOf: 5, ...})
- AND MatchEngine is created with bestOf=5

#### Scenario: Handicap applied at match start

- GIVEN referee sets handicapA=3 in modal and clicks "Iniciar Partido"
- WHEN client emits START_MATCH with handicapA: 3
- THEN server forwards config to MatchOrchestrator
- AND MatchEngine initialScore reflects handicap (A starts at 3)

### Requirement: Match Setup UI

The match setup form MUST render inside a modal overlay with: player name A/B text inputs, best-of button selector (1/3/5), handicap +/− steppers per player (negative values allowed, no floor), and "Iniciar Partido" / "Cancelar" buttons. Points-per-set SHALL be hardcoded to 11 and MUST NOT be shown as a selector.

(Previously: points-per-set was selectable (11/15/21) in full-page panel; handicap had floor at 0; no modal overlay.)

#### Scenario: Handicap allows negative values

- GIVEN handicapA is 0
- WHEN user clicks decrement (−) for handicapA
- THEN handicapA goes to -1 (negative values allowed, no floor)

#### Scenario: Points-per-set not shown

- GIVEN MatchConfigModal is open
- THEN no points-per-set selector (11/15/21) is rendered
- AND pointsPerSet=11 is silently included in START_MATCH payload

## REMOVED Requirements

### Requirement: CONFIGURE_MATCH Client Emission

(Reason: The configureMatch function in useSocketActions.ts is dead code — never called by any component. The CONFIGURE_MATCH event definition in shared/events.ts is preserved on the server but no longer emitted from client.)

### Requirement: ScoreboardMain Internal Config Panel

(Reason: ScoreboardMain.tsx lines 66-83 renders a duplicate, non-functional MatchConfigPanel that neither starts a match nor communicates config to the server. Removed in favor of CONFIGURING visual state text.)

### Requirement: MatchConfigPanel Full-Page Layout

(Reason: Replaced by MatchConfigModal overlay. The organisms/MatchConfigPanel/ component is deprecated and removed.)
