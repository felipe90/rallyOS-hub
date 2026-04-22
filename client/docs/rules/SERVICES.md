# Services Layer Rules

**Location:** `client/src/services/`  
**Rule:** If the logic doesn't need React to work, it lives here.

---

## The Core Principle

Services contain **pure business logic** — calculations, transformations, validations, and domain rules. They know nothing about React, components, hooks, or the DOM.

**A service function must be testable with a simple `assert` or `expect`. No `render()`, no `mount()`, no `act()` needed.**

---

## What Belongs in Services

| Category | Examples | Current Location (Wrong) |
|----------|----------|--------------------------|
| Calculations | Score/set winner logic, handicap math | `ScoreboardMain.tsx` inline |
| Transformations | Format history events, format timestamps | `MatchHistoryTicker.tsx`, `HistoryDrawer.tsx` |
| Validations | PIN length, name length, score bounds | `useSocket.ts` (lines 32-37) |
| Rules | Permissions, feature flags | `services/permissions/rules/` (model) |
| URL building | Generate scoreboard URLs, QR data | `DashboardGrid.tsx`, `QRCodeImage.tsx` |
| Statistics | Dashboard aggregations | `OwnerDashboardPage.tsx` inline JSX |

---

## What Does NOT Belong in Services

| Category | Why Not | Where It Goes |
|----------|---------|---------------|
| React state | Services are pure, no side effects | Hooks (`useState`) or Contexts |
| Event handlers | Services don't know about user interactions | Components (`onClick`) |
| JSX | Services don't render | Components |
| Socket.io calls | Services don't do I/O | Hooks (`useSocketActions`) |
| localStorage access | Side effects | `hooks/useAuth.ts` or dedicated storage hook |

---

## Rules

### Rule 1: Zero React Dependencies

A service file must not import from `react`, `react-dom`, or any UI library.

**Good:**
```typescript
// services/match/calculateSets.ts
import type { SetScore } from '@/shared/types'

export function calculateSetsWon(setHistory: SetScore[]): { setsA: number; setsB: number } {
  return {
    setsA: setHistory.filter(s => s.a > s.b).length,
    setsB: setHistory.filter(s => s.b > s.a).length,
  }
}
```

**Bad:**
```typescript
// WRONG - service importing React
import { useMemo } from 'react' // ❌ NEVER

export function calculateSomething(data: any) {
  return useMemo(() => data, [data]) // ❌ Services don't use hooks
}
```

---

### Rule 2: Deterministic — Same Input, Same Output

Service functions must be deterministic. Given the same arguments, they always return the same result.

**Good:**
```typescript
// services/permissions/rules/scoreboard.ts
export function canEditScoreboard(role: UserRole, mode: ScoreboardMode): boolean {
  if (!role) return false
  const isAuthorizedRole = role === UserRoles.OWNER || role === UserRoles.REFEREE
  return isAuthorizedRole && mode === 'referee'
}

// Test: canEditScoreboard('referee', 'referee') === true (always)
// Test: canEditScoreboard('viewer', 'referee') === false (always)
```

**Bad:**
```typescript
// WRONG - non-deterministic
export function canEdit() {
  return Math.random() > 0.5 ? true : false // ❌ NEVER
}

// WRONG - depends on global state
export function canEdit() {
  return window.currentUser?.role === 'owner' // ❌ Pass it as argument instead
}
```

---

### Rule 3: Single Responsibility

One service file = one domain concept. Don't mix unrelated logic.

**Good structure:**
```
services/
  permissions/
    rules/
      scoreboard.ts    # Scoreboard permissions only
      dashboard.ts     # Dashboard permissions only
      url.ts           # URL parsing only
  match/
    calculateSets.ts   # Set counting
    determineWinner.ts # Winner detection
    formatEvent.ts     # History formatting
    applySideSwap.ts   # Side swap logic
  dashboard/
    calculateStats.ts  # Stats aggregation
  validation/
    pin.ts             # PIN validation
    auth.ts            # Auth form validation
    match.ts           # Match config validation
  url/
    buildTableUrl.ts   # URL construction
    buildScoreboardUrl.ts
```

**Bad structure:**
```
services/
  utils.ts             # ❌ Garbage dump of unrelated functions
  helpers.ts           # ❌ "Helper" is not a domain
```

---

### Rule 4: Types Over Any

Service functions must be fully typed. `any` is forbidden.

**Good:**
```typescript
export function determineSetWinner(
  scoreA: number,
  scoreB: number,
  pointsPerSet: number
): 'A' | 'B' | null {
  // ...
}
```

**Bad:**
```typescript
export function determineSetWinner(scoreA: any, scoreB: any): any { // ❌ NEVER
  // ...
}
```

---

## Real Examples: From Bad to Good

### Example 1: PIN Validation

**Current (in `useSocket.ts`, lines 32-37):**
```typescript
// ❌ Mixed with socket logic, not reusable
const validateTablePin = (pin: string): boolean => /^\d{4}$/.test(pin);
const validateOwnerPin = (pin: string): boolean => /^\d{8}$/.test(pin);
```

**Good (extracted to service):**
```typescript
// services/validation/pin.ts
export const TABLE_PIN_LENGTH = 4
export const OWNER_PIN_LENGTH = 8

export function validateTablePin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

export function validateOwnerPin(pin: string): boolean {
  return /^\d{8}$/.test(pin)
}

export function validatePinLength(pin: string, expectedLength: number): boolean {
  return pin.length === expectedLength && /^\d+$/.test(pin)
}
```

---

### Example 2: History Formatting

