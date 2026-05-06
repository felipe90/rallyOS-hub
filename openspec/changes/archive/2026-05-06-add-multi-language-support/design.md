# Design: Multi-Language Support

## Overview

Add i18n to the rallyOS-hub React client via `react-i18next` with a thin wrapper that exposes `i18nText()` as the sole translation function — never raw `i18next.t()` or `react-i18next`'s `t()` directly. Two access patterns cover the whole app: a `useI18n()` hook for React components (pages, organisms), and a singleton `i18nText` import for service-layer pure functions. Atoms and molecules receive already-translated text via props — zero i18n dependency. Locale JSON files (`es.json`, `en-US.json`) are imported statically at Vite build time and bundled for PWA offline reliability.

---

## Architecture

### The `i18nText()` wrapper

```
client/src/i18n/
  index.ts              ← init, bootstrap, exports useI18n + i18nText singleton
  locales/
    es-AR.json          ← complete, all ~80 keys in Argentine Spanish
    en-US.json          ← structural mirror, values may be partial at launch
```

The wrapper is purposely thin — it wraps `i18next.t()` with the same signature so that swapping the underlying library (unlikely but possible) touches one file. The rationale for `i18nText()` over raw `t()`:

| Concern | `t()` from i18next | `i18nText()` wrapper |
|---|---|---|
| Library coupling | Direct i18next API | Isolates callers from i18next |
| Import path in services | Must know i18next internals | Single import from `@/i18n` |
| Future ICU migration | Breaking change | Change internal impl only |
| Discoverability | Library docs needed | Project convention visible |

### Hook vs Singleton — when each is used

| Layer | Access pattern | Why |
|---|---|---|
| Pages | `const { i18nText } = useI18n()` | React lifecycle, re-renders on language change |
| Organisms | `const { i18nText } = useI18n()` | Same — they are composable React components |
| Molecules | Props only | Pure presentational, testable without i18n |
| Atoms | Props only (`children` or label prop) | Same |
| Hooks | None — hook returns data; **caller** applies `i18nText()` | Hooks stay pure of UI concerns |
| Services | `import { i18nText } from '../i18n'` | Not in React tree — singleton works everywhere |

### Dependency graph

```
main.tsx
  │
  ├── i18n/index.ts          ← init i18next with detector + static JSON
  │     │
  │     ├── locales/es-AR.json  (imported statically)
  │     └── locales/en-US.json  (imported statically, fallback)
  │
  ├── App.tsx                 ← wraps with I18nextProvider
  │     │
  │     ├── Pages ──► useI18n() ──► i18nText(key)
  │     │       │
  │     │       └── Organisms ──► useI18n() ──► i18nText(key)
  │     │               │
  │     │               ├── Molecules (via props)
  │     │               └── Atoms     (via props/children)
  │     │
  │     └── Services ──► import { i18nText } ──► i18nText(key, params)
  │
  └── test/test-utils.tsx     ← renderWithI18n() wraps with I18nextProvider
```

Key point: `i18n/index.ts` is imported once at the app entry (`main.tsx`) to **initialize** i18next. After init, the singleton is globally available. Component tree gets `I18nextProvider` wrapping from `App.tsx` to enable re-render on language changes.

---

## Module Design

### `client/src/i18n/index.ts`

```typescript
// Init i18next with browser language detection + static JSON imports
// Exports: useI18n hook + i18nText singleton + i18n instance (for tests)

import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './locales/es-AR.json'
import en from './locales/en-US.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'es-AR': { translation: es },
      'en-US': { translation: en },
    },
    fallbackLng: 'es-AR',
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [],             // no localStorage cache for initial release
    },
    interpolation: {
      escapeValue: false,     // React already escapes
    },
    returnNull: false,
    returnEmptyString: false,
  })

// Singleton — usable outside React (services, formatters)
export const i18nText = i18n.t.bind(i18n)
export type I18nTextFn = typeof i18nText

// Hook — usable inside React components (pages, organisms)
export function useI18n() {
  const { t } = useTranslation()
  return { i18nText: t }
}

export default i18n
```

### `useI18n()` Hook

```typescript
// Signature
function useI18n(): { i18nText: (key: string, params?: Record<string, unknown>) => string }
```

- Thin wrapper over `useTranslation()` from react-i18next
- Returns the exact `i18nText` name we expose everywhere — no `t()` confusion
- Re-renders the component when i18next language changes (react-i18next handles this via context)
- The `I18nextProvider` context wrapping (in `App.tsx`) enables this

### Singleton `i18nText`

```typescript
// In a service file:
import { i18nText } from '@/i18n'

export function formatEvent(event: ScoreChange): string {
  switch (event.action) {
    case 'SET_WON':
      return i18nText('event.set', { number: event.setNumber, player: event.player, scoreA, scoreB })
    // ...
  }
}
```

