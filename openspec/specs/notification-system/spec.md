# notification-system Specification

## Purpose

Application-wide toast framework providing success/error/warning feedback to all user roles, with haptic feedback on score interactions.

## Requirements

### Requirement: Toast Notifications

The system MUST provide a ToastProvider with Toast components in four variants: success, error, warning, info. Toasts SHALL auto-dismiss after a configurable duration and stack from the viewport edge (default: bottom-right). Implementation MAY use Framer Motion for enter/exit animations.

#### Scenario: Success toast on table creation

- GIVEN the owner creates a new table
- WHEN the table is persisted
- THEN a success toast appears with a confirmation message and auto-dismisses

#### Scenario: Error toast on failure

- GIVEN an operation fails (network, validation, or server error)
- WHEN the error is caught
- THEN an error toast appears with the error reason

#### Scenario: Warning toast for non-blocking issue

- GIVEN a non-blocking condition occurs (e.g., PIN mismatch retry)
- WHEN the condition is detected
- THEN a warning toast appears

#### Scenario: Info toast for status change

- GIVEN a system state changes (e.g., match started, match ended)
- WHEN the state transition completes
- THEN an info toast appears

#### Scenario: Multiple toasts stack

- GIVEN a toast is visible
- WHEN a second toast fires before the first dismisses
- THEN both are visible, stacked, each with its own auto-dismiss timer

#### Scenario: App toasts do not overlap kiosk broadcast

- GIVEN the kiosk view is displayed with a KioskNotificationToast at the screen bottom
- WHEN an app-level toast fires on a non-kiosk view
- THEN app toasts and kiosk broadcast toasts occupy distinct z-index layers and do not visually overlap

### Requirement: Toast Reduced Motion

Toast enter/exit animations MUST be disabled when `prefers-reduced-motion: reduce` is active. Static appearance with auto-dismiss SHALL be used instead.

#### Scenario: Reduced motion disables toast animation

- GIVEN OS-level "Reduce motion" is enabled
- WHEN a toast fires
- THEN it appears without animation and fades out without motion

### Requirement: Haptic Feedback

The system SHALL call `navigator.vibrate(10)` on player score tap and undo actions, with feature detection (`'vibrate' in navigator`). If vibrate is unsupported, the call MUST be silently ignored.

#### Scenario: Haptic on score tap

- GIVEN device supports vibration
- WHEN a player taps their score area to increment
- THEN the device vibrates for 10ms

#### Scenario: No haptic on unsupported device

- GIVEN device does not support vibration
- WHEN a player taps their score area
- THEN no error is thrown and the score increments normally

### Requirement: Toast Action Binding (Expected Usage)

The toast system SHALL be triggered for these lifecycle events:
- `table:created` → success toast (table name)
- `pin:verified` → success toast
- `match:started` → info toast
- `match:ended` → info toast
- Any caught error boundary → error toast

#### Scenario: PIN verified toast

- GIVEN a referee enters the correct PIN
- WHEN PIN verification succeeds
- THEN a success toast confirms access
