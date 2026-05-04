# Proposal: Actualizar la interfaz del config para iniciar las mesas

## Intent

Replace the full-page match configuration panel with a modal overlay, remove dead code, and fix broken set-selector and handicap features. Currently: the config is a separate full page (not a modal), points-per-set is selectable but should be hardcoded to 11 (table tennis standard), and **the server START_MATCH handler silently ignores all config params** — `bestOf`, `handicapA`, `handicapB` are received but never forwarded to `tableManager.startMatch()`. Neither feature works end-to-end.

## Scope

### In Scope
- Create `MatchConfigModal` molecule (PinModal pattern: overlay, backdrop, Escape)
- Replace full-page config in ScoreboardPage with modal
- Remove dead `configureMatch` from `useSocketActions.ts` (CONFIGURE_MATCH defined, never called client-side)
- Remove duplicate MatchConfigPanel usage from `ScoreboardMain.tsx` (lines 65-83)
- Remove points-per-set selector — hardcode to 11
- Fix server START_MATCH to forward `bestOf`, `handicapA/B` to `tableManager.startMatch()`
- Fix handicap UI to only allow >= 0 (currently allows negative)
- Show CONFIGURING visual state in ScoreboardMain when modal is open

### Out of Scope
- Persisting config across RESET_TABLE calls
- Pre-configuration from Owner Dashboard (deferred)
- Unifying CONFIGURE_MATCH + START_MATCH server-side (deferred)

## Capabilities

### New Capabilities
None — all changes are within existing capability boundaries.

### Modified Capabilities
- `multi-table-system`: START_MATCH now forwards config params; CONFIGURING visual state; config modal replaces panel

## Approach

**UI**: New `MatchConfigModal` component — modal with player name inputs, best-of selector (1/3/5 buttons), handicap +/− per player (floor at 0), hardcoded pointsPerSet=11, "Iniciar Partido"/"Cancelar" buttons. Reuses existing Button, Typography atoms.

**Page**: ScoreboardPage shows `MatchConfigModal` when `canConfigure && !isLive` instead of full-page panel. ScoreboardMain's internal config panel removed — shows CONFIGURING text via ScoreboardBar instead.

**Server**: One-line fix in `MatchEventHandler.ts` line 139:
```
// Before:
const state = this.tableManager.startMatch(data.tableId);
// After:
const state = this.tableManager.startMatch(data.tableId, data);
```
`MatchOrchestrator.startMatch` already accepts `config` — it was never called with it.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/components/molecules/MatchConfigModal/` | New | Modal component |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | Modified | Modal instead of full-page panel |
| `client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx` | Modified | Remove internal config panel (lines 65-83), add CONFIGURING state |
| `client/src/hooks/useSocketActions.ts` | Modified | Remove dead `configureMatch` |
| `server/src/handlers/MatchEventHandler.ts` | Modified | Pass config to `startMatch()` |
| `client/src/components/organisms/MatchConfigPanel/` | Removed | Replaced by MatchConfigModal |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Modal breaks on mobile | Low | Same responsive pattern as PinModal |
| Removing ScoreboardMain internal config breaks viewer | Low | Gated by `isReferee` — viewers never see it |
| Existing tests import MatchConfigPanel | Med | Update import paths; tests for modal follow same contract |

## Rollback Plan

1. `git revert` the commit — restores full-page panel, duplicate in ScoreboardMain, dead configureMatch
2. Server: revert `startMatch(data.tableId, data)` back to `startMatch(data.tableId)`
3. Delete `MatchConfigModal/` directory

## Dependencies

- PinModal exists and is stable
- No new packages
- SocketEvents.CLIENT.START_MATCH protocol unchanged

## Success Criteria

- [ ] Config shown in modal overlay (not full page), dismissed with Escape or Cancel
- [ ] bestOf 1/3/5 selector works e2e: chosen value reaches MatchEngine
- [ ] Handicap +/− applies initial score correctly when match starts
- [ ] pointsPerSet always 11, not shown as option
- [ ] CONFIGURING state visible between modal open and match start
- [ ] Existing tests pass (updated imports where needed)
- [ ] `configureMatch` removed from client; duplicate panel removed from ScoreboardMain
