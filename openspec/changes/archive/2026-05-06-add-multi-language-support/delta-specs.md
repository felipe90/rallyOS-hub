# Delta Specs: Multi-Language Support

**Change**: `add-multi-language-support`
**Cross-cutting concern**: i18n for all client UI text — no existing spec to modify. Adds new infrastructure, modifies ~28 files.

## Requirements

### FR1: i18n Infrastructure

The system MUST ship a new `client/src/i18n/` module with react-i18next initialization, a `useI18n()` hook, and a singleton `i18nText` function. The module MUST bundle locale JSON at build time (static Vite import, no runtime fetch). The system MUST install `i18next@^24`, `react-i18next@^15`, and `i18next-browser-languagedetector@^8`.

#### Scenario: i18n module initialization

- GIVEN the app boots in a browser with `navigator.language === 'en-US'`
- WHEN the `i18n/index.ts` init runs
- THEN the detected language is `'en-US'`
- AND fallback language is `'es-AR'`
- AND no HTTP request is made for locale files

#### Scenario: Singleton access in services

- GIVEN a service file imports `i18nText` from `'../i18n'`
- WHEN the service calls `i18nText('some.key')`
- THEN the correct translated string is returned without a React context

### FR2: Component Migration — Hook vs Props Boundary

All **pages** and **organisms** MUST use the `useI18n()` hook to retrieve translated text. All **atoms** and **molecules** MUST receive translated text via **props only** — they MUST NOT import or reference i18n. The `useI18n()` hook MUST return an `i18nText` function accepting a dot-notation key and optional interpolation params.

#### Scenario: Page uses useI18n hook

- GIVEN `NotFoundPage` currently renders `"Página no encontrada"`
- WHEN the page is migrated to use `const { i18nText } = useI18n()`
- THEN the title text reads `i18nText('notFound.title')`
- AND no hardcoded Spanish strings remain in the component

#### Scenario: Molecule receives text via props only

- GIVEN `ScoreDisplay` is a molecule with `meta` prop for player name display
- WHEN `ScoreDisplay` is rendered by `ScoreboardMain` (an organism)
- THEN `ScoreboardMain` passes the translated label via the `meta` prop
- AND `ScoreDisplay` has no i18n import

#### Scenario: Badge atom is text-agnostic

- GIVEN `Badge` renders `{children}` as its inner content
- WHEN `ScoreboardBar` passes a translated status string via `children`
- THEN `Badge` renders the translated text unchanged
- AND `Badge` has no i18n dependency

### FR3: Service-Layer Migration

All service-layer formatters (`formatEvent`, `formatRelativeTime`, `errorMessages`, `validation/match`) MUST use the `i18nText` singleton instead of hardcoded strings. Services MUST import `{ i18nText }` directly from the i18n root module — they MUST NOT use hooks. Interpolation params MUST be passed as the second argument to `i18nText`.

#### Scenario: formatEvent uses i18n keys

- GIVEN `formatEvent(event)` is called with `action: 'POINT'`, `player: 'A'`, `pointsAfter: { a: 11, b: 5 }`
- WHEN the function runs with locale `es-AR`
- THEN it returns `"A: 11-5"` via `i18nText('event.point', { player: 'A', scoreA: 11, scoreB: 5 })`

#### Scenario: errorMessages uses i18n keys

- GIVEN `getErrorMessage('INVALID_PIN')` is called while locale is `en-US`
- WHEN the function dispatches via `i18nText('errors.invalidPin')`
- THEN it returns `"Incorrect table PIN"`

### FR4: Test Infrastructure

The system MUST provide a shared `renderWithI18n()` test utility (analogous to the existing `renderWithProviders()` in `client/src/test/test-utils.tsx`). This utility MUST wrap components with a test-ready i18n instance preloaded with `es-AR` locale data. All existing component tests that render translated text MUST use this utility.

#### Scenario: renderWithI18n wraps components with i18n provider

- GIVEN a component test renders `<NotFoundPage />`
- WHEN the test uses `renderWithI18n(<NotFoundPage />)` instead of `render(<NotFoundPage />)`
- THEN `i18nText('notFound.title')` resolves to `"Página no encontrada"`
- AND the test passes without i18n mock boilerplate

#### Scenario: Service tests remain pure (no wrapper needed)

- GIVEN `formatEvent.test.ts` tests a pure service function
- WHEN the test calls `formatEvent(event)`
- THEN it MUST import `i18nText` mock or initialize a test i18n instance
- AND the test does NOT need the `renderWithI18n` wrapper

### FR5: Locale Files

The system MUST ship two locale JSON files: `es-AR.json` (complete — covers all 70–80 UI strings in Argentine Spanish) and `en-US.json` (structural mirror — same key tree, values MAY be incomplete at launch). Keys MUST use nested JSON matching the verbose dot-notation key path (e.g., `"scoreboard.title.matchInProgress"` → `{ "scoreboard": { "title": { "matchInProgress": "..." } } }`).

