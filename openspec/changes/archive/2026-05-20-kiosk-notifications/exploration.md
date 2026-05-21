# Exploration: Kiosk Notifications / Alert System

## Current State

### Kiosk Page (`KioskAllTablesPage`)
- Lives at `client/src/pages/KioskAllTablesPage/` — served at `/scoreboard/all/kiosk`
- Hands-free TV display (no mouse, keyboard) — auto-rotating grid of table cards every 10s
- Receives real-time updates via Socket.IO through `useSocketContext()` → `useSocketState()`
- `useSocketState()` centralizes all socket listeners: `TABLE_LIST`, `TABLE_UPDATE`, `TABLE_CREATED`, `TABLE_DELETED`, `TABLE_LIST_WITH_PINS`, `MATCH_UPDATE`, `ALL_HISTORY`, `ERROR`, `HUB_CONFIG`
- No existing toast, snackbar, or notification UI components
- Zero audio/sound functionality exists in the codebase

### Owner Dashboard (`OwnerDashboardPage`)
- Lives at `client/src/pages/OwnerDashboardPage/`
- Actions area in `DashboardHeader` — currently: "New Table" button + "View History" button
- Uses `PinModal` for PIN-based access to tables
- Has access to `ownerPin` via `useAuthContext()`
- Socket events listened: `QR_DATA`, `PIN_REGENERATED` (registered directly on `socket.on`, not via `useSocketState`)

### Socket.IO Event System (`shared/events.ts`)
- Single source of truth — 18 CLIENT events, 21 SERVER events (all `UPPER_CASE`)
- Adding new events: add to both `CLIENT` and `SERVER` sections in the `SocketEvents` constant
- `ERROR` event exists (SERVER → CLIENT) but is for protocol errors (VALIDATION_ERROR, TABLE_NOT_FOUND, etc.) — NOT for user-facing notifications
- Broadcast pattern: `io.emit(event, data)` sends to ALL connected clients (used for `TABLE_LIST`)

### Server Handler Pattern
- `SocketHandlerBase` — abstract base with shared utilities (`isOwner()`, `comparePin()`, `emitError()`, `validateTableExists()`, rate limiting)
- `SocketHandler` — orchestrator: creates handler instances, calls `registerHandlers(socket)` on each connection
- Concrete handlers: `TableEventHandler`, `MatchEventHandler`, `AuthHandler`, `AdminHandler`
- Each handler: constructor receives `(io, tableManager, ownerPin)`, extends `SocketHandlerBase`
- Owner validation: `this.isOwner(pin)` — timing-safe PIN comparison against `this.ownerPin`
- Payload validation: `validateSocketPayload(socket, data, rules, eventName)` — validates type, length, pattern; auto-emits `ERROR` on failure

### Existing Notification-Like Patterns
- **None.** No toast, snackbar, notification, or alert banner components exist
- The `appError` state in `useSocketState` captures `ERROR` events but is only displayed inline (e.g., table creation error message in OwnerDashboard)
- `ConfirmDialog` molecule exists but is an interactive confirmation dialog, not a passive notification
- Lucide icons include `AlertCircle`, `AlertTriangle`, `Info`, `CheckCircle`, `XCircle` — available for notification type icons

### Sound/Audio
- **None.** No `Audio`, `Web Audio API`, `HTMLMediaElement`, or any sound-related code exists in the client

## Affected Areas

| File | Why Affected |
|------|-------------|
| `shared/events.ts` | Add `SEND_NOTIFICATION` (CLIENT) and `KIOSK_NOTIFICATION` (SERVER) events |
| `shared/types.ts` | Add `KioskNotificationData` type with `type`, `message`, `duration` fields |
| `shared/validation.ts` | Add notification message validation rules (max length, allowed chars) |
| `server/src/handlers/AdminHandler.ts` | Register `SEND_NOTIFICATION` event — validate owner, sanitize, broadcast |
| `server/src/handlers/SocketHandler.ts` | No changes needed (AdminHandler already registered) |
| `client/src/hooks/useSocketState.ts` | Listen for `KIOSK_NOTIFICATION` event and expose `currentNotification` state |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | Render notification toast / snackbar overlay on kiosk screen |
| `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx` | Add "Create Notification" button + modal in the actions area |
| `openspec/specs/kiosk-display/spec.md` | Delta spec for notification display requirements |
| `client/src/i18n/locales/es.json` | Spanish labels for notification types, button, modal |
| `client/src/i18n/locales/en-US.json` | English labels |

