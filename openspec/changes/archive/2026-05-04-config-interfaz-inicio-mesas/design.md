# Design: Actualizar interfaz de configuración para inicio de mesas

## Technical Approach

Replace the full-page `MatchConfigPanel` with a modal overlay (`MatchConfigModal`), following the proven `PinModal` pattern (fixed overlay, backdrop dismiss, Escape key). Remove the dead duplicate config panel from `ScoreboardMain` and the unused `configureMatch` client code. Fix the server-side bug where `START_MATCH` silently ignores config params by passing `data` into `tableManager.startMatch()`.

## Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|----------|---------|---------|--------|-----------|
| Modal approach | Inline replacement of current full-page panel | New `MatchConfigModal` molecule | **B: Modal** | PinModal already proven; overlay avoids re-render of entire ScoreboardMain; Escape/backdrop UX familiar |
| pointsPerSet selector | Keep 11/15/21 buttons | Hardcode to 11 | **B: Hardcode** | Table tennis standard; removes untested feature. Proposal requires this |
| Server CONFIGURE_MATCH handler | Delete entirely | Keep but stop calling client-side | **B: Keep** | Out of scope per proposal; handler has validation logic from security hardening that still applies |
| Handicap floor | Allow negative (current) | Floor at 0 | **B: Floor at 0** | Negative handicap has no table tennis semantics; prevents invalid server state |

## Data Flow

```
MatchConfigModal ──onStart(config)──→ useScoreboardEvents.handleStartMatch(config)
                                            │
                                    emit(START_MATCH, {tableId, ...config})
                                            │
                                    ┌───────▼────────────┐
                                    │ MatchEventHandler   │
                                    │  line 139 FIX:      │
                                    │  startMatch(id,data)│
                                    └───────┬────────────┘
                                            │
                                    tableManager.startMatch(tableId, config)
                                            │
                                    MatchOrchestrator.startMatch(table, config)
                                            │
                                    new MatchEngine({pointsPerSet:11, bestOf, handicapA/B})
                                            │
                                    MATCH_UPDATE → all clients in room
```

**Note**: The `handleStartMatch` in `useScoreboardEvents` already passes `pointsPerSet`, `bestOf`, `handicapA/B`, `playerNameA/B`. The only fix needed is server-side line 139: pass `data` as second arg.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/molecules/MatchConfigModal/MatchConfigModal.tsx` | **Create** | Modal with overlay, backdrop, Escape close. Inputs: player names, bestOf buttons (1/3/5), handicap +/− (floor 0). No pointsPerSet selector. `isLoading` disables "Iniciar Partido", `error` shown inline |
| `client/src/components/molecules/MatchConfigModal/index.ts` | **Create** | Barrel export |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | **Modify** | Replace `MatchConfigPanel` import with `MatchConfigModal`. Render modal when `canConfigure && !LIVE`; ScoreboardMain renders behind as CONFIGURING visual |
| `client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx` | **Modify** | Remove lines 65-84 (duplicate config panel + `MatchConfigPanel` import). Remove `import { MatchConfigPanel }`. When `status !== 'LIVE' && status !== 'FINISHED'`, show CONFIGURING text via ScoreboardBar |
| `client/src/hooks/useSocketActions.ts` | **Modify** | Remove `configureMatch` function (lines 67-80) and its return entry |
| `client/src/contexts/SocketContext/SocketContext.types.ts` | **Modify** | Remove `configureMatch` from `SocketContextType` (line 30) |
| `server/src/handlers/MatchEventHandler.ts` | **Modify** | Line 139: `startMatch(data.tableId)` → `startMatch(data.tableId, data)` |
| `client/src/components/organisms/MatchConfigPanel/` | **Delete** | Both `MatchConfigPanel.tsx` and `index.ts` |
| `client/src/pages/ScoreboardPage/ScoreboardPage.test.tsx` | **Modify** | Update "shows config panel" test to assert modal presence instead of `Configurar Partido` text |
| `client/src/components/organisms/ScoreboardMain/ScoreboardMain.test.tsx` | **Modify** | Remove `MatchConfigPanel` import plus its describe block (line 340-407). Update test on line 281-288 to assert CONFIGURING state instead of config panel |

## Interfaces / Contracts

```ts
// MatchConfigModalProps
export interface MatchConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onStart: (config: {
    bestOf: number
    handicapA?: number
    handicapB?: number
    playerNameA?: string
    playerNameB?: string
  }) => void
  isLoading?: boolean
  error?: string | null
}
```

**START_MATCH payload** (unchanged): `{ tableId, pointsPerSet: 11, bestOf, handicapA, handicapB, playerNameA, playerNameB }`. `pointsPerSet` hardcoded to 11 in `useScoreboardEvents.handleStartMatch`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | MatchConfigModal | Render modal, test Escape close, backdrop close, button disable when loading, error display, handicap floor |
| Unit | ScoreboardMain | Assert CONFIGURING visual when `status !== 'LIVE'` and `isReferee`; assert NO config panel rendered |
| Integration | ScoreboardPage | Assert modal opens on WAITING status with canConfigure; assert START_MATCH emitted with correct payload |
| E2E | Full flow | Config → start match → verify bestOf + handicap applied correctly on scoreboard |

## Migration / Rollout

No migration required. Feature gated by `canConfigure` permission (referee-only). Rollback: `git revert` restores full-page panel and duplicate; server revert changes one line.

## Edge Cases

- **Modal close without start**: User clicks backdrop or Escape → `onClose` fires → modal hides, ScoreboardMain shows WAITING state with "Atrás" button
- **Socket disconnected**: `useScoreboardEvents.handleStartMatch` checks `connected` before emit — button appears to do nothing; user can dismiss modal
- **Server error**: Server `ERROR` event after failed START_MATCH → capture in `useScoreboardEvents` or SocketContext, pass as `error` prop to modal
- **Handicap floor**: "−" button disabled when handicap = 0; state never goes negative
- **Modal competing with other overlays**: z-50 (same as PinModal); modal content `max-w-sm` centered
