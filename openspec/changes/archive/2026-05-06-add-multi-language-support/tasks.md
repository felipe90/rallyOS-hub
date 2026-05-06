# Tasks: Multi-Language Support

## Review Workload Forecast

Estimated lines: ~510 (240 low-cog JSON). 400-line risk: High. Needs size:exception.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

| Unit | Goal | Notes |
|------|------|-------|
| 1 | Phase 1 Infra | i18n module, deps, wiring |
| 2 | Phase 2-4 Migration | All components + services |

## Phase 1: Infrastructure

- [x] **1.1** `package.json` — add i18next, react-i18next, i18next-browser-languagedetector (+3 lines)
- [x] **1.2** `client/src/i18n/index.ts` — i18next init, `useI18n()` hook, singleton `i18nText` (~30 lines)
- [x] **1.3** `client/src/i18n/locales/es-AR.json` (~120 lines) + `en-US.json` (~120 lines)
- [x] **1.4** `main.tsx` — `import './i18n'` before App (+1 line)
- [x] **1.5** `App.tsx` — wrap tree with `I18nextProvider` (~5 lines)
- [x] **1.6** `test-utils.tsx` — add `renderWithI18n()` (~30 lines)

Deps: 1.1→1.2→1.4→1.5; 1.3, 1.6→1.2. Unlocks all phases.

## Phase 2: Molecules & Atoms (Props Pattern)

- [x] **2.1** `ScoreDisplay.tsx` — accept `label` prop (~5 lines)
- [x] **2.2** `MatchConfigModal.tsx` — accept `title`, `submitLabel` props (~8 lines)
- [x] **2.3** `PageHeader.tsx` — accept `title`, `backLabel` props (~5 lines)
- [x] **2.4** `Badge.tsx` — convenience badges accept `label` prop (~8 lines)
- [x] **2.5** `ConnectionStatus.tsx` — accept `label` prop (~5 lines)

Deps: none. Callers (Phase 3) depend on these.

## Phase 3: Pages & Organisms (Hook Pattern)

- [x] **3.1** `NotFoundPage.tsx` — 3 strings → `i18nText('notFound.*')` (~5 lines)
- [x] **3.2** `ScoreboardPage.tsx` — ~8 strings → `i18nText('scoreboard.*')` (~12 lines)
- [x] **3.3** `AuthPage.tsx` — ~6 strings → `i18nText('auth.*')` (~10 lines)
- [x] **3.4** `OwnerDashboardPage.tsx` — ~5 strings → `i18nText('owner.*')` (~8 lines)
- [x] **3.5** `RefereeDashboardPage.tsx` — ~4 strings → `i18nText('referee.*')` (~6 lines)
- [x] **3.6** `SpectatorDashboardPage.tsx` — ~3 strings → `i18nText('spectator.*')` (~5 lines)
- [x] **3.7** `HistoryViewPage.tsx` — ~3 strings → `i18nText('history.*')` (~5 lines)
- [x] **3.8** `ScoreboardMain.tsx + ScoreboardHeader.tsx` — labels → `i18nText()` (~8 lines)
- [x] **3.9** `HistoryDrawer.tsx` — titles → `i18nText('history.*')` (~5 lines)
- [x] **3.10** `DashboardGrid.tsx` — labels → `i18nText('dashboard.*')` (~5 lines)
- [x] **3.11** `usePinSubmission.ts + useAuthFlow.ts` — return error codes; callers translate (~15 lines)

Deps: Phase 1 + 2. All independent within phase.

## Phase 4: Services (Singleton Pattern)

- [x] **4.1** `formatEvent.ts` — format strings → `i18nText('event.*', params)` (~8 lines)
- [x] **4.2** `formatRelativeTime.ts` — Spanish → `i18nText('event.relativeTime.*')` (~8 lines)
- [x] **4.3** `errorMessages.ts` — ERROR_MESSAGES map → `i18nText('errors.*')` (~15 lines)
- [x] **4.4** `validation/match.ts` — strings → `i18nText('validation.*')` (~8 lines)

Deps: 1.2 only. All independent.

## Phase 5: Test Updates

- [x] **5.1** Page/organism tests: `render()` → `renderWithI18n()` (~10 files, ~2 lines each)
- [x] **5.2** Service tests: add `vi.mock('@/i18n', ...)` (~4 files, ~3 lines each)

Deps: Phase 2-4.

## Order

Phase 1 first. Then Phase 2 + 4 in parallel. Phase 3 after Phase 2. Phase 5 alongside each migration.
