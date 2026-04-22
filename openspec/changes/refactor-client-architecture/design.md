# Design: Refactor Client Architecture

## Phase 1: Extract Services

### 1.1 `services/match/`

```
services/match/
  calculateSets.ts        — Count sets won from setHistory
  determineWinner.ts      — Set winner and match winner detection
  formatEvent.ts          — Format ScoreChange for display
  getEventColor.ts        — Color coding for history events
  applySideSwap.ts        — ITTF side swap logic
  index.ts                — Barrel export
```

**Key function signatures:**
```typescript
export function calculateSetsWon(setHistory: SetScore[]): { setsA: number; setsB: number }
export function determineSetWinner(scoreA: number, scoreB: number, pointsPerSet: number): 'A' | 'B' | null
export function determineMatchWinner(setsA: number, setsB: number, totalSets: number): 'A' | 'B' | null
export function formatEvent(event: ScoreChange): string
export function getEventColor(event: ScoreChange): string
export function applySideSwap(match: MatchStateExtended): SwappedDisplay
```

### 1.2 `services/dashboard/`

```
services/dashboard/
  calculateStats.ts       — Aggregate stats from TableInfo[]
  index.ts
```

```typescript
export interface DashboardStats {
  totalTables: number
  liveMatches: number
  activePlayers: number
}

export function calculateDashboardStats(tables: TableInfo[]): DashboardStats
```

### 1.3 `services/validation/`

```
services/validation/
  pin.ts                  — PIN length and format validation
  auth.ts                 — Auth form validation
  match.ts                — Match config validation
  index.ts
```

```typescript
export const TABLE_PIN_LENGTH = 4
export const OWNER_PIN_LENGTH = 8
export function validateTablePin(pin: string): boolean
export function validateOwnerPin(pin: string): boolean
export function validatePinLength(pin: string, expectedLength: number): boolean
```

### 1.4 `services/url/`

```
services/url/
  buildScoreboardUrl.ts   — Generate scoreboard URLs
  buildTableUrl.ts        — Generate table URLs
  index.ts
```

```typescript
export function buildScoreboardUrl(tableId: string, pin: string): string
export function buildTableUrl(tableId: string): string
```

### 1.5 `services/errors/`

```
services/errors/
  errorMessages.ts        — Centralized error message map
  index.ts
```

```typescript
export const ERROR_MESSAGES: Record<string, string | ((error: ValidationError) => string)>
export function getErrorMessage(code: string, error?: ValidationError): string
```

### 1.6 `services/storage/`

```
services/storage/
  authStorage.ts          — Abstract localStorage/sessionStorage
  index.ts
```

```typescript
export const authStorage = {
  getRole: () => localStorage.getItem('role') as UserRole,
  setRole: (role: UserRole) => localStorage.setItem('role', role),
  getTableId: () => localStorage.getItem('tableId'),
  setTableId: (id: string) => localStorage.setItem('tableId', id),
  getOwnerPin: () => sessionStorage.getItem('ownerPin'),
  setOwnerPin: (pin: string) => sessionStorage.setItem('ownerPin', pin),
  clear: () => { /* remove all auth keys */ },
}
```

---

## Phase 2: Refactor Hooks

### 2.1 Split `useSocket.ts`

**Current:** 256 lines, 5 responsibilities

**After:**
```
hooks/
  useSocketConnection.ts   — Socket connection lifecycle (connect/disconnect/reconnect)
  useSocketState.ts        — State from socket events (tables, currentMatch)
  useSocketActions.ts      — Action emitters (scorePoint, createTable, etc.)
  usePinSubmission.ts      — Reusable PIN submission flow (DRY)
```

### 2.2 New `usePinSubmission.ts`

Extracted from `OwnerDashboardPage` and `RefereeDashboardPage`:

