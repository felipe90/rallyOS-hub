# Proposal: Multi-Language Support

## Intent

~70-80 UI strings hardcoded in Argentine Spanish across ~28 client files. Adds i18n so the app works for international tournament organizers, referees, and spectators (Spanish, English, Portuguese).

## Scope

### In Scope
- All hardcoded text in pages (7), organisms (3), molecules (14), atoms (3), hooks (3), services (4)
- Service-layer formatters (`formatEvent`, `formatRelativeTime`, `errorMessages`, `validation/match`)
- Badge/`TableStatus` display mapping
- Shared i18n test mock for component tests
- Static JSON locale bundling (PWA offline)

### Out of Scope
- Server-side text, user-generated content (names, scores)
- Language switcher UI, dynamic locale loading, runtime language change without reload

## Capabilities

### New Capabilities
- `multi-language-support`: Client renders text via translation keys. Ships es-AR and en-US locale files.

### Modified Capabilities
None — new cross-cutting concern, no spec-level behavior changes.

## Approach

React-i18next (~7KB gzipped): thin wrapper that exposes `i18nText()` (not `t()`) as the translation function everywhere — `useI18n()` hook for components, `i18nText` singleton for service layers. `i18next-browser-languagedetector` for auto-detect, static JSON imports at Vite build time, nested locale files with verbose keys (`es-AR.json`, `en-US.json`), shared `renderWithI18n()` test utility.

**Conventions**:
- **Pages & Organisms**: use `const { i18nText } = useI18n()` → `i18nText('referee.action.removeReferee')`
- **Service layers**: `import { i18nText } from '../i18n'` → `i18nText('event.format.setScore', { ... })`
- **Atoms & Molecules**: receive translated text via **props** only — NO i18n dependency, pure presentational
- **Translation keys**: verbose and self-documenting (e.g., `scoreboard.title.matchInProgress`, not `scoreboard.title` or `match.title`)
- **Locale JSON**: nested keys matching the verbose dot-notation path

## Affected Areas

| Area | Impact | Files |
|------|--------|-------|
| `client/src/i18n/` | New | init + 2 locale files |
| `client/src/pages/` | Modify | 7 pages → `i18nText()` |
| `client/src/components/` | Modify | ~14 — atoms/molecules receive translated text via props only |
| `client/src/services/` | Modify | 4 formatters/errors |
| `client/src/hooks/` | Modify | 3 hooks |
| `client/src/test-utils/` | New | `renderWithI18n` |
| `client/package.json` | Modify | +3 deps |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| +~7KB bundle | High | Acceptable — lightest full-featured option |
| Service singleton sync | Low | `i18next` updates globally |
| JSON key drift | Med | Type-safe keys + CI lint |
| ~30 test files need mocks | Med | Single shared `renderWithI18n` |

## Rollback Plan

Revert `client/package.json`, delete `client/src/i18n/`, revert all `i18nText()` calls to original strings, restore service formatters. All changes additive — safe to revert per-file.

## Dependencies

`i18next@^24.2`, `react-i18next@^15.4`, `i18next-browser-languagedetector@^8.0`

## Success Criteria

- [ ] All 28 files use `i18nText()` keys or locale JSON — no hardcoded Spanish/English
- [ ] es-AR.json covers all original strings
- [ ] en-US.json mirrors key structure (values optional at launch)
- [ ] Service formatters render via `i18nText()` singleton
- [ ] All existing tests pass with mocked i18n
- [ ] Bundle increase ≤ 10KB gzipped
- [ ] No runtime locale fetch — all JSON at build time
