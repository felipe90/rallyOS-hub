# Hooks Rules

**Location:** `client/src/hooks/` and `client/src/pages/**/use*.ts`  
**Rule:** A hook has ONE responsibility. Max 80 lines.

---

## The Core Principle

Hooks bridge between **React's lifecycle** and **pure business logic**. They:
1. Gather data from contexts and props
2. Call service functions to transform that data
3. Return state and handlers for components to consume

**A hook should be thin. If it's over 80 lines, it's doing too much.**

---

## What Belongs in Hooks

| Category | Examples | Why |
|----------|----------|-----|
| Data composition | `usePermissions`, `useMatchDisplay` | Combine context data + service calls |
| Side effects | `useSocket`, `useAutoUpdate` | Connect to external systems |
| Local state | `useMatchState`, `usePinSubmission` | Manage UI state that doesn't need context |
| Lifecycle | `useOrientation`, `useServiceWorkerUpdate` | Respond to browser events |

---

## What Does NOT Belong in Hooks

| Category | Example | Where It Goes |
|----------|---------|---------------|
| Business logic (pure) | Score calculation, set winner detection | `services/match/` |
| Validation rules | PIN regex, name length checks | `services/validation/` |
| Error messages | `ERROR_MESSAGES` map in Spanish | `services/errors/` or constant files |
| Formatting | Date formatting, event formatting | `services/match/formatEvent.ts` |
| URL building | Generating scoreboard URLs | `services/url/` |
| Socket event handling logic | Transforming events to state | Should be in services, hook only wires |

---

## Rules

### Rule 1: One Responsibility

A hook does ONE thing. Name it after that one thing.

**Good names:**
- `useMatchDisplay` — calculates display values from match state
- `usePermissions` — resolves permission booleans from auth context
- `usePinSubmission` — manages PIN submission flow (loading, error, success)
- `useOrientation` — tracks device orientation

**Bad names:**
- `useSocket` — does connection + state + validation + actions + error handling (❌ 5 responsibilities)
- `useDashboard` — too vague. What about the dashboard?
- `useStuff` — ❌ self-explanatory why this is wrong

**The `useSocket.ts` problem (256 lines):**
```typescript
// ❌ GOD OBJECT - 5 responsibilities in one hook
export function useSocket(options: UseSocketOptions = {}) {
  // 1. Socket connection management (lines 39-80)
  const socket = io(serverUrl, {...})
  
  // 2. State management (lines 81-120)
  const [tables, setTables] = useState([])
  const [currentMatch, setCurrentMatch] = useState(null)
  
  // 3. Validation (lines 121-140)
  const validateTablePin = (pin: string) => /^\d{4}$/.test(pin)
  
  // 4. Business actions (lines 141-220)
  const scorePoint = (player) => { ... }
  const undoLastPoint = () => { ... }
  
  // 5. Error handling (lines 221-256)
  const ERROR_MESSAGES = { ... }
}
```

**Better (split into focused hooks):**
```typescript
// hooks/useSocketConnection.ts — ONLY connection
export function useSocketConnection(serverUrl: string) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  // ... connection logic only
  return { socket: socketRef.current, connected }
}

// hooks/useSocketState.ts — ONLY state from events
export function useSocketState(socket: Socket | null) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [currentMatch, setCurrentMatch] = useState<MatchStateExtended | null>(null)
  // ... listeners only
  return { tables, currentMatch }
}

// hooks/useSocketActions.ts — ONLY action emitters
export function useSocketActions(socket: Socket | null, currentTable: TableInfo | null) {
  const scorePoint = useCallback((player: 'A' | 'B') => {
    if (socket?.connected && currentTable?.id) {
      socket.emit('SCORE_POINT', { tableId: currentTable.id, player })
    }
  }, [socket, currentTable])
  
  return { scorePoint }
}
```

---

### Rule 2: Max 80 Lines

If a hook is longer than 80 lines, split it.

**Exceptions:**
- Object literal returns with many fields (like `useMatchDisplay` returning 15 computed values)
- Exhaustive switch statements

**How to split:**
- Extract pure logic to `services/`
- Extract related state to smaller hooks
- Extract event handlers to separate hooks

---

### Rule 3: Thin Wrappers Over Services

Hooks should be thin wrappers that call services. The heavy lifting happens in services.

