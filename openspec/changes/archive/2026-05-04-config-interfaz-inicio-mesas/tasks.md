# Tasks: Actualizar interfaz de configuración para inicio de mesas

## Phase 1: Foundation — Create MatchConfigModal

- [x] 1.1 Create `MatchConfigModal.tsx` molecule — PinModal pattern (fixed overlay, backdrop dismiss, Escape close). Props: `isOpen`, `onClose`, `onStart`, `isLoading`, `error`. Inputs: player name A/B text fields, bestOf buttons (1/3/5), handicap +/− per player (floor at 0). No pointsPerSet selector. "Iniciar Partido" disabled when `isLoading`.
- [x] 1.2 Create `MatchConfigModal/index.ts` barrel export.
- [x] 1.3 Create `MatchConfigModal.test.tsx` — test Escape close, backdrop close, button disabled when loading, error text display, handicap floor (decrement at 0 stays 0), onStart called with correct config.

## Phase 2: Core Wiring — Connect Modal to Pages

- [x] 2.1 Modify `ScoreboardBar.tsx` — render `status` as a badge (e.g., "CONFIGURING") when `status !== 'LIVE' && status !== 'FINISHED'`. Style: small muted badge.
- [x] 2.2 Modify `ScoreboardMain.tsx` — remove dead duplicate MatchConfigPanel block (lines 65‒83 + import). Normal scoreboard renders for all statuses; CONFIGURING badge shown via ScoreboardBar.
- [x] 2.3 Modify `ScoreboardPage.tsx` — replace `MatchConfigPanel` import + usage with `MatchConfigModal`. Modal opens when `canConfigure && currentMatch.status !== 'LIVE'`. Bridge `onStart` to `handleStartMatch` with `pointsPerSet: 11` hardcoded. Keep "Atrás" button outside modal.

## Phase 3: Dead Code Removal

- [x] 3.1 Remove `configureMatch` from `useSocketActions.ts` (function lines 67‒80 + return entry).
- [x] 3.2 Remove `configureMatch` from `SocketContext.types.ts` (line 30).
- [x] 3.3 Delete `MatchConfigPanel/` directory (`MatchConfigPanel.tsx`, `index.ts`).

## Phase 4: Server Fix — Forward Config to startMatch

- [x] 4.1 Modify `MatchEventHandler.ts` line 139: `this.tableManager.startMatch(data.tableId)` → `this.tableManager.startMatch(data.tableId, data)`.

## Phase 5: Test Updates

- [x] 5.1 Update `ScoreboardMain.test.tsx` — remove `MatchConfigPanel` import + describe block (lines 340‒407). Change "muestra config panel cuando status !== LIVE" (line 281) to assert CONFIGURING badge/text instead.
- [x] 5.2 Update `ScoreboardPage.test.tsx` — change "shows config panel" test (line 183‒211) to assert `MatchConfigModal` overlay (`Configurar Partido` via modal instead of full‑page panel). Test passes when modal renders with config title.
