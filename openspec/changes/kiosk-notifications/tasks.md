# Tasks: Kiosk Notifications

## Review Workload Forecast

Est. changed lines: 580–650. Split: PR1 shared+server → PR2 kiosk → PR3 owner-modal.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Notes |
|------|------|----|-------|
| 1 | Shared contracts + server handler | 1 | Autonomous; server-test verifiable |
| 2 | Client state + toast + kiosk page | 2 | Depends on PR 1 types |
| 3 | Modal + owner dashboard + i18n | 3 | Depends on PR 1 types |

## Phase 1: Shared Layer (TDD)

- [x] 1.1 **RED**: Failing test for `KioskNotificationType`, `KioskNotificationData`, `NOTIFICATION_RULES` (max 280 chars, duration enum, type enum)
- [x] 1.2 **GREEN**: `shared/events.ts` — add `SEND_NOTIFICATION` (CLIENT) + `KIOSK_NOTIFICATION` (SERVER)
- [x] 1.3 **GREEN**: `shared/types.ts` — add `KioskNotificationType` union + `KioskNotificationData` interface
- [x] 1.4 **GREEN**: `shared/validation.ts` — add `NOTIFICATION_RULES` + `sanitizeMessage()`
- [x] 1.5 **REFACTOR**: Follow existing conventions (`as const`, RFC 2119 JSDoc); shared tests pass

## Phase 2: Server Handler (TDD)

- [x] 2.1 **RED**: Failing server test: PIN reject, rate-limit 5/min, HTML stripped, broadcast shape
- [x] 2.2 **GREEN**: `server/src/handlers/AdminHandler.ts` — register `SEND_NOTIFICATION`: validate PIN (`comparePin`), rate-limit via `RateLimiter`, strip HTML, `timestamp: Date.now()`, `io.emit(KIOSK_NOTIFICATION)`
- [x] 2.3 **REFACTOR**: Extract helper; scope rate-limit per IP; server tests pass

## Phase 3: Client State + Toast (TDD)

- [x] 3.1 **RED**: Failing test: `useSocketState` sets `kioskNotification` on `KIOSK_NOTIFICATION`, clears on null
- [x] 3.2 **GREEN**: Add state + listener in `client/src/hooks/useSocketState.ts`; expose via `client/src/hooks/useSocket.ts`
- [x] 3.3 **RED**: Failing test: `KioskNotificationToast` renders icon+message, plays sound, auto-dismisses, silent fallback
- [x] 3.4 **GREEN**: Create `client/src/components/organisms/KioskNotificationToast/` — `index.ts`, component, test. Web Audio `OscillatorNode` per design table (4 types). Framer `AnimatePresence`. Fixed bottom, `z-50`, semi-transparent. `setTimeout` auto-dismiss.
- [x] 3.5 **REFACTOR**: Pure sound fn, try-catch audio context; component tests pass

## Phase 4: Modal + Wiring + i18n (TDD)

- [x] 4.1 **RED**: Failing test: `KioskNotificationModal` type selector, char counter, duration default 5s, empty msg blocked
- [x] 4.2 **GREEN**: Create `client/src/components/molecules/KioskNotificationModal/` — `index.ts`, component, test. Type picker, textarea (max 280+live counter), duration dropdown (5/10/15/30s), submit emits `SEND_NOTIFICATION`.
- [x] 4.3 **GREEN**: `OwnerDashboardPage.tsx` — add "Create Notification" button in `dashboardActions`; toggle modal with socket emit on submit
- [x] 4.4 **GREEN**: `KioskAllTablesPage.tsx` — read `kioskNotification` from context; render `KioskNotificationToast` when non-null
- [x] 4.5 **GREEN**: `client/src/i18n/locales/es.json` + `en-US.json` — labels for types, modal title, button, char counter
- [x] 4.6 **REFACTOR**: Match existing component patterns; all page/component tests pass

## Phase 5: Integration & Verification

- [ ] 5.1 Round-trip: emit `SEND_NOTIFICATION` → validate → rate-limit → broadcast → client receives sanitized
- [ ] 5.2 Kiosk display: toast at bottom, 4 cards fully visible (spec scenario)
- [ ] 5.3 Walk all 9 spec scenarios from both delta specs
- [ ] 5.4 Full suite: `cd client && npm test && cd ../server && npm test`