**Good — `usePermissions` (model):**
```typescript
// hooks/usePermissions.ts — 45 lines
export function usePermissions(): Permissions {
  const { role } = useAuthContext()
  const { mode } = useScoreboardMode()
  
  return {
    scoreboard: {
      canEdit: canEditScoreboard(role, mode ?? 'view'),
      canConfigure: canConfigureMatch(role, mode ?? 'view'),
      canViewHistory: canViewMatchHistory(role),
    },
    dashboard: {
      canCreateTable: canCreateTable(role),
      showPinColumn: shouldShowPinColumn(role),
      showQrColumn: shouldShowQrColumn(role),
    }
  }
}
```
This hook:
- Gathers data from contexts (2 lines)
- Calls pure service functions (6 lines)
- Returns structured result (4 lines)
- **Total logic: ~12 lines. Rest is types and boilerplate.**

**Bad — `useSocket.ts` (anti-pattern):**
```typescript
// ❌ Hook contains validation, error messages, and business actions
const validateTablePin = (pin: string): boolean => /^\d{4}$/.test(pin)

const ERROR_MESSAGES = {
  'INVALID_PIN': 'PIN de mesa incorrecto',
  'RATE_LIMITED': 'Demasiados intentos. Esperá un minuto.',
  // ... 8 more messages
}

const scorePoint = (player: 'A' | 'B') => {
  // 20 lines of validation + socket emission logic
}
```

---

### Rule 4: No Inline Business Logic

Don't calculate things inline in a hook. Call a service.

**Bad:**
```typescript
// ❌ Inline calculation in hook
export function useDashboardStats(tables: TableInfo[]) {
  return useMemo(() => ({
    total: tables.length,
    live: tables.filter(t => t.status === 'LIVE').length,
    // ... 15 lines of calculation
  }), [tables])
}
```

**Good:**
```typescript
// ✅ Delegates to service
import { calculateDashboardStats } from '@/services/dashboard/calculateStats'

export function useDashboardStats(tables: TableInfo[]) {
  return useMemo(() => calculateDashboardStats(tables), [tables])
}
```

---

### Rule 5: Hooks Can Import Services, Not Vice Versa

Services are pure and don't know about hooks. Hooks can (and should) import services.

```
┌─────────┐     imports     ┌──────────┐
│  Hook   │  ───────────►   │ Service  │
│ (React) │                 │ (Pure)   │
└─────────┘                 └──────────┘
     │                            │
     │     NEVER this way         │
     ▼                            ▼
   ❌ Service importing Hook    ❌ Service importing React
```

---

## Real Examples: From Bad to Good

### Example 1: Match Display Hook (Model)

`useMatchDisplay.ts` is the **gold standard** in this codebase.

```typescript
// hooks/useMatchDisplay/useMatchDisplay.ts — 97 lines
export function useMatchDisplay(match: MatchStateExtended): MatchDisplayState {
  const displayState = useMemo(() => {
    // All calculation is pure. Could be extracted to services/match/calculateDisplay.ts
    const setsA = setHistory.filter(s => s.a > s.b).length
    const setsB = setHistory.filter(s => s.b > s.a).length
    
    const isSwapped = swappedSides === true
    const leftPlayer: 'A' | 'B' = isSwapped ? 'B' : 'A'
    
    // ... more calculation
    
    return { setsA, setsB, leftPlayer, /* ... */ }
  }, [match])

  return displayState
}
```

**Why it's good:**
- Single responsibility: calculate display values from match state
- Pure calculation wrapped in `useMemo` (optimization, not required for correctness)
- No socket calls, no side effects, no JSX
- Could be extracted to a service function + thin hook tomorrow

**Future improvement:**
```typescript
// services/match/calculateDisplay.ts
export function calculateMatchDisplay(match: MatchStateExtended): MatchDisplayState {
  // Same logic, but now it's a pure service
}

// hooks/useMatchDisplay.ts
export function useMatchDisplay(match: MatchStateExtended) {
  return useMemo(() => calculateMatchDisplay(match), [match])
}
```

---

### Example 2: Auth Flow (Needs Refactoring)

**Current (in `AuthPage.tsx`):**
```typescript
// ❌ Page handles socket events directly
useEffect(() => {
  const handleOwnerVerified = (data) => {
    setOwner(true, pin)
    login('owner', undefined, pin)
    navigate(Routes.DASHBOARD_OWNER)
  }
  const handleError = (error) => {
    if (error.code === 'INVALID_OWNER_PIN') {
      setError('PIN de organizador incorrecto')
    }
  }
  socket.on('OWNER_VERIFIED', handleOwnerVerified)
  socket.on('ERROR', handleError)
}, [socket, login, navigate, setOwner, pin])
```

