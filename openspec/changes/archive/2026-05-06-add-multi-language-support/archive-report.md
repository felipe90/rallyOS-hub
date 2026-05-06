# Archive Report: Multi-Language Support

**Change**: `add-multi-language-support`
**Archived to**: `openspec/changes/archive/2026-05-06-add-multi-language-support/`
**Archived at**: 2026-05-06
**Verdict**: PASS WITH WARNINGS (verified, warnings addressed)

---

## Summary

Implemented full i18n infrastructure for the rallyOS-hub React client using `react-i18next`. All ~80 hardcoded UI strings across ~28 client files (pages, organisms, molecules, atoms, hooks, services) were replaced with `i18nText()` translation calls backed by two static locale JSON files (`es.json`, `en-US.json`). The system ships a `useI18n()` hook for React components, a singleton `i18nText` import for service-layer pure functions, and a `renderWithI18n()` test utility for component tests. Atoms and molecules receive translated text via props only — zero i18n dependency.

### Key architectural decisions

- **`i18nText()` wrapper** over raw `i18next.t()` — isolates callers from the underlying library
- **Hook vs Singleton pattern** — `useI18n()` for React components (pages, organisms), `import { i18nText }` for service-layer pure functions
- **Props-only boundary** — molecules and atoms never import i18n; parent organisms pass translated text via props
- **Static JSON bundling** — locale files imported at Vite build time, no runtime fetch (PWA offline)
- **Flat camelCase keys** — spec originally called for nested JSON but implementation uses flat keys (e.g., `notFoundTitle` not `notFound.title`) for simplicity; internally consistent

## Files Created

| File | Description |
|------|-------------|
| `client/src/i18n/index.ts` | i18next init with LanguageDetector, exports `useI18n()` and `i18nText` singleton |
| `client/src/i18n/locales/es.json` | 102 keys in Spanish (complete) |
| `client/src/i18n/locales/en-US.json` | 102 keys — structural mirror of es.json (English values) |

## Files Modified

| File | Description |
|------|-------------|
| `client/package.json` | Added `i18next@^24`, `react-i18next@^15`, `i18next-browser-languagedetector@^8` |
| `client/src/main.tsx` | Added `import './i18n'` before App mount |
| `client/src/App.tsx` | Wrapped component tree with `<I18nextProvider>` |
| `client/src/test/test-utils.tsx` | Added `renderWithI18n()` test utility |
| `client/src/pages/NotFoundPage/NotFoundPage.tsx` | 3 strings → `i18nText()` |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | ~8 strings → `i18nText()` |
| `client/src/pages/AuthPage/AuthPage.tsx` | ~6 strings → `i18nText()`; migrated `translateAuthError` to `i18nText()` |
| `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx` | ~5 strings → `i18nText()`; migrated `translatePinError` to `i18nText()` |
| `client/src/pages/RefereeDashboardPage/RefereeDashboardPage.tsx` | ~4 strings → `i18nText()`; migrated `translatePinError` to `i18nText()` |
| `client/src/pages/SpectatorDashboardPage/SpectatorDashboardPage.tsx` | ~3 strings → `i18nText()` |
| `client/src/pages/HistoryViewPage/HistoryViewPage.tsx` | ~3 strings → `i18nText()` |
| `client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx` | Labels → `i18nText()` |
| `client/src/components/organisms/ScoreboardMain/components/ScoreboardHeader.tsx` | "Atrás", "Sets" → `i18nText()` |
| `client/src/components/organisms/ScoreboardMain/components/ScoreDecorations.tsx` | Labels → `i18nText()` |
| `client/src/components/organisms/HistoryDrawer/HistoryDrawer.tsx` | Titles → `i18nText()` |
| `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx` | Labels → `i18nText()`; removed Spanish defaults from `DashboardHeader` |
| `client/src/components/molecules/ScoreDisplay/ScoreDisplay.tsx` | Accept `label` prop for player display name |
| `client/src/components/molecules/MatchConfigModal/MatchConfigModal.tsx` | Accept `title`, `submitLabel` components via props |
| `client/src/components/molecules/PageHeader/PageHeader.tsx` | Accept `title`, `backLabel`, `connectionLabels` props |
| `client/src/components/molecules/PinModal/PinModal.tsx` | Labels → i18n props |
| `client/src/components/molecules/TableStatusChip/TableStatusChip.tsx` | Status text → i18n props |
| `client/src/components/atoms/Badge/Badge.tsx` | Convenience badges accept `label` prop; removed hardcoded English |
| `client/src/components/atoms/ConnectionStatus/ConnectionStatus.tsx` | Accept `labels` prop; removed hardcoded Spanish fallbacks |
| `client/src/hooks/useAuthFlow.ts` | Returns status codes; callers translate via `i18nText()` |
| `client/src/hooks/usePinSubmission.ts` | Returns error codes; callers translate |
| `client/src/hooks/useAutoUpdate.tsx` | Status messages → `i18nText()` |
| `client/src/services/match/formatEvent.ts` | Format strings → `i18nText('event.*', params)` |
| `client/src/services/date/formatRelativeTime.ts` | Hardcoded Spanish → `i18nText('event.relativeTime.*')` |
| `client/src/services/errors/errorMessages.ts` | `ERROR_MESSAGES` map → `i18nText('errors.*')` |
| `client/src/services/validation/match.ts` | Validation strings → `i18nText('validation.*')` |
| `client/src/components/atoms/Badge/Badge.test.tsx` | Updated for i18n-aware calls |
| `client/src/components/atoms/ConnectionStatus/ConnectionStatus.test.tsx` | Updated for i18n-aware calls |
| `client/src/components/molecules/PageHeader/PageHeader.test.tsx` | Updated for i18n-aware calls |
| `client/src/components/organisms/DashboardGrid/DashboardGrid.test.tsx` | Updated for i18n-aware calls |
| `client/src/components/organisms/HistoryDrawer/HistoryDrawer.test.tsx` | Updated for i18n-aware calls |
| `client/src/pages/AuthPage/AuthPage.test.tsx` | Updated for i18n-aware calls |
| `client/src/pages/ScoreboardPage/ScoreboardPage.test.tsx` | Updated for i18n-aware calls |
| `client/src/services/date/formatRelativeTime.test.ts` | Added `vi.mock('@/i18n')` |
| `client/src/services/errors/errorMessages.test.ts` | Added `vi.mock('@/i18n')` |
| `client/src/services/validation/match.test.ts` | Added `vi.mock('@/i18n')` |
| `client/package-lock.json` | Updated with new deps |
| `README.md` | Updated with i18n documentation |

