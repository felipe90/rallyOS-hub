# Design: UX Improvement Plan

## Technical Approach

Five stacked PRs to `main`, each independently deployable. Zero new dependencies — all changes use existing React 19, Tailwind v4, Framer Motion 12, and Workbox. Atomic design hierarchy preserved: atoms → molecules → organisms → pages.

---

## Architecture Decisions

| Decision | Option | Tradeoff | Verdict |
|----------|--------|----------|---------|
| Toast system | React Context + createPortal | Extra provider; clean z-index separation from kiosk toast (z-40 vs z-50) | **Chosen**. No Zustand dependency. |
| Focus trap | Custom `useFocusTrap(ref, active)` | Query focusables manually; no new package | **Chosen** over `focus-trap-react` |
| Font hosting | Local woff2 in `public/fonts/` | Manual download of Space Grotesk + Manrope variable woff2; guaranteed offline | **Chosen** over CDN-only |
| Border-radius | `.card` utility in `@layer components` | Must add `card` class to ~15 elements; explicit control | **Chosen** over universal `*` selector |
| Token dedup | Remove duplicate `:root` vars; keep only scoreboard tokens + safe-area | `@theme` block is single source; scoreboard tokens exist in `style={{}}` + `bg-[var(...)]` patterns | **Chosen** |
| Logo sizing | Extract `useResponsiveQrSize()` to shared hook | Currently inline in KioskAllTablesPage; reuse for logo height | **Chosen** over duplication |
| Haptic | `navigator.vibrate?.(10)` inline in handleTap/handleUndo | No hook needed; single-call usage | **Chosen** |

---

## Data Flow

```
ToastProvider (Context)
  addToast(v, msg, dur) → queue(max 3) → FIFO auto-dismiss via setTimeout
  → createPortal → #toast-root (z-40)  ∥  kiosk toast (z-50)

useFocusTrap(ref, isActive)
  open: save activeElement, query focusables → Tab/Shift+Tab cycle
  close: restore saved element

useResponsiveQrSize()
  window.innerWidth * 0.05, clamp 80-160 → logo height = QR size
```

---

## File Changes

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `client/public/fonts/SpaceGrotesk[wght].woff2` | P1 | Self-hosted variable font |
| `client/public/fonts/Manrope[wght].woff2` | P1 | Self-hosted variable font |
| `client/src/hooks/useResponsiveQrSize.ts` | P1 | Extracted from KioskAllTablesPage |
| `client/src/hooks/useFocusTrap.ts` | P2 | Tab cycle + focus restore |
| `client/src/components/molecules/Toast/ToastProvider.tsx` | P4 | Context provider |
| `client/src/components/molecules/Toast/ToastContainer.tsx` | P4 | Portal + queue render |
| `client/src/components/molecules/Toast/Toast.tsx` | P4 | Single toast with variant |
| `client/src/components/molecules/Toast/Toast.types.ts` | P4 | Types |
| `client/src/components/molecules/Toast/index.ts` | P4 | Barrel export |

### Modified Files (By Phase)

**Phase 1 — Foundation**
- `client/src/index.css` — Remove `*` border-radius; add `.card`; change `@font-face` to local; dedup `:root` tokens (keep only scoreboard + safe-area)
- `client/vite.config.ts` — `theme_color: '#006b5f'`, `background_color: '#f7f9fb'`
- `client/index.html` — `theme-color` meta → `#006b5f`
- `client/src/components/molecules/QRCodeImage/QRCodeImage.tsx` — Remove `!rounded-none`
- `client/src/hooks/index.ts` — Export `useResponsiveQrSize`
- `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` — Import hook; logo `style={{ height: qrSize }}`

**Phase 2 — Accessibility**
- `client/index.html` — `maximum-scale=5.0`; skip link before `#root`
- All 4 modals — `role="dialog" aria-modal="true" aria-labelledby="modal-title"` + `useFocusTrap`
- `client/src/components/molecules/TournamentResumeModal/` — Also add Escape dismiss
- `client/src/components/molecules/ConfirmDialog/ConfirmDialog.tsx` — `role="alertdialog"`
- `client/src/components/atoms/ConnectionStatus/ConnectionStatus.tsx` — `role="status" aria-live="polite"`
- Page layouts — Add `id="main-content"` to `<main>` on KioskAllTablesPage, ScoreboardPage, OwnerDashboardPage, RefereeView, HistoryView
- `client/src/index.css` — Replace `text-text/30`, `text-text/50`, `text-text/60` with contrast-safe alternatives

**Phase 3 — Component Fixes**
- `client/src/components/organisms/ScoreboardMain/components/PlayerScoreArea.tsx` — Reposition undo button outside `motion.section` tap area
- `client/src/components/molecules/TableStatusChip/TableStatusChip.tsx` — `stopPropagation` on QR container `onClick`
- `client/src/components/organisms/HistoryDrawer/HistoryDrawer.tsx` — Remove `group-hover:opacity-100` for undo; make keyboard/touch visible
- `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx` — `onKeyPress` → `onKeyDown`
- `client/src/components/molecules/MatchConfigModal/MatchConfigModal.tsx` — Add `<label htmlFor>` to player inputs

**Phase 4 — Feedback**
- `client/src/main.tsx` — Wrap app with `<ToastProvider>`
- `client/src/components/organisms/ScoreboardMain/components/PlayerScoreArea.tsx` — `navigator.vibrate?.(10)` in handleTap/handleUndo

**Phase 5 — Navigation**
- `client/src/components/atoms/CoachMark/CoachMark.tsx` — Add `pb-[env(safe-area-inset-bottom)]`
- `client/src/pages/HistoryViewPage/` — `navigate(-1)` fallback

---

## Interfaces

```ts
// Toast.types.ts
type ToastVariant = 'success' | 'error' | 'warning' | 'info'
interface ToastItem { id: string; variant: ToastVariant; message: string; duration: number }
interface ToastContextValue { addToast: (variant: ToastVariant, message: string, duration?: number) => void }

// useFocusTrap.ts
function useFocusTrap(containerRef: RefObject<HTMLElement>, isActive: boolean): void

// useResponsiveQrSize.ts
function useResponsiveQrSize(): number  // 80–160
```

---

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `useFocusTrap` — tab cycle, focus restore | RTL, mock container |
| Unit | `useResponsiveQrSize` — clamp, resize | jsdom `innerWidth` |
| Unit | Toast queue — max 3, FIFO, auto-dismiss | RTL + `vi.advanceTimersByTime` |
| Unit | Haptic — called on tap, silent on unsupported | `vi.fn()` mock of `navigator.vibrate` |
| Integration | Modal ARIA + focus trap | RTL: open → Tab cycle → Escape → focus restore |
| Integration | QR stopPropagation | RTL: click QR → parent handler not called |
| Integration | Skip link → `#main-content` | RTL: Tab + Enter on skip link |
| E2E | Fonts render offline | Playwright: cache then disconnect |

Existing tests in `PlayerScoreArea`, `KioskTableCard`, `HistoryDrawer`, modal tests pass unchanged.

---

## Dependency Order

```
P1 (Foundation) → P2 (Accessibility) → P3 (Fixes) → P4 (Feedback) → P5 (Navigation)
                     ↘ P3 can start after P1 (no P2 dependency)
```

---

## Open Questions

- [ ] Should toast use manual dismiss (close button) in addition to auto-dismiss?
- [ ] Confirm all 5 page layouts that need `<main id="main-content">` — KioskAllTablesPage, ScoreboardPage, OwnerDashboardPage confirmed; RefereeView and HistoryView likely needed
