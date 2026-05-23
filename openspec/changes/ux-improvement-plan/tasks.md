# Tasks: UX Improvement Plan

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~640 total (~130+180+90+180+60 across 5 PRs) |
| 400-line budget risk | High (total) — each PR slice ≤180 |
| Chained PRs recommended | Yes |
| Suggested split | 5 stacked PRs → main |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Design foundation | PR 1 | Token dedup, fonts, PWA theme, safe-area |
| 2 | Accessibility core | PR 2 | Contrast, reduced motion, focus trap, ARIA |
| 3 | Component fixes | PR 3 | Undo button, QR extraction, labels, key events |
| 4 | Feedback system | PR 4 | Toast provider, queue, integration |
| 5 | Navigation & polish | PR 5 | Back buttons, error icons, aria-labels |

## Phase 1: Design Foundation

- [x] 1.1 Remove universal `*:not([style*="border"]) { border-radius }` rule from `index.css`; add `.card { border-radius: var(--radius-md); }` in `@layer components`
- [x] 1.2 Add `card` class to ~15 card-bearing elements: KioskTableCard, TableStatusChip, PageHeader, modals, buttons
- [x] 1.3 Remove `!rounded-none` workaround from `QRCodeImage.tsx`
- [x] 1.4 Dedup `:root` tokens in `index.css`: keep only scoreboard vars + safe-area; remove duplicate `@theme` copies
- [x] 1.5 PWA manifest: `theme_color: '#006b5f'`, `background_color: '#f7f9fb'` in `vite.config.ts`
- [x] 1.6 `<meta name="theme-color">` to `#006b5f` in `index.html`
- [x] 1.7 Download Space Grotesk + Manrope variable woff2 to `public/fonts/`; update `@font-face` in `index.css` to local paths
- [x] 1.8 Remove Workbox Google Fonts runtime caching entries from `vite.config.ts`
- [x] 1.9 Add `overscroll-behavior: none` to kiosk body class in `index.css`
- [x] 1.10 Extract `useResponsiveQrSize()` from `KioskAllTablesPage.tsx` → `hooks/useResponsiveQrSize.ts`; export from `hooks/index.ts`
- [x] 1.11 Kiosk logo: replace `h-10` with `style={{ height: qrSize }}` in `KioskAllTablesPage.tsx`

## Phase 2: Accessibility Core

- [x] 2.1 Create `--color-text-muted` token in `@theme` with ≥4.5:1 contrast; replace `text-text/30`, `text-text/50`, `text-text/60` across all component files
- [x] 2.2 Create `useFocusTrap(containerRef, isActive)` hook in `hooks/useFocusTrap.ts`
- [x] 2.3 Add `role="dialog" aria-modal="true"` + `useFocusTrap` to MatchConfigModal, PinModal, KioskNotificationModal, TournamentResumeModal
- [x] 2.4 Add Escape-key dismiss to TournamentResumeModal
- [x] 2.5 Add `role="alertdialog"` to ConfirmDialog
- [x] 2.6 Add `<main id="main-content">` wrapper to KioskAllTablesPage, ScoreboardPage, OwnerDashboardPage, RefereeDashboardPage, HistoryViewPage
- [x] 2.7 Add skip-to-main-content link as first focusable element in `index.html`
- [x] 2.8 Add `useReducedMotion()` guard to 10 animated components: ConnectionStatus, CoachMark, HistoryDrawer, KioskNotificationToast, Button, ToggleButton, DashboardGrid, StatCard, ScoreDisplay, HoldToConfirmButton
- [x] 2.9 Change `<meta name="viewport">` `maximum-scale=1.0` → `maximum-scale=5.0` in `index.html`
- [x] 2.10 Add `aria-label` via i18n to all icon-only buttons: undo, close, settings, history
- [x] 2.11 Add `<label htmlFor>` to MatchConfigModal player name inputs (wrap existing inputs)

## Phase 3: Component Fixes

- [ ] 3.1 PlayerScoreArea: move undo button outside `motion.section` tap area; increase size 48→64px; add `navigator.vibrate?.(10)` in `handleTap` and `handleUndo`
- [ ] 3.2 TableStatusChip: wrap QR in separate div with `onClick={(e) => e.stopPropagation()}`; clicking QR opens fullscreen QR modal (≥250px) with backdrop dismiss
- [ ] 3.3 Create QR fullscreen modal component (or reuse modal pattern) for kiosk table cards
- [ ] 3.4 HistoryDrawer: remove `opacity-0 group-hover:opacity-100` from undo button; make permanently visible with `focus-visible` ring + `aria-label` via i18n
- [ ] 3.5 OwnerDashboardPage: replace `onKeyPress` with `onKeyDown` on table name input (line ~267)
- [ ] 3.6 HistoryViewPage: replace `navigate(-1)` with `navigate(Routes.DASHBOARD_OWNER)` (line ~74)

## Phase 4: Feedback System

- [ ] 4.1 Create `Toast.types.ts` with `ToastVariant`, `ToastItem`, `ToastContextValue` interfaces
- [ ] 4.2 Create `ToastProvider.tsx` context + `addToast(variant, message, duration?)` method; wrap app in `main.tsx`
- [ ] 4.3 Create `Toast.tsx` single toast component with 4 variants (success/error/warning/info) using Framer Motion
- [ ] 4.4 Create `ToastContainer.tsx` with queue (max 3, FIFO auto-dismiss via setTimeout), rendered via `createPortal` to `#toast-root`
- [ ] 4.5 Add `<div id="toast-root" />` after `#root` in `index.html` + portal target
- [ ] 4.6 Toast respects `prefers-reduced-motion`: disable AnimatePresence transitions when reduce is active
- [ ] 4.7 Integrate success/error toasts in OwnerDashboardPage: table create, clean, delete, PIN error
- [ ] 4.8 Integrate info toasts in ScoreboardPage: match started, ended, winner dialog
- [ ] 4.9 Integrate error toasts in AuthPage: connection errors, PIN failures
- [ ] 4.10 Create barrel export `components/molecules/Toast/index.ts`

## Phase 5: Navigation & Polish

- [ ] 5.1 ConnectionStatus: add `role="status" aria-live="polite"` to container div
- [ ] 5.2 CoachMark: add `pb-[env(safe-area-inset-bottom)]` to motion wrapper (line ~52)
- [ ] 5.3 Error displays in MatchConfigModal, PinModal, OwnerDashboardPage: add error icon + `role="alert"` wrapper
- [ ] 5.4 ScoreboardActions: replace hardcoded `aria-label="History"`/`"Settings"` with i18n labels
- [ ] 5.5 Audit back buttons across all dashboards: ensure consistent routing (not `navigate(-1)`) to appropriate dashboard
- [ ] 5.6 RefereeDashboardPage and SpectatorDashboardPage: add `<main id="main-content">` wrapper (if not done in P2)
