# Functional Programming Rules

**Applies to:** All TypeScript code in `client/src/`  
**Philosophy:** Favor immutability, pure functions, and composition. Minimize side effects and mutable state.

---

## Why Functional Programming?

Functional Programming (FP) makes code:
- **Predictable** — Pure functions always produce the same output for the same input
- **Testable** — No hidden state to set up
- **Composable** — Small functions combine into larger ones
- **Parallelizable** — No shared mutable state means no race conditions

React itself is heavily influenced by FP. Hooks are functions. JSX is function calls. State updates are immutable replacements.

---

## Core Principles

### 1. Pure Functions

A pure function:
1. Returns the same output for the same input (deterministic)
2. Has no side effects (doesn't modify external state)

**Good — `services/permissions/rules/scoreboard.ts`:**
```typescript
export function canEditScoreboard(role: UserRole, mode: ScoreboardMode): boolean {
  if (!role) return false
  return (role === 'owner' || role === 'referee') && mode === 'referee'
}

// Always returns true for ('referee', 'referee')
// Always returns false for ('viewer', 'referee')
// Doesn't touch anything outside itself
```

**Bad — `useSocket.ts` (lines 156-159):**
```typescript
// ❌ Side effect: mutates external state via setState
socket.on(SocketEvents.SERVER.ERROR, (error: ErrorResponse) => {
  setState({ connected: false, connecting: false, error: message, errorCode: null })
})
```

This is acceptable in hooks (bridging to React), but the logic inside should be pure:
```typescript
// ✅ Better: extract the pure part
const getErrorState = (error: ErrorResponse): SocketState => ({
  connected: false,
  connecting: false,
  error: formatErrorMessage(error),
  errorCode: error.code,
})

// In hook:
socket.on('error', (error) => setState(getErrorState(error)))
```

---

### 2. Immutability

Never mutate data. Always create new copies.

**Good:**
```typescript
// ✅ Creates new array, doesn't mutate
setTables(prev => prev.map(t => 
  t.id === table.id ? table : t
))

// ✅ Creates new object, doesn't mutate
setMatch(prev => prev ? { ...prev, status: 'FINISHED' } : null)

// ✅ Filter creates new array
const activeTables = tables.filter(t => t.status === 'LIVE')
```

**Bad:**
```typescript
// ❌ Mutates array in place
tables.push(newTable)
setTables(tables)

// ❌ Mutates object in place
match.status = 'FINISHED'
setMatch(match)

// ❌ Mutates nested object
match.score.currentSet.a += 1
setMatch(match)
```

**React depends on immutability.** If you mutate state directly, React won't detect the change and won't re-render.

---

### 3. Functional Array Methods

Use `map`, `filter`, `reduce`, `find`, `some`, `every` instead of imperative loops.

**Good:**
```typescript
// ✅ Declarative: "give me the names"
const tableNames = tables.map(t => t.name)

// ✅ Declarative: "give me active tables"
const activeTables = tables.filter(t => t.status === 'LIVE')

// ✅ Declarative: "count active players"
const activePlayers = tables.reduce((acc, t) => 
  acc + (t.playerNames ? 2 : 0), 0
)

// ✅ Declarative: "find the current table"
const currentTable = tables.find(t => t.id === tableId)
```

**Bad:**
```typescript
// ❌ Imperative: "create empty array, loop, push"
const tableNames: string[] = []
for (let i = 0; i < tables.length; i++) {
  tableNames.push(tables[i].name)
}

// ❌ Imperative: "create empty array, loop, conditionally push"
const activeTables: TableInfo[] = []
for (const table of tables) {
  if (table.status === 'LIVE') {
    activeTables.push(table)
  }
}
```

**When to use loops:**
- Complex algorithms with early breaks
- Performance-critical code (rare in UI code)
- Async iteration (but `Promise.all` + `map` is usually better)

---

### 4. Avoid Mutable Variables

Use `const` by default. Only use `let` when reassignment is necessary.

**Good:**
```typescript
const setsA = setHistory.filter(s => s.a > s.b).length
const isAuthorized = role === 'owner' || role === 'referee'
```

**Bad:**
```typescript
let setsA = 0
for (const set of setHistory) {
  if (set.a > set.b) {
    setsA++
  }
}

let isAuthorized = false
if (role === 'owner') {
  isAuthorized = true
} else if (role === 'referee') {
  isAuthorized = true
}
```

**Exception:** Accumulators in `reduce` use `let` inside the callback, but that's scoped and controlled:
```typescript
const total = items.reduce((sum, item) => {
  const newSum = sum + item.price // ✅ const inside callback
  return newSum
}, 0)
```

---

### 5. Function Composition

Build complex logic by composing small functions.

**Good — `usePermissions`:**
```typescript
export function usePermissions(): Permissions {
  const { role } = useAuthContext()
  const { mode } = useScoreboardMode()
  
  return {
    scoreboard: {
      canEdit: canEditScoreboard(role, mode ?? 'view'),      // ✅ Composes pure functions
      canConfigure: canConfigureMatch(role, mode ?? 'view'), // ✅ Composes pure functions
    }
  }
}
```

**Good — `ScoreboardMain`:**
```typescript
export function ScoreboardMain({ match, onScorePoint }: ScoreboardMainProps) {
  const display = useMatchDisplay(match) // ✅ Composes hook
  const { canEdit } = usePermissions().scoreboard // ✅ Composes another hook
  
  return (
    <div>
      <ScoreDisplay {...display} /> // ✅ Passes computed data to component
      {canEdit && <ScoreControls onScore={onScorePoint} />}
    </div>
  )
}
```

**Bad:**
```typescript
// ❌ One giant function doing everything
function processMatch(match: MatchStateExtended) {
  const setsA = match.setHistory.filter(...).length
  const setsB = match.setHistory.filter(...).length
  const winner = setsA > setsB ? 'A' : 'B'
  const formatted = `Player ${winner} wins ${setsA}-${setsB}`
  console.log(formatted)
  updateDatabase(match.id, winner)
  sendNotification(winner)
  return formatted
}
```

**Better:**
```typescript
// ✅ Each function does one thing
const calculateSets = (history: SetScore[]) => ({
  setsA: history.filter(s => s.a > s.b).length,
  setsB: history.filter(s => s.b > s.a).length,
})

const determineWinner = (setsA: number, setsB: number) => 
  setsA > setsB ? 'A' : setsB > setsA ? 'B' : null

const formatResult = (winner: string, setsA: number, setsB: number) =>
  `Player ${winner} wins ${setsA}-${setsB}`

// Compose them
const { setsA, setsB } = calculateSets(match.setHistory)
const winner = determineWinner(setsA, setsB)
const message = winner ? formatResult(winner, setsA, setsB) : 'Draw'
```

---

### 6. Higher-Order Functions

Functions that take functions as arguments or return functions.

**Used in codebase:**
- `useCallback` — returns a memoized function
- `useMemo` — returns a memoized value computed by a function
- `Array.map`, `Array.filter` — take predicate functions

**Good:**
```typescript
// ✅ Higher-order function for event handling
const createScoreHandler = (player: 'A' | 'B') => 
  () => onScorePoint(player)

<button onClick={createScoreHandler('A')}>+</button>
<button onClick={createScoreHandler('B')}>+</button>
```

**Bad:**
```typescript
// ❌ Duplicated logic
<button onClick={() => onScorePoint('A')}>+</button>
<button onClick={() => onScorePoint('B')}>+</button>
```

---

### 7. Discriminated Unions

Use TypeScript's union types with discriminant fields instead of boolean flags.

**Good:**
```typescript
type MatchStatus = 
  | { status: 'WAITING' }
  | { status: 'CONFIGURING'; config: MatchConfig }
  | { status: 'LIVE'; match: MatchStateExtended }
  | { status: 'FINISHED'; match: MatchStateExtended; winner: 'A' | 'B' }

// Exhaustive switch — TypeScript ensures you handle all cases
function getMatchLabel(state: MatchStatus): string {
  switch (state.status) {
    case 'WAITING': return 'Waiting for players'
    case 'CONFIGURING': return 'Configuring match'
    case 'LIVE': return 'Match in progress'
    case 'FINISHED': return `Winner: ${state.winner}`
    default: return assertNever(state) // ✅ Compile-time check for exhaustiveness
  }
}

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`)
}
```

**Bad:**
```typescript
// ❌ String literal without structure
let status: 'waiting' | 'configuring' | 'live' | 'finished'

