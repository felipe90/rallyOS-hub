# Delta for qr-scoreboard-link

## MODIFIED Requirements

### Requirement: WiFi QR Code

The system MUST render a WiFi QR using `WIFI:T:WPA;S:{ssid};P:{password};;` from hub config. The QR SHALL render at a minimum scan size of 256px (logical CSS pixels) to ensure scannability from a reasonable distance on the kiosk display.

(Previously: WiFi QR rendered without a minimum size constraint.)

#### Scenario: QR renders from hub config

- GIVEN hub config has ssid="rallyhub" and wifiPassword="abc123"
- WHEN scoreboard renders
- THEN QR encodes `WIFI:T:WPA;S:rallyhub;P:abc123;;`

#### Scenario: QR meets minimum scan size on kiosk

- GIVEN the scoreboard renders on a 1080p HDMI display
- WHEN the WiFi QR is visible
- THEN the QR element has logical dimensions ≥256px in both width and height

#### Scenario: QR responsive sizing respects minimum

- GIVEN the scoreboard renders on a 720p display
- WHEN the viewport size triggers responsive QR sizing
- THEN the QR never scales below 256px

## REMOVED Requirements

None.
