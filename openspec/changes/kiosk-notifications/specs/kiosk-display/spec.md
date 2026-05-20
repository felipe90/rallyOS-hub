# Delta for kiosk-display

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Live Scoreboard Grid

The kiosk MUST render active tables in a responsive CSS grid for HDMI (1080p/720p). Socket.IO score updates MUST update cards without page reload. Card add/remove on status transitions SHALL animate smoothly.

(Previously: consumed `score:update` and `table:statusUpdate`. Now also consumes `KIOSK_NOTIFICATION`.)

**Socket.IO events consumed (Server→Client):**

| Event | Direction | Effect |
|-------|-----------|--------|
| `score:update` | Server→Client | Updates single table card score |
| `table:statusUpdate` | Server→Client | Adds card (LIVE/WAITING) or removes card (FINISHED) |
| `KIOSK_NOTIFICATION` | Server→Client | Renders color-coded toast at bottom |

#### Scenario: Multi-table grid

- GIVEN 4 LIVE tables
- WHEN kiosk loads
- THEN 2×2 grid with names and scores

#### Scenario: Single table centered

- GIVEN 1 LIVE table
- WHEN kiosk loads
- THEN card centered

#### Scenario: Live score update

- GIVEN kiosk shows 2 tables
- WHEN `score:update` for table-1
- THEN only table-1 updates

#### Scenario: Table finishes removed

- GIVEN table-3 LIVE
- WHEN `table:statusUpdate` → FINISHED
- THEN card removed

#### Scenario: New table added

- GIVEN kiosk shows 2 tables
- WHEN `table:statusUpdate` → LIVE for new table
- THEN card added to grid

#### Scenario: Toast does not obscure scores

- GIVEN cards displayed AND `KIOSK_NOTIFICATION` received
- WHEN toast renders
- THEN all cards remain visible
