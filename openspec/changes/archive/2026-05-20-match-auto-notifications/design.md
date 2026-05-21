# Design: Auto Kiosk Notifications on Match Lifecycle

## Approach

Two `io.emit(KIOSK_NOTIFICATION)` insertions. Zero new infrastructure. No client changes.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Emission | `io.emit()` (global) | Matches `AdminHandler`; kiosk isn't in table rooms |
| PIN / rate-limit | Bypass | Server-sourced lifecycle events, no socket context |
| Fallback names | `'Player A'` / `'Player B'` | Same defaults as entire match stack |
| Duration | 10s | Spec-defined; matches existing `important` duration |

## Injection Points

**1. `MatchEventHandler.ts` — START_MATCH, after line 152**

`startMatch()` returns `MatchStateExtended` with `playerNames: {a, b}`.

```ts
const names = state.playerNames;
this.io.emit(SocketEvents.SERVER.KIOSK_NOTIFICATION, {
  type: 'info', duration: 10,
  message: `Match started: ${names.a} vs ${names.b}`,
  timestamp: Date.now(),
});
```

**2. `SocketHandler.ts` — MATCH_WON, after line 64**

Resolve name via `getMatchState(tableId)` → `playerNames` indexed by `event.winner`.

```ts
const ms = this.tableManager.getMatchState(tableId);
const names = ms?.playerNames ?? { a: 'Player A', b: 'Player B' };
const winner = names[event.winner === 'A' ? 'a' : 'b'];
this.io.emit(SocketEvents.SERVER.KIOSK_NOTIFICATION, {
  type: 'important', duration: 10,
  message: `Winner: ${winner}!`,
  timestamp: Date.now(),
});
```

## File Changes

| File | What |
|------|------|
| `server/src/handlers/MatchEventHandler.ts` | Emit notification after START_MATCH |
| `server/src/handlers/SocketHandler.ts` | Emit notification after MATCH_WON |

## Testing (Jest)

| Scenario | Assertion |
|----------|-----------|
| START_MATCH emits notification | Mock io/tableManager; trigger handler; verify `io.emit` called with `info`, names from state |
| MATCH_WON emits notification | Mock `getMatchState`; verify `io.emit` with `important`, resolved winner name |
| Fallback names (both events) | Mock undefined `playerNames`; verify `'Player A'` / `'Player B'` defaults |
| Existing emissions unchanged | Verify `MATCH_UPDATE` / `MATCH_WON` counts preserved |

## Rollout

None. No schema, type, or client changes.
