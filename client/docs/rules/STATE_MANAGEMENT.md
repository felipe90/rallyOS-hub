# State Management Rules

**Rule:** State lives in the lowest layer that needs it. Don't globalize what can be local.

---

## The Core Principle

Not all state is equal. We use 4 different mechanisms depending on scope and lifecycle:

| Mechanism | Scope | Use Case | Example |
|-----------|-------|----------|---------|
| **Local state** (`useState`) | Single component | UI state (modals, forms, toggles) | `isMenuOpen`, `formData` |
| **Custom hooks** | Multiple components, same feature | Feature state derived from contexts | `usePermissions`, `useMatchDisplay` |
| **Context** | App-wide or major sections | Auth, socket connection | `AuthContext`, `SocketContext` |
| **Services** (pure functions) | Stateless | Business logic, calculations | `calculateSetsWon`, `canEditScoreboard` |

---

## Rules

### Rule 1: Local State First

Start with `useState` in the component. Only lift when 2+ components need it.

**Good:**
```typescript
// ✅ Local state for UI-only concern
function MatchConfigPanel() {
  const [isExpanded, setIsExpanded] = useState(false) // Only this panel cares
  
  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)}>Configure</button>
      {isExpanded && <form>...</form>}
    </div>
  )
}
```

**Bad:**
```typescript
// ❌ Global state for local concern
// In some context:
const [isConfigExpanded, setIsConfigExpanded] = useState(false) // ❌ Why is this global?

// In component:
const { isConfigExpanded, setIsConfigExpanded } = useSomeContext()
```

---

### Rule 2: Custom Hooks for Feature State

When multiple components in a feature need the same derived state, use a custom hook.

**Good — `usePermissions`:**
```typescript
// hooks/usePermissions.ts
export function usePermissions(): Permissions {
  const { role } = useAuthContext()
  const { mode } = useScoreboardMode()
  
  return {
    scoreboard: {
      canEdit: canEditScoreboard(role, mode ?? 'view'),
      canConfigure: canConfigureMatch(role, mode ?? 'view'),
    }
  }
}

// Used in multiple components:
const { canEdit } = usePermissions().scoreboard
```

**Bad:**
```typescript
// ❌ Duplicating permission checks in every component
function ScoreboardPage() {
  const { role } = useAuthContext()
  const canEdit = role === 'referee' || role === 'owner' // ❌ Duplicated logic
}

function ScoreboardMain() {
  const { role } = useAuthContext()
  const canEdit = role === 'referee' || role === 'owner' // ❌ Same logic, different place
}
```

---

### Rule 3: Context for Global State Only

Contexts are expensive (all consumers re-render on change). Use only for state that 3+ components need, or state that's truly app-wide.

**Current contexts (appropriate use):**
- `AuthContext` — role, tableId, pins (needed by routing, pages, permissions)
- `SocketContext` — socket instance (needed by pages, hooks, organisms)

**If you're adding a new context, ask:**
1. Do 3+ unrelated components need this state? → Context
2. Is this state only used within one feature? → Custom hook
3. Is this state only used in one component? → `useState`

**Bad context example:**
```typescript
// ❌ Don't create a context for local UI state
const ModalContext = createContext(...) // Only 2 components use this modal

// ✅ Use local state + prop drilling (2 levels max)
function Parent() {
  const [isOpen, setIsOpen] = useState(false)
  return <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} />
}
```

---

### Rule 4: Contexts Are Thin

Contexts should only hold state and basic setters. No business logic.

**Good — `SocketContext`:**
```typescript
// contexts/SocketContext/SocketContext.tsx
export function SocketProvider({ children }) {
  const socketState = useSocket() // Hook does the heavy lifting
  
  return (
    <SocketContext.Provider value={socketState}>
      {children}
    </SocketContext.Provider>
  )
}
```

**Bad — `AuthContext` (current, needs refactoring):**
```typescript
// ❌ Context touching localStorage directly
const [role, setRole] = useState(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('role') as UserRole // ❌ Side effect in init
  }
  return null
})

const login = (newRole: UserRole, tId?: string, pin?: string) => {
  if (newRole) {
    localStorage.setItem('role', newRole) // ❌ Side effect in context
    setRole(newRole)
  }
  // ...
}
```

**Better:**
```typescript
// services/storage/authStorage.ts
export const authStorage = {
  getRole: () => localStorage.getItem('role') as UserRole,
  setRole: (role: UserRole) => localStorage.setItem('role', role),
  clear: () => { localStorage.removeItem('role'); ... },
}

// contexts/AuthContext.tsx
const [role, setRole] = useState(() => authStorage.getRole())

const login = (newRole: UserRole, tId?: string, pin?: string) => {
  authStorage.setRole(newRole) // ✅ Delegated to service
  setRole(newRole)
}
```

---

### Rule 5: No Business Logic in Contexts

Contexts store and provide state. They don't calculate, validate, or make decisions.

