# Design Document: UX Refactor (ux-refactor)

## Architecture Decisions

### 1. `PlayerScoreArea` & Zero-Latency Interaction
Instead of rendering nested `ScoreButton` components that restrict the tap zone:
1. `PlayerScoreArea` will become an interactive `motion.div` itself, wrapping the entire half-screen area.
2. The `onClick` handler of the main wrapper will trigger `onScorePoint`.
3. To handle `onSubtractPoint` (Undo), we will introduce a subtle circular button (e.g., 48x48px) positioned at the bottom inner-corner of the player's area. This ensures it's reachable but prevents accidental taps during frantic rallies.
4. Active States: Apply a `whileTap={{ scale: 0.98, opacity: 0.9 }}` effect to the entire wrapper for haptic visual feedback.

### 2. Auto-hiding `ConnectionStatus`
1. Use a local `useEffect` inside `ConnectionStatus.tsx`.
2. Track the `status` string. If `status === 'connected'`, start a 3000ms timeout.
3. Once the timeout completes, toggle a local `isVisible` state to `false`.
4. Wrap the component in `<AnimatePresence>` and use `<motion.div animate={{ y: isVisible ? 0 : -100 }}>` to slide the banner out.
5. Any change in status to `'error'` or `'connecting'` will reset `isVisible` to `true` instantly and clear the timeout.

### 3. `HoldToConfirm` Component
Instead of a generic Javascript `window.confirm` or generic `ConfirmDialog` modal:
1. Create `components/atoms/Button/HoldToConfirmButton.tsx`.
2. Use Framer Motion's `useAnimation` and pointer events (`onPointerDown`, `onPointerUp`, `onPointerLeave`).
3. While the pointer is down, animate a CSS fill or a SVG circle over 2 seconds (`duration: 2`).
4. If `onPointerUp` triggers before 2s, cancel and reset the animation.
5. If the animation completes (triggering `onUpdate` or a `setTimeout` of 2000ms), execute the `onConfirm` callback.
6. Replace the `Trash2` icon delete button in `TableStatusChip` with this new component.

### 4. `MatchHistoryTicker` (Broadcast Overlay)
1. In `ScoreboardMain.tsx`, integrate `<MatchHistoryTicker events={history} />`.
2. Create `components/molecules/MatchHistoryTicker/MatchHistoryTicker.tsx`.
3. Style as a horizontal flex box (`flex-row overflow-x-auto whitespace-nowrap scrollbar-hide`).
4. Map over the match history events to show sequential milestones (e.g., `Set 1 - Win A (11-8)`, `Point B`, etc.).
5. Apply specific colors (Blue vs Red, or current theme variables) to map the broadcast-style reference. Ensure it docks to the bottom edge using `absolute bottom-0 w-full` to not interfere with the zero-latency tap zones.
