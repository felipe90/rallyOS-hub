# Proposal: Kiosk Set Display Redesign

## Intent

Spectators and players in the venue cannot read the current kiosk fullscreen scoreboard from a distance. Set counts are only tiny dots, the `ScoreboardBar` is unwanted and buggy in fullscreen, and player names are too small. This change redesigns the kiosk spotlight view for TV readability while leaving the referee scoreboard untouched.

## Scope

### In Scope (first slice)
- New `KioskPointDisplay` component rendered only by `KioskScoreboard`.
- Remove `ScoreboardBar` from the kiosk fullscreen view.
- Large left/right score digits with player names above.
- Center set-count panels showing sets won per side.
- Padel game counters visible below each point digit.
- Theme-aware rendering; no forced dark TV-only mode.
- Slightly larger player names.

### Out of Scope
- Referee scoreboard (`ScoreboardMain`) changes.
- `TTPointDisplay` / `PadelPointDisplay` modifications.
- Mobile/tablet layouts.
- New animations beyond the existing reduced-motion pattern.

## Business Rules / Product Decisions

- Target users: venue spectators and players.
- Finished match behavior: keep existing winner toast + defocus.
- Theme: respect app light/dark mode; do not force TV-only dark.
- Player names: always visible and larger than current.
- Padel games: shown as small counters near each point digit.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `kiosk-display`: Featured fullscreen scoreboard must render large scores, center set-count panels, and no `ScoreboardBar`.

## Approach

Create `client/src/components/molecules/KioskPointDisplay/KioskPointDisplay.tsx` consumed only by `KioskScoreboard`. `KioskScoreboard` drops `ScoreboardBar` and `SportDisplaySelector`, fetches display data via `useMatchDisplay` and `useSportAdapter`, and passes it to the new component. `KioskPointDisplay` uses `adapter.computeDisplayData(match)` to keep sport branching minimal and preserve the adapter strategy. Existing `TTPointDisplay` and `PadelPointDisplay` remain untouched.

Layout: full-width row with two large halves. Each half shows player name, score digit, and (padel) games counter. A center column contains two stacked panels for left and right sets won. Existing set-dot indicators may remain below scores for quick scanning. Animations reuse the existing `framer-motion` reduced-motion pattern.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `KioskScoreboard.tsx` | Modified | Remove `ScoreboardBar`/`SportDisplaySelector`; wire `KioskPointDisplay`. |
| `KioskPointDisplay.tsx` | New | Kiosk-only fullscreen score visualization. |
| `KioskPointDisplay.test.tsx` | New | Unit tests for score digits, set panels, padel games. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Regression in referee displays | Low | Do not modify `TTPointDisplay` / `PadelPointDisplay`. |
| Padel state unreadable | Med | Keep games counter below point digit. |
| Side-swap mismatch | Low | Consume `leftSets`/`rightSets` from `useMatchDisplay`. |
| Animation jarring on TV | Low | Reuse reduced-motion-aware pattern. |

## Rollback Plan

Revert the commit or manually: delete `KioskPointDisplay` files, restore `ScoreboardBar` and `SportDisplaySelector` in `KioskScoreboard`, and revert any CSS changes. The referee path is unaffected.

## Dependencies

None.

## Success Criteria

- [ ] Kiosk fullscreen shows large score digits and center set-count panels.
- [ ] `ScoreboardBar` is absent in kiosk.
- [ ] Padel games are visible in kiosk.
- [ ] Player names are larger and always visible.
- [ ] Theme switching works without TV-only dark overrides.
- [ ] Referee scoreboard has zero regression.
- [ ] Unit tests for `KioskPointDisplay` pass.