- `i18next.t.bind(i18n)` — permanently bound to the i18n instance
- Works the instant i18n init completes (before React mounts)
- Must be imported **after** i18n init runs — enforced by import order in `main.tsx`
- If a service module is imported lazily (dynamic import), it always sees an initialized i18n

### `renderWithI18n()` test utility

Added to the existing `client/src/test/test-utils.tsx` alongside `renderWithProviders()`:

```typescript
import i18n from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import es from '@/i18n/locales/es-AR.json'

// Pre-configured test instance — isolated from production i18n
const testI18n = i18n.createInstance()
void testI18n.use(initReactI18next).init({
  resources: { 'es-AR': { translation: es } },
  lng: 'es-AR',
  fallbackLng: 'es-AR',
  interpolation: { escapeValue: false },
  returnNull: false,
})

function renderWithI18n(
  ui: React.ReactElement,
  options?: CustomRenderOptions,
) {
  const { mockSocketContext, ...rest } = options || {}
  return render(ui, {
    wrapper: ({ children }) => (
      <I18nextProvider i18n={testI18n}>
        <TestWrapper mockSocketContext={mockSocketContext}>
          {children}
        </TestWrapper>
      </I18nextProvider>
    ),
    ...rest,
  })
}
```

For **service tests** that don't need React (e.g., `formatEvent.test.ts`), the approach is simpler:

```typescript
// Mock the i18nText singleton at module level — no wrapper needed
vi.mock('@/i18n', () => ({
  i18nText: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}))
```

---

## Migration Strategy

### Phase 1: Infrastructure (PR #1 — ~100 lines)

| File | Action |
|---|---|
| `client/package.json` | Add `i18next`, `react-i18next`, `i18next-browser-languagedetector` |
| `client/src/i18n/index.ts` | Create — init + exports |
| `client/src/i18n/locales/es-AR.json` | Create — all ~80 keys |
| `client/src/i18n/locales/en-US.json` | Create — structural mirror |
| `client/src/test/test-utils.tsx` | Add `renderWithI18n()` |
| `client/src/main.tsx` | Import `@/i18n` to trigger init |
| `client/src/App.tsx` | Wrap with `I18nextProvider` |

Phase 1 must land first — no component can use `i18nText()` without the infrastructure.

### Phase 2: Pages & Organisms (PR #2 — ~100 lines)

Replace hardcoded strings via `useI18n()` hook:

| File | Change |
|---|---|
| `pages/NotFoundPage/` | 3 strings → `i18nText()` |
| `pages/ScoreboardPage/` | ~8 strings → `i18nText()` |
| `pages/AuthPage/` | ~6 strings → `i18nText()` |
| `pages/OwnerDashboardPage/` | ~5 strings → `i18nText()` |
| `pages/RefereeDashboardPage/` | ~4 strings → `i18nText()` |
| `pages/SpectatorDashboardPage/` | ~3 strings → `i18nText()` |
| `pages/HistoryViewPage/` | ~3 strings → `i18nText()` |
| `organisms/ScoreboardMain/` | Labels → `i18nText()` |
| `organisms/ScoreboardHeader/` | "Atrás" + "Sets" → `i18nText()` |
| `organisms/HistoryDrawer/` | Titles → `i18nText()` |
| `organisms/DashboardGrid/` | Labels → `i18nText()` |

Each page/organism change follows this pattern:

```tsx
// Before
<Typography>Página no encontrada</Typography>

// After
const { i18nText } = useI18n()
<Typography>{i18nText('notFound.title')}</Typography>
```

### Phase 3: Atoms & Molecules (PR #2, same PR — ~40 lines)

**No i18n dependency added to these files.** Molecules and atoms receive translated text via props:

| File | Change |
|---|---|
| `molecules/ScoreDisplay/` | Accept `label` prop for player display name |
| `molecules/MatchConfigModal/` | Accept `title`, `submitLabel`, etc. as props |
| `molecules/PageHeader/` | Accept `title`, `backLabel` props |
| `atoms/Badge/` | Convenience badges (`WaitingBadge`, etc.) accept `label` prop |
| `atoms/ConnectionStatus/` | Accept `label` prop instead of internal status map |

Convenience badge change:

```tsx
// Before
export function WaitingBadge({ className }: { className?: string }) {
  return <Badge status="waiting" dot>Waiting</Badge>
}

// After
export function WaitingBadge({ label, className }: { label: string; className?: string }) {
  return <Badge status="waiting" dot>{label}</Badge>
}

// Usage in parent (organism/hook-caller):
<WaitingBadge label={i18nText('badge.waiting')} />
```

