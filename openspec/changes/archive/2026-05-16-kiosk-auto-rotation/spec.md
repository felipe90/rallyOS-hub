# Spec: Kiosk Auto-Rotation

**Change**: kiosk-auto-rotation
**Status**: Draft
**Requires**: proposal.md

## Summary

KioskAllTablesPage shows active tables as cards in a responsive grid. On a TV/kiosk with many tables, cards overflow the viewport requiring scroll — but the display is hands-free (no mouse, no touch, no keyboard). When cards fit the viewport, show them statically with tighter spacing. When they overflow, auto-rotate through pages with smooth fade transitions and page indicator dots.

## Device Constraints

- **Display**: Horizontal TV (landscape), 16:9 or similar
- **Input**: NONE — purely informational display. No hover, no touch, no mouse, no keyboard
- **Interaction model**: Fully automatic continuous rotation
- **Viewing distance**: 1–5 meters

## Required Behavior

### R1: Overflow Detection

```
Scenario: Cards fit in viewport — static grid mode
  Given the kiosk page has N active tables
  And all N cards fit within the visible viewport height (no scroll)
  Then the page renders as a static grid with ALL cards visible
  And NO rotation UI elements (no page indicators, no rotation)
  And grid spacing uses gap-4 (tighter) and reduced card padding

Scenario: Cards overflow viewport — rotation mode activates
  Given the kiosk page has N active tables
  And N cards overflow the visible viewport height (scroll would be needed)
  Then rotation mode activates automatically
  And cards are split into pages that each fit the viewport
  And page indicator dots appear at the bottom of the content area
  And the first page is shown immediately on activation

Scenario: Transition from static to rotation when tables are added
  Given the page starts in static grid mode (cards fit)
  When new active tables are added and cards now overflow
  Then the page transitions to rotation mode

Scenario: Transition from rotation to static when tables finish
  Given the page is in rotation mode (cards overflow)
  When enough tables finish and remaining cards fit the viewport
  Then the page transitions back to static grid mode
```

### R2: Auto-Rotation

```
Scenario: Page advances on timer in rotation mode
  Given rotation mode is active with P pages
  When T seconds elapse (T = rotation interval)
  Then the display advances to the next page (currentPage + 1)
  And resets to page 0 after reaching the last page

Scenario: Rotation interval is configurable
  Given rotation mode is active
  Then the rotation interval is defined as a constant at the top of the file
  And the default value is 10_000ms

Scenario: Rotation pauses when the page is hidden
  Given rotation mode is active
  When the browser tab or window becomes hidden (document.hidden = true)
  Then the rotation interval is cleared
  When the browser tab or window becomes visible again
  Then the rotation interval restarts from the current page

Scenario: Page count changes mid-rotation
  Given rotation mode is active with P pages on page K
  When tables are added/removed and the page count changes to P'
  Then if K >= P', clamp to P' - 1 (last page)
  Otherwise keep K
  And the rotation interval is reset
```

### R3: Page Transitions

```
Scenario: Fade transition between pages
  Given rotation mode is active on page K
  When the timer triggers advancement to page K+1
  Then the current page fades out (opacity 0, duration 500ms)
  Then the next page fades in (opacity 1, duration 500ms)
  And both pages are fully opaque during their display period

Scenario: No flicker during live score updates
  Given rotation mode is active showing page K
  When a score update arrives via socket for a card on page K
  Then the card re-renders in place WITHOUT affecting the fade timing
  And the transition still triggers on schedule
```

### R4: Page Indicators

```
Scenario: Page indicator dots show current position
  Given rotation mode is active with P pages
  Then P indicator dots are displayed as a centered row at the bottom of the content area
  And the dot for the current page is filled (solid color)
  And all other dots are outline (empty)
  And dots transition when the page changes

Scenario: No indicators in static mode
  Given static grid mode is active
  Then NO page indicators are rendered
```

### R5: QR Code Size & URL Display

```
Scenario: QR code scales responsively to display size
  Given hubConfig.wifiPassword is available
  Then the QR code SVG renders at a size proportional to viewport width
  And the size is 5% of viewport width, clamped between 80px (min) and 160px (max)
  And the QR updates on window resize
  And is scannable from TV viewing distance at any supported resolution

Scenario: Full URL displayed alongside QR
  Given hubConfig.domain is available
  Then the header displays the full URL: "https://{domain}:{port}"
  And the URL is rendered in monospace font for clarity
  And the URL is always visible regardless of table count
```

### R6: Empty State

```
Scenario: Empty state is unchanged
  Given there are ZERO active tables
  Then the existing empty state message ("No active matches") is displayed
  And no rotation or grid layout is rendered
```

## Non-Requirements (explicitly OUT of scope)

- No hover, touch, or mouse interaction of any kind
- No external libraries (no react-window, framer-motion, etc.)
- No pagination buttons or manual controls
- No virtual scrolling or windowing
- No backend changes
- No configurable timing via UI (constants only)
- No animation library — CSS transitions only

## Affected Files

| File | Action | Description |
|------|--------|-------------|
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | Modified | **Already done**: QR 120px + full URL display. **Pending**: overflow detection, rotation logic, page indicators |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.test.tsx` | Modified | Update existing tests + add rotation behavior tests |
| `client/src/components/organisms/KioskTableCard/KioskTableCard.tsx` | Modified (optional) | Add `condensed` prop for reduced padding in static-fit mode |

## Integration Points

- **SocketContext**: `tables` array (reactive) — no changes needed. Existing `TABLE_LIST` global broadcast drives re-renders.
- **ResizeObserver**: Built-in browser API. Falls back to always-rotate if unavailable in test (jsdom).

## Migration / Backward Compatibility

- Pure client-side change. No data migration needed.
- Existing tests must continue to pass.
- New behavior is additive (static grid stays when cards fit).
