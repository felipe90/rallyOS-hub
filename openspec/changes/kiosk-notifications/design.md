# Design: Kiosk Notifications

## Technical Approach

Dedicated `SEND_NOTIFICATION` → `KIOSK_NOTIFICATION` Socket.IO event pair, registered in `AdminHandler`. Owner emits from a modal; server validates PIN, sanitizes, rate-limits, broadcasts. Kiosk `useSocketState` listens and exposes `kioskNotification` state. `KioskNotificationToast` organism renders at the viewport bottom with Framer Motion entry/exit, playing type-specific Web Audio API chimes. Auto-dismisses after owner-configured duration (default 5s).

## Sequence

```
OwnerDashboard (modal) ──emit('SEND_NOTIFICATION', {pin,type,msg,duration})──→ AdminHandler
  ┊
AdminHandler ──validate PIN──→ rate-limit IP──→ sanitize HTML──→ io.emit('KIOSK_NOTIFICATION', payload)
  ┊
useSocketState ──on('KIOSK_NOTIFICATION')──→ setKioskNotification(payload)
  ┊
KioskAllTablesPage ──read kioskNotification──→ render KioskNotificationToast (bottom, z-50)
  ┊
KioskNotificationToast ──playSound(type)──→ AnimatePresence entry──→ setTimeout(duration * 1000) dismiss
```

## Architecture Decisions

| Decision | Option A (chosen) | Option B (rejected) | Why A |
|---|---|---|---|
| **Event pair** | Dedicated `SEND_NOTIFICATION`/`KIOSK_NOTIFICATION` | Reuse `ERROR` with type field | `ERROR` is for protocol faults; mixing user notifications violates SRP and forces every `ERROR` consumer to filter |
| **Handler location** | Extend `AdminHandler` | New `NotificationHandler` class | `AdminHandler` already owns owner-gated operations (`REGENERATE_PIN`, `IS_OWNER`); avoids handler registration overhead and keeps admin concerns co-located |
| **Toast component** | Inline `KioskNotificationToast` organism in `KioskAllTablesPage` | Global NotificationContext + portal | Only the kiosk consumes notifications today; context would be YAGNI. Inline keeps colocation and simplifies cleanup |
| **Audio engine** | Web Audio API `OscillatorNode` (zero deps) | howler.js or `<audio>` elements | No npm dep, no asset files, full control over waveform/envelope. Chromium kiosk already has `--autoplay-policy=no-user-gesture-required` |
| **Toast position** | Fixed bottom (`bottom-0`, `z-50`) | Top banner | Scores and header occupy top ~180px; bottom placement never overlaps match data. Semi-transparent `bg-{color}/90` |
| **Duration storage** | `duration` field in `KioskNotificationData` payload; auto-dismiss via `setTimeout` in component | Server-side TTL with push dismissal | Simpler; avoids server-managed timer state. Component unmounts cleanly |

## Sound Design (Web Audio API)

Each type uses a distinct waveform + frequency combo generated at play time:

| Type | Waveform | Frequency | Duration | Character |
|------|----------|-----------|----------|-----------|
| `info` | sine | 880Hz | 200ms | Soft chime |
| `warning` | sine | 660Hz | 300ms | Attention tone (rapid decay) |
| `error` | square | 440Hz | 400ms | Alert |
| `important` | sine (dual) | 1047+1319Hz | 500ms | Bell (decaying envelope) |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `shared/events.ts` | Modify | Add `SEND_NOTIFICATION` (CLIENT) + `KIOSK_NOTIFICATION` (SERVER) |
| `shared/types.ts` | Modify | Add `KioskNotificationType` union + `KioskNotificationData` interface |
| `shared/validation.ts` | Modify | Add `NOTIFICATION_RULES`: max 280 chars, type enum |
| `server/src/handlers/AdminHandler.ts` | Modify | Register `SEND_NOTIFICATION`: PIN check → rate-limit 5/min/IP → sanitize → `io.emit(KIOSK_NOTIFICATION)` |
| `client/src/hooks/useSocketState.ts` | Modify | Add `kioskNotification` state + `KIOSK_NOTIFICATION` listener; set on receive, clear on null payload |
| `client/src/components/organisms/KioskNotificationToast/` | Create | `index.ts`, `KioskNotificationToast.tsx`, test. Renders color-coded animated toast with sound |
| `client/src/components/molecules/KioskNotificationModal/` | Create | `index.ts`, `KioskNotificationModal.tsx`, test. Type selector, message textarea (280 char limit + counter), duration dropdown (5/10/15/30s, default 5s) |
| `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx` | Modify | Add "Create Notification" button in dashboardActions; render `KioskNotificationModal` on open |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | Modify | Read `kioskNotification` from context; render `KioskNotificationToast` when non-null |
| `client/src/i18n/locales/es.json` | Modify | Labels: notification type names, button, modal title, char counter |
| `client/src/i18n/locales/en-US.json` | Modify | English equivalents |

## Interfaces

```ts
// shared/types.ts
export type KioskNotificationType = 'info' | 'warning' | 'error' | 'important';

export interface KioskNotificationData {
  type: KioskNotificationType;
  message: string;    // max 280 chars, HTML-stripped
  duration: number;   // seconds (5, 10, 15, or 30)
  timestamp: number;  // server-set Date.now()
}
```

```ts
// useSocketState return — new field
{ kioskNotification: KioskNotificationData | null }
```

## Testing Strategy

| Layer | What | Tool |
|-------|------|------|
| Unit | `NOTIFICATION_RULES` validate type enum + max length | Vitest (shared) |
| Unit | `AdminHandler` handler: PIN reject, rate-limit block, sanitize HTML, broadcast payload shape | Jest (server) |
| Unit | `useSocketState` listener sets/clears `kioskNotification` on event | Vitest + RTL |
| Unit | `KioskNotificationToast` renders type icon+message, triggers `playSound`, calls dismiss after duration | Vitest + RTL |
| Unit | `KioskNotificationModal` form validation, char counter, duration dropdown defaults | Vitest + RTL |
| Integration | Server handler round-trip: socket emit → rate-limit state → broadcast → client receive | Jest (mocked io) |
| E2E | Owner opens modal → fills form → submits → kiosk displays toast → auto-dismisses | Playwright |

## Open Questions

None. All architectural decisions resolved.
