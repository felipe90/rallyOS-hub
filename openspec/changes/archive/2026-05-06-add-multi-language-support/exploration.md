# Exploration: Multi-language (i18n) support for rallyOS-hub client

## Current State

The rallyOS-hub React client is **entirely in Argentine Spanish (es-AR)** with hardcoded text spread across **~25-30 files** containing **~70-80 distinct UI string keys**.

### Text volume by layer

| Layer | Files with text | Approx. strings | Examples |
|-------|----------------|-----------------|----------|
| **Pages** (7) | 7 | ~30 | AuthPage, ScoreboardPage, OwnerDashboardPage, RefereeDashboardPage, SpectatorDashboardPage, NotFoundPage, HistoryViewPage |
| **Organisms** (3) | 3 | ~10 | DashboardGrid, ScoreboardMain, HistoryDrawer |
| **Molecules** (14) | 8 | ~25 | MatchConfigModal, PinModal, ConfirmDialog, TableStatusChip, MatchContext, HistoryAccordion, HistoryList, HistoryTableSection |
| **Atoms** (8) | 3 | ~8 | ConnectionStatus, CoachMark, Badge |
| **Utilities** (2) | 1 | ~3 | ErrorBoundary |
| **Hooks** (16) | 3 | ~8 | useAuthFlow, useAutoUpdate, usePinSubmission |
| **Services** (14) | 4 | ~15 | errorMessages, formatEvent, formatRelativeTime, validation/match |
| **Total** | ~28 | ~70-80 | — |

### Current language patterns
- **Text hardcoded directly** in JSX: `"Cargando partido..."`, `"Panel de Organizador"`, `"Nueva Mesa"`
- **Fallback defaults** in JSX: `currentMatch.playerNames?.a || 'Jugador A'`
- **Pure service functions** with hardcoded strings: `formatEvent()`, `formatRelativeTime()`, `getErrorMessage()`
- **Error messages** centralized in `errorMessages.ts`
- **Validation messages** in `validation/match.ts`
- **A few English outliers**: Badge labels (`Waiting`, `Configuring`, `Live`, `Finished`), some aria-labels (`"History"`, `"Settings"`), `"VS"` in VSDivider

### Service-layer functions that return display strings (must accept i18n)
- `services/match/formatEvent.ts` — returns `"Set N - A 11-5"`, `"A: 11-9"`, `"Corr: 11-9"`
- `services/date/formatRelativeTime.ts` — returns `"recién"`, `"hace 5m"`, `"hace 2h"`
- `services/errors/errorMessages.ts` — returns error strings like `"PIN de mesa incorrecto"`
- `services/validation/match.ts` — returns validation error strings

## Affected Areas

### Files with hardcoded UI text

```
client/src/pages/AuthPage/AuthPage.tsx
client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx
client/src/pages/RefereeDashboardPage/RefereeDashboardPage.tsx
client/src/pages/SpectatorDashboardPage/SpectatorDashboardPage.tsx
client/src/pages/ScoreboardPage/ScoreboardPage.tsx
client/src/pages/NotFoundPage/NotFoundPage.tsx
client/src/pages/HistoryViewPage/HistoryViewPage.tsx
client/src/components/organisms/DashboardGrid/DashboardGrid.tsx
client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx
client/src/components/organisms/ScoreboardMain/components/ScoreDecorations.tsx
client/src/components/organisms/ScoreboardMain/components/ScoreboardHeader.tsx
client/src/components/organisms/HistoryDrawer/HistoryDrawer.tsx
client/src/components/molecules/MatchConfigModal/MatchConfigModal.tsx
client/src/components/molecules/PinModal/PinModal.tsx
client/src/components/molecules/ConfirmDialog/ConfirmDialog.tsx
client/src/components/molecules/PageHeader/PageHeader.tsx
client/src/components/molecules/TableStatusChip/TableStatusChip.tsx
client/src/components/molecules/MatchContext/MatchContext.tsx
client/src/components/molecules/MatchHistoryTicker/MatchHistoryTicker.tsx
client/src/components/molecules/HistoryAccordion/HistoryAccordion.tsx
client/src/components/molecules/HistoryList/HistoryList.tsx
client/src/components/molecules/HistoryTableSection/HistoryTableSection.tsx
client/src/components/molecules/ScoreDisplay/ScoreDisplay.tsx
client/src/components/atoms/ConnectionStatus/ConnectionStatus.tsx
client/src/components/atoms/CoachMark/CoachMark.tsx
client/src/components/atoms/Badge/Badge.tsx
client/src/components/utilities/ErrorBoundary/ErrorBoundary.tsx
client/src/hooks/useAuthFlow.ts
client/src/hooks/useAutoUpdate.tsx
client/src/hooks/usePinSubmission.ts
client/src/services/match/formatEvent.ts
client/src/services/date/formatRelativeTime.ts
client/src/services/errors/errorMessages.ts
client/src/services/validation/match.ts
```

