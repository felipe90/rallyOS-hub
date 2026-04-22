# Components Rules

**Location:** `client/src/components/`  
**Rule:** Components render UI. They don't contain business logic.

---

## The Core Principle

Components are responsible for **presentation only**. They receive data via props, render it, and emit events via callbacks. They don't calculate scores, don't validate PINs, don't build URLs, and don't talk to sockets directly.

**A component should be testable by passing it props and asserting on the rendered output.**

---

## Atomic Design Hierarchy

We follow [Atomic Design](https://atomicdesign.bradfrost.com/) with 4 levels:

```
components/
  atoms/        — Smallest building blocks, no internal state
  molecules/    — Combinations of atoms, simple logic OK
  organisms/    — Complex sections, compose molecules + atoms
  utilities/    — Non-visual components (PrivateRoute, etc.)
```

### Atoms
**Rule:** Single element. No composition of other components. Minimal logic.

**Examples from codebase:**
- `Button.tsx` — renders a styled button with variants
- `Badge.tsx` — renders a status badge
- `ConnectionStatus.tsx` — shows connection state (exception: reads from context)
- `PinInput.tsx` — renders a PIN input field
- `Typography.tsx` — text variants

**Good atom:**
```typescript
// components/atoms/Badge/Badge.tsx
export function Badge({ variant, children }: BadgeProps) {
  const colorClass = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
  }[variant]

  return <span className={`px-2 py-1 rounded-full text-xs ${colorClass}`}>{children}</span>
}
```

**Bad atom:**
```typescript
// ❌ Atom doing too much
export function ScoreButton({ match, player, onScore }) {
  const canScore = match.status === 'LIVE' && !match.winner // ❌ Business logic in atom
  const isWinning = match.score.currentSet[player] > match.score.currentSet[otherPlayer] // ❌ Calculation
  
  return (
    <button disabled={!canScore} onClick={() => onScore(player)}>
      {match.score.currentSet[player]}
    </button>
  )
}
```

**Exception — `ConnectionStatus.tsx`:**
```typescript
// This atom reads from SocketContext. This is acceptable because:
// 1. Connection status is a system-level concern, not business logic
// 2. Every page needs it, passing as prop would be tedious
// 3. It's a pure read, no actions
export function ConnectionStatus() {
  const { connected, connecting, error } = useSocketContext()
  // ... render status
}
```

---

### Molecules
**Rule:** Composes atoms. Can have simple local state. No business logic.

**Examples from codebase:**
- `PageHeader.tsx` — title + subtitle + actions + connection status
- `TableStatusChip.tsx` — chip showing table status
- `MatchHistoryTicker.tsx` — scrolling history (needs refactoring: formatting logic should be in services)
- `ConfirmDialog.tsx` — dialog with confirm/cancel

**Good molecule:**
```typescript
// components/molecules/PageHeader/PageHeader.tsx — 32 lines
export function PageHeader({ title, subtitle, actions, showStatus = true }: PageHeaderProps) {
  return (
    <>
      {showStatus && <ConnectionStatus />}
      <header className="p-4 border-b border-border flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
    </>
  )
}
```

**Bad molecule:**
```typescript
// ❌ Molecule with business logic
export function HistoryList({ history }: { history: ScoreChange[] }) {
  const formatEvent = (event: ScoreChange) => { // ❌ Should be in services/match/formatEvent.ts
    // ... 20 lines of formatting
  }
  
  const getEventColor = (event: ScoreChange) => { // ❌ Should be in services/match/getEventColor.ts
    // ... color logic
  }
  
  return <div>{history.map(formatEvent)}</div>
}
```

---

### Organisms
**Rule:** Complex sections. Compose molecules and atoms. Can manage local UI state. Bridge to hooks.

**Examples from codebase:**
- `ScoreboardMain.tsx` — main scoreboard display (uses `useMatchDisplay` hook)
- `DashboardGrid.tsx` — grid of tables (needs refactoring: stats calculation should be in services)
- `MatchConfigPanel.tsx` — match configuration form
- `HistoryDrawer.tsx` — history drawer (needs refactoring: time formatting should be in services)

**Good organism:**
```typescript
// components/organisms/ScoreboardMain/ScoreboardMain.tsx
export function ScoreboardMain({ match, onScorePoint, onUndo }: ScoreboardMainProps) {
  const display = useMatchDisplay(match) // ✅ Delegates business logic to hook
  const { canEdit } = usePermissions().scoreboard // ✅ Reads permissions
  
  return (
    <div>
      <ScoreDisplay 
        leftScore={display.leftScore}
        rightScore={display.rightScore}
        leftSets={display.leftSets}
        rightSets={display.rightSets}
      />
      {canEdit && (
        <ScoreControls onAddA={() => onScorePoint('A')} onAddB={() => onScorePoint('B')} />
      )}
    </div>
  )
}
```

**Bad organism:**
```typescript
// ❌ Organism with inline calculation
export function DashboardGrid({ tables }: { tables: TableInfo[] }) {
  // ❌ All of this should be in services/dashboard/calculateStats.ts + hook
  const activePlayers = tables.reduce((acc, t) => {
    const hasPlayers = t.playerNames?.a || t.playerNames?.b
    return acc + (hasPlayers ? 2 : (t.playerCount || 0))
  }, 0)
  
  const liveMatches = tables.filter(t => t.status === 'LIVE').length
  
  return (
    <div>
      <StatCard label="Active Players" value={activePlayers} />
      <StatCard label="Live Matches" value={liveMatches} />
    </div>
  )
}
```

---

### Utilities
**Rule:** Non-visual components. Handle routing, auth guards, layout.

**Examples from codebase:**
- `PrivateRoute.tsx` — route guard based on auth state
- `ErrorBoundary.tsx` — error handling (if exists)

---

## Rules

### Rule 1: No Business Logic in Components

Components render. They don't calculate, validate, or transform.

**Allowed in components:**
- Conditional rendering (`if (loading) return <Spinner />`)
- Event forwarding (`onClick={() => onAdd('A')}`)
- CSS class composition
- Simple local UI state (`isExpanded`, `isMenuOpen`)

**NOT allowed in components:**
- Score/set winner calculation
- PIN validation
- URL building
- Statistics aggregation
- Error message maps
- Date formatting
- History event formatting

**Good:**
```typescript
// ✅ Component only renders what it receives
export function ScoreDisplay({ score, sets, serving }: ScoreDisplayProps) {
  return (
    <div className="flex justify-center gap-8">
      <div className={serving === 'A' ? 'text-primary' : ''}>
        <span className="text-6xl">{score.a}</span>
        <span className="text-2xl">{sets.a}</span>
      </div>
      <div className={serving === 'B' ? 'text-primary' : ''}>
        <span className="text-6xl">{score.b}</span>
        <span className="text-2xl">{sets.b}</span>
      </div>
    </div>
  )
}
```

**Bad:**
```typescript
// ❌ Component calculates winner
export function ScoreDisplay({ match }: { match: MatchStateExtended }) {
  const pointsPerSet = match.config?.pointsPerSet || 11 // ❌ Should be in service
  const setWinner = match.score.currentSet.a >= pointsPerSet && match.score.currentSet.a > match.score.currentSet.b
    ? 'A' // ❌ Calculation in component
    : null
  
  return <div>{setWinner && <span>Set Winner: {setWinner}</span>}</div>
}
```

---

### Rule 2: Props Over Context (for Atoms and Molecules)

Atoms and molecules should receive data via props, not read from context. This makes them reusable and testable.

**Good:**
```typescript
// ✅ Receives everything via props
export function Button({ variant, size, onClick, children }: ButtonProps) {
  return <button className={...} onClick={onClick}>{children}</button>
}
```

**Bad:**
```typescript
// ❌ Atom reading context
export function UserBadge() {
  const { user } = useAuthContext() // ❌ Atom should not know about auth
  return <span>{user.name}</span>
}
```

**Exception:** System-level atoms like `ConnectionStatus` that appear on every page.

---

### Rule 3: Components Don't Build URLs

URL construction is business logic. Components receive ready-made URLs.

**Bad — `QRCodeImage.tsx`:**
```typescript
// ❌ Component does encryption and URL building
export function QRCodeImage({ tableId, pin }: QRCodeImageProps) {
  const key = generateKey(tableId) // ❌ Business logic
  const encryptedPin = encryptPin(pin, key) // ❌ Business logic
  const joinUrl = `${window.location.origin}/scoreboard/${tableId}/referee?ePin=${encryptedPin}`
  
  return <QRCode value={joinUrl} />
}
```

**Good:**
```typescript
// ✅ Component receives URL, doesn't build it
export function QRCodeImage({ joinUrl }: QRCodeImageProps) {
  return <QRCode value={joinUrl} />
}

// URL is built in service + hook:
// const joinUrl = useMemo(() => buildScoreboardUrl(tableId, pin), [tableId, pin])
```

---

### Rule 4: Event Handlers Forward, Don't Transform

Components receive event handlers via props. They don't transform event data before calling the handler.

**Good:**
```typescript
// ✅ Simple forwarding
<motion.button onClick={onAdd} disabled={disabled}>
  +
</motion.button>
```

**Bad:**
```typescript
// ❌ Component transforms event data
<button onClick={(e) => {
  const score = calculateNewScore(currentScore, 1) // ❌ Should be in parent hook
  onScoreUpdate(score)
}}>
  +
</button>
```

---

### Rule 5: One Component Per File

Each component lives in its own file. Exception: tightly coupled sub-components (like `Button` + `ScoreButton`).

**Good structure:**
```
components/
  atoms/
    Button/
      Button.tsx
      Button.types.ts
      Button.test.tsx
      index.ts
  molecules/
    PageHeader/
      PageHeader.tsx
      PageHeader.types.ts
      index.ts
```

**Bad:**
```
components/
  DashboardHeader.tsx  // ❌ Should be in organisms/DashboardHeader/
  ScoreboardStuff.tsx  # ❌ Vague name, probably too big
```

---

### Rule 6: Types in Separate File

Each component has its props type in a `.types.ts` file.

```typescript
// Button.types.ts
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}
```

---

## Real Examples: From Bad to Good

### Example 1: Button Component (Model)

`Button.tsx` is well-structured:
- Purely presentational
- Receives all data via props
- No business logic
- Variants defined as configuration, not hardcoded

```typescript
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-md hover:shadow-lg',
  secondary: 'bg-surface-low text-text hover:bg-surface-high',
  // ... etc
}
```

**One issue:** `ScoreButton` is defined in the same file. It's related but different enough that it could be its own component in `atoms/ScoreButton/`.

---

### Example 2: DashboardGrid (Needs Refactoring)

**Current:**
```typescript
// ❌ Inline stats calculation and URL generation
export function DashboardGrid({ tables }: DashboardGridProps) {
  const activePlayers = tables.reduce((acc, t) => { // ❌ Inline calculation
    const hasPlayers = t.playerNames?.a || t.playerNames?.b
    return acc + (hasPlayers ? 2 : (t.playerCount || 0))
  }, 0)

  const generateTableUrl = (tableId: string) => { // ❌ URL building in component
    return `/scoreboard/${tableId}/referee`
  }

  return (
    <div>
      <StatCard label="Active Players" value={activePlayers} />
      {tables.map(table => (
        <QRCodeImage url={generateTableUrl(table.id)} /> // ❌ Passes built URL
      ))}
    </div>
  )
}
```

**Good:**
```typescript
// ✅ Delegates to hooks and services
export function DashboardGrid({ tables }: DashboardGridProps) {
  const stats = useDashboardStats(tables) // ✅ Hook calls service
  
  return (
    <div>
      <StatCard label="Active Players" value={stats.activePlayers} />
      <StatCard label="Live Matches" value={stats.liveMatches} />
      {tables.map(table => (
        <TableCard key={table.id} table={table} /> // ✅ TableCard gets raw data
      ))}
    </div>
  )
}
```

---

### Example 3: PageHeader (Model)

`PageHeader.tsx` is a perfect molecule:
- Composes atoms (`ConnectionStatus`)
- Receives data via props
- No business logic
- 32 lines

---

## Testing Components

Components should be tested with React Testing Library, focusing on user behavior.

```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByText('Click'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByText('Disabled')).toBeDisabled()
  })
})
```

**Important:** Component tests verify rendering and interaction. They don't test business logic (that's for service tests).