// ❌ Boolean flags
interface MatchState {
  isWaiting: boolean
  isConfiguring: boolean
  isLive: boolean
  isFinished: boolean
  winner?: 'A' | 'B'
}
// Which combinations are valid? Can isLive and isFinished both be true?
```

---

### 8. Avoid Null/Undefined with Option/Maybe

Use explicit null handling instead of implicit null propagation.

**Good:**
```typescript
const tableName = currentTable?.name ?? 'Unknown Table'

const activeMatch = tables.find(t => t.status === 'LIVE')
if (activeMatch) {
  // TypeScript knows activeMatch is not undefined here
  navigate(`/scoreboard/${activeMatch.id}`)
}
```

**Bad:**
```typescript
// ❌ Will crash if currentTable is null
const tableName = currentTable.name

// ❌ Implicit null — hard to track
const activeMatch = tables.find(t => t.status === 'LIVE')
navigate(`/scoreboard/${activeMatch.id}`) // 💥 Runtime error
```

---

### 9. No Implicit Side Effects

Side effects should be explicit and centralized.

**Allowed side effects (in hooks only):**
- `useEffect` — subscriptions, event listeners
- Socket event handlers — external communication
- localStorage/sessionStorage — persistence (but prefer a service)

**Not allowed (in components/services):**
- `console.log` in production code
- Modifying global variables
- Mutating arguments
- Calling `alert()` or `confirm()`

---

## FP in React Specifically

### State Updates Are Function Calls

React state updates are inherently functional:
```typescript
// ✅ Functional update (receives previous state)
setCount(prev => prev + 1)

