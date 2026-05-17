# Tasks: Kiosk Auto-Rotation

**Change**: kiosk-auto-rotation
**Requires**: spec.md, design.md

## Phase 1: KioskTableCard Condensed Variant

- [x] 1.1 Add `condensed?: boolean` prop to `KioskTableCardProps` interface
- [x] 1.2 When `condensed=true`, use `p-4 md:p-5` instead of `p-6 md:p-8`
- [x] 1.3 When `condensed=true`, reduce score font sizes slightly (optional, for denser static grid)

## Phase 2: Page Calculation Logic

- [x] 2.1 Add state variables: `pages: TableInfo[][]`, `currentPage: number`
- [x] 2.2 Implement `calculatePages(tables, viewportHeight)` function:
  - `HEADER_HEIGHT = 180`
  - `CARD_HEIGHT = 200`
  - `CARD_GAP = 24`
  - `COLUMNS` based on `window.innerWidth` breakpoints (1/2/3)
  - `cardsPerPage = Math.floor((viewportHeight - HEADER_HEIGHT) / (CARD_HEIGHT + CARD_GAP)) * COLUMNS`
  - Split `tables` into chunks of `cardsPerPage`
- [x] 2.3 Effect to recalculate pages when `activeTables` changes or window resizes
- [x] 2.4 Clamp `currentPage` if it exceeds new `pages.length`

## Phase 3: Rotation Timer

- [x] 3.1 Add constant `const ROTATION_INTERVAL_MS = 10_000` at top of file
- [x] 3.2 `useEffect` with `setInterval` that advances `currentPage` when `pages.length > 1`
- [x] 3.3 Cleanup interval on unmount or when `pages.length` changes
- [x] 3.4 Handle `visibilitychange` to reset timer when TV wakes from sleep

## Phase 4: Page Rendering

- [x] 4.1 Static mode: when `pages.length <= 1`, render all cards with `gap-4` and `condensed` prop
- [x] 4.2 Rotation mode: when `pages.length > 1`, render only `pages[currentPage]` cards with `gap-6`
- [x] 4.3 Add fade transition: `transition-opacity duration-500` on the grid container
- [x] 4.4 Use `key={currentPage}` on grid container to trigger re-mount with fade

## Phase 5: Page Indicators

- [x] 5.1 Render dot indicators below the grid when `pages.length > 1`
- [x] 5.2 Active dot: `bg-primary` (filled), inactive: `bg-primary/30` (outline)
- [x] 5.3 Centered flex row with `gap-2`, `pb-4`
- [x] 5.4 No indicators in static mode

## Phase 6: Testing

- [x] 6.1 Test static mode: 3 tables fit → no indicators, `gap-4` grid
- [x] 6.2 Test rotation mode: 8 tables overflow → indicators visible, page advances
- [x] 6.3 Test page wrap-around: last page → wraps to page 0
- [x] 6.4 Test dynamic tables: add/remove tables mid-rotation → page count recalculates
- [x] 6.5 Test QR responsive: verify QR size updates on resize (mock window.innerWidth)
- [x] 6.6 Test URL display: full URL visible when hubConfig available

## Pre-work (already completed)

- [x] P.1 QR responsive size (5% vw, 80-160px clamp) — done
- [x] P.2 Full URL `https://{domain}:{port}` displayed in monospace — done
- [x] P.3 `.env.example` default `HUB_WIFI_PASSWORD=rallyos2026` — done
