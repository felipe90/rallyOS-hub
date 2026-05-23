# Delta for kiosk-display

## ADDED Requirements

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
