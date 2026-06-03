# kiosk-display Specification

## Purpose

Public read-only scoreboard for HDMI/TV display. No authentication required. Shows all active tables (LIVE/WAITING) in a responsive grid with live Socket.IO updates.

## Requirements

### Requirement: Public Kiosk Route

The system MUST serve `/scoreboard/all/kiosk` without authentication, displaying ALL active tables (LIVE/WAITING) as cards in a responsive grid. Each card SHALL show table name, players, and current score/set. No input controls.

#### Scenario: All-tables kiosk loads without login

- GIVEN browser navigates to `/scoreboard/all/kiosk`
- WHEN no auth token exists
- THEN all active table cards render in grid

#### Scenario: No active tables

- GIVEN no LIVE or WAITING tables
- WHEN kiosk loads
- THEN "Waiting for match to start" displays

#### Scenario: Mixed statuses filtered

- GIVEN table-1 FINISHED, table-2 LIVE, table-3 WAITING
- WHEN kiosk loads
- THEN only table-2 and table-3 cards shown

### Requirement: Kiosk Auto-Launch

A systemd service `rallyos-kiosk.service` MUST launch Chromium kiosk at boot (after Docker), opening `http://localhost:PORT/kiosk`. The launch endpoint redirects to all-tables view.

#### Scenario: Kiosk auto-starts after Docker

- GIVEN Orange Pi boots
- WHEN Docker reaches active state
- THEN Chromium opens full-screen to `http://localhost:3000/kiosk`

#### Scenario: Chromium unavailable fallback

- GIVEN chromium not installed
- WHEN kiosk script runs
- THEN service logs error, exits failed

### Requirement: Active Table Auto-Detection

`GET /kiosk` MUST 302-redirect to `/scoreboard/all/kiosk`. No single-table selection logic.

#### Scenario: Redirect to all-tables view

- GIVEN server running
- WHEN `GET /kiosk`
- THEN 302 → `/scoreboard/all/kiosk`

#### Scenario: Server unreachable retry

- GIVEN server not running
- WHEN `GET /kiosk` called
- THEN Chromium retries every 5s

### Requirement: Live Scoreboard Grid

The kiosk MUST render active tables in a responsive CSS grid optimized for HDMI displays (1080p/720p). Score updates via Socket.IO MUST update individual cards without page reload. Card add/remove on status transitions SHALL animate smoothly.

**Socket.IO events consumed (Server→Client):**

| Event | Direction | Effect |
|-------|-----------|--------|
| `score:update` | Server→Client | Updates single table card score |
| `table:statusUpdate` | Server→Client | Adds card (LIVE/WAITING) or removes card (FINISHED) |
| `KIOSK_NOTIFICATION` | Server→Client | Renders color-coded toast at bottom |

#### Scenario: Toast does not obscure scores

- GIVEN cards displayed AND `KIOSK_NOTIFICATION` received
- WHEN toast renders
- THEN all cards remain visible

#### Scenario: Multi-table grid

- GIVEN 4 LIVE tables
- WHEN kiosk loads
- THEN 2×2 card grid renders with table name, players, score

#### Scenario: Single table centered

- GIVEN 1 LIVE table
- WHEN kiosk loads
- THEN card is centered, fills available space

#### Scenario: Socket.IO live score

- GIVEN kiosk shows 2 tables
- WHEN Server→Client `score:update` for table-1
- THEN only table-1 card updates

#### Scenario: Table finishes → card removed

- GIVEN table-3 shown as LIVE
- WHEN Server→Client `table:statusUpdate` → FINISHED
- THEN card removed from grid

#### Scenario: New table → card added

- GIVEN kiosk shows 2 tables
- WHEN Server→Client `table:statusUpdate` → LIVE for new table
- THEN card added to grid

### Requirement: Set Scores Visible on Kiosk Cards

Each kiosk table card MUST display current set scores below point scores when available. The display SHALL follow the `TableStatusChip` set-score pattern (label + `{a} - {b}`). Set scores MUST be hidden when `currentSets` is absent or both values are zero.

#### Scenario: Set scores display when present

- GIVEN a LIVE table with `currentSets` = `{ a: 2, b: 1 }`
- WHEN the kiosk renders the table card
- THEN "Sets:" label and "2 - 1" are visible below the point scores

#### Scenario: Set scores hidden when absent

- GIVEN a LIVE table without `currentSets`
- WHEN the kiosk renders the table card
- THEN no "Sets:" text or set score numerals appear

#### Scenario: Set scores hidden when both zero

- GIVEN a LIVE table with `currentSets` = `{ a: 0, b: 0 }`
- WHEN the kiosk renders the table card
- THEN no "Sets:" text or set score numerals appear

#### Scenario: Condensed sizing

- GIVEN a LIVE table with `currentSets` in condensed mode
- WHEN the kiosk renders the card
- THEN set scores use condensed font sizes matching the condensed point-score sizing