### Files to create
```
client/src/i18n/index.ts                        # i18n init + config
client/src/i18n/locales/es-AR.json              # Argentine Spanish translations
client/src/i18n/locales/en-US.json              # English translations (future)
```

### Test files that need mock providers
```
(estimated 5-10 files with component tests)
```

### NOT affected (no hardcoded text)
- `routes.ts`, `shared/types.ts`, `shared/events.ts`, `shared/validation.ts`
- CSS/tailwind files
- Auth/Socket contexts (no UI text)
- Pure data hooks (useSocket, useMatchDisplay, useDashboardStats, etc.)
- PIN validation, crypto services

## Approaches

### 1. **react-i18next** — Recommended

The industry standard for React i18n. Uses a provider-based approach with `useTranslation()` hook.

| Factor | Assessment |
|--------|-----------|
| **Bundle size** | ~7KB gzipped (i18next + react-i18next) |
| **React 19 compat** | ✅ i18next v24+ supports React 19 |
| **TypeScript 6** | ✅ @types/i18next, fully typed |
| **Vite 8** | ✅ Zero-config with Vite, works with ESM |
| **Interpolation** | ✅ Built-in: `"Ganador: {{name}}"` |
| **Plurals** | ✅ Built-in plural rules |
| **Nested JSON** | ✅ `t("match.winner")` syntax |
| **Language detection** | ✅ `i18next-browser-languagedetector` |
| **Lazy loading** | ✅ `i18next-http-backend` (not needed at this size) |
| **ICU syntax** | ❌ Not natively supported (needs `i18next-icu`) |
| **Dev experience** | ✅ Excellent — react-i18next eslint plugin, translation scanner tools |

**Pros:**
- Hooks-based (`useTranslation`) — natural fit for React components
- Works inside pure services via the `i18next` singleton (critical for `formatEvent`, `formatRelativeTime`)
- Interpolation and plurals built in
- Lightweight for a PWA
- Huge ecosystem with CLI tools for managing translation files
- `Trans` component for JSX-within-translations if needed

**Cons:**
- Initialization boilerplate (provider, config, language detector)
- Some complexity for a currently single-language app

### 2. **react-intl (FormatJS)**

ICU MessageFormat-based library with rich formatting capabilities.

| Factor | Assessment |
|--------|-----------|
| **Bundle size** | ~15KB+ gzipped |
| **React 19 compat** | ⚠️ v7.x targets React 18, React 19 compat unclear |
| **TypeScript 6** | ✅ Good TS support |
| **Vite 8** | ✅ Works with Vite |
| **Interpolation** | ✅ Via ICU placeholders `{name}` |
| **Plurals/select** | ✅ ICU `{count, plural, ...}` and `{gender, select, ...}` |
| **Date/number format** | ✅ Built-in `FormattedDate`, `FormattedNumber` |
| **Nested JSON** | ❌ Flat key structure only |
| **Bundle impact** | Heavier — includes Intl polyfills for older browsers |

**Pros:**
- `FormattedRelativeTime` could replace `formatRelativeTime.ts`
- `FormattedNumber` handles locale-aware formatting
- Powerful ICU for complex plural/gender rules
- Well-structured API with `<FormattedMessage>` component

**Cons:**
- Heavier bundle — less ideal for a PWA
- ICU syntax is verbose for simple strings (`"Hello {name}"` instead of `"Hello {{name}}"`)
- No nested JSON keys (everything is flat namespace)
- React 19 compatibility is uncertain at this point
- Harder to call from pure services (needs imperative API)

### 3. **Custom lightweight solution**

Build exactly what's needed with a thin wrapper.

| Factor | Assessment |
|--------|-----------|
| **Bundle size** | <1KB |
| **Developer effort** | Medium (initial), High (ongoing) |
| **React 19** | ✅ Full control |
| **TypeScript** | ✅ Manual type safety |
| **Interpolation** | ❌ Must implement |
| **Plurals** | ❌ Must implement |
| **Edge cases** | ❌ Must handle each one manually |

**Pros:**
- Maximum control, zero deps
- Minimal bundle impact
- Can be tailored exactly to this codebase