**Good (extracted to hook):**
```typescript
// hooks/useAuthFlow.ts
export function useAuthFlow() {
  const socket = useSocketContext()
  const { login } = useAuthContext()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    const handleOwnerVerified = (data: OwnerVerifiedPayload) => {
      login('owner', undefined, data.pin)
      navigate(Routes.DASHBOARD_OWNER)
    }
    
    const handleError = (error: ErrorResponse) => {
      setError(getAuthErrorMessage(error.code)) // ✅ Service call
    }
    
    socket.on('OWNER_VERIFIED', handleOwnerVerified)
    socket.on('ERROR', handleError)
    
    return () => {
      socket.off('OWNER_VERIFIED', handleOwnerVerified)
      socket.off('ERROR', handleError)
    }
  }, [socket, login, navigate])
  
  const submitPin = useCallback((pin: string) => {
    if (!validateOwnerPin(pin)) { // ✅ Service call
      setError('El PIN debe tener 8 dígitos')
      return
    }
    setLoading(true)
    socket.emit('VERIFY_OWNER', { pin })
  }, [socket])
  
  return { submitPin, error, loading }
}
```

---

### Example 3: PIN Submission (Extract from Duplication)

**Current (duplicated in OwnerDashboardPage and RefereeDashboardPage):**
```typescript
// ❌ Same ~30 lines in two pages
const handlePinSubmit = (pin: string, tableId: string) => {
  setPinLoading(true)
  socket.once('REF_SET', () => {
    setPinLoading(false)
    setPinModalOpen(false)
    // ...
  })
  socket.once('ERROR', (error) => {
    setPinLoading(false)
    setPinError(error.message)
  })
  setTimeout(() => {
    setPinLoading(false)
  }, 5000)
  socket.emit('SET_REFEREE', { tableId, pin })
}
```

**Good (reusable hook):**
```typescript
// hooks/usePinSubmission.ts
export function usePinSubmission() {
  const socket = useSocketContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const submitPin = useCallback((pin: string, tableId: string) => {
    if (!validateTablePin(pin)) {
      setError('PIN inválido')
      return Promise.reject(new Error('Invalid PIN'))
    }
    
    setLoading(true)
    setError(null)
    
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        setLoading(false)
        reject(new Error('Timeout'))
      }, 5000)
      
      socket.once('REF_SET', () => {
        clearTimeout(timeout)
        setLoading(false)
        resolve()
      })
      
      socket.once('ERROR', (err: ErrorResponse) => {
        clearTimeout(timeout)
        setLoading(false)
        setError(err.message)
        reject(new Error(err.message))
      })
      
      socket.emit('SET_REFEREE', { tableId, pin })
    })
  }, [socket])
  
  return { submitPin, loading, error, clearError: () => setError(null) }
}
```

---

## Testing Hooks

Hooks need React Testing Library because they use React features.

```typescript
// hooks/usePermissions.test.ts
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { usePermissions } from './usePermissions'
import { AuthProvider } from '@/contexts/AuthContext'

describe('usePermissions', () => {
  it('allows scoreboard edit for referee in referee mode', () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => (
        <AuthProvider initialRole="referee">{children}</AuthProvider>
      )
    })
    
    expect(result.current.scoreboard.canEdit).toBe(true)
  })
})
```

**But:** The service functions they call should be tested separately (pure unit tests, no React). Hook tests prove wiring; service tests prove logic.

---

## Checklist

When creating a new hook, verify:

- [ ] Hook has ONE clear responsibility (name reflects it)
- [ ] Under 80 lines (exceptions documented)
- [ ] Business logic is delegated to `services/`
- [ ] No validation rules inline (use `services/validation/`)
- [ ] No error message maps inline (use `services/errors/`)
- [ ] No formatting logic inline (use `services/match/`, `services/date/`)
- [ ] No `any` types
- [ ] Has corresponding `.test.ts` or `.test.tsx` file
- [ ] Doesn't import from `services/` that import back from hooks (no cycles)
- [ ] Returns structured object, not tuples when there are 3+ values

---

## Anti-Patterns

| Anti-Pattern | Example | Why It's Wrong |
|--------------|---------|----------------|
| God Object hook | `useSocket.ts` (256 lines) | 5 responsibilities. Untestable. |
| Hook with state + actions + formatting | `useDashboard.ts` doing everything | Split into smaller hooks |
| Inline service logic | `calculateSetsWon` inside hook | Extract to `services/match/` |
| Hook calling hook calling hook | `useA` → `useB` → `useC` → `useA` | Circular dependency |
| Hook returning raw socket | `return { socket }` | Exposes implementation. Return actions instead. |
| `useEffect` with missing deps | `useEffect(() => {...}, [])` | Bugs. Always use exhaustive-deps. |
