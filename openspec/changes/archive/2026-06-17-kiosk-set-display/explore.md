## Exploration: kiosk-set-display

### Current State

`KioskScoreboard` renders a fullscreen scoreboard for the kiosk spotlight mode. Today it:

1. Shows a `ScoreboardBar` at the top with status badge and set-history chips.
2. Delegates the main score visualization to `SportDisplaySelector`, which uses `useSportAdapter` to pick the sport-specific display (`TTPointDisplay` or `PadelPointDisplay`).
3. Passes `leftSets` / `rightSets` (already side-swapped by `useMatchDisplay`) into the selector.
4. Renders with `isReferee={false}`, so the existing set-indicator dots below each score are actually shown — they are **not** hidden in kiosk (the prompt assumption is slightly off; both TT and Padel tests explicitly verify dots render when `isReferee={false}`).
5. The set counts themselves (`leftSets` / `rightSets`) are **only** visualized through the small dot indicators; there is no large numeric "sets won" readout in the center as requested by the inspiration design.

The `ScoreboardBar` set-history strip is the component the user wants removed from kiosk because it is buggy and unwanted in fullscreen mode.

### Affected Areas

- `client/src/components/organisms/KioskScoreboard/KioskScoreboard.tsx` — entry point; must drop `ScoreboardBar` and present sets-won numerics.
- `client/src/components/molecules/SportDisplaySelector/SportDisplaySelector.tsx` — currently the indirection used by KioskScoreboard; may be bypassed or kept depending on approach.
- `client/src/components/molecules/TTPointDisplay/TTPointDisplay.tsx` — contains the large score digits and set-dot rendering pattern; may be duplicated/adapted.
- `client/src/components/molecules/PadelPointDisplay/PadelPointDisplay.tsx` — same as above but adds padel-specific `games` counters and point strings.
- `client/src/hooks/useMatchDisplay/useMatchDisplay.ts` — already supplies `leftSets` / `rightSets`; no logic change needed, only consumption.
- `client/src/components/organisms/ScoreboardMain/components/ScoreboardBar.tsx` — to be removed from kiosk usage.
- `client/src/pages/KioskAllCourtsPage/KioskAllCourtsPage.tsx` — consumer of `KioskScoreboard`; no API change expected if `KioskScoreboardProps` stays stable.
- `client/src/index.css` — scoreboard dark tokens (`--color-scoreboard-bg`, `--color-scoreboard-bg-alt`, `--color-score`, `--color-score-muted`, `--color-amber`) are the palette to reuse.

### Approaches

1. **Approach A — Inline redesign inside `KioskScoreboard`**
   - Drop `SportDisplaySelector` and `ScoreboardBar` entirely from `KioskScoreboard`.
   - Build a custom flex layout with large left/right score digits and a center column showing `leftSets` / `rightSets` numerics plus the existing dot indicators.
   - Use `adapter.computeDisplayData(match)` directly to obtain `leftScore`/`rightScore` (TT) or `leftPoint`/`rightPoint` + `leftGames`/`rightGames` (padel).
   - **Pros:**
     - Single file changed for the core feature.
     - No new public component API to document/test.
     - Fastest path to the exact requested visual layout.
   - **Cons:**
     - Kiosk-specific sport branching (TT vs padel) leaks into `KioskScoreboard`, violating the adapter pattern.
     - Duplicates score-rendering concerns already owned by `TTPointDisplay` / `PadelPointDisplay`.
     - Future sport additions require touching kiosk code.
     - Harder to unit-test in isolation because the component grows and embeds adapter details.
   - **Effort:** Low
   - **TDD alignment:** Weak — adding sport-specific conditionals in a component makes pure unit tests awkward and encourages snapshot/UI-heavy tests.

2. **Approach B — New `KioskPointDisplay` component (recommended)**
   - Create `client/src/components/molecules/KioskPointDisplay/KioskPointDisplay.tsx` that is rendered only by `KioskScoreboard`.
   - Internally it still uses `useSportAdapter(match)` to resolve the sport and renders a shared kiosk layout, but keeps sport-specific sub-rendering minimal (e.g., two small sport display sub-components or a switch on `adapter.sport`).
   - `KioskScoreboard` becomes a thin container: no `ScoreboardBar`, no `SportDisplaySelector`, just fetches display data and passes it to `KioskPointDisplay`.
   - Existing `TTPointDisplay` / `PadelPointDisplay` remain untouched.
   - **Pros:**
     - Keeps the adapter strategy intact; sport branching is isolated in one new component.
     - Clean separation: `KioskScoreboard` owns layout/container concerns, `KioskPointDisplay` owns kiosk visual concerns.
     - Easy to test `KioskPointDisplay` in isolation with mocked adapter data.
     - No regression risk to the referee `ScoreboardMain` path.
   - **Cons:**
     - One new file and one new test file.
     - Slightly more initial boilerplate than Approach A.
   - **Effort:** Medium
   - **TDD alignment:** Strong — new component can be driven by small, focused tests for score digits, set numerics, and dot counts per sport.

3. **Approach C — Add a kiosk mode flag to existing point displays**
   - Add a `kiosk?: boolean` (or `variant="kiosk"`) prop to `TTPointDisplay` and `PadelPointDisplay`.
   - When enabled, the components render the center set-count boxes and suppress the `ScoreboardBar` (which they do not render anyway).
   - **Pros:**
     - Reuses existing component logic (animations, serving indicator, undo button gating).
   - **Cons:**
     - Adds branching inside components that already mix referee and spectator concerns.
     - `isReferee={false}` plus a new `kiosk` flag creates a combinatorial prop space that is hard to reason about.
     - The requested center layout is structurally different from the current left/right full-height panels; retrofitting it increases component complexity.
     - Touching `TTPointDisplay` / `PadelPointDisplay` risks regressing the referee scoreboard, which is the primary use case.
   - **Effort:** Medium-High
   - **TDD alignment:** Moderate — tests must cover new prop combinations in already-large components.

### Recommendation

**Approach B** — create a dedicated `KioskPointDisplay` component.

The kiosk design is a different product surface (large digits, center set panels, no referee controls) and deserves its own component. Isolating it prevents sport-specific logic from leaking into `KioskScoreboard`, protects the existing referee displays from regression, and yields a component that is small enough to drive with strict TDD. The marginal cost of one extra file is paid back immediately in maintainability and testability.

### Risks

- **Risk 1 — Padel game count visibility:** The current `PadelPointDisplay` shows `Games: N` under each point and a `leftGames-rightGames` counter in the VS divider. The inspiration design only mentions large scores + center sets. If games are still needed for padel kiosk, the new component must explicitly include them or padel state will be incomprehensible.
- **Risk 2 — Side-swap correctness:** `useMatchDisplay` already side-swaps `leftSets` / `rightSets`. The new component must consume those exact values, not re-derive from raw `match.setHistory`, or kiosk will disagree with the referee view.
- **Risk 3 — Accessibility / i18n:** The set-count labels and player-name fallbacks (`commonPlayerA` / `commonPlayerB`) must continue to use `useI18n` and meaningful `aria-label`s.
- **Risk 4 — Animation parity:** The new component should reuse the same `framer-motion` reduced-motion-aware pattern used by the existing displays to avoid jarring score changes on the venue TV.

### Ready for Proposal

Yes. The next phase should be `sdd-propose`, where the scope can be finalized: remove `ScoreboardBar` from kiosk, add a `KioskPointDisplay` component, keep `TTPointDisplay` / `PadelPointDisplay` untouched, and add focused unit tests for the new component.
