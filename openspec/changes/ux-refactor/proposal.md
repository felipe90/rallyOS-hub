# Proposal: UX Refactor & Zero-Latency Scorekeeping (ux-refactor)

## 1. Intent
Align the RallyOS-hub client with the "High-Tech Clubhouse" design principles and enforce true "Zero-Latency Scorekeeping". Resolve critical friction points identified during the UX audit (U-01, U-02, U-03) and implement a broadcast-style Match Ticker to expose match momentum without breaking immersion.

## 2. Motivation
In fast-paced ping pong tournaments, a 132x132px tap target for scoring adds cognitive load (U-01). Referees need to tap blindly. Additionally, persistent connection banners break the immersive Glassmorphism aesthetic (U-02), and destructive actions like deleting active tables lack physical friction (U-03). A "Broadcast Overlay" for match history will elevate the professional feel of the app.

## 3. Scope
**In Scope:**
*   Refactor `PlayerScoreArea` to make the entire half-screen a tap target for `onAdd` (Zero-Latency).
*   Add a localized `Undo` (swipe/small button) for `onSubtract`.
*   Refactor `ConnectionStatus` to auto-hide the "Connected" state after 3 seconds.
*   Implement a `HoldToConfirmButton` (Long-press) for the Delete Table action in `DashboardGrid`.
*   Create a horizontal `MatchHistoryTicker` component (Broadcast Overlay) for live matches.

**Out of Scope:**
*   Changes to the server-side logic (already covered in `security-hardening`).
*   Complete rewrite of the `MatchConfigPanel` state (we will just add visual validation).

## 4. Risks & Considerations
*   **Accidental Scoring:** Making the entire half-screen clickable increases the risk of double-taps. We might need a small debounce (e.g., 200ms) to prevent ghost touches.
*   **Destructive Patterns:** Moving from a standard modal to a "Long Press" requires clear visual feedback (e.g., a progress fill ring) so users know they are deleting something.
*   **Landscape Squeezing:** The horizontal `MatchHistoryTicker` needs to fit well globally without pushing the score numbers out of the viewport.