**Cons:**
- Re-implementing what i18next gives you for free
- No ecosystem tooling (translation scanners, lint rules, management UIs)
- Adding a 2nd language means building plural rules, date formatting, etc. from scratch
- Higher maintenance burden
- Team/contributor unfamiliarity (no standard patterns)

## Recommendation

### Use **react-i18next**

This is the right choice for three reasons specific to this project:

1. **Service-layer compatibility**: `formatEvent()`, `formatRelativeTime()`, and `errorMessages.ts` are pure functions outside React. react-i18next provides the `i18next` singleton that can be imported and called (`i18next.t()`) from anywhere — not just React components. This is CRITICAL for this project because the real-time formatting pipeline lives in services, not components.

2. **Bundle/cost ratio**: At ~7KB gzipped, it's the lightest full-featured solution. For a PWA that needs to install on mobile devices, every KB matters. The feature set (interpolation, plurals, nested JSON, language detection) justifies the cost.

3. **Future-proof**: If the app grows to 3+ languages, react-i18next has the ecosystem (translation management, lint rules for missing keys, automated extraction) to handle it. Replacing a custom system at that point would be painful.

### Dependencies to add
```json
{
  "i18next": "^24.2.0",                          // Core
  "react-i18next": "^15.4.0",                    // React bindings
  "i18next-browser-languagedetector": "^8.0.0"   // Auto-detect browser lang
}
```

Bundle impact: ~7KB gzipped addition (from ~150KB current → ~157KB).

## File Structure Proposal

```
client/src/
├── i18n/
│   ├── index.ts                  # i18n init, config, export i18next instance
│   └── locales/
│       ├── es-AR.json            # Argentine Spanish (current content)
│       └── en-US.json            # English (future, or start partial)
├── services/
│   ├── match/formatEvent.ts      # Update: accept `t` param OR use i18next directly
│   ├── date/formatRelativeTime.ts# Update: use i18next-based relative time
│   └── errors/errorMessages.ts   # Update: use translation keys instead of hardcoded strings
└── [components/pages/hooks]      # Update: import `useTranslation`, replace strings with `t()`
```

