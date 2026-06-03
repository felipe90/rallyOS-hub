# qr-scoreboard-link Specification

## Purpose

Static WiFi QR on scoreboard enables network connection. Domain text guides to web app.

**Data source**: hub config via existing Socket.IO connection (`{ ssid, wifiPassword }`). Domain from `HUB_DOMAIN` env var. No `QR_DATA` event consumed.

## Requirements

### Requirement: WiFi QR Code

The system MUST render a WiFi QR using `WIFI:T:WPA2;S:{ssid};P:{password};H:false;;` from hub config. Encryption type SHALL be `T:WPA2` to match hostapd `wpa=2` AES-only configuration. Hidden SSID parameter `H:false` MUST be included explicitly. Both WiFi QR and URL QR SHALL use error correction level `H` (30%) for readability on glare-prone TV screens. QR MUST render at 180px (confirmed for venue TV readability).

#### Scenario: WPA2 QR triggers auto-connect

- GIVEN AP configured with `wpa=2` and `rsn_pairwise=CCMP` (WPA2/AES only)
- WHEN user scans WiFi QR on phone
- THEN device auto-connects to WiFi without opening manual settings

#### Scenario: QR encodes correct WPA2 format

- GIVEN hub config has ssid="rallyhub" and wifiPassword="abc123"
- WHEN kiosk renders
- THEN QR value is `WIFI:T:WPA2;S:rallyhub;P:abc123;H:false;;`

#### Scenario: QR meets minimum scan size on kiosk

- GIVEN scoreboard on a 1080p HDMI display
- WHEN WiFi QR is visible
- THEN QR element has logical dimensions of 180px in both width and height

#### Scenario: QR error correction at level H

- GIVEN either WiFi QR or URL QR is rendered
- WHEN QRCodeSVG component is instantiated
- THEN `level="H"` (30% error correction) is used

### Requirement: Domain Link Text

Below the QR, the system MUST display "Abrí {domain}" using HUB_DOMAIN env var.

#### Scenario: Domain text below QR

- GIVEN HUB_DOMAIN="rallyos-hub.local"
- WHEN scoreboard renders
- THEN "Abrí rallyos-hub.local" appears below the QR

### Requirement: Missing Credentials Fallback

When `hubConfig.wifiPassword` is absent, the system SHALL hide only the WiFi QR. The URL QR and domain text SHALL remain visible. Domain text continues to use `hubConfig.domain`.

#### Scenario: WiFi QR hidden, URL QR visible

- GIVEN hub config lacks wifiPassword
- WHEN kiosk renders
- THEN WiFi QR is hidden AND URL QR is visible AND domain text renders

### Requirement: Kiosk-Only Visibility

The WiFi QR, URL QR, and domain text SHALL render ONLY on the kiosk all-tables view (`/scoreboard/all/kiosk`). Other scoreboard views (per-table referee, view) SHALL NOT display either QR.

#### Scenario: Both QRs on kiosk only

- GIVEN hub config provides wifiPassword
- WHEN kiosk all-tables view displays
- THEN both WiFi QR and URL QR are visible with their respective CTAs

#### Scenario: QRs absent on per-table views

- GIVEN hub config provides wifiPassword
- WHEN a per-table scoreboard view (referee, view) displays
- THEN neither WiFi QR nor URL QR is visible

### Requirement: URL QR Code

The kiosk MUST render a second QR code encoding `https://{hubConfig.domain}:{hubConfig.port}` alongside the WiFi QR. The URL value SHALL come exclusively from server-provided `hubConfig` — no hardcoded URLs. Error correction level SHALL be `H` (30%). The URL QR MUST render regardless of whether WiFi QR is present (independent of `hubConfig.wifiPassword`).

(QR-003, QR-006)

#### Scenario: URL QR encodes hub address

- GIVEN hubConfig.domain="rallyos.local" and hubConfig.port=3000
- WHEN kiosk renders
- THEN URL QR encodes `https://rallyos.local:3000`
- AND scanning opens the hub in the device browser

#### Scenario: URL QR renders without WiFi password

- GIVEN `hubConfig.wifiPassword` is empty string or null
- WHEN kiosk renders
- THEN WiFi QR is hidden AND URL QR is visible AND encodes the hub URL

### Requirement: Dual QR Layout

Both QRs MUST render together with distinct CTA labels: "Escaneá para conectarte al WiFi" (WiFi QR) and "Escaneá para abrir rallyOS" (URL QR). Layout SHALL place WiFi QR, URL QR, and URL text in a horizontal row optimized for 1080p kiosk displays.

(QR-004)

#### Scenario: Dual QRs with labeled CTAs

- GIVEN kiosk displays with hubConfig.wifiPassword present
- WHEN view renders
- THEN WiFi QR has WiFi CTA label AND URL QR has app CTA label

#### Scenario: Single QR with label when no WiFi

- GIVEN hubConfig.wifiPassword is absent
- WHEN view renders
- THEN only URL QR renders with its label AND no orphaned WiFi CTA label appears
