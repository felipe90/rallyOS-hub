# Delta for kiosk-display

## MODIFIED Requirements

### Requirement: Kiosk Notification Toast Overlay

The kiosk toast MUST use headline typography ≥48pt bold (`text-5xl` to `text-7xl`) and subtext at 28-32pt (`text-3xl`). Container height SHALL be 15-20% viewport height (`min-h-[15vh]`). Background MUST be near-opaque (≤10% transparency, e.g., `bg-gray-900/90`) — no glassmorphism or blur. Icons SHALL be ≥64px (`size={64}` minimum, 80px preferred) with color contrasting against the toast background. Toast SHALL position at `bottom-0`. The component MUST use `role="alert"` and respect `prefers-reduced-motion`. Color mapping SHALL remain: info=green, warning=amber, error=red, important=primary. Toast MUST auto-dismiss after configured duration and MUST NOT obscure active table scores.

(Previously: generic "semi-transparent, color-coded, auto-dismiss" with no typography scale, sizing constraints, icon requirements, or accessibility attributes.)

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

## ADDED Requirements

### Requirement: Non-Kiosk Toast Unaffected

Toast typography, sizing, and icon scale changes MUST only apply in kiosk mode. When the component is used outside kiosk context, the existing small-toast design SHALL be preserved unchanged.

(TOAST-007)

#### Scenario: Non-kiosk retains original design

- GIVEN non-kiosk mode (desktop, tablet)
- WHEN a notification appears
- THEN headline <48pt AND icon <64px AND no viewport-proportional height applied
