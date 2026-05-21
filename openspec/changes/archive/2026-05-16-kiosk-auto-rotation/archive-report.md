# Archive Report: kiosk-auto-rotation

**Date archived**: 2026-05-16
**Archive mode**: openspec
**Verification status**: PASS (14/15 compliant, 0 CRITICAL)

## Executive Summary

Implemented auto-rotation for the kiosk all-tables display. When table cards overflow the viewport on a hands-free TV/kiosk, the display automatically rotates through pages with smooth fade transitions and page indicator dots. When cards fit the viewport, they render as a static grid with tighter spacing. No external libraries, no backend changes — pure client-side CSS + React hooks addition to `KioskAllTablesPage.tsx`.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| — | None | No delta specs existed (`specs/` subdirectory absent). Change spec was self-contained at root level. |

The existing `kiosk-display` main spec (`openspec/specs/kiosk-display/spec.md`) remains unchanged — the rotation behavior is an additive feature that doesn't conflict with existing requirements (Live Scoreboard Grid, Socket.IO events, etc.).

## Artifacts Archived

| Artifact | Path | Status |
|----------|------|--------|
| spec.md | `openspec/changes/archive/2026-05-16-kiosk-auto-rotation/spec.md` | ✅ |
| design.md | `openspec/changes/archive/2026-05-16-kiosk-auto-rotation/design.md` | ✅ |
| tasks.md | `openspec/changes/archive/2026-05-16-kiosk-auto-rotation/tasks.md` | ✅ (all 15 tasks complete) |
| verify-report.md | Not found in change folder | ⚠️ — verification was reported PASS externally |

## Task Summary

All 15 tasks completed across 6 phases:

| Phase | Tasks | Status |
|-------|-------|--------|
| Pre-work (QR + URL) | P.1, P.2, P.3 | ✅ |
| Phase 1: KioskTableCard Condensed | 1.1, 1.2, 1.3 | ✅ |
| Phase 2: Page Calculation | 2.1, 2.2, 2.3, 2.4 | ✅ |
| Phase 3: Rotation Timer | 3.1, 3.2, 3.3, 3.4 | ✅ |
| Phase 4: Page Rendering | 4.1, 4.2, 4.3, 4.4 | ✅ |
| Phase 5: Page Indicators | 5.1, 5.2, 5.3, 5.4 | ✅ |
| Phase 6: Testing | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 | ✅ |

## Key Design Decisions

1. **No new component files** — rotation logic fits inline in `KioskAllTablesPage.tsx` using hooks, keeping the component tree flat (~80 lines added)
2. **Viewport calculation over DOM measurement** — uses `window.innerHeight` with hard-coded header/card height estimates instead of ResizeObserver, avoiding jsdom mocking complexity
3. **CSS-only fade transitions** — `transition-opacity duration-500` with `key={currentPage}` for remount-based crossfade, no animation libraries
4. **Condensed prop on KioskTableCard** — optional `condensed?: boolean` reduces padding for static-fit mode (`p-4` vs `p-6`)
5. **Rotation interval**: 10,000ms constant at file top, not configurable via UI

## Affected Files (post-archive)

| File | Change |
|------|--------|
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | +~80 lines: rotation logic, page calculation, indicators |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.test.tsx` | +~40 lines: rotation behavior tests |
| `client/src/components/organisms/KioskTableCard/KioskTableCard.tsx` | Small: `condensed` prop |

## Rollback

Revert the commit containing rotation logic → `KioskAllTablesPage.tsx` restores to prior state (QR + URL + static grid). No data migration needed.