### Potentially Affected (optional)

| File | Why Affected |
|------|-------------|
| `client/src/components/organisms/KioskNotificationToast/` | New organism component — notification display |
| `client/src/components/molecules/KioskNotificationModal/` | New molecule component — owner's "Create Notification" modal |
| `client/src/contexts/SocketContext/` | If notification state is exposed via context (depends on approach) |
| `client/src/assets/sounds/` | If audio bell sound is included (static asset) |

## Approaches

### 1. Dedicated Event + AdminHandler Extension (Recommended)

Add a `SEND_NOTIFICATION` client event and `KIOSK_NOTIFICATION` server event. Register the handler in `AdminHandler` (since notifications are an owner-only admin operation). The kiosk page listens for `KIOSK_NOTIFICATION` and renders an animated toast overlay.

**Flow:**
```
Owner clicks "Create Notification" → Modal opens (type selector + message input)
→ Owner submits → socket.emit('SEND_NOTIFICATION', { ownerPin, type, message })
→ Server (AdminHandler): validates owner PIN, sanitizes HTML from message,
  rate-limits (max 5/min per IP), broadcasts io.emit('KIOSK_NOTIFICATION', data)
→ Kiosk: useSocketState receives KIOSK_NOTIFICATION → sets state
→ KioskNotificationToast component renders animated overlay, auto-dismisses after duration
→ Optional: Web Audio API plays a short bell/chime on new notification
```

- **Pros:**
  - Clean separation — notification system is self-contained in `AdminHandler`
  - Follows existing event-driven architecture exactly
  - No new handler class needed (AdminHandler already owns owner-only operations)
  - Reuses `validateSocketPayload` and `isOwner()` patterns
  - `KIOSK_NOTIFICATION` is semantically distinct from `ERROR`
  - Framer Motion already in the project for toast animations
  - Web Audio API is zero-dependency, built into all modern browsers
- **Cons:**
  - New event pair adds to the shared contract (but this is the intended pattern)
  - Toast component needs careful positioning to not cover match scores on the TV
- **Effort:** Medium

### 2. Generic Notification Context + Reusable Toast System

Build a client-side `NotificationContext` provider that any page can consume, with a reusable toast component library. The server side remains the same as Approach 1. This adds infrastructure for future notification use cases (referee alerts, spectator announcements).

- **Pros:**
  - Reusable across pages — referee dashboard, spectator view could also show notifications
  - Centralized toast management (queue, stacking, priority)
  - Future-proof if notification types expand
- **Cons:**
  - Over-engineering for current requirements — only the kiosk needs notifications today
  - Additional context provider adds complexity to the React tree
  - Premature abstraction — violates YAGNI
- **Effort:** Medium-High

### 3. Reuse ERROR Event with Type Discrimination

Instead of a new `KIOSK_NOTIFICATION` event, extend the existing `ERROR` event payload with a `severity` or `notificationType` field and a `dismissible` flag. The kiosk would check this field to decide whether to show a toast vs. treating it as an error.

- **Pros:**
  - No new socket events — minimal shared/events.ts change
  - One less listener on the kiosk
- **Cons:**
  - **Semantic confusion:** `ERROR` means protocol/runtime errors; mixing user notifications degrades its meaning
  - `ERROR` is already consumed by `useSocketState` to set `appError` — would need to differentiate in every consumer
  - Violates Single Responsibility Principle
  - Harder to test and reason about
- **Effort:** Low (but wrong)

## Recommendation

**Approach 1: Dedicated Event + AdminHandler Extension**

This is the right fit for the codebase. It follows the exact same patterns as existing features (`REGENERATE_PIN` → `PIN_REGENERATED`, `QR_DATA`). Adding `SEND_NOTIFICATION` → `KIOSK_NOTIFICATION` is a direct extension of the established architecture.

Why not Approach 2: The feature request is specific to the kiosk. Building a generic notification system now is premature. If future needs arise (referee alerts, etc.), the dedicated event can be extended or refactored into a context without breaking anything — the socket event is the stable interface.

Why not Approach 3: `ERROR` already has a specific role — protocol-level error reporting. Diluting it with user-facing notifications would make debugging harder and tests more fragile.

### Implementation Outline

