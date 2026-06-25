# Delta Spec for kiosk-set-display

## ADDED Requirements

### Requirement: Kiosk Point Display Layout

`KioskPointDisplay` MUST render a TV-readable scoreboard for featured matches. The main score area shows large left/right score digits with player names above each digit and center panels showing the sets won by each side (`leftSets` / `rightSets`). Score digit panels, set-count panels, and the set-history strip MUST use the dark primary green (`--color-primary` / `#006b5f`) as background. The page-level background of the kiosk fullscreen view MUST use the light primary green (`--color-primary-light` / `#00897b`). Score digits and set counts MUST be white. Below the main score area, a TV-style set-history strip shows one row per player with columns for each finished set only (no current-set column). The visualization MUST be sport-adaptive (table tennis vs padel).

#### Scenario: Table tennis kiosk display

- GIVEN a featured table-tennis match
- WHEN `KioskScoreboard` renders
- THEN `KioskPointDisplay` shows large left and right point digits
- AND center panels show `leftSets` and `rightSets`
- AND a TV-style set-history strip appears below the main score area
- AND the strip shows one row per player with columns for each finished set only

#### Scenario: Player names visible and larger

- GIVEN a featured match with players named "A" and "B"
- WHEN `KioskPointDisplay` renders
- THEN both names are visible above their score digit
- AND name typography is larger than the previous `text-3xl` size
- AND the name text is not visually clipped (e.g., descenders remain visible)

### Requirement: Kiosk Serving Indicator

`KioskPointDisplay` MUST render a visual serving indicator next to the player who is currently serving. The indicator MUST use the app's amber/yellow accent color for consistency with the referee scoreboard.

#### Scenario: Left player is serving

- GIVEN a featured match where the left player is serving
- WHEN `KioskPointDisplay` renders
- THEN a serving indicator appears near the left player's name or score
- AND the indicator uses the amber/yellow accent color

#### Scenario: Right player is serving

- GIVEN a featured match where the right player is serving
- WHEN `KioskPointDisplay` renders
- THEN a serving indicator appears near the right player's name or score
- AND the indicator uses the amber/yellow accent color

#### Scenario: Side-swap correctness

- GIVEN a featured match with `swappedSides=true`
- WHEN `KioskPointDisplay` consumes `useMatchDisplay`
- THEN left score, name, center set-count panel, and set-history columns correspond to the left side of the display

#### Scenario: Empty player names

- GIVEN a featured match with a missing player name
- WHEN `KioskPointDisplay` renders
- THEN a fallback label is shown in place of the missing name

### Requirement: Padel Games in Kiosk

For padel matches, `KioskPointDisplay` MUST show the current game count and point score in a padel-adapted layout. The set-history strip below the main score MUST show finished sets only.

#### Scenario: Padel kiosk display with games

- GIVEN a featured padel match with `leftGames=3` and `rightGames=2`
- WHEN `KioskPointDisplay` renders
- THEN the main score area shows padel-adapted information (games and points)
- AND center panels show `leftSets` and `rightSets`
- AND the set-history strip shows one row per player with finished set scores only

### Requirement: Kiosk Theme Awareness

`KioskPointDisplay` MUST use the app's primary green palette. The fullscreen kiosk background MUST be light primary green, score/set panels MUST be dark primary green, and score/set numbers MUST be white.

#### Scenario: Primary green palette in kiosk

- GIVEN the kiosk fullscreen renders
- WHEN `KioskPointDisplay` mounts
- THEN the page background uses the light primary green
- AND score/set panels use the dark primary green
- AND score/set numbers are white

### Requirement: Sport-Adaptive Visualization

`KioskPointDisplay` MUST render a sport-specific main score area and set-history strip. Table tennis emphasizes points per set; padel emphasizes games and points per game.

#### Scenario: Sport-specific layout

- GIVEN a featured table-tennis match
- WHEN `KioskPointDisplay` renders
- THEN the main score area shows point digits and the set strip shows set scores in point format
- GIVEN a featured padel match
- WHEN `KioskPointDisplay` renders
- THEN the main score area shows games/points and the set strip shows set scores in game/point format

### Requirement: Kiosk Reduced Motion

Score value changes in `KioskPointDisplay` MUST respect `prefers-reduced-motion`.

#### Scenario: Reduced motion enabled