### Phase 4: Services (PR #3 — ~50 lines)

| File | Change |
|---|---|
| `services/match/formatEvent.ts` | Replace format strings → `i18nText()` singleton |
| `services/date/formatRelativeTime.ts` | Replace Spanish strings → `i18nText()` singleton |
| `services/errors/errorMessages.ts` | Replace `ERROR_MESSAGES` map → `i18nText()` calls |
| `services/validation/match.ts` | Replace validation strings → `i18nText()` singleton |

Service change pattern:

```typescript
// Before
return `Set ${n} - ${p} ${a}-${b}`

// After
import { i18nText } from '@/i18n'
return i18nText('event.set', { number: n, player: p, scoreA: a, scoreB: b })
```

### Phase 5: Locale files (throughout, iterative)

- `es.json` is complete before Phase 2 starts (all keys present)
- `en-US.json` mirrors key structure; values can use `TODO:` markers for incomplete translations
- Locale files are **static imports** — no runtime fetch. Vite bundles them into the JS chunk at build time

---

## Key Interfaces / Type Signatures

```typescript
// === i18n/index.ts exports ===

// Singleton for services
export const i18nText: (key: string, params?: Record<string, unknown>) => string

// Hook for React components
export function useI18n(): { i18nText: (key: string, params?: Record<string, unknown>) => string }

// === Locale JSON structure (es-AR.json / en-US.json) ===
interface LocaleResource {
  [namespace: string]: {
    [key: string]: string | { [subKey: string]: string | { [subSubKey: string]: string } }
  }
}
// Example:
// {
//   "scoreboard": {
//     "title": {
//       "matchInProgress": "Partido en curso"
//     },
//     "winner": "Ganador: {{name}}"
//   }
// }

// === renderWithI18n (in test-utils.tsx) ===
function renderWithI18n(
  ui: React.ReactElement,
  options?: CustomRenderOptions,
): RenderResult
```

---

## Data Flow Diagram

```
                      ┌─────────────────────┐
                      │   Locale JSON files  │
                      │  (es-AR.json,        │
                      │   en-US.json)         │
                      └──────┬──────────────┘
                             │ static import (Vite bundles at build time)
                             ▼
                      ┌─────────────────────┐
                      │  i18n/index.ts       │
                      │                      │
                      │  i18next.init()      │
                      │  + LanguageDetector  │
                      │  + initReactI18next  │
                      └──┬──────────────┬───┘
                         │              │
              singleton  │              │  React context
              export     │              │  (I18nextProvider)
                         ▼              ▼
              ┌──────────────────┐  ┌──────────────────────┐
              │ i18nText(key,    │  │ useI18n() hook       │
              │   params?)       │  │  → i18nText(key,     │
              │                  │  │      params?)         │
              └────────┬─────────┘  └──────────┬───────────┘
                       │                       │
                       ▼                       ▼
              ┌──────────────────┐  ┌──────────────────────┐
              │ Service layer    │  │ Pages & Organisms    │
              │ (pure functions) │  │ (React components)   │
              │                  │  │                      │
              │ formatEvent()    │  │ NotFoundPage         │
              │ formatRelative() │  │ ScoreboardPage       │
              │ getErrorMessage()│  │ ScoreboardMain       │
              │ validateMatch()  │  │ ScoreboardHeader     │
              └──────────────────┘  └──────┬───────────────┘
                                           │
                                           │ passes translated
                                           │ text via props
                                           ▼
                              ┌──────────────────────────┐
                              │ Molecules & Atoms        │
                              │ (pure presentational)    │
                              │                          │
                              │ ScoreDisplay(label)      │
                              │ Badge(children)          │
                              │ Button(children)         │
                              │ ConnectionStatus(label)  │
                              └──────────────────────────┘
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │     Browser screen        │
                              │  (rendered UI with text)  │
                              └──────────────────────────┘
```

---

## Edge Cases & Mitigations

### Missing key fallback

| Scenario | Behavior | Configuration |
|---|---|---|
| Key not found in current locale | Falls back to `es.json` | `fallbackLng: 'es-AR'` |
| Key not found in fallback either | Returns the key string itself (e.g., `"notFound.title"`) | i18next default behavior |
| Nested path partially missing | Returns key string, no crash | `returnNull: false` + `returnEmptyString: false` |

Enforced in `i18n/index.ts` config. Users see the verbatim key in development — clear signal something is missing.

### Interpolation with dynamic content

```typescript
// i18nText('match.forTable', { tableName: userEnteredName })
// es-AR.json: "para {{tableName}}"

// Player names, scores — never translated
// These are interpolation variables, not keys passed to i18nText
i18nText('scoreboard.winner', { name: currentMatch.winner }) // ✅
i18nText(currentMatch.winner)                                 // ❌
```

