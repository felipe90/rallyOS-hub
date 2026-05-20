# Proposal: Auto Kiosk Notifications on Match Lifecycle

## Intent

Match start and win are invisible on the kiosk display — only raw score updates show. Auto-emitting `KIOSK_NOTIFICATION` toasts makes these moments immediately visible without owner intervention.

## Scope

### In Scope
- `START_MATCH` → auto `KIOSK_NOTIFICATION` (type `info`, 10s) with player names
- `MATCH_WON` → auto `KIOSK_NOTIFICATION` (type `important`, 10s) announcing winner
- Server-side only, reusing existing `KioskNotificationData`

### Out of Scope
- `SET_WON` notifications (too frequent), client changes, new types/sounds, config UI

## Capabilities

### Modified Capabilities
- **kiosk-notifications**: Add requirement for server-side auto-notifications on match lifecycle events, bypassing PIN auth and rate-limiting since the server is the source.

## Approach

Two injection points in existing handlers:

1. **`MatchEventHandler.START_MATCH`** — after `startMatch()` returns state, emit `KIOSK_NOTIFICATION` with `state.playerNames`.
2. **`SocketHandler.onMatchEvent` (MATCH_WON)** — after existing socket emission, emit `KIOSK_NOTIFICATION` with names from `tableManager.getMatchState()`.

Both use `this.io.emit()` (global broadcast, matching `AdminHandler`). Fallback to `'Player A'`/`'Player B'` if names missing.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/handlers/MatchEventHandler.ts` | Modified | Notification on start |
| `server/src/handlers/SocketHandler.ts` | Modified | Notification on win |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Names absent on edge case | Low | Fallback to defaults |
| Double emission | Low | START_MATCH and MATCH_WON fire at different lifecycle points |

## Rollback Plan

Revert the two `io.emit` additions. No schema, type, or client changes.

## Dependencies

None. `KIOSK_NOTIFICATION` event and `KioskNotificationData` type already exist.

## Success Criteria

- [ ] Match start emits toast: "Match started: {A} vs {B}"
- [ ] Match won emits toast: "Winner: {Name}!"
- [ ] Existing `MATCH_UPDATE` / `MATCH_WON` emissions unchanged
- [ ] Zero client changes
