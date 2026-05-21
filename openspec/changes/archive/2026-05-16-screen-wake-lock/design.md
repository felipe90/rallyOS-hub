# Design: Screen Wake Lock

## Technical Approach

A `useWakeLock` React hook wraps `navigator.wakeLock.request('screen')` with automatic re-acquisition on visibility change and cleanup on unmount. Integrated into `ScoreboardPage` at the top level — referee and spectator paths both benefit. Graceful degradation via try/catch when the API is unavailable.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|----------|
| **Hook shape** | `{ isSupported, isActive }` | Throw on error, callback API | Matches `useOrientation` pattern — consumers read state, no callbacks needed |
| **Re-acquisition** | `visibilitychange` listener | `onfreeze` event | `visibilitychange` is the recommended pattern from the Wake Lock API spec; `onfreeze` has narrower browser support |
| **Error handling** | Silent try/catch | Surface errors to user | Wake lock is a UX enhancement — users can't act on failures; matches the proposal's graceful degradation |
| **Sentinel ref** | `useRef<WakeLockSentinel>` | State variable | No re-renders needed on sentinel changes; ref gives us the handle for manual release |
| **Integration point** | Top of `ScoreboardPage` | Conditional per path | Both referee and viewer need screen-on behavior; one call at page level covers both |

## Data Flow

```
ScoreboardPage mounts
  └─ useWakeLock()
       ├─ Check navigator.wakeLock support
       │    └─ No → isSupported: false, isActive: false
       │    └─ Yes → request('screen')
       │         └─ Success → store sentinel in ref → isActive: true
       │         └─ Error   → isActive: false (degraded)
       │
       ├─ visibilitychange → document.hidden === false
       │    └─ Release old sentinel → request new sentinel
       │
       └─ Unmount → release sentinel → cleanup
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/hooks/useWakeLock.ts` | Create | Hook with request/release/visibilitychange logic |
| `client/src/hooks/useWakeLock.test.ts` | Create | Unit tests mocking `navigator.wakeLock` |
| `client/src/hooks/index.ts` | Modify | Add `useWakeLock` export |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | Modify | Add `useWakeLock()` call (1 line + import) |

## Interfaces

```typescript
// Return type of useWakeLock
interface WakeLockState {
  isSupported: boolean  // true if navigator.wakeLock exists
  isActive: boolean     // true if a wake lock is currently held
}

// Hook signature
function useWakeLock(): WakeLockState
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Request on mount | Mock `navigator.wakeLock.request` returning a sentinel; `renderHook` → verify `isActive: true` |
| Unit | Release on unmount | `renderHook` then `unmount()` → verify sentinel `.release()` called |
| Unit | Re-acquire on visibility change | Mock `visibilitychange` event with `document.hidden = false` → verify new `request()` call |
| Unit | Silent no-op when API missing | `delete (navigator as any).wakeLock` → verify `isSupported: false`, no errors |
| Unit | Request failure | Mock `request()` rejecting → verify `isActive: false`, no thrown errors |

Tests follow the project pattern from `useOrientation.test.ts`: Vitest + `renderHook` from `@testing-library/react` with local mocks, no global test setup required.

## Migration / Rollout

No migration required. Single commit, revert via `git revert HEAD`.

## Open Questions

None.