### Requirement: Kiosk Notification Toast Overlay

The kiosk toast MUST use headline typography ≥48pt bold (`text-5xl` to `text-7xl`) and subtext at 28-32pt (`text-3xl`). Container height SHALL be 15-20% viewport height (`min-h-[15vh]`). Background MUST be near-opaque (≤10% transparency, e.g., `bg-gray-900/90`) — no glassmorphism or blur. Icons SHALL be ≥64px (`size={64}` minimum, 80px preferred) with color contrasting against the toast background. Toast SHALL position at `bottom-0`. The component MUST use `role="alert"` and respect `prefers-reduced-motion`. Color mapping SHALL remain: info=green, warning=amber, error=red, important=primary. Toast MUST auto-dismiss after configured duration and MUST NOT obscure active table scores.

#### Scenario: Venue-scale typography and sizing in kiosk

- GIVEN kiosk mode is active
- WHEN a notification appears
- THEN headline font ≥48pt AND icon size ≥64px AND container height ≥15vh AND background opacity ≥90%

#### Scenario: Toast at bottom, scores visible

- GIVEN 4 active cards displayed
- WHEN `KIOSK_NOTIFICATION` arrives
- THEN toast renders at bottom AND all cards remain fully visible

#### Scenario: Toast auto-dismiss

- GIVEN toast displayed with configured duration
- WHEN duration elapses
- THEN toast animates out and is removed from DOM

#### Scenario: Accessibility with alert role

- GIVEN a notification renders in kiosk mode
- WHEN the toast element mounts
- THEN `role="alert"` is set AND `prefers-reduced-motion` media query is respected

### Requirement: QR Card Interaction

Each kiosk table card that displays a QR code (table link) MUST call `stopPropagation()` on the QR container to prevent triggering the card's navigation. Clicking the QR SHALL open a fullscreen modal with the QR rendered at ≥250px for easy scanning. Tapping outside the QR MUST close the modal.

#### Scenario: QR click opens fullscreen modal

- GIVEN a kiosk card with a QR code is displayed
- WHEN user taps/clicks the QR container
- THEN a fullscreen modal opens with the QR rendered at ≥250px AND card navigation does NOT fire

#### Scenario: Tapping card outside QR navigates normally

- GIVEN a kiosk card with a QR code is displayed
- WHEN user taps/clicks the card area outside the QR
- THEN card navigation fires normally (table details)

#### Scenario: QR modal closes on outside tap

- GIVEN the QR fullscreen modal is open
- WHEN user taps the backdrop or close button
- THEN the modal closes

### Requirement: Overscroll-behavior Containment

Kiosk pages (`/scoreboard/all/kiosk`) and scoreboard pages MUST set `overscroll-behavior: none` to prevent pull-to-refresh and overscroll bounce on touch devices.

#### Scenario: No overscroll on kiosk

- GIVEN the kiosk page is displayed on a touch device
- WHEN user scrolls to the top edge and pulls down
- THEN the page does not refresh or bounce

#### Scenario: Scroll within overflow works

- GIVEN `overscroll-behavior: none` is active
- WHEN user scrolls content that overflows its container
- THEN scrolling within the container works normally

### Requirement: Kiosk Logo Responsive Sizing

The kiosk view logo height SHALL use the same responsive sizing as the QR code (80-160px range, via `useResponsiveQrSize()`). The current fixed `h-10` (40px) MUST be replaced with dynamic sizing.

#### Scenario: Logo matches QR size on large display

- GIVEN the kiosk is on a 1080p display
- WHEN the view renders
- THEN the logo height equals the QR code height

#### Scenario: Logo scales on smaller viewport

- GIVEN the kiosk is on a 720p display
- WHEN the view renders
- THEN the logo height shrinks proportionally with the QR code

### Requirement: CoachMark Safe-Area

The CoachMark overlay on kiosk views MUST apply `padding-bottom: env(safe-area-inset-bottom)` to avoid being obscured by device home indicators (notch, gesture bar).

#### Scenario: CoachMark clears home indicator

- GIVEN the kiosk is displayed on a device with a home indicator bar
- WHEN a CoachMark step renders
- THEN the content is padded above the safe area and not clipped

#### Scenario: CoachMark safe-area on desktop

- GIVEN no safe-area-inset is present (desktop browser)
- WHEN a CoachMark renders
- THEN `env(safe-area-inset-bottom)` resolves to 0 and layout is unaffected

### Requirement: Non-Kiosk Toast Unaffected

Toast typography, sizing, and icon scale changes MUST only apply in kiosk mode. When the component is used outside kiosk context, the existing small-toast design SHALL be preserved unchanged.

(TOAST-007)

#### Scenario: Non-kiosk retains original design

- GIVEN non-kiosk mode (desktop, tablet)
- WHEN a notification appears
- THEN headline <48pt AND icon <64px AND no viewport-proportional height applied