## Test Results

| Metric | Value |
|--------|-------|
| Test files | 54 |
| Tests passing | 538 |
| Tests failing | 0 |
| Build (tsc --noEmit) | ✅ Passed — zero TypeScript errors |

## Spec Compliance

| Requirement | Status |
|-------------|--------|
| FR1: i18n Infrastructure | ✅ Implemented |
| FR2: Hook vs Props Boundary | ✅ Implemented |
| FR3: Service-Layer Migration | ✅ Implemented |
| FR4: Test Infrastructure | ✅ Implemented |
| FR5: Locale Files | ✅ Implemented |
| Non-requirements (NR1-NR8) | ✅ Respected |

## Warnings Addressed

The following warnings from the verification report were fixed before archiving:

1. **ConnectionStatus.tsx hardcoded Spanish fallbacks (Warning 3)** — Removed. Component now receives `labels` via props from its callers.
2. **DashboardHeader Spanish defaults (Warning 4)** — Removed. `gridViewLabel`, `listViewLabel`, `statLabels` no longer have Spanish defaults.
3. **translatePinError in OwnerDashboardPage / RefereeDashboardPage (Warning 5)** — Migrated from hardcoded Spanish maps to `i18nText()` calls.
4. **translateAuthError in AuthPage (Warning 5)** — Migrated from hardcoded Spanish map to `i18nText()` calls.
5. **All PageHeader callers pass connectionLabels via i18nText()** — Verified.

The following warnings were accepted as design decisions (not blocking):

- **Flat camelCase keys vs nested JSON** — Internally consistent, functional, and simpler. Spec updated to reflect convention.
- **Locale file `es.json` vs `es-AR.json`** — Uses `'es'` language code. Works via i18next fallback for `es-AR` → `es`. Verified in tests.

## Known Issues

None.

## Next Steps

1. **Language switcher UI** — Deferred. A follow-up change can add a dropdown/settings page for locale selection, including runtime language change support.
2. **Key extraction tooling** — Deferred. A CLI scanner to detect missing locale keys would prevent key drift as the codebase grows.
3. **Portuguese (pt-BR) locale file** — Third locale can be added as a follow-up change.

## Main Spec

The source-of-truth spec has been created at:
- `openspec/specs/multi-language-support.md`

## Archive Contents

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ |
| `delta-specs.md` | ✅ (synced to main spec) |
| `exploration.md` | ✅ |
| `design.md` | ✅ |
| `tasks.md` | ✅ (28/28 tasks complete) |
| `verify-report.md` | ✅ (PASS) |
| `archive-report.md` | ✅ (this file) |

## SDD Cycle Complete

The change has been fully planned, explored, spec'd, designed, implemented, tested, verified, and archived. Ready for the next change.