// ✅ Functional update with object
setState(prev => ({ ...prev, loading: true }))
```

### Props Are Immutable

Treat props as read-only. Never mutate them.
```typescript
// ✅ Create new array
const sortedTables = [...tables].sort((a, b) => a.name.localeCompare(b.name))

// ❌ Mutates prop (breaks parent state)
tables.sort((a, b) => a.name.localeCompare(b.name))
```

### Hooks Are Composable

```typescript
// ✅ Compose hooks
const display = useMatchDisplay(match)
const permissions = usePermissions()
const stats = useDashboardStats(tables)

// Use all three in component
return (
  <Dashboard 
    display={display} 
    canEdit={permissions.scoreboard.canEdit}
    stats={stats}
  />
)
```

---

## Anti-Patterns

| Anti-Pattern | Example | Why It's Wrong | Fix |
|--------------|---------|----------------|-----|
| Mutating state directly | `state.value = 5` | React won't detect change | `setState({ ...state, value: 5 })` |
| Mutating arrays | `array.push(item)` | Side effect, unpredictable | `[...array, item]` |
| `let` by default | `let x = 5` | Invites mutation | `const x = 5` |
| Imperative loops | `for (let i...)` | Harder to read, more mutable state | `map`, `filter`, `reduce` |
| Side effects in render | `fetch()` in component body | Unpredictable timing | `useEffect` |
| Functions with no return | `processData()` that logs | Hard to test, side effects | Return result, let caller decide |
| Deep mutation | `obj.nested.value = 5` | Hard to detect, breaks immutability | Use immutable update patterns or library |
| Boolean flags over unions | `isLoading + isError` | Invalid states possible | `status: 'idle' \| 'loading' \| 'error'` |

---

## Checklist

When writing code:

- [ ] Use `const` by default, `let` only when necessary
- [ ] Never mutate props or arguments
- [ ] Use `map`, `filter`, `reduce` instead of `for` loops
- [ ] Extract pure logic to services
- [ ] Compose small functions instead of writing large ones
- [ ] Use discriminated unions instead of boolean flags
- [ ] Handle null/undefined explicitly (not implicitly)
- [ ] Side effects only in hooks, never in services
- [ ] State updates create new objects/arrays, never mutate existing
- [ ] Functions return values; callers decide what to do with them

---

## Related Documents

- [SERVICES.md](SERVICES.md) — Pure functions in detail
- [HOOKS.md](HOOKS.md) — Composing hooks
- [TESTING.md](TESTING.md) — Pure functions are easiest to test