- GIVEN `prefers-reduced-motion` is active
- WHEN a score value updates
- THEN the new value renders immediately without motion transition

### Requirement: No Kiosk ScoreboardBar

`KioskScoreboard` MUST NOT render `ScoreboardBar` or `SportDisplaySelector` in the featured fullscreen view.

#### Scenario: Absence of ScoreboardBar in kiosk

- GIVEN a featured match in kiosk fullscreen
- WHEN `KioskScoreboard` renders
- THEN `ScoreboardBar` is absent from the DOM
- AND `SportDisplaySelector` is absent from the DOM

### Requirement: Referee Path Unaffected

`TTPointDisplay`, `PadelPointDisplay`, and `ScoreboardMain` MUST remain unchanged.

#### Scenario: No regression in referee path

- GIVEN the referee scoreboard renders
- WHEN `ScoreboardMain` mounts with `SportDisplaySelector`
- THEN `TTPointDisplay` and `PadelPointDisplay` behavior is unchanged

### Requirement: Kiosk Finished Match

The kiosk MUST preserve existing finished-match behavior: winner toast plus defocus/return to grid.

#### Scenario: Featured match finishes

- GIVEN a featured match in kiosk fullscreen
- WHEN the match transitions to `FINISHED`
- THEN the winner toast displays
- AND the kiosk transitions back to grid mode

## MODIFIED Requirements

### Requirement: Kiosk Featured Transition

The kiosk MUST apply a 500ms CSS opacity fade when transitioning between grid↔fullscreen and between different featured courts. The transition SHALL use the same `transition-all duration-500` pattern as the existing auto-rotation.

(Previously: transitioned to fullscreen `ScoreboardMain`; now transitions to fullscreen `KioskPointDisplay`.)

#### Scenario: Grid to fullscreen fade

- GIVEN kiosk is in grid mode
- WHEN a court becomes featured
- THEN kiosk emits `SUBSCRIBE_MATCH` and transitions to fullscreen `KioskPointDisplay` with a 500ms opacity fade

#### Scenario: Switch between featured courts

- GIVEN kiosk shows fullscreen for court-A (featured)
- WHEN featured switches to court-B
- THEN the `KioskScoreboard` key changes so court-A view unmounts and court-B `KioskPointDisplay` mounts
- AND the transition applies a 500ms opacity fade

#### Scenario: Return to grid when match ends

- GIVEN kiosk shows fullscreen for featured court-A
- WHEN court-A transitions to FINISHED
- THEN kiosk emits `UNSUBSCRIBE_MATCH` and transitions back to grid mode

#### Scenario: Return to grid when featured cleared

- GIVEN kiosk shows fullscreen for featured court-A
- WHEN `TABLE_UPDATE` arrives with `featured: false` on court-A
- THEN kiosk emits `UNSUBSCRIBE_MATCH` and transitions back to grid mode

## Acceptance Criteria

- [ ] Large left/right score digits render in `KioskPointDisplay`.
- [ ] The kiosk fullscreen background uses the light primary green (`--color-primary-light`).
- [ ] Score/set panels and set-history strip use the dark primary green (`--color-primary`).
- [ ] Score digits and set counts are white.
- [ ] Center panels show `leftSets` and `rightSets` between the large score digits.
- [ ] A serving indicator is shown for the currently serving player using the amber/yellow accent.
- [ ] Player names are always visible above each score, larger than before, and not visually clipped.
- [ ] A TV-style set-history strip appears below the main score area with one row per player.
- [ ] The set-history strip shows finished sets only (no current-set column).
- [ ] `KioskPointDisplay` adapts its visualization to the sport (table tennis vs padel).
- [ ] Padel games and points are visible in the main score area.
- [ ] Set-indicator dots are not rendered in kiosk.
- [ ] `ScoreboardBar` and `SportDisplaySelector` are absent from kiosk fullscreen.
- [ ] Light/dark theme is respected with no forced dark TV mode.
- [ ] Reduced motion preference is honored.
- [ ] `TTPointDisplay`, `PadelPointDisplay`, and `ScoreboardMain` are unchanged.
- [ ] Existing winner toast + grid return behavior is preserved for finished matches.
- [ ] Unit tests for `KioskPointDisplay` pass.

## Edge Cases

- Empty player names fallback to a localized label.
- Finished featured match triggers existing toast and grid return.
- Reduced motion disables score-change animation.
