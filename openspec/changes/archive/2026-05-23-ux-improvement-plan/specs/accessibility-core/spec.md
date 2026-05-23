# accessibility-core Specification

## Purpose

WCAG AA compliance baseline: contrast, reduced motion, screen-reader support, focus management, and zoom restoration — applied to all user-facing views.

## Requirements

### Requirement: Text Color Contrast

All visible text MUST achieve a contrast ratio ≥4.5:1 against its background. The tokens `text-text/30` (1.4:1), `text-text/50` (2.0:1), and `text-text/60` (2.8:1) SHALL be replaced with alternatives reaching the threshold.

#### Scenario: Low-opacity text replaced

- GIVEN a component uses `text-text/30`, `text-text/50`, or `text-text/60`
- WHEN the page renders
- THEN the rendered text has contrast ≥4.5:1

#### Scenario: Large text threshold

- GIVEN text at 18px+bold or 24px+ regular
- WHEN the page renders
- THEN the rendered text has contrast ≥3:1 (WCAG AA large-text exception)

### Requirement: Reduced Motion

The system MUST disable non-essential animations when `prefers-reduced-motion: reduce` is active. Components: ConnectionStatus, CoachMark, HistoryDrawer, KioskNotificationToast, Button, ToggleButton, DashboardGrid, StatCard, ScoreDisplay, HoldToConfirmButton.

#### Scenario: System reduced-motion preference

- GIVEN OS-level "Reduce motion" is enabled
- WHEN any of the 10 animated components render
- THEN transitions and animations are disabled

#### Scenario: No reduced-motion preference

- GIVEN OS-level "Reduce motion" is disabled
- WHEN components render
- THEN animations play normally

### Requirement: Skip Navigation Link

A skip-to-main-content link MUST be the first focusable element in `index.html`. Activation SHALL move focus to `<main>` and set `tabindex="-1"` on the target.

#### Scenario: Keyboard user skips to main

- GIVEN page loads
- WHEN Tab is pressed and then Enter on the skip link
- THEN focus moves to `<main>` and subsequent Tab moves to first interactive element inside it

### Requirement: Modal Accessibility

Four modals (MatchConfigModal, PinModal, KioskNotificationModal, TournamentResumeModal) MUST declare `role="dialog" aria-modal="true"`. Focus SHALL be trapped inside the modal while open and restored to the trigger element on close.

#### Scenario: Modal opens with focus trap

- GIVEN a modal trigger is activated
- WHEN the modal opens
- THEN `role="dialog"` and `aria-modal="true"` are present AND focus cycles inside the modal

#### Scenario: Modal closes returns focus

- GIVEN a modal is open with focus inside
- WHEN the modal is dismissed via close button or Escape
- THEN focus returns to the trigger element

### Requirement: Confirm Dialog Role

The ConfirmDialog component MUST use `role="alertdialog"` to announce destructive or confirmation actions to screen readers.

#### Scenario: Destructive confirmation announced

- GIVEN ConfirmDialog opens for a destructive action
- WHEN a screen reader is active
- THEN the dialog is announced as an alert requiring immediate attention

### Requirement: Screen Reader Announcements

Live regions, errors, icon buttons, and form inputs MUST declare ARIA roles and labels. ConnectionStatus SHALL use `role="status" aria-live="polite"`. Error displays SHALL use `role="alert"` with an icon. Icon-only buttons SHALL have `aria-label` via i18n. MatchConfigModal inputs SHALL have `<label>` or `aria-label`.

#### Scenario: Connection lost announced

- GIVEN the Socket.IO connection drops
- WHEN ConnectionStatus re-renders
- THEN screen reader announces the disconnection

#### Scenario: Error announced

- GIVEN an operation fails
- WHEN the error display renders
- THEN `role="alert"` triggers immediate screen reader announcement

#### Scenario: Icon button label

- GIVEN an icon-only button (undo, close, settings)
- WHEN a screen reader encounters it
- THEN a meaningful action label is announced, not raw markup

#### Scenario: Input label

- GIVEN MatchConfigModal is open
- WHEN screen reader focuses a player name input
- THEN "Player 1 name" (i18n) is announced

### Requirement: Pinch Zoom

The viewport meta tag MUST allow `maximum-scale=5.0` (not `1.0`) to restore user pinch-to-zoom capability.

#### Scenario: User pinches to zoom

- GIVEN the app is loaded on a mobile device
- WHEN user performs a pinch gesture
- THEN the page scales up to 5×