**Current (in `MatchHistoryTicker.tsx`):**
```typescript
// ❌ Component knows how to format business events
const formatEvent = (event: ScoreChange): string => {
  if (event.action === 'SET_WON') {
    const winner = event.player || 'A'
    const loser = winner === 'A' ? 'B' : 'A'
    // ... 20 lines of formatting logic
  }
  // ...
}
```

**Good (service + thin hook):**
```typescript
// services/match/formatEvent.ts
export function formatEvent(event: ScoreChange): string {
  switch (event.action) {
    case 'SET_WON':
      return formatSetWon(event)
    case 'SCORE':
      return formatScore(event)
    default:
      return formatGeneric(event)
  }
}

function formatSetWon(event: ScoreChange): string {
  const winner = event.player || 'A'
  const loser = winner === 'A' ? 'B' : 'A'
  const winnerScore = winner === 'A' ? event.pointsAfter.a : event.pointsAfter.b
  const loserScore = winner === 'A' ? event.pointsAfter.b : event.pointsAfter.a
  return `Set ${event.setNumber || '?'} - ${winner} ${winnerScore}-${loserScore}`
}
```

```typescript
// hooks/useFormattedHistory.ts
import { useMemo } from 'react'
import { formatEvent } from '@/services/match/formatEvent'

export function useFormattedHistory(history: ScoreChange[]) {
  return useMemo(
    () => history.map(formatEvent),
    [history]
  )
}
```

---

### Example 3: Dashboard Statistics

**Current (inline in `OwnerDashboardPage.tsx` JSX):**
```typescript
// ❌ Calculation inside JSX, not reusable, not testable
activePlayers={tables.reduce((acc, t) => {
  const hasPlayers = t.playerNames?.a || t.playerNames?.b
  return acc + (hasPlayers ? 2 : (t.playerCount || 0))
}, 0) || 0}
```

**Good:**
```typescript
// services/dashboard/calculateStats.ts
import type { TableInfo } from '@/shared/types'

export interface DashboardStats {
  totalTables: number
  liveMatches: number
  activePlayers: number
}

export function calculateDashboardStats(tables: TableInfo[]): DashboardStats {
  return {
    totalTables: tables.length,
    liveMatches: tables.filter(t => t.status === 'LIVE' || t.status === 'CONFIGURING').length,
    activePlayers: tables.reduce((acc, t) => {
      const hasPlayers = t.playerNames?.a || t.playerNames?.b
      return acc + (hasPlayers ? 2 : (t.playerCount || 0))
    }, 0)
  }
}
```

```typescript
// hooks/useDashboardStats.ts
import { useMemo } from 'react'
import { calculateDashboardStats } from '@/services/dashboard/calculateStats'
import type { TableInfo } from '@/shared/types'

export function useDashboardStats(tables: TableInfo[]) {
  return useMemo(() => calculateDashboardStats(tables), [tables])
}
```

---

### Example 4: URL Building

**Current (in `QRCodeImage.tsx`):**
```typescript
// ❌ Component does encryption and URL building
const key = generateKey(tableId)
const encryptedPin = encryptPin(pin, key)
const joinUrl = `${window.location.origin}/scoreboard/${tableId}/referee?ePin=${encryptedPin}`
```

**Good:**
```typescript
// services/url/buildScoreboardUrl.ts
export function buildScoreboardUrl(tableId: string, pin: string): string {
  const key = generateKey(tableId)
  const encryptedPin = encryptPin(pin, key)
  return `${window.location.origin}/scoreboard/${tableId}/referee?ePin=${encryptedPin}`
}
```

```typescript
// QRCodeImage.tsx — now purely presentational
interface QRCodeImageProps {
  joinUrl: string  // ✅ Receives URL, doesn't build it
  size?: number
}
```

---

## Testing Services

Services must have unit tests that run **without React**.

```typescript
// services/permissions/rules/scoreboard.test.ts
import { canEditScoreboard } from './scoreboard'

describe('canEditScoreboard', () => {
  it('allows referee in referee mode', () => {
    expect(canEditScoreboard('referee', 'referee')).toBe(true)
  })

  it('denies viewer in referee mode', () => {
    expect(canEditScoreboard('viewer', 'referee')).toBe(false)
  })

  it('denies anyone in view mode', () => {
    expect(canEditScoreboard('referee', 'view')).toBe(false)
    expect(canEditScoreboard('owner', 'view')).toBe(false)
  })
})
```

**Why this matters:** These tests run in milliseconds. They don't need `jsdom`, `render()`, or `act()`. They prove your business logic is correct independent of the UI.

---

## Checklist

When creating a new service, verify:

- [ ] File is in `services/<domain>/`
- [ ] No imports from `react`, `react-dom`, or UI libraries
- [ ] Function is deterministic (same input → same output)
- [ ] Function has a single, clear responsibility
- [ ] All parameters and return types are explicitly typed (no `any`)
- [ ] Has corresponding `.test.ts` file with pure unit tests
- [ ] No side effects (no `console.log`, no API calls, no storage access)
- [ ] Named after what it does, not what it's for (e.g., `calculateSetsWon` not `scoreboardHelper`)

---

## Anti-Patterns

| Anti-Pattern | Example | Why It's Wrong |
|--------------|---------|----------------|
| "Utils" file | `services/utils.ts` | Garbage dump. No domain meaning. |
| Service with state | `let cache = {}` | Services are stateless. Use hooks for state. |
| Service calling hooks | `useMemo` inside service | Services don't know React exists. |
| Service with side effects | `fetch()` inside service | Use hooks or dedicated API layer. |
| `any` types | `function(x: any): any` | Defeats TypeScript's purpose. |