- Dynamic content (player names, table names, scores) is ALWAYS passed as interpolation params
- NEVER pass user data as the translation key itself — that's an XSS vector and defeats i18n
- `escapeValue: false` is safe because React already escapes — but i18next's default `escapeValue: true` is safe too. We set it `false` for React compatibility.

### Service singleton initialization timing

| Concern | Mitigation |
|---|---|
| Service import before i18n init | `main.tsx` imports `@/i18n` at the top — init runs synchronously before any React component mounts |
| Dynamic/lazy imports in services | By the time a lazy module loads (e.g., after user action), i18n has been initialized for seconds |
| Test isolation | Each test file either mocks `i18nText` via `vi.mock('@/i18n')` or imports the live singleton after init |

**Enforcement**: `i18n/index.ts` is imported in `main.tsx` as the FIRST import after the React imports. The side effect of importing it runs `i18n.init()` which completes before `createRoot()`.

```typescript
// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

// ⚠ i18n init MUST run before App renders
import './i18n'

import App from './App.tsx'
// ...
```

### Test isolation between locales

| Scenario | Approach |
|---|---|
| Component test (needs React) | `renderWithI18n()` with `es-AR` preloaded test instance |
| Service test (no React) | `vi.mock('@/i18n')` or initialize test i18n instance inline |
| Mixed provider tests | `renderWithI18n` wraps both `I18nextProvider` AND `TestWrapper` (Auth + Socket) |
| Changing locale in a test | Create a new test i18n instance with different `lng` — do NOT mutate the shared singleton between tests |

The `testI18n` instance in `renderWithI18n()` is a **separate** i18n instance created via `i18n.createInstance()`. It will never conflict with the production singleton or other test instances. Each test file gets its own mock or instance.

---

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit — services | `formatEvent`, `formatRelativeTime`, `getErrorMessage`, `validateMatchConfig` translate correctly | Mock `i18nText` to return key + params, or use test i18n instance. Test with both `es-AR` and `en-US` |
| Unit — i18n module | Init defaults, language detection, fallback | Import `i18n/index.ts` in test, verify resources loaded, fallback to `es-AR` |
| Component — pages | Rendered text comes from translation keys | `renderWithI18n()`, assert on `i18nText('notFound.title')` resolution |
| Component — atoms | No i18n import present | Verify atoms receive text via props, no `useI18n()` call |
| Integration | Page → Organism → Molecule → Atom text flow | Organism passes `i18nText()` result as prop to molecule; molecule renders it |

---

## File Changes Summary

| File | Action | Lines |
|---|---|---|
| `client/package.json` | Modify | +3 deps |
| `client/src/i18n/index.ts` | Create | ~30 |
| `client/src/i18n/locales/es-AR.json` | Create | ~120 |
| `client/src/i18n/locales/en-US.json` | Create | ~120 |
| `client/src/main.tsx` | Modify | +1 import |
| `client/src/App.tsx` | Modify | +wrap I18nextProvider |
| `client/src/test/test-utils.tsx` | Modify | +renderWithI18n |
| `client/src/pages/NotFoundPage/` | Modify | ~3 strings |
| `client/src/pages/ScoreboardPage/` | Modify | ~8 strings |
| `client/src/pages/AuthPage/` | Modify | ~6 strings |
| `client/src/pages/OwnerDashboardPage/` | Modify | ~5 strings |
| `client/src/pages/RefereeDashboardPage/` | Modify | ~4 strings |
| `client/src/pages/SpectatorDashboardPage/` | Modify | ~3 strings |
| `client/src/pages/HistoryViewPage/` | Modify | ~3 strings |
| `client/src/components/organisms/ScoreboardMain/` | Modify | ~5 strings |
| `client/src/components/organisms/HistoryDrawer/` | Modify | ~3 strings |
| `client/src/components/organisms/DashboardGrid/` | Modify | ~3 strings |
| `client/src/components/molecules/ScoreDisplay/` | Modify | Props pattern |
| `client/src/components/molecules/MatchConfigModal/` | Modify | Props pattern |
| `client/src/components/molecules/PageHeader/` | Modify | Props pattern |
| `client/src/components/atoms/Badge/` | Modify | Props pattern |
| `client/src/components/atoms/ConnectionStatus/` | Modify | Props pattern |
| `client/src/services/match/formatEvent.ts` | Modify | ~5 strings |
| `client/src/services/date/formatRelativeTime.ts` | Modify | ~4 strings |
| `client/src/services/errors/errorMessages.ts` | Modify | ~12 strings |
| `client/src/services/validation/match.ts` | Modify | ~6 strings |

---

## Open Questions

- None — all decisions made and documented. Design is ready for task breakdown.
