# Design: Kiosk Set Display Redesign

## Technical Approach

Add `KioskPointDisplay` as the sole kiosk fullscreen visualization. `KioskScoreboard` removes `ScoreboardBar` and `SportDisplaySelector`, calls `useMatchDisplay`, and passes display state to `KioskPointDisplay`. The new component resolves `useSportAdapter` and calls `adapter.computeDisplayData(match)` for sport-specific data. It renders large score digits with player names above, center panels showing `leftSets`/`rightSets`, a serving indicator using the amber accent, and a bottom set-history strip from `adapter.formatSetHistory(match.setHistory)` showing finished sets only. The fullscreen kiosk background uses the light primary green (`--color-primary-light`); score digit panels, set-count panels, and the set-history strip use the dark primary green (`--color-primary`); score and set numbers are white. Player names remain readable above each score area.

For cross-court transitions, `KioskAllCourtsPage` must force a remount of the fullscreen `KioskScoreboard` when the featured `courtId` changes (e.g., by using the court id as a React `key`), combined with the existing `transition-opacity duration-500` wrapper.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Kiosk fullscreen component | Reuse `SportDisplaySelector` vs. new `KioskPointDisplay` | Reuse keeps small text and dots; new component is kiosk-only and TV-readable. | New `KioskPointDisplay`. |
| Sport branching | Inline `if (isPadel)` vs. adapter strategy | Inline is faster; adapter preserves existing strategy and leaves TT/Padel displays untouched. | Adapter strategy via `useSportAdapter`. |
| Set indicator | Center panels vs. bottom strip vs. dots | Dots are unreadable on TV; center panels show sets won; bottom strip shows finished set details. | Center panels for sets won + bottom TV-style strip for finished set scores, no dots. |
| Theme | Force dark TV mode vs. inherit app theme | Forced dark ignores user/system theme; inheritance matches spec. | Inherit app semantic theme tokens. |
| Reduced motion | `useReducedMotion` guard vs. always animate | Guard honors accessibility; always animate can jar spectators. | Use `framer-motion` `useReducedMotion` guard. |

## Data Flow

```
KioskAllCourtsPage
       │
       ▼
KioskScoreboard
       │
       ├── useMatchDisplay(match) ──► names, sets, serving
       │
       ▼
KioskPointDisplay
       │
       ├── useSportAdapter(match) ──► adapter
       ├── adapter.computeDisplayData(match) ──► sportDisplay
       └── adapter.formatSetHistory(...) ──► finishedSets
```

`useMatchDisplay` memoizes side-swap, names, serving, and sets. The adapter handles sport-specific score formatting and set-history display.

## Visual Layout

### Table tennis kiosk

```
┌─────────────────────────────────────────────────────────────────┐
│  Alice ● Saque                  Bob                              │
│                                                                  │
│ ┌────┐  ┌─────┐  ┌─────┐  ┌────┐                                │
│ │ 11 │  │  1  │  │  0  │  │  7 │                                │
│ └────┘  └─────┘  └─────┘  └────┘                                │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Alice  │  11  │   5  │  11  │                                  │
│  Bob    │   7  │  11  │   7  │                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Padel kiosk

```
┌─────────────────────────────────────────────────────────────────┐
│  Alice ● Saque                  Bob                              │
│                                                                  │
│ ┌────┐  ┌─────┐  ┌─────┐  ┌────┐                                │
│ │ 40 │  │  1  │  │  0  │  │ 30 │                                │
│ └────┘  └─────┘  └─────┘  └────┘                                │
│ Games: 5                      Games: 2                           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Alice  │ 6-4 │ 3-6 │                                             │
│  Bob    │ 4-6 │ 6-3 │                                             │
└─────────────────────────────────────────────────────────────────┘
```

The fullscreen background is light primary green; score digit panels, set-count panels, and the set-history strip use dark primary green with white numbers. The serving indicator uses the amber accent (yellow dot + "Saque" label). The main score area shows one large digit per side with center panels for sets won; padel adds a game counter below each score. The bottom strip shows one row per player with one column per finished set only. No dots are rendered.

## Component Structure

```
KioskPointDisplay
├── MainScoreArea
│   ├── PlayerSide (left)
│   │   ├── PlayerName
│   │   ├── ServingIndicator  (if leftServing)
│   │   ├── AnimatedScoreDigit
│   │   └── PadelGameCounter  (padel only)
│   ├── CenterSetPanels
│   │   ├── LeftSetsPanel
│   │   └── RightSetsPanel
│   └── PlayerSide (right)
│       ├── PlayerName
│       ├── ServingIndicator  (if rightServing)
│       ├── AnimatedScoreDigit
│       └── PadelGameCounter  (padel only)
└── SetHistoryStrip
    ├── SetHistoryRow (left player)
    └── SetHistoryRow (right player)