#### Scenario: es-AR.json covers all UI strings

- GIVEN every `i18nText(...)` call in the codebase
- WHEN looking up its key in `es-AR.json`
- THEN a corresponding nested entry exists
- AND the value matches the original hardcoded Spanish string

#### Scenario: en-US.json mirrors structure

- GIVEN `es-AR.json` has key `"scoreboard.title.matchInProgress"`
- WHEN checking `en-US.json`
- THEN the same key path exists
- AND the value is in English (or a TODO marker for incomplete translations)

## Scenarios

### S1 — Page (NotFoundPage): `useI18n()` hook

| Before | After | i18n key | es-AR.json value |
|--------|-------|----------|-------------------|
| `<Typography>Página no encontrada</Typography>` | `const { i18nText } = useI18n()`<br/>`<Typography>{i18nText('notFound.title')}</Typography>` | `notFound.title` | `"Página no encontrada"` |
| `<Typography>La ruta que intentaste acceder no existe.</Typography>` | `<Typography>{i18nText('notFound.message')}</Typography>` | `notFound.message` | `"La ruta que intentaste acceder no existe."` |
| `<Button>Volver al inicio</Button>` | `<Button>{i18nText('notFound.goHome')}</Button>` | `notFound.goHome` | `"Volver al inicio"` |

### S2 — Organism (ScoreboardHeader): `useI18n()` hook + label

| Before | After | i18n key | es-AR.json value |
|--------|-------|----------|-------------------|
| `title="Atrás"` | `title={i18nText('common.back')}` | `common.back` | `"Atrás"` |
| `<span>Sets</span>` | `<span>{i18nText('scoreboard.setsLabel')}</span>` | `scoreboard.setsLabel` | `"Sets"` |

### S3 — Molecule (ScoreDisplay): Props-only pattern

| Before | After | Key observation |
|--------|-------|-----------------|
| `<span>Player {player}</span>` | `<span>{label}</span>` (receives `label` prop from parent) | Molecule has NO i18n import — parent organism passes translated `label` via props |
| Parent: `<ScoreDisplay player="A" />` | Parent: `<ScoreDisplay label={i18nText('scoreboard.playerLabel', { player: 'A' })} />` | Translation happens at the organism level |

### S4 — Atom (Badge): Props-only children

| Before | After | Key observation |
|--------|-------|-----------------|
| `function WaitingBadge() { return <Badge>Waiting</Badge> }` | `function WaitingBadge({ label }: { label: string }) { return <Badge>{label}</Badge> }` | Convenience badges accept `label` prop; organism passes `i18nText('badge.waiting')` |
| Parent (organism): `<WaitingBadge />` | Parent: `<WaitingBadge label={i18nText('badge.waiting')} />` | Badge atom remains pure — no i18n import |

### S5 — Service (formatEvent): Singleton pattern

| Before | After | i18n key | es-AR.json value |
|--------|-------|----------|-------------------|
| ``return `Set ${n} - ${p} ${a}-${b}` `` | `return i18nText('event.set', { number, player, scoreA: a, scoreB: b })` | `event.set` | `"Set {{number}} - {{player}} {{scoreA}}-{{scoreB}}"` |
| ``return `${p}: ${a}-${b}` `` | `return i18nText('event.point', { player, scoreA, scoreB })` | `event.point` | `"{{player}}: {{scoreA}}-{{scoreB}}"` |
| ``return `Corr: ${a}-${b}` `` | `return i18nText('event.correction', { scoreA, scoreB })` | `event.correction` | `"Corr: {{scoreA}}-{{scoreB}}"` |

### S6 — Service (formatRelativeTime): i18n singleton

| Before | After | i18n key | es-AR.json value |
|--------|-------|----------|-------------------|
| `return 'recién'` | `return i18nText('event.relativeTime.justNow')` | `event.relativeTime.justNow` | `"recién"` |
| ``return `hace ${Math.floor(diff / 60000)}m` `` | `return i18nText('event.relativeTime.minutesAgo', { count: Math.floor(diff / 60000) })` | `event.relativeTime.minutesAgo` | `"hace {{count}}m"` |
| `toLocaleDateString('es-AR', ...)` | `return i18nText('event.relativeTime.fullDate', { date: formatDate(timestamp) })` | `event.relativeTime.fullDate` | (ISO date formatting, locale-aware via Intl) |

### S7 — Test utility: `renderWithI18n()` wrapper

```tsx
// Before — bare render, no i18n available (test fails or needs manual mock)
render(<NotFoundPage />)
screen.getByText('Página no encontrada') // ✅ works only if text is hardcoded

// After — wrapped with i18n provider
import { renderWithI18n } from '@/test/test-utils'
renderWithI18n(<NotFoundPage />)
screen.getByText(i18nText('notFound.title')) // ✅ resolves via test i18n instance
```

## Non-Requirements

The following are explicitly OUT OF SCOPE for this change:

| # | Non-requirement | Rationale |
|---|-----------------|-----------|
| NR1 | **Language switcher UI** — no dropdown, toggle, or settings page for locale selection | The proposal aims for infrastructure + migration only; UI comes in a follow-up |
| NR2 | **Dynamic locale loading** — no runtime `fetch()` of JSON translation files | All locale files bundled at Vite build time for PWA offline reliability |
| NR3 | **Runtime language change** — changing locale requires page reload | `i18next` supports runtime change but this is deferred; initial scope is detect-on-load |
| NR4 | **Server-side i18n** — no translation of server-emitted strings or error codes | Server remains 100% English; all translation happens in the client |
| NR5 | **User-generated content translation** — player names, team names, table names, scores | These are data, not UI text — never passed through `i18nText()` |
| NR6 | **ICU MessageFormat syntax** — plural rules use simple interpolation, not ICU | `i18next` has optional ICU support; too complex for the initial 2-language scope |
| NR7 | **Translation management tools** — no CLI extraction, no lint for missing keys | Future improvement; initial scope is manual key authoring |
| NR8 | **Right-to-left (RTL) support** — no layout mirroring for Arabic/Hebrew | Feature request would be separate; `es-AR` and `en-US` are both LTR |

## Key Conventions

| Layer | i18n mechanism | Component examples | Example code |
|-------|---------------|--------------------|--------------|
| **Pages** | `useI18n()` hook | `NotFoundPage`, `ScoreboardPage`, `OwnerDashboardPage` | `const { i18nText } = useI18n()` → `{i18nText('notFound.title')}` |
| **Organisms** | `useI18n()` hook | `ScoreboardMain`, `DashboardGrid`, `HistoryDrawer` | `{i18nText('scoreboard.setsLabel')}` |
| **Molecules** | Props only (no i18n import) | `ScoreDisplay`, `MatchConfigModal`, `PageHeader`, `FormField` | `<ScoreDisplay score={n} label={translatedLabel} />` |
| **Atoms** | Props only (`children` or prop) | `Badge`, `Button`, `Typography`, `ConnectionStatus` | `<Badge>{translatedLabel}</Badge>` or `<Button>{translatedText}</Button>` |
| **Hooks** | `useI18n()` in the component that calls the hook; hook itself stays i18n-agnostic | `useAuthFlow`, `useAutoUpdate`, `usePinSubmission` | Hook returns data; component applies `i18nText()` to status messages |
| **Services** | `import { i18nText } from '../i18n'` singleton | `formatEvent`, `formatRelativeTime`, `errorMessages`, `validation/match` | `i18nText('event.set', { number: n, ... })` |
| **Locale JSON** | Nested keys matching dot-notation path | `es-AR.json`, `en-US.json` | `{ "scoreboard": { "title": { "matchInProgress": "..." } } }` |
| **Tests (components)** | `renderWithI18n()` wrapper | All component tests rendering translated content | `renderWithI18n(<MyComponent />)` |
| **Tests (services)** | Jest-mock `i18nText` or test i18n init | `formatEvent.test.ts`, `errorMessages.test.ts` | `vi.mock('@/i18n', () => ({ i18nText: (k) => k }))` |

## Key File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/i18n/index.ts` | **NEW** | i18next init with language detector, exports `useI18n()` and `i18nText` |
| `client/src/i18n/locales/es-AR.json` | **NEW** | All ~80 keys in Argentine Spanish (complete) |
| `client/src/i18n/locales/en-US.json` | **NEW** | Structural mirror of es-AR (values may be partial) |
| `client/src/pages/NotFoundPage/NotFoundPage.tsx` | **MODIFY** | Replace 3 hardcoded strings → `i18nText()` |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | **MODIFY** | Replace ~8 hardcoded strings → `i18nText()` |
| `client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx` | **MODIFY** | Replace labels, pass translated props to molecules |
| `client/src/components/organisms/ScoreboardMain/components/ScoreboardHeader.tsx` | **MODIFY** | Replace `"Atrás"`, `"Sets"` → `i18nText()` |
| `client/src/components/atoms/Badge/Badge.tsx` | **MODIFY** | Make label a prop, remove hardcoded English |
| `client/src/components/molecules/ScoreDisplay/ScoreDisplay.tsx` | **MODIFY** | Accept `label` prop for player display name |
| `client/src/services/match/formatEvent.ts` | **MODIFY** | Replace hardcoded format strings → `i18nText()` singleton |
| `client/src/services/date/formatRelativeTime.ts` | **MODIFY** | Replace hardcoded Spanish → `i18nText()` singleton |
| `client/src/services/errors/errorMessages.ts` | **MODIFY** | Replace `ERROR_MESSAGES` map → `i18nText()` calls |
| `client/src/services/validation/match.ts` | **MODIFY** | Replace validation error strings → `i18nText()` |
| `client/src/test/test-utils.tsx` | **MODIFY** | Add `renderWithI18n()` alongside existing `renderWithProviders()` |
| `client/package.json` | **MODIFY** | Add `i18next`, `react-i18next`, `i18next-browser-languagedetector` |