### Translation file structure (es-AR.json)
```json
{
  "common": {
    "back": "Atrás",
    "cancel": "Cancelar",
    "confirm": "Confirmar",
    "loading": "Cargando..."
  },
  "auth": {
    "selectRole": "Elige tu rol",
    "owner": "Organizador",
    "referee": "Árbitro",
    "spectator": "Espectador",
    "enterOwnerPin": "Ingresa tu PIN de Organizador",
    "yourPinIs": "Tu PIN es:",
    "usePinToEnter": "Usalo para entrar como organizador"
  },
  "dashboard": {
    "owner": { "title": "Panel de Organizador", "subtitle": "Crea mesas, gestiona árbitros y partidos" },
    "referee": { "title": "Panel de Árbitro", "subtitle": "Gestiona tu mesa y arbitra" },
    "spectator": { "title": "Mesas Disponibles" },
    "newTable": "Nueva Mesa",
    "viewHistory": "Ver Historial",
    "noTables": "No hay mesas disponibles",
    "tryLater": "Intenta más tarde",
    "tableLabel": "Mesa {{number}}"
  },
  "scoreboard": {
    "refRevoked": "Árbitr@ removido",
    "refRevokedDesc": "El organizador ha regenerado el PIN de esta mesa.",
    "redirecting": "Redirigiendo a sala de espera...",
    "loading": "Cargando partido...",
    "matchFinished": "¡Partido Finalizado!",
    "winner": "Ganador: {{name}}",
    "continue": "Continuar",
    "coachmark": "Tocá cualquier lado del marcador para sumar un punto",
    "tapToSpectate": "Tocá para spectar",
    "serving": "Saque"
  },
  "history": {
    "title": "Historial",
    "loading": "Cargando historial…",
    "noEvents": "Sin eventos registrados",
    "noEventsYet": "Sin eventos aún",
    "event": "evento",
    "events": "eventos",
    "expandAll": "Expandir todos",
    "collapseAll": "Colapsar todos",
    "point": "Punto",
    "setWon": "Set ganado",
    "correction": "Corrección"
  },
  "notFound": {
    "title": "Página no encontrada",
    "message": "La ruta que intentaste acceder no existe.",
    "goHome": "Volver al inicio"
  },
  "errors": {
    "invalidPin": "PIN de mesa incorrecto",
    "invalidOwnerPin": "PIN de organizador incorrecto",
    "rateLimited": "Demasiados intentos. Esperá un minuto.",
    "refAlreadyActive": "Ya hay un árbitro activo en esta mesa",
    "tableNotFound": "Mesa no encontrada",
    "unauthorized": "No autorizado",
    "notOwner": "No tenés permisos de organizador",
    "unknown": "Error desconocido: {{code}}",
    "validationError": "Error de validación: {{code}}",
    "pinMustBe8Digits": "El PIN debe tener exactamente 8 dígitos",
    "connectionError": "Error de conexión",
    "noConnection": "Sin conexión",
    "invalidPinShort": "PIN inválido",
    "couldNotAssignRef": "No se pudo asignar el árbitro",
    "timeout": "Tiempo de espera agotado",
    "connectionLost": "Conexión perdida"
  },
  "connection": {
    "connected": "Conectado",
    "connecting": "Conectando",
    "noConnection": "Sin Conexión",
    "disconnected": "Desconectado"
  },
  "match": {
    "configTitle": "Configurar Partido",
    "forTable": "para {{tableName}}",
    "players": "Jugadores",
    "playerAPlaceholder": "Jugador A",
    "playerBPlaceholder": "Jugador B",
    "bestOf": "Mejor de",
    "handicap": "Handicap",
    "teamA": "Equipo A",
    "teamB": "Equipo B",
    "startMatch": "Iniciar Partido",
    "starting": "Iniciando...",
    "enterPin": "Ingresa el PIN",
    "toEnter": "para entrar a {{tableName}}",
    "enter": "Entrar",
    "verifying": "Verificando...",
    "pin": "PIN:",
    "setsLabel": "Sets:",
    "cleanTable": "Limpiar Mesa",
    "deleteTable": "Eliminar Mesa",
    "cleanConfirmTitle": "Limpiar Mesa",
    "cleanConfirmMessage": "¿Estás seguro de resetear esta mesa? Se borrarán los nombres, el score y se generará un nuevo PIN.",
    "deleteConfirmTitle": "Eliminar Mesa",
    "deleteConfirmMessage": "¿Estás seguro de eliminar la mesa? Esta acción no se puede deshacer.",
    "confirmDelete": "Eliminar",
    "confirmClean": "Limpiar",
    "phaseQuarterfinal": "Cuartos de Final",
    "phaseSemifinal": "Semifinal",
    "phaseFinal": "Final",
    "matchXofY": "Partido {{number}} de {{total}}",
    "pointsPerSet": "pts/set",
    "updateAvailable": "Nueva versión disponible",
    "updateNow": "Actualizar",
    "updating": "Actualizando...",
    "later": "Después"
  },
  "validation": {
    "pointsPerSetRange": "Puntos por set debe estar entre {{min}} y {{max}}",
    "bestOfRange": "Mejor de debe estar entre {{min}} y {{max}}",
    "bestOfOdd": "Mejor de debe ser un número impar",
    "minDifference": "Diferencia mínima debe ser al menos 1",
    "handicapARange": "Handicap A debe estar entre 0 y 20",
    "handicapBRange": "Handicap B debe estar entre 0 y 20"
  },
  "event": {
    "set": "Set {{number}} - {{player}} {{scoreA}}-{{scoreB}}",
    "point": "{{player}}: {{scoreA}}-{{scoreB}}",
    "correction": "Corr: {{scoreA}}-{{scoreB}}",
    "relativeTime": {
      "justNow": "recién",
      "minutesAgo": "hace {{count}}m",
      "hoursAgo": "hace {{count}}h"
    }
  },
  "badge": {
    "waiting": "Waiting",
    "configuring": "Configuring",
    "live": "Live",
    "finished": "Finished"
  },
  "stats": {
    "tables": "Mesas",
    "matches": "Partidos",
    "players": "Jugadores"
  }
}
```

## Risks and Considerations

### 1. Real-time Socket.IO formatting pipeline

`formatEvent()` and `formatRelativeTime()` are **pure functions** outside React's component tree. They're called from `MatchHistoryTicker` and `HistoryDrawer` — both of which render real-time updates as points are scored.

**Solution**: Import the `i18next` singleton directly in these modules and call `i18next.t()`. This works because i18next initializes once and is available outside React. When the language changes, the singleton updates, and components that re-render will pick up the new translation.

```
// services/match/formatEvent.ts
import i18next from 'i18next'

export function formatEvent(event: ScoreChange): string {
  switch (event.action) {
    case 'SET_WON':
      return i18next.t('event.set', { number: event.setNumber, player: event.player, ... })
    // ...
  }
}
```