```

### Dependency diagram

```
KioskScoreboard
    ├── useMatchDisplay
    ├── useI18n
    └── KioskPointDisplay
            ├── useSportAdapter
            ├── framer-motion (useReducedMotion)
            └── i18n (fallback names)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `client/src/components/molecules/KioskPointDisplay/KioskPointDisplay.tsx` | Create | Kiosk-only fullscreen score visualization. |
| `client/src/components/molecules/KioskPointDisplay/KioskPointDisplay.test.tsx` | Create | TDD unit tests for TT, padel, swap, names, motion, theme. |
| `client/src/components/organisms/KioskScoreboard/KioskScoreboard.tsx` | Modify | Remove `ScoreboardBar`/`SportDisplaySelector`; wire `KioskPointDisplay`. |
| `client/src/pages/KioskAllCourtsPage/KioskAllCourtsPage.tsx` | Modify | Force `KioskScoreboard` remount on featured court change to enable 500ms cross-fade. |

## Interfaces / Contracts

```typescript
export interface KioskPointDisplayProps {
  match: MatchStateExtended;
  leftName: string;
  rightName: string;
  leftSets: number;
  rightSets: number;
  totalSets: number;
  leftServing: boolean;
  rightServing: boolean;
}
```

Inside the component:

```typescript
const adapter = useSportAdapter(match);
const sportDisplay = adapter.computeDisplayData(match);
const finishedSets = adapter.formatSetHistory(match.setHistory || []);
```

Empty names fall back to `i18nText('commonPlayerA')` / `i18nText('commonPlayerB')`.

## Tailwind Tokens

- Page background: `bg-[var(--color-primary-light)]`
- Card/panel background: `bg-[var(--color-primary)]`
- Score/set numbers: `text-white`
- Player names: `text-white text-[clamp(2rem,5vw,7rem)] font-heading font-bold leading-tight` (avoid descender clipping; prefer `line-clamp-1` or scaling over `truncate` with overflow-hidden)
- Serving indicator: `bg-amber/10 border border-amber/20` pill with `bg-amber` dot
- Score digits: `text-[clamp(10rem,30vw,26rem)] font-heading font-bold leading-none text-white`
- Score/set panels: `bg-[var(--color-primary)] rounded-2xl border border-white/10`
- Set count numbers: `text-[clamp(5rem,14vw,18rem)] font-heading font-bold leading-none text-white`
- Padel games: `text-[clamp(1.5rem,3vw,4rem)] font-heading font-semibold text-white/70`
- Strip cells: `text-[clamp(1.25rem,3vw,4rem)] font-heading font-bold text-white`
- Fade: `transition-opacity duration-500`

## Testing Strategy

Strict TDD per `openspec/config.yaml`. Mock `framer-motion` and stub `useSportAdapter` to test `KioskPointDisplay` in isolation.

| Layer | What to test | Approach |
|---|---|---|
| Unit | TT layout | Names, large point digits, center set panels, finished sets, background color. |
| Unit | Padel layout | Games counter, point string, center set panels, finished set strip, background color. |
| Unit | Side-swap | Left/right content mirrors `swappedSides`. |
| Unit | Empty names | Fallback labels render. |
| Unit | Serving indicator | Indicator renders only on the serving side and uses amber accent. |
| Unit | Reduced motion | Score updates immediately when `useReducedMotion` returns `true`. |
| Unit | Theme | No hardcoded dark-only classes; semantic tokens present. |
| Unit | KioskScoreboard refactor | `ScoreboardBar` and `SportDisplaySelector` absent from DOM. |
| Integration | Cross-court fade | `KioskAllCourtsPage` remounts `KioskScoreboard` on featured court change with 500ms opacity transition. |
| Integration | Finished-match return | Existing winner toast + grid return preserved. |

## Migration / Rollout

No migration. The change is purely presentational inside the kiosk fullscreen path; referee components are untouched.

## Open Questions

- Dark mode is not yet implemented. `KioskPointDisplay` uses existing semantic tokens and will adapt once a dark theme is added.