```typescript
export function usePinSubmission() {
  const socket = useSocketContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitPin = useCallback((pin: string, tableId: string): Promise<void> => {
    // Validation, socket.once('REF_SET'), timeout, error handling
  }, [socket])

  return { submitPin, loading, error, clearError: () => setError(null) }
}
```

### 2.3 Update `useMatchDisplay.ts`

Extract pure logic to `services/match/calculateDisplay.ts`, keep thin wrapper:

```typescript
export function useMatchDisplay(match: MatchStateExtended) {
  return useMemo(() => calculateMatchDisplay(match), [match])
}
```

---

## Phase 3: Refactor Contexts

### 3.1 `AuthContext`

Remove direct localStorage access, delegate to `authStorage` service:

```typescript
const [role, setRole] = useState<UserRole>(() => authStorage.getRole())

const login = (newRole: UserRole, tId?: string, pin?: string) => {
  if (newRole) {
    authStorage.setRole(newRole)
    setRole(newRole)
  }
  // ...
}
```

---

## Phase 4: Fix Components

### 4.1 `QRCodeImage.tsx`

**Before:** Does encryption inside component
**After:** Receives `joinUrl` as prop

```typescript
interface QRCodeImageProps {
  joinUrl: string
  size?: number
}
```

URL built by parent using `services/url/buildScoreboardUrl.ts`.

### 4.2 `MatchHistoryTicker.tsx`

**Before:** Inline `formatEvent()` and `getEventColor()`
**After:** Imports from `services/match/`

### 4.3 `HistoryDrawer.tsx`

**Before:** Inline `formatRelativeTime()`
**After:** Uses `services/date/formatRelativeTime.ts` (or `date-fns` if added)

### 4.4 `DashboardGrid.tsx`

**Before:** Inline stats calculation and URL generation
**After:** Uses `useDashboardStats(tables)` hook

---

## Phase 5: Cleanup

- Delete `useScoreboardAuth.ts` (deprecated)
- Update all imports to use `useCan`
- Remove dead code (unused functions, commented blocks)
- Run full test suite
- Run build

---

## Data Flow (After)

```
Server Socket.IO
       │
       ▼
useSocketConnection ──► useSocketState ──► SocketContext
                               │
                               ▼
Pages ──► usePermissions/useMatchDisplay/useDashboardStats ──► Components
              │
              ▼
         services/ (pure functions)
```

---

## Testing Strategy

| Layer | Tests | Coverage Target |
|-------|-------|-----------------|
| Services | Pure unit tests (no React) | 90%+ |
| Hooks | `renderHook` from RTL | 80%+ |
| Components | `render` from RTL | 70% organisms, 60% molecules/atoms |
| Integration | Existing E2E must pass | All critical paths |

---

## File Changes Summary

### New Files (~20)
- `services/match/*.ts` (5 files + tests)
- `services/dashboard/*.ts` (1 file + test)
- `services/validation/*.ts` (3 files + tests)
- `services/url/*.ts` (2 files + tests)
- `services/errors/*.ts` (1 file + test)
- `services/storage/*.ts` (1 file + test)
- `hooks/useSocketConnection.ts`
- `hooks/useSocketState.ts`
- `hooks/useSocketActions.ts`
- `hooks/usePinSubmission.ts`

### Modified Files (~15)
- `hooks/useSocket.ts` → split into 3 hooks
- `hooks/useMatchDisplay.ts` → thin wrapper
- `contexts/AuthContext.tsx` → use authStorage
- `components/QRCodeImage.tsx` → receive URL prop
- `components/MatchHistoryTicker.tsx` → use services
- `components/HistoryDrawer.tsx` → use services
- `components/DashboardGrid.tsx` → use useDashboardStats
- `pages/OwnerDashboardPage.tsx` → use usePinSubmission
- `pages/RefereeDashboardPage.tsx` → use usePinSubmission
- `pages/ScoreboardPage.tsx` → remove useScoreboardAuth

### Deleted Files
- `hooks/useScoreboardAuth.ts`
