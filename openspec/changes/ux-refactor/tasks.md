# Implementation Tasks: UX Refactor (ux-refactor)

## Phase 1: Zero-Latency Tap Targets
- [ ] Modify `PlayerScoreArea.tsx` to handle `onClick` on its main outer `<section>` container directly for `onScorePoint`.
- [ ] Remove the nested `<ScoreButton>` logic that wraps the old `+` and `-` inputs from the center.
- [ ] Add a visual hit-state (`active:scale-95` or `framer-motion` equivalents) to the entire `PlayerScoreArea` to give tap feedback.
- [ ] Introduce a small `UndoButton` atom (or a simple `<button>`) fixed at the bottom of the `PlayerScoreArea` mapped to `onSubtractPoint`.

## Phase 2: Immersive Connection Banner
- [ ] Modify `ConnectionStatus.tsx` to introduce a local state `showConnected` (default `true`).
- [ ] Add a `useEffect` that listens to `status === 'connected'`. Set a `setTimeout` to flip `showConnected` to `false` after 3000ms.
- [ ] Handle cleanup (clearTimeout) if the component unmounts or status changes to `'error'/'connecting'`, instantly setting `showConnected` back to `true`.
- [ ] Wrap the banner block in a `<motion.div>` with slide/fade out mechanics based on `showConnected`.

## Phase 3: Tactical Friction Deletion
- [ ] Create a new atom component: `HoldToConfirmButton.tsx` inside `components/atoms/Button/`.
- [ ] Implement pointer event listeners (`onPointerDown`, `onPointerUp`, `onPointerLeave`) holding a 2000ms timer.
- [ ] Add visual feedback (like a filling background or progress bar) representing the hold duration.
- [ ] Update `TableStatusChip.tsx` to use `HoldToConfirmButton` instead of triggering a manual popup for table deletion. Remove the generic delete `ConfirmDialog`.

## Phase 4: Broadcast Match Ticker
- [ ] Create `components/molecules/MatchHistoryTicker/MatchHistoryTicker.tsx`.
- [ ] Design a horizontal scrollable row that parses the current match `history` prop.
- [ ] Map historical events to small badged strings (e.g. `[A: 11-9]`, `A scored`, `B scored`) in chronological order.
- [ ] Inject the `MatchHistoryTicker` inside `ScoreboardMain.tsx`, positioned absolutely at the top or bottom of the screen to mimic a TV sports overlay.