**Good:**
```typescript
// ✅ Context stores raw state
<AuthContext.Provider value={{ role, tableId, login, logout }}>
```

**Bad:**
```typescript
// ❌ Context making business decisions
<AuthContext.Provider value={{
  role,
  isOwner: role === 'owner', // ❌ Calculated value
  canCreateTable: role === 'owner', // ❌ Business logic
  login,
  logout
}}>
```

Use `usePermissions` hook instead for derived permission state.

---

## Data Flow

```
┌────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                               │
└────────────────────────────────────────────────────────────────┘

Server Socket.IO
       │
       ▼
┌──────────────────┐     ┌──────────────────┐
│ useSocket        │────►│ SocketContext    │
│ (connection +    │     │ (provides socket  │
│  listeners)      │     │  + state)         │
└──────────────────┘     └──────────────────┘
                                │
                                ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ AuthContext      │◄────│ Pages            │────►│ Custom Hooks     │
│ (role, tableId)  │     │ (OwnerDashboard, │     │ (usePermissions, │
│                  │     │  ScoreboardPage) │     │  useMatchDisplay)│
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                │                          │
                                ▼                          ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │ Organisms        │◄────│ Services         │
                         │ (ScoreboardMain, │     │ (permissions/,   │
                         │  DashboardGrid)  │     │  match/, etc.)   │
                         └──────────────────┘     └──────────────────┘
                                │
                                ▼
                         ┌──────────────────┐
                         │ Molecules/Atoms  │
                         │ (Button, Badge,  │
                         │  PageHeader)     │
                         └──────────────────┘
```

**Key rules of flow:**
1. Data flows down: Context → Pages → Hooks → Organisms → Molecules/Atoms
2. Events flow up: Atoms → Molecules → Organisms → Pages → Hooks → Socket
3. Services are called by hooks, never by components directly (exception: utilities)
4. Contexts never call services (they're too low-level). Hooks call services.

---

## When to Use What

### useState (Local State)

Use for:
- Modal open/closed
- Form input values
- Toggle states
- Local UI animations
- Dropdown/menu visibility

```typescript
const [isCreatingTable, setIsCreatingTable] = useState(false)
const [pinModalOpen, setPinModalOpen] = useState(false)
```

### Custom Hook (Feature State)

Use for:
- Derived state from contexts (permissions, display values)
- Local state shared by multiple components in a feature
- Side effects that multiple components need (socket listeners)

```typescript
const permissions = usePermissions() // Derived from AuthContext
const display = useMatchDisplay(match) // Derived from match state
const stats = useDashboardStats(tables) // Derived from socket state
```

### Context (Global State)

Use for:
- Auth state (role, tableId)
- Socket connection
- Theme/preferences (if app-wide)
- User profile (if needed globally)

```typescript
const { role, login, logout } = useAuthContext()
const { socket, tables, currentMatch } = useSocketContext()
```

### Service (No State)

Use for:
- Pure calculations
- Validation
- Formatting
- Permission rules
- URL building

```typescript
const canEdit = canEditScoreboard(role, mode)
const winner = determineSetWinner(scoreA, scoreB, pointsPerSet)
const formatted = formatEvent(event)
```

---

## Anti-Patterns

| Anti-Pattern | Example | Why It's Wrong |
|--------------|---------|----------------|
| Context for local state | `ModalContext` for 2 components | Use prop drilling or local state |
| Business logic in context | `canCreateTable` in `AuthContext` | Use `usePermissions` hook |
| Side effects in context | `localStorage.setItem` in context | Use `services/storage/` |
| Hook with multiple responsibilities | `useSocket.ts` (256 lines) | Split into focused hooks |
| Component reading context directly | Atom reading `AuthContext` | Pass via props |
| State in services | `let cache = {}` in service | Services are stateless |
| Prop drilling 4+ levels | `prop → prop → prop → prop` | Use context or composition |

---

## Current Refactoring Priorities

| Priority | Issue | Solution |
|----------|-------|----------|
| 1 | `AuthContext` touches `localStorage` directly | Extract `services/storage/authStorage.ts` |
| 2 | `useSocket.ts` is 256-line God Object | Split into `useSocketConnection`, `useSocketState`, `useSocketActions` |
| 3 | `useScoreboardAuth` (deprecated) still used | Replace with `usePermissions` + `useCan` |
| 4 | `AuthPage` handles socket events directly | Extract to `hooks/useAuthFlow.ts` |
| 5 | Pages calculate stats inline | Create `useDashboardStats` hook + `services/dashboard/calculateStats.ts` |

---

## Checklist

When deciding where to put state:

- [ ] Can this be local to one component? → `useState`
- [ ] Do 2-3 components in a feature need this? → Custom hook
- [ ] Do 3+ unrelated components need this? → Context
- [ ] Is this a calculation/transformation? → Service (no state)
- [ ] Does the context only store state and basic setters? (no business logic)
- [ ] Are side effects (storage, API) delegated to services/hooks?
- [ ] Is derived state computed in hooks, not contexts?
