# qr-scoreboard-link Specification

## Purpose

Static WiFi QR on scoreboard enables network connection. Domain text guides to web app.

**Data source**: hub config via existing Socket.IO connection (`{ ssid, wifiPassword }`). Domain from `HUB_DOMAIN` env var. No `QR_DATA` event consumed.

## Requirements

### Requirement: WiFi QR Code

The system MUST render a WiFi QR using `WIFI:T:WPA;S:{ssid};P:{password};;` from hub config.

#### Scenario: QR renders from hub config

- GIVEN hub config has ssid="rallyhub" and wifiPassword="abc123"
- WHEN scoreboard renders
- THEN QR encodes `WIFI:T:WPA;S:rallyhub;P:abc123;;`

### Requirement: Domain Link Text

Below the QR, the system MUST display "Abrí {domain}" using HUB_DOMAIN env var.

#### Scenario: Domain text below QR

- GIVEN HUB_DOMAIN="rallyos-hub.local"
- WHEN scoreboard renders
- THEN "Abrí rallyos-hub.local" appears below the QR

### Requirement: Missing Credentials Fallback

When wifiPassword is absent from hub config, the system SHALL hide the QR and display domain text only.

#### Scenario: QR hidden without wifiPassword

- GIVEN hub config lacks wifiPassword
- WHEN scoreboard renders
- THEN QR is hidden AND domain text still renders

### Requirement: Kiosk-Only Visibility

WiFi QR and domain text SHALL render ONLY on the kiosk all-tables view (TV scoreboard). Other scoreboard views (per-table referee, view) SHALL NOT display the QR.

#### Scenario: QR on kiosk only

- GIVEN hub config provides wifiPassword
- WHEN kiosk all-tables view (`/scoreboard/all/kiosk`) displays
- THEN WiFi QR and domain text are visible

#### Scenario: QR absent on per-table views

- GIVEN hub config provides wifiPassword
- WHEN a per-table scoreboard view (referee, view) displays
- THEN WiFi QR and domain text are NOT visible