1. **Shared layer** (no tests needed for type definitions):
   - Add `KioskNotificationType = 'info' | 'warning' | 'error' | 'important'` to `shared/types.ts`
   - Add `KioskNotificationData` interface with `{ type, message, duration }` fields
   - Add validation rules in `shared/validation.ts`: message max 280 chars, `type` enum check
   - Add `SEND_NOTIFICATION` (CLIENT) and `KIOSK_NOTIFICATION` (SERVER) to `shared/events.ts`

2. **Server** (`AdminHandler`):
   - Register `SEND_NOTIFICATION` event handler
   - Validate owner PIN via `this.isOwner(data.ownerPin)`
   - Rate-limit: max 5 notifications per minute per IP
   - Sanitize message: strip HTML tags, truncate to 280 chars
   - Broadcast: `this.io.emit(SocketEvents.SERVER.KIOSK_NOTIFICATION, { type, message, duration, timestamp })`

3. **Client — State** (`useSocketState`):
   - Add `kioskNotification` state (`KioskNotificationData | null`)
   - Listen for `KIOSK_NOTIFICATION` event, set state, auto-clear after duration
   - Expose via `useSocketContext`

4. **Client — Kiosk** (`KioskAllTablesPage`):
   - Import `kioskNotification` from context
   - Render `KioskNotificationToast` overlay when notification is active
   - Toast: fixed position (top or top-right), color-coded by type, auto-dismiss with framer-motion exit animation
   - Must NOT obscure table scores — position at top as a banner is safest for TV readability
   - Optional: play bell sound via Web Audio API `OscillatorNode` (no external asset needed)

5. **Client — Owner Dashboard**:
   - Add "Create Notification" button next to "New Table" and "View History"
   - New `KioskNotificationModal` molecule:
     - Type selector: 4 buttons with color coding (info=blue, warning=amber, error=red, important=purple)
     - Text area for message (max 280 chars)
     - Duration selector (optional, default 8s): 5s, 8s, 15s, until dismissed
     - Submit emits `SEND_NOTIFICATION` with `{ ownerPin, type, message, duration }`
   - Include `ownerPin` in payload (consistent with `GET_TABLES_WITH_PINS` pattern)

6. **i18n**: Add Spanish + English labels for all new UI strings

### Color Coding (Tailwind tokens)
| Type | Background | Border/Icon Color |
|------|-----------|-------------------|
| info | `bg-primary/90` | primary |
| warning | `bg-amber/90` | amber |
| error | `bg-red-500/90` | red-500 |
| important | `bg-purple-600/90` | purple |

## Risks

- **TV readability**: Toast must not obscure match scores. Fixed top banner (full width, auto-height) is the safest placement. The kiosk header area (logo + QR + connection status) is ~180px; toast goes below that.
- **Rate limiting**: Without server-side rate limiting, a malicious owner could spam notifications. Enforce max 5 per minute (same pattern as `CREATE_TABLE` rate limiting).
- **Message sanitization**: Messages must be sanitized server-side to strip HTML tags. Use existing `sanitizeInput()` utility.
- **No persistence**: Notifications are ephemeral — if the kiosk disconnects, it misses notifications sent while offline. This is acceptable for the feature scope (real-time alert system, not a messaging backlog).
- **Audio autoplay policy**: Browsers block `AudioContext` before user interaction. However, the kiosk page auto-launches and is considered a "secure context" — and Chromium in kiosk mode (`--kiosk` flag, already in use) allows autoplay. The `systemd` kiosk service already uses `--autoplay-policy=no-user-gesture-required`. This must be verified.

## Ready for Proposal

**Yes.** The feature has clear boundaries, follows existing patterns, and no architectural blockers were found. The exploration is complete enough to move to proposal and spec.

### What the orchestrator should tell the user

The codebase is well-structured for this feature. The key architectural decision is using a new `KIOSK_NOTIFICATION` server event (not overloading `ERROR`). The implementation follows the exact same pattern as `REGENERATE_PIN`/`PIN_REGENERATED` — add event to shared contract, register handler in `AdminHandler`, broadcast with `io.emit()`, consume in `useSocketState`, render in kiosk page.

No existing toast/snackbar components exist, so we'll build a lightweight `KioskNotificationToast` organism. For the bell sound, Web Audio API `OscillatorNode` generates a chime with no external assets.

The strict TDD mode (`strict_tdd: true`) means tests must be written first. This aligns well — the shared types/events are testable in isolation, the server handler has a clear input→output contract, and the kiosk component can be tested with RTL + Vitest.
