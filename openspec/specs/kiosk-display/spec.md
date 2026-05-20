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

### Requirement: Kiosk Notification Toast Overlay

Kiosk MUST render toast at screen BOTTOM, semi-transparent, color-coded, auto-dismiss after configured duration. Toast MUST NOT obscure active table scores.

#### Scenario: Toast at bottom, scores visible

- GIVEN 4 active cards displayed
- WHEN `KIOSK_NOTIFICATION` arrives
- THEN toast at bottom, all cards fully visible

#### Scenario: Toast auto-dismiss

- GIVEN toast displayed
- WHEN duration elapses
- THEN animates out, removed from DOM