### 2. Server sends English status values

`TableStatus` values (`'WAITING'`, `'CONFIGURING'`, `'LIVE'`, `'FINISHED'`) come from the server and are displayed in:
- `ScoreboardBar.tsx` — shows `{status}` in a badge
- `Badge.tsx` — the `WaitingBadge`, `LiveBadge`, etc. components have hardcoded English text

**Solution**: Either map statuses through translation keys (`t('badge.waiting')`) or keep status badges as-is (they're de facto UI constants understood in any language).

### 3. Badge labels — intentional English?

The Badge components currently display `"Waiting"`, `"Configuring"`, `"Live"`, `"Finished"` — these are the **only** English strings in the UI. They could be:
- Translated to Spanish for consistency
- Kept as-is (they're common tournament terminology)
- Made configurable via translations

**Recommendation**: Translate them to keep the app fully internationalized. Current badge labels in Spanish would be: "Esperando", "Configurando", "En Vivo", "Finalizado".

### 4. Dynamic content (player names, table names)

Player names, table names, and scores are user-entered data. They must NOT be translated.

**Solution**: Keep dynamic content outside `t()` calls. Use interpolation to inject them into translated strings:
```tsx
// ✅ Correct
t('scoreboard.winner', { name: playerName })

// ❌ Wrong
t(playerName)
```

### 5. Match status shown directly from server

In `ScoreboardBar.tsx`, the raw `status` string is rendered:
```tsx
<Caption className="...">{status}</Caption>
```
This displays `"WAITING"`, `"LIVE"`, etc. directly. This needs a mapping function.

**Solution**: Map `TableStatus` values through a translation function in the component.

### 6. Fallback text in JSX

Many components have inline fallbacks like `currentMatch.playerNames?.a || 'Jugador A'`. These defaults are also hardcoded Spanish strings.

**Solution**: Defaults should use `t()` calls too, or be pulled from the translation file:
```tsx
{currentMatch.playerNames?.a || t('match.playerAFallback')}
```

### 7. Test infrastructure

~30+ test files exist. Component tests that render translated text will need an i18n mock provider or `jest.mock('react-i18next')` setup.

**Solution**: Create a test utility that wraps components with `I18nextProvider` and a test-ready i18next instance.

### 8. Vite + dynamic JSON imports

Translation JSON files must be imported as static assets (or bundled) to avoid runtime fetch overhead in the PWA. With Vite, JSON imports work seamlessly:
```ts
import es from './locales/es-AR.json'
```

**Risk**: Dynamic `fetch()`-based loading (via `i18next-http-backend`) would add unnecessary complexity — bundle the JSON at build time.

### 9. Chained PR strategy

Given ~25-30 files to touch and ~150-200 lines changed, this exceeds the 400-line cognitive review budget by a bit. Recommend splitting into **3 chained PRs**:

| PR | Scope | Files | Est. lines |
|----|-------|-------|------------|
| **PR 1: Infrastructure** | i18n config, locale JSON, language detector, context provider, test utilities | 5 | ~100 |
| **PR 2: Components & Pages** | Replace all hardcoded strings in pages, organisms, molecules, atoms with `t()` calls | ~20 | ~100 |
| **PR 3: Services & Hooks** | Update `formatEvent`, `formatRelativeTime`, `errorMessages`, validation strings, hooks with i18n | 8 | ~50 |

## Estimated Effort

| Metric | Value |
|--------|-------|
| **Files to create** | 3-4 (i18n config, locale JSON files) |
| **Files to modify** | 25-30 (components, pages, hooks, services) |
| **Lines to add/change** | ~150-200 (imports + string replacements + translations) |
| **New dependencies** | 3 (`i18next`, `react-i18next`, `i18next-browser-languagedetector`) |
| **Bundle impact** | +~7KB gzipped (from ~150KB → ~157KB) |
| **Test files to touch** | 5-10 (add i18n mock provider) |
| **Chained PRs** | 3 recommended |
| **Total complexity** | Medium |

### Key takeaways
- **~70-80 distinct strings** across **~28 files** — manageable scope
- **Entirely Spanish today** — adding English doubles the content
- **Reactive services** (`formatEvent`, `formatRelativeTime`) are the trickiest part — need singleton access to i18n
- **No server changes needed** — this is 100% client-side
- **Bundle impact is minimal** — i18next is only ~7KB gzipped

## Ready for Proposal

**Yes** — there is enough information to write a detailed proposal. The approach is clear (react-i18next), the file structure is defined, and all edge cases are identified.