---

## Checklist

When creating a new component, verify:

- [ ] Component only renders UI (no business logic)
- [ ] Receives data via props (atoms/molecules) or hooks (organisms)
- [ ] No inline calculations, validations, or transformations
- [ ] No URL building or encryption
- [ ] No socket event handling
- [ ] Event handlers are forwarded, not transformed
- [ ] Has `.types.ts` file with explicit prop types
- [ ] Has `.test.tsx` file with rendering/interaction tests
- [ ] Placed in correct Atomic Design folder (`atoms/`, `molecules/`, `organisms/`)
- [ ] One component per file (with index.ts barrel export)

---

## Anti-Patterns

| Anti-Pattern | Example | Why It's Wrong |
|--------------|---------|----------------|
| Component with calculations | `const winner = scoreA > scoreB ? 'A' : 'B'` | Use service + hook |
| Component with validation | `if (pin.length !== 4) return` | Use service |
| Component building URLs | `` `url = /scoreboard/${id}` `` | Use `services/url/` |
| Atom reading context | `const { user } = useAuthContext()` | Pass via props |
| Inline formatting | `date.toLocaleDateString()` | Use `services/date/` |
| Component with socket | `socket.emit('ACTION')` | Use hook |
| God component | `DashboardPage.tsx` (240 lines) | Split into organisms |
| `any` in props | `score: any` | Use shared types |
