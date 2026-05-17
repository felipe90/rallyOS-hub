# Design: Kiosk Auto-Rotation

**Change**: kiosk-auto-rotation
**Requires**: spec.md

## Summary

Single-component addition to `KioskAllTablesPage.tsx`. Auto-rotates through pages of table cards when they overflow the viewport. Static grid when they fit. No external libraries, no backend changes.

## Component Architecture

No new component file — the rotation logic fits inline in `KioskAllTablesPage.tsx` using hooks. The page is 83 lines currently and the rotation adds ~80 lines total. Keeping it inline avoids prop drilling and keeps the component tree flat.

### State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `pages` | `TableInfo[][]` | Current tables split into page buckets |
| `currentPage` | `number` | Active page index |
| `isRotating` | `boolean` | Derived: `pages.length > 1` |

No `isOverflow` flag needed — `pages.length` already encodes it (1 page = static, >1 = rotating).

### Hooks

1. **`useResponsiveQrSize`** — Already implemented. Calculates QR size from viewport width.
2. **`useResizeObserver`** — Already available via a ref on the grid container (or inline `ResizeObserver` in a useEffect).
3. **`usePageRotation`** — Core rotation hook (see below).

## Core Algorithm

### Overflow Detection → Page Calculation

```
onTablesChange (tables array changes) OR onResize:
  1. Measure availableHeight = window.innerHeight - headerOffset - padding
  2. cardRowHeight ≈ 200px (fixed from KioskTableCard layout)
  3. columns = responsive breakpoint (1 cols mobile, 2 md, 3 xl)
  4. cardsPerPage = Math.floor(availableHeight / cardRowHeight) * columns
  5. If ALL cards fit (tables.length <= cardsPerPage):
       - pages = [tables] (single page, static mode)
  6. If overflow:
       - Split tables into chunks of cardsPerPage
       - pages = chunks[]
  7. Clamp currentPage if it exceeds new pages.length
```

**Measurement approach**: Use a `ResizeObserver` on a `div ref` wrapping the grid area. Compare `scrollHeight` vs `clientHeight` of a hidden measurement element, OR simpler: calculate from `window.innerHeight - known_header_height`.

**Simpler approach** (recommended): Hard-code card height estimates + current column count from CSS. This avoids DOM measurement entirely and is more predictable:

```ts
const HEADER_HEIGHT = 180 // header + padding
const CARD_HEIGHT = 200   // approximate from KioskTableCard layout (p-6 md:p-8 + scores)
const CARD_GAP = 24       // gap-6
const COLUMNS = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1

const availableHeight = window.innerHeight - HEADER_HEIGHT
const rowsPerPage = Math.max(1, Math.floor(availableHeight / (CARD_HEIGHT + CARD_GAP)))
const cardsPerPage = rowsPerPage * COLUMNS
```

### Timer Management

```ts
useEffect(() => {
  if (pages.length <= 1) return // static mode, no timer

  const interval = setInterval(() => {
    setCurrentPage(prev => (prev + 1) % pages.length)
  }, ROTATION_INTERVAL_MS) // = 10_000

  return () => clearInterval(interval)
}, [pages.length, ROTATION_INTERVAL_MS])
```

No pause on hover/touch — this is a TV with no input.

Visibility changes (TV sleep/wake):

```ts
useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      // page hidden → timer naturally clears on re-render
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  return () => document.removeEventListener('visibilitychange', handleVisibility)
}, [])
```

With React 19, the interval effect already cleans up when `pages.length` changes since it's a dependency. The `setInterval` naturally stops when the page is hidden because React pauses renders, but to be safe, we reset the timer on visibility change by toggling a `resetKey` state.

### Page Rendering

```tsx
{pages.length <= 1 ? (
  // Static mode: render all cards at once, tighter spacing
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6 flex-1 content-start">
    {activeTables.map(table => <KioskTableCard key={table.id} table={table} condensed />)}
  </div>
) : (
  // Rotation mode: render only current page's cards
  <div className="flex-1 flex flex-col">
    <div
      key={currentPage}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 flex-1 content-start opacity-100 transition-opacity duration-500"
    >
      {pages[currentPage].map(table => <KioskTableCard key={table.id} table={table} />)}
    </div>
    {/* Page indicators */}
    <div className="flex justify-center gap-2 pb-4">
      {pages.map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-colors duration-300 ${
            i === currentPage ? 'bg-primary' : 'bg-primary/30'
          }`}
        />
      ))}
    </div>
  </div>
)}
```

### Fade Transition

When `currentPage` changes, React re-mounts the `div` with `key={currentPage}`, which causes a re-render with `opacity-0` → `opacity-100`. However, we need a cross-fade.

**Simpler approach**: Use two layers — one fading out (previous page), one fading in (current page). Or use `animate-ping` / custom keyframes.

**Even simpler**: Accept that React will unmount/remount and just use `transition-opacity` with `animate-fadeIn`. No flicker because the card content is static while transitioning.

**Recommended**: Use a `useRef` + `setTimeout` approach:

1. When page changes → add `opacity-0` to current content
2. After 300ms → swap content, add `opacity-100`
3. During transition, keep old content visible via absolute positioning

Or simplest of all: wrap the grid in a parent with `overflow-hidden` and use `transform translateX` slide.

**Final recommendation**: Simple opacity transition:

```tsx
const [fadeState, setFadeState] = useState<'visible' | 'hidden'>('visible')

useEffect(() => {
  if (pages.length <= 1) return
  setFadeState('hidden')
  const t = setTimeout(() => {
    setCurrentPage(prev => (prev + 1) % pages.length)
    setFadeState('visible')
  }, 300) // fade-out duration
  return () => clearTimeout(t)
}, [currentPage, pages.length])
```

## Static Mode (condensed)

When all cards fit, render with `gap-4` (tighter) and pass `condensed` prop to `KioskTableCard` for reduced padding. The condensed variant uses `p-4 md:p-5` instead of `p-6 md:p-8`.

## QR Code

Already implemented:
- **Size**: Responsive to viewport (5% of width, 80-160px clamped)
- **URL**: Full `https://{domain}:{port}` displayed in monospace

## Affected Files

| File | Action | Lines Changed |
|------|--------|---------------|
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | Modified | ~+80 lines (rotation logic + states) |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.test.tsx` | Modified | ~+40 lines (rotation tests) |
| `client/src/components/organisms/KioskTableCard/KioskTableCard.tsx` | Modified | small — `condensed` prop |

## Test Strategy

### Unit Tests (via mock)

| Scenario | Mock | Assertion |
|----------|------|-----------|
| Static mode when cards fit | Set viewport large, 3 tables | Grid renders with `gap-4`, no indicators |
| Rotation mode when overflow | Set viewport small, 8 tables | Indicators visible, only 1 page shown at a time |
| Page advances on timer | Use `vi.advanceTimersByTime(10000)` | `currentPage` increments |
| Page wraps around | Start on last page | Advances to page 0 |
| Dynamic: tables added mid-rotation | Increase mock tables length | Page count recalculates, indicator updates |

### Mocking ResizeObserver

No mock needed if using viewport calculation approach (window.innerHeight). Just mock `window.innerHeight`:

```ts
Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
```

## Rollback Plan

Revert the commit containing rotation logic → `KioskAllTablesPage.tsx` restores to current state (QR + URL + static grid). No data migration needed.

## Open Questions

1. **Card height**: Current estimate is 200px. Should measure actual rendered height or hard-code?
2. **Transition**: Simple opacity fade, or slide? Fade is simpler, slide is more polished.
3. **Rotation interval**: 10s feels right. User wants shorter/longer?
