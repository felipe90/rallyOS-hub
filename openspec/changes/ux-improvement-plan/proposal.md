# Proposal: UX Improvement Plan

## Intent

Transform rallyOS-hub from a functional but unpolished PWA into a professional-grade application. Synthesize 24 issues from two independent audits (external UX evaluation + deep code audit) into a phased delivery that fixes regressions in performance, accessibility, mobile patterns, and error feedback — without altering the match engine or tournament logic under test.

## Scope

### In Scope
- **Phase 1 — Design Foundation**: universal border-radius anti-pattern, duplicated `@theme`/`:root` tokens, PWA splash screen theme alignment, self-host fonts via Workbox, safe-area padding, overscroll-behavior on kiosk pages
- **Phase 2 — Accessibility Core**: WCAG AA contrast (text-text/30, text-text/50), `prefers-reduced-motion` across all 11 animated components, skip-to-main-content link, ARIA roles (`role="dialog"`, `aria-modal`, focus trapping) on 4 modals, `role="alertdialog"` on ConfirmDialog, restore pinch-zoom (remove `maximum-scale=1.0`)
- **Phase 3 — Component Fixes**: undo button moved outside tap-to-score area in PlayerScoreArea, QR removed from TableStatusChip click-target with `stopPropagation`, HistoryDrawer undo made visible to keyboard/touch, `onKeyPress`→`onKeyDown` in OwnerDashboard, `<label>` elements in MatchConfigModal inputs
- **Phase 4 — Feedback System**: application-wide toast/notification (success/error/warning beyond kiosk broadcast), `navigator.vibrate` haptic feedback on score tap
- **Phase 5 — Navigation & Polish**: consistent back button patterns, `navigate(-1)` fallback in HistoryViewPage, CoachMark safe-area-inset-bottom

### Out of Scope
- Visual redesign or rebranding
- New features beyond fixes listed
- Server-side rendering or framework migration
- Tournament lifecycle logic changes

## Capabilities

### New Capabilities
- `accessibility-core`: WCAG AA compliance baseline — responsive motion, screen-reader support, focus management, contrast
- `notification-system`: application-wide toast framework for success/error/warning feedback to all user roles
- `design-token-consolidation`: single-source Tailwind v4 `@theme` tokens, PWA manifest theme alignment, font self-hosting

### Modified Capabilities
- `kiosk-display`: QR rendering inside cards (stopPropagation + 256px minimum), overscroll-behavior containment, CoachMark safe-area
- `qr-scoreboard-link`: QR minimum scan size constraint (was implicit 48px, now explicit 256px)

## Approach

Five stacked PRs, each a self-contained deployable slice targeting one phase. Phase 1 first (foundation for all others), then phases 2–5 in parallel or sequential. Each PR: spec delta → design → tasks → implementation → verify → archive before next begins.

## Affected Areas

| Area | Impact | Phase |
|------|--------|-------|
| `client/src/index.css` | Modified — border-radius, token dedup, self-hosted @font-face, safe-area, overscroll | 1, 2 |
| `client/vite.config.ts`, `client/index.html` | Modified — PWA manifest colors | 1 |
| `client/src/components/molecules/TableStatusChip/` | Modified — QR extraction + stopPropagation | 3 |
| `client/src/components/organisms/ScoreboardMain/components/PlayerScoreArea.tsx` | Modified — undo button reposition | 3 |
| `client/src/components/organisms/HistoryDrawer/` | Modified — visible undo | 3 |
| `client/src/components/molecules/ConfirmDialog/` | Modified — `role="alertdialog"` | 2 |
| `client/src/components/molecules/MatchConfigModal/` | Modified — `<label>` + ARIA | 2 |
| `client/src/pages/OwnerDashboardPage/` | Modified — onKeyDown | 3 |
| `client/src/components/organisms/` (4 modals) | Modified — ARIA roles + focus trapping | 2 |
| `client/src/components/atoms/CoachMark/` | Modified — safe-area | 5 |
| New: `client/src/components/molecules/ToastStack/` | New — app-wide notification | 4 |
| New: `client/src/components/atoms/SkipToMain/` | New — skip link | 2 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Border-radius removal breaks card styling | Med | Audit all components that depend on universal rule; apply radius explicitly to cards/buttons |
| Self-hosted fonts missing Unicode ranges for Spanish | Low | Subset with Latin Extended; validate with ES-AR content |
| WCAG contrast fixes force color palette redesign | Low | Adjust token opacity values; keep primary palette intact |
| Toast system conflicts with kiosk-notification toast | Med | Separate toast stacks (app-toast vs kiosk-toast); distinct z-index layers |
| HistoryDrawer undo visibility regresses swipe behavior | Low | Test swipe + keyboard nav together |

## Rollback Plan

Each phase is an independent PR. Revert the merged PR and redeploy. Phase 1 (index.css + vite.config) is the highest-risk: test with `git revert` on staging before production deployment. No database migrations — all changes are client-side CSS/TSX.

## Dependencies

- Node.js ≥22, React 19, Tailwind v4, Framer Motion 11, Workbox 7 (all already in project)
- No new external packages required (toast system built on existing Framer Motion + Tailwind)

## Success Criteria

- [ ] All 24 identified issues resolved or explicitly deferred with justification
- [ ] `prefers-reduced-motion` respected in all 11 animated components
- [ ] Lighthouse Accessibility score ≥95
- [ ] WCAG AA contrast ratio ≥4.5:1 for all text
- [ ] PWA splash screen matches app theme on cold launch
- [ ] Fonts render on first load without internet (Workbox cache + self-host fallback)
- [ ] Existing Playwright/Vitest/RTL tests pass unchanged
- [ ] Each phase delivers independently deployable, reviewable PR under 400-line budget
