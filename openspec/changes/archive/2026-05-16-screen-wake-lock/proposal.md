# Proposal: Screen Wake Lock

## Intent

Referee and spectator phone screens lock/sleep during scoreboard use — referees lose scoring context mid-point, spectators miss live updates. Use the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) to keep screens awake while the scoreboard is mounted.

## Scope

### In Scope
- `useWakeLock` hook in `client/src/hooks/useWakeLock.ts` with visibilitychange re-acquisition and cleanup
- Integration in `ScoreboardPage` (both `/referee` and `/view` modes)
- Unit tests for the hook following project conventions

### Out of Scope
- Kiosk/HDMI display mode — assumed always-on via OS/Chromium config
- Server-side changes — purely client-side UX
- UI indicators or toggles — wake lock is silent

## Capabilities

### New Capabilities
None — pure implementation-level UX enhancement. No new spec-level behavior or requirements.

### Modified Capabilities
None — no existing capability's requirements change.

## Approach

1. **Hook** (`useWakeLock`): Call `navigator.wakeLock.request('screen')` on mount, store the `WakeLockSentinel`. Listen for `visibilitychange` → re-acquire when tab becomes visible again. Release the sentinel on unmount. Wrap in try/catch — if API unavailable or permission denied, fail silently (graceful degradation).

2. **Integration**: Call `useWakeLock()` at the top of `ScoreboardPage`. Activates regardless of mode (referee/viewer) — both benefit from screen-on behavior.

3. **Tests**: Vitest + jsdom mock with `mockWakeLock()` in setup. Test: request on mount, release on unmount, re-acquire on visibility change, no-op when API unavailable.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/hooks/useWakeLock.ts` | New | Screen Wake Lock hook with re-acquisition |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | Modified | Add `useWakeLock()` call |
| `client/src/hooks/useWakeLock.test.ts` | New | Unit tests for the hook |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Browser doesn't support Wake Lock API | Medium | try/catch → graceful no-op |
| Lock released on tab switch without re-acquisition | Low | `visibilitychange` listener re-requests |
| Mobile browser power-saving blocks API | Low | Hook degrades silently, no UX impact |

## Rollback Plan

Single-commit change. Revert via `git revert HEAD` and verify ScoreboardPage logs no wake-lock errors.

## Dependencies

- Screen Wake Lock API — available in Chrome 84+, Edge 84+, Safari 16.4+, Firefox 126+ (no polyfill needed)

## Success Criteria

- [ ] `useWakeLock` requests a sentinel on mount, releases on unmount
- [ ] Lock re-acquired after `visibilitychange` → visible
- [ ] Graceful no-op when `navigator.wakeLock` is undefined
- [ ] ScoreboardPage imports and invokes `useWakeLock()` without errors
- [ ] All tests pass (`npm test` in client)
