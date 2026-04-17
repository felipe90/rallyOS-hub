# RallyOS Client Component Architecture Analysis

**Date:** April 8, 2026  
**Scope:** `/client/src/` - Full component hierarchy analysis  
**Files Analyzed:** 18 components + 2 hooks + 1 context  

---

## 1. COMPONENT INVENTORY

### PAGES (5 components)
| Component | Location | Purpose | Props | State |
|-----------|----------|---------|-------|-------|
| **AuthPage** | `pages/AuthPage.tsx` | Role selection + PIN entry flow | none | `pin`, `error`, `isLoading`, `mode` |
| **DashboardPage** | `pages/DashboardPage.tsx` | Table list, creation, navigation | none | `viewMode`, `isCreatingTable`, `tableName` |
| **ScoreboardPage** | `pages/ScoreboardPage.tsx` | Match display with referee controls | `tableId` (param) | `historyOpen` |
| **WaitingRoomPage** | `pages/WaitingRoomPage.tsx` | Spectator table selection + PIN join | none | `selectedTableId`, `pin`, `error` |
| **HistoryViewPage** | `pages/HistoryViewPage.tsx` | Full-page event history | none | none |

### ORGANISMS (4 components)
| Component | Location | Purpose | Props | State |
|-----------|----------|---------|-------|-------|
| **DashboardGrid** | `organisms/DashboardGrid.tsx` | Table cards grid/list view | `tables`, `onTableClick`, `viewMode` | none |
| **DashboardHeader** | `organisms/DashboardGrid.tsx` | Stats bar + view mode toggle | `totalTables`, `liveMatches`, `activePlayers`, `viewMode`, `onViewModeChange` | none |
| **ScoreboardMain** | `organisms/ScoreboardMain.tsx` | Large interactive scoreboard display | `match`, `onScorePoint`, `onSubtractPoint`, `onUndo`, `isReferee` | none (pure presentational) |
| **HistoryDrawer** | `organisms/HistoryDrawer.tsx` | Slide-in event history panel | `isOpen`, `events`, `onClose`, `onUndo` | none |

**Bonus Component (nested in ScoreboardMain):**  
- **MatchConfigPanel** (lines 408-561) - Match configuration form | `defaultConfig`, `onStart`, `onCancel` | `pointsPerSet`, `bestOf`, `handicapA`, `handicapB` |

### MOLECULES (6 components)
| Component | Location | Purpose | Props | State |
|-----------|----------|---------|-------|-------|
| **ScoreDisplay** | `molecules/ScoreDisplay.tsx` (lines 1-44) | Single score card with animations | `score`, `player`, `meta`, `serving`, `winner` | none |
| **ScorePair** | `molecules/ScoreDisplay.tsx` (lines 46-70) | Two scores side-by-side with vs divider | `score`, `serving`, `playerNames` | none |
| **StatCard** | `molecules/StatCard.tsx` | Dashboard metric card | `title`, `value`, `change`, `trend`, `graph` | none |
| **MiniStatCard** | `molecules/StatCard.tsx` | Compact inline stat | `label`, `value`, `icon` | none |
| **TableStatusChip** | `molecules/TableStatusChip.tsx` | Table info card with status badge | `tableNumber`, `tableName`, `status`, `tablePin`, `playerNames`, `playerCount` | none |
| **MatchContext** | `molecules/MatchContext.tsx` (lines 1-54) | Tournament phase info display | `phase`, `status`, `matchNumber`, `bestOf`, `pointsPerSet` | none |
| **SetScore** | `molecules/MatchContext.tsx` (lines 56-85) | Individual set score | `setNumber`, `scoreA`, `scoreB`, `isCurrentSet` | none |

### ATOMS (7 components)
| Component | Location | Purpose | Props | State |
|-----------|----------|---------|-------|-------|
| **Button** | `atoms/Button.tsx` (lines 1-61) | Primary button variant | `variant`, `size`, `children`, `loading`, `animate` | none |
| **ScoreButton** | `atoms/Button.tsx` (lines 63-107) | Score control buttons (+/-) | `side`, `onAdd`, `onSubtract`, `disabled` | none |
| **Input** | `atoms/Input.tsx` (lines 1-44) | Text input with label/error | `label`, `error`, `hint`, `...HTMLInputAttributes` | none |
| **PinInput** | `atoms/Input.tsx` (lines 46-100) | 4-digit PIN input fields | `value`, `onChange`, `length`, `error` | none |
| **Typography** | `atoms/Typography.tsx` | Text component family | `variant`, `weight`, `as`, `children` | none |
| **Headline, Title, Body, Label, Caption** | `atoms/Typography.tsx` | Typography shortcuts | `children`, `className` | none |
| **Badge** | `atoms/Badge.tsx` | Status indicators | `status`, `children`, `dot` | none |
| **WaitingBadge, ConfiguringBadge, LiveBadge, FinishedBadge** | `atoms/Badge.tsx` | Status badge shortcuts | none | none |
| **Icon** | `atoms/Icon.tsx` | Lucide icon wrapper | `name`, `size`, `variant` | none |

### HOOKS (2)
| Hook | Location | Purpose | Returns |
|------|----------|---------|---------|
| **useSocket** | `hooks/useSocket.ts` | Socket.io connection + events | `{connected, tables, currentMatch, emit, createTable, ...}` |
| **useAuth** | `hooks/useAuth.ts` | LocalStorage-based auth | `{role, isReferee, isViewer, login, logout}` |

### CONTEXT (1)
| Context | Location | Purpose |
|---------|----------|---------|
| **SocketContext** | `contexts/SocketContext.tsx` | Global socket state provider |

### OTHER UTILITIES (1)
| Component | Location | Purpose |
|-----------|----------|---------|
| **ConnectionStatus** | `components/ConnectionStatus.tsx` | Fixed header showing socket connection state |

---

## 2. IDENTIFIED DUPLICATIONS

### 2.1 PIN Input Validation (MEDIUM PRIORITY)
**Issue:** PIN validation implemented 3 different ways

| Location | Implementation | Problem |
|----------|-----------------|---------|
| **AuthPage** (line 60-62) | `e.target.value.replace(/\D/g, '').slice(0, 5)` | Manual string manipulation |
| **WaitingRoomPage** (line 39-40) | `e.target.value.replace(/\D/g, '').slice(0, 5)` | Identical—duplicated logic |
| **PinInput atom** (lines 46-100) | Custom component with digit array splitting | Overly complex for common task |

**Impact:** 
- Bug fix requires changes in 2+ places
- Inconsistent UX if validation logic diverges
- PinInput atom exists but isn't used in forms  

**Suggestion:** Consolidate to single `usePinInput` hook or use PinInput consistently  

---

### 2.2 Header Layout Pattern (HIGH PRIORITY)  
**Issue:** Page headers duplicated across 4 pages with minor variations

| Location | Code Pattern |
|----------|--------------|
| **DashboardPage** (lines 46-76) | `<div className="pt-12 p-4 border-b border-border flex justify-between items-center">` |
| **ScoreboardPage** (lines 63-75) | `<div className="pt-12 p-4 border-b border-border flex justify-between items-center">` |
| **WaitingRoomPage** (lines 31-45) | `<div className="p-4 border-b border-border">` (slightly different) |
| **HistoryViewPage** (lines 6-20) | `<div className="p-4 border-b border-border flex justify-between items-center">` |

**Impact:**
- 4 nearly identical Tailwind class strings (15+ classes each)
- Styling drift if CSS variables change
- No responsive behavior in header components

**Suggestion:** Extract `PageHeader` component:
```tsx
// Create: components/atoms/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="pt-12 p-4 border-b border-border flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-heading font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
```

---

### 2.3 Modal/Config Panel Logic (MEDIUM PRIORITY)
**Issue:** MatchConfigPanel shown in 2 places with duplicated async logic

| Location | Pattern |
|----------|---------|
| **ScoreboardPage** (lines 97-132) | `if (isReferee && currentMatch.status !== 'LIVE')` then show config |
| **ScoreboardMain** (lines 89-107) | Same condition duplicates config check |

**Impact:**
- Config logic split between container & presentational component
- Hard to test in isolation
- Parent & child both decide when to show (confusion of responsibilities)

**Suggestion:** 
- Move all config logic to page container
- ScoreboardMain should ONLY show livematch display
- Remove MatchConfigPanelInternal duplication (lines 420-440 vs actual panel)

---

### 2.4 Input Field Styling (MEDIUM PRIORITY)
**Issue:** Custom input fields bypass Input atom component

| Location | Implementation |
|----------|-----------------|
| **DashboardPage** (lines 70-77) | Custom `<input>` with inline Tailwind |
| **WaitingRoomPage** (lines 46-54) | Custom `<input>` with inline Tailwind |
| **Input** atom | Proper component exists but not used |

Both pages use identical styling:
```tsx
className="px-3 py-2 rounded border border-border bg-background text-text"
```

**Impact:**
- Form styling inconsistencies
- Error states not handled consistently
- Input atom doesn't get usage feedback

**Suggestion:** Replace custom inputs with `<Input>` component in both pages

---

### 2.5 Score Display in History (LOW-MEDIUM PRIORITY)
**Issue:** Score display rendered 2 different ways

| Location | Implementation |
|----------|-----------------|
| **HistoryDrawer** (lines 52-55) | Inline spans: `<span>{event.pointsAfter.a} - {event.pointsAfter.b}</span>` |
| **ScoreDisplay** molecule | Dedicated component exists with animations |
| **ScoreboardMain** | Inline large text (line 280): `text-[18rem]` |

**Impact:**
- Inconsistent styling across score displays
- ScoreDisplay component underutilized
- Three different ways to show same data

---

### 2.6 Form State Management (MEDIUM PRIORITY)
**Issue:** Similar form pattern repeated with slight variations

| Location | Code |
|----------|------|
| **AuthPage** | `const [pin, setPin]` + `const [error, setError]` + `const [isLoading, setIsLoading]` |
| **DashboardPage** | `const [isCreatingTable, setIsCreatingTable]` + `const [tableName, setTableName]` |
| **WaitingRoomPage** | `const [selectedTableId, setSelectedTableId]` + `const [pin, setPin]` + `const [error, setError]` |
| **MatchConfigPanel** | `const [pointsPerSet, setPointsPerSet]` + `const [bestOf, setBestOf]` + handicap values |

**Impact:**
- No validation abstraction (validation logic in handlers)
- No feedback/error state pattern
- Hard to add features like "debounce" or "validation hints"

**Suggestion:** Consider `useFormState` hook:
```tsx
const { values, errors, handleChange, handleSubmit } = useFormState(
  { pin: '', error: '' },
  validatePin
)
```

---

## 3. IDENTIFIED SILOS (Tightly Coupled Components)

### 3.1 **ScoreboardMain is tightly coupled to MatchStateExtended** (HIGH)
**Location:** `organisms/ScoreboardMain.tsx` (lines 55-300+)

**Problems:**
1. **Complex nested property access:**
   ```tsx
   // Lines 58-70: Complex unpacking of nested state
   const leftPlayer = isSwapped ? 'B' : 'A'
   const leftScore = isSwapped ? score.currentSet.b : score.currentSet.a
   const leftSets = isSwapped ? setsB : setsA
   const leftServing = isSwapped ? (score.serving === 'B') : (score.serving === 'A')
   ```
   - Requires knowledge of exact shape: `match.score.currentSet.a/b`, `match.swappedSides`, `match.config.bestOf`
   - Tight coupling to MatchStateExtended interface

2. **Business logic in presentational component:**
   ```tsx
   // Lines 62-63: Calculation logic
   const setsA = setHistory.filter(s => s.a > s.b).length
   const setsB = setHistory.filter(s => s.b > s.a).length
   ```
   - Score calculation shouldn't live in presentation layer

3. **Side-swap logic hardcoded** (lines 64-77):
   - ITTF-specific business rule embedded in component
   - Would be hard to reuse for different sports

4. **Large component (561 lines total)**:
   - Handles multiple concerns: display, calculations, role-checking, mode switching
   - Hard to unit test in isolation

**Impact:** Cannot reuse ScoreboardMain for:
- Different match types (volleyball, badminton)
- Different state shapes
- Different calculation rules

**Suggestion:** Extract business logic:
```tsx
// Create: hooks/useMatchDisplay.ts
interface UseMatchDisplayResult {
  leftPlayer: 'A' | 'B'
  leftScore: number
  leftSets: number
  leftServing: boolean
  // ... all computed values
}

export function useMatchDisplay(match: MatchStateExtended): UseMatchDisplayResult {
  // All the calculation logic from ScoreboardMain moved here
}
```

---

### 3.2 **DashboardHeader & DashboardGrid are co-dependent** (MEDIUM)  
**Location:** `organisms/DashboardGrid.tsx` (lines 44-128)

**Problems:**
1. **Exported together, imported together:**
   ```tsx
   // In DashboardPage (line 3)
   import { DashboardGrid, DashboardHeader } from '../organisms/DashboardGrid'
   ```

2. **Header requires aggregate calculations:**
   ```tsx
   // Page must calculate stats that header consumes
   const liveMatches = tables.filter(t => t.status === 'LIVE').length
   const activePlayers = tables.reduce(...)
   // Then pass to DashboardHeader (lines 79-84)
   ```

3. **tightly coupled props:**
   - Header expects specific props: `totalTables`, `liveMatches`, `activePlayers`
   - Form validation: if Grid changes, Header must know

**Impact:**
- Can't use DashboardHeader without DashboardGrid
- Can't reuse Header in other contexts (different dashboard types)
- Stat calculations leak into page logic

**Suggestion:** 
- Move to separate files
- Make stats calculation optional callback props
- Use composition pattern

---

### 3.3 **TableStatusChip hardcodes badge mapping** (MEDIUM)
**Location:** `molecules/TableStatusChip.tsx` (lines 17-22)

```tsx
const statusBadge: Record<TableStatus, typeof WaitingBadge> = {
  WAITING: WaitingBadge,
  CONFIGURING: ConfiguringBadge,
  LIVE: LiveBadge,
  FINISHED: FinishedBadge,
};
```

**Problems:**
1. **Silo #1: Tightly coupled to Badge components**
   - If badge components move, this breaks
   - Can't customize badge per context

2. **Silo #2: Hard to add new statuses**
   - Adding status requires changes here AND Badge component
   - No error if mapping incomplete

3. **Silo #3: Styling assumptions**
   - Component assumes status directly maps to badge type
   - No way to override styling per table context

**Suggestion:** Accept badge component as prop:
```tsx
interface TableStatusChipProps {
  // ... other props
  statusComponent?: ReactNode; // or badgeVariant prop
}
```

---

### 3.4 **History is duplicated (Drawer vs Page)** (MEDIUM)
**Locations:** 
- `organisms/HistoryDrawer.tsx` (lines 1-90) - Slide-in panel
- `pages/HistoryViewPage.tsx` (lines 1-40) - Full page view

**Problems:**
1. **Two implementations of same content:**
   ```tsx
   // HistoryDrawer: Formatted events from props
   {events.map((event) => <div>...{event.pointsAfter.a} - {event.pointsAfter.b}...</div>)}
   
   // HistoryViewPage: Formatted events from currentMatch object
   {currentMatch?.history.map((event) => <div>...{event.action}...</div>)}
   ```

2. **Different data sources:**
   - Drawer gets passed `events` prop
   - Page gets `currentMatch.history` from context
   - Both format differently

3. **Different styling:**
   - Drawer uses animated motion divs, tonal shifts
   - Page uses simple divs
   - No visual consistency

**Impact:**
- Update history format in one place = must update both
- Inconsistent UX (drawer vs page view look different)
- Code duplication

**Suggestion:** Extract `HistoryList` molecule:
```tsx
// components/molecules/HistoryList.tsx
interface HistoryListProps {
  events: ScoreChange[]
  variant?: 'compact' | 'full' // drawer vs page
  onUndo?: (id: string) => void
}

export function HistoryList({ events, variant = 'full', onUndo }: HistoryListProps) {
  // Shared rendering logic
}

// Then:
export function HistoryDrawer() {
  return <HistoryList variant="compact" ... />
}

export function HistoryViewPage() {
  return <HistoryList variant="full" ... />
}
```

---

### 3.5 **Auth uses localStorage, no context provider** (MEDIUM)
**Location:** `hooks/useAuth.ts` (entire file, 24 lines)

```tsx
// Directly reads/writes localStorage
const role = localStorage.getItem('role') as UserRole
```

**Problems:**
1. **Not a provider pattern:**
   - `useSocket` uses context provider (SocketContext)
   - `useAuth` doesn't—why the inconsistency?

2. **Hard to test:**
   - Can't mock localStorage in tests
   - Can't override auth in specific components

3. **No centralized logout:**
   - Logout only clears localStorage
   - Doesn't invalidate socket connection
   - Could leave zombie connections

4. **Can't integrate with other systems:**
   - Can't listen to auth changes
   - Can't add auth middleware

**Suggestion:** Create AuthProvider:
```tsx
// components/AuthProvider.tsx
interface AuthContextValue {
  role: UserRole
  login: (role: UserRole) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>(null)
  // ... state management
  return <AuthContext.Provider value={...}>{children}</AuthContext.Provider>
}
```

---

### 3.6 **ConnectionStatus not integrated with SocketContext** (MEDIUM)  
**Location:** `components/ConnectionStatus.tsx` (entire file, 45 lines)

**Problems:**
1. **Looks up context but not tightly integrated:**
   ```tsx
   const { connected, connecting, error } = useSocketContext()
   ```
   - Component exists separately but tightly coupled by import

2. **Fixed positioning, can't customize:**
   ```tsx
   <div className="fixed top-0 left-0 right-0 z-50">
   ```
   - Always appears at top
   - Can't position differently in different layouts

3. **Hardcoded styling:**
   - Status configuration hardcoded (lines 14-38)
   - Can't theme colors without editing component

**Suggestion:**
- Move status bar into SocketProvider as optional export
- Or accept theme/position props
- Or make it truly optional (not always shown)

---

### 3.7 **MatchConfigPanel nested inside ScoreboardMain** (MEDIUM)
**Locations:**
- Nested internal component: `ScoreboardMain.tsx` lines 420-561
- Wrapping export: `ScoreboardMain.tsx` lines 545-551
- Usage 1: `ScoreboardPage.tsx` line 113 (imports from ScoreboardMain)
- Usage 2: `ScoreboardMain.tsx` lines 89-107 (internal usage)

**Problems:**
1. **Confusing export structure:**
   - `MatchConfigPanel` exported from ScoreboardMain but is unrelated
   - Hidden implementation (MatchConfigPanelInternal)
   - Poor discoverability

2. **Duplicated mounting logic:**
   ```tsx
   // In ScoreboardPage (lines 97-104)
   if (isReferee && currentMatch.status !== 'LIVE') {
     return <MatchConfigPanel ... />
   }
   
   // In ScoreboardMain (lines 89-107)
   if (isReferee && status !== 'LIVE' && status !== 'FINISHED') {
     return <MatchConfigPanelInternal ... />
   }
   ```

3. **Violation of separation of concerns:**
   - Match config is unrelated to scoreboard display
   - Only happens to be used in same flow

**Suggestion:** Move to separate file:
```
// Create: organisms/MatchConfigPanel.tsx
export function MatchConfigPanel({ ... }: MatchConfigPanelProps) {
  const [pointsPerSet, setPointsPerSet] = useState(...)
  // ... implementation
}
```

---

## 4. IDENTIFIED PATTERNS

### 4.1 Button Usage Patterns (Consistent)
**Status:** ✅ GOOD - Well standardized

All pages correctly use Button variants:
- `AuthPage`: Uses `variant="primary"`, `variant="secondary"`, `variant="ghost"` (lines 84-102)
- `DashboardPage`: Uses `variant="secondary"`, `variant="ghost"` (lines 65, 72, 75)
- `ScoreboardPage`: Uses `variant="secondary"`, `variant="ghost"` (lines 76, 80)
- `WaitingRoomPage`: Uses `variant="primary"`, `variant="ghost"` (lines 53, 62)

**Note:** AuthPage mixes className overrides:
```tsx
className='bg-primary text-primary hover:bg-primary'  // line 84
```
This is unnecessary—variant handles this.

---

### 4.2 Typography Usage Pattern (Consistent)
**Status:** ✅ GOOD - Well adopted

Consistent use of Typography atom family across all pages:
- Pages use `<Typography variant="headline">` and `variant="title"`
- Components use shortcuts: `<Title>`, `<Body>`, `<Label>`, `<Caption>`

Example: All pages use same pattern for headers:
```tsx
<Typography variant="headline">RallyOS</Typography>  // AuthPage
<Title>Mesas Disponibles</Title>  // WaitingRoomPage
```

---

### 4.3 State Management Pattern (Consistent but simple)
**Status:** ⚠️ ACCEPTABLE - Works but limited

All managed through:
1. **Remote state:** `useSocketContext()` for tables, currentMatch
2. **Local state:** `useState()` for UI toggles (viewMode, isCreatingTable, etc.)
3. **Browser state:** `useAuth()` reads from localStorage

**Pattern consistency:**
- ✅ All pages follow same pattern
- ⚠️ No validation abstraction
- ⚠️ No global UI state management (Zustand/Redux)
- ⚠️ No error boundaries for state failures

---

### 4.4 Data Fetching Pattern (Consistent)
**Status:** ✅ GOOD - Socket-based

All data flows through socket events in `useSocket`:
1. Pages call `useSocketContext()` to get `tables`, `currentMatch`
2. Pages emit events via `emit()` callback
3. Socket listeners update context state

No HTTP requests, all real-time socket updates. ✅

---

### 4.5 Modal/Drawer Pattern (Inconsistent)
**Status:** ⚠️ NEEDS WORK

Two patterns:

**Pattern A (Preferred):** State in container, component is presentational
```tsx
// ScoreboardPage (lines 13, 81, 107)
const [historyOpen, setHistoryOpen] = useState(false)
<HistoryDrawer isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
```

**Pattern B (Mixed):** Conditional rendering
```tsx
// ScoreboardPage (lines 97-104)
if (isReferee && currentMatch.status !== 'LIVE') {
  return <MatchConfigPanel ... />
}
```

**Inconsistency:** HistoryDrawer uses pattern A (container controls visibility), but MatchConfigPanel uses pattern B (component shows conditionally). Choose one.

---

### 4.6 Layout Pattern (Highly consistent)  
**Status:** ✅ EXCELLENT

All pages follow same structure:
```tsx
<div className="flex flex-col h-screen bg-surface">
  {/* Header with title + actions */}
  <div className="pt-12 p-4 border-b border-border flex justify-between items-center">
    ... title and buttons ...
  </div>
  
  {/* Main content */}
  <div className="flex-1 overflow-auto">
    ... content ...
  </div>
</div>
```

This is good! But see **Suggestion 2.2** to extract as `<PageLayout>` component.

---

## 5. CONSOLIDATION RECOMMENDATIONS

### TIER 1: Quick Wins (1-2 hours each)

#### 1a. Extract PageHeader Component ✅ HIGH IMPACT
**Effort:** 1 hour | **Impact:** LARGE (reduces 60+ lines of overhead)

**Files to create:** `components/atoms/PageHeader.tsx`

```tsx
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={`pt-12 p-4 border-b border-border flex justify-between items-center ${className}`}>
      <div>
        <h1 className="text-2xl font-heading font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
```

**Refactor locations:**
- [DashboardPage](DashboardPage.tsx#L46-L76) - Replace lines 46-76
- [ScoreboardPage](ScoreboardPage.tsx#L63-L75) - Replace lines 63-75  
- [WaitingRoomPage](WaitingRoomPage.tsx#L25-L39) - Replace lines 25-39
- [HistoryViewPage](HistoryViewPage.tsx#L6-L20) - Replace lines 6-20

**Result:** 4 pages cleanup, 1 source of truth for header styling

---

#### 1b. Consolidate PIN Input Validation ✅ HIGH IMPACT  
**Effort:** 30 mins | **Impact:** MEDIUM (consistency + bug fixes)

**Replace in:**
- [AuthPage](AuthPage.tsx#L60-L62) - Use PinInput component
- [WaitingRoomPage](WaitingRoomPage.tsx#L39-L40) - Use PinInput component

Or create hook:
```tsx
// hooks/usePinInput.ts
export function usePinInput(maxLength = 5) {
  const [pin, setPin] = useState('')
  
  const handleChange = (value: string) => {
    setPin(value.replace(/\D/g, '').slice(0, maxLength))
  }
  
  return { pin, setPin, handleChange }
}
```

---

#### 1c. Replace Custom Input Fields in Forms ✅ MEDIUM IMPACT
**Effort:** 45 mins | **Impact:** MEDIUM

**Files to refactor:**
- [DashboardPage](DashboardPage.tsx#L70-L77) - Replace custom input with `<Input>` component  
- [WaitingRoomPage](WaitingRoomPage.tsx#L46-L54) - Replace custom input with `<Input>` component

```tsx
// Before (DashboardPage, line 70-77)
<input
  type="text"
  placeholder="Nombre de la mesa..."
  value={tableName}
  onChange={(e) => setTableName(e.target.value)}
  className="px-3 py-2 rounded border border-border bg-background text-text ..."
/>

// After
<Input
  placeholder="Nombre de la mesa..."
  value={tableName}
  onChange={(e) => setTableName(e.target.value)}
/>
```

---

### TIER 2: Medium Refactors (2-4 hours each)

#### 2a. Extract useMatchDisplay Hook ✅ VERY HIGH IMPACT
**Effort:** 2 hours | **Impact:** LARGE (unlocks reusability) 

**Create:** `hooks/useMatchDisplay.ts`

**Move from [ScoreboardMain.tsx](ScoreboardMain.tsx#L58-L77):**
```tsx
export function useMatchDisplay(match: MatchStateExtended) {
  const { score, status, playerNames, setHistory, config, swappedSides } = match
  
  const setsA = setHistory.filter(s => s.a > s.b).length
  const setsB = setHistory.filter(s => s.b > s.a).length
  const totalSets = config?.bestOf ? Math.ceil(config.bestOf / 2) * 2 - 1 : 3

  const isSwapped = swappedSides === true
  
  const leftPlayer = isSwapped ? 'B' : 'A'
  const rightPlayer = isSwapped ? 'A' : 'B'
  
  // ... all computed values
  
  return {
    leftPlayer, rightPlayer, leftScore, rightScore,
    leftSets, rightSets, leftName, rightName,
    leftServing, rightServing, totalSets,
    leftHandicap, rightHandicap
  }
}
```

**Impact:** 
- ScoreboardMain becomes 100+ lines shorter
- Logic testable in isolation
- Can reuse in other scoreboard types
- Enables different sports rule sets

---

#### 2b. Create HistoryList Molecule ✅ HIGH IMPACT
**Effort:** 1.5 hours | **Impact:** MEDIUM (reduces duplication)

**Create:** `components/molecules/HistoryList.tsx`

**Consolidate from:**
- [HistoryDrawer](organisms/HistoryDrawer.tsx#L40-L84) - Events rendering
- [HistoryViewPage](pages/HistoryViewPage.tsx#L12-L38) - Events rendering

```tsx
interface HistoryListProps {
  events: ScoreChange[]
  variant?: 'compact' | 'detailed'  // drawer vs page
  onUndo?: (eventId: string) => void
  className?: string
}

export function HistoryList({ events, variant = 'detailed', onUndo, className }: HistoryListProps) {
  // Shared logic, variant controls styling
}
```

**Update files:**
- Replace [HistoryDrawer](organisms/HistoryDrawer.tsx#L40-L84) internals
- Replace [HistoryViewPage](pages/HistoryViewPage.tsx#L12-L38) internals

---

#### 2c. Move MatchConfigPanel to Own File ✅ MEDIUM IMPACT
**Effort:** 1 hour | **Impact:** MEDIUM (clarity & discoverability)

**Create:** `components/organisms/MatchConfigPanel.tsx`

**Extract from:** [ScoreboardMain](ScoreboardMain.tsx#L408-L561)

Benefits:
- Clear file structure
- Can't accidentally nest logic in display component
- Better code splitting

---

### TIER 3: Large Refactors (4+ hours)

#### 3a. Extract AuthContext Provider 
**Effort:** 2 hours | **Impact:** MEDIUM (consistency with socket)

**Create:** `contexts/AuthContext.tsx` + `providers/AuthProvider.tsx`

Similar to SocketProvider pattern. Enables:
- Centralized logout (triggers socket disconnect)
- Auth state changes listeners
- Better testing (mock provider)
- Eliminates localStorage coupling

---

#### 3b. Make DashboardHeader Independent ✅ MEDIUM REFACTOR
**Effort:** 2 hours | **Impact:** MEDIUM

**Changes:**
1. Move to separate file: `organisms/DashboardHeader.tsx`
2. Accept optional `stats` prop (calculat OR pass explicit)
3. Remove dependency on DashboardGrid
4. May be [already done](DashboardGrid.tsx#L44-L128)—check if file should be split

---

#### 3c. Break Down ScoreboardMain (If needed)
**Effort:** 4 hours | **Impact:** LARGE (maintainability)

Current file: 561 lines (too large)

**Possible split:**
- `ScoreboardDisplay.tsx` - Display logic only (140 lines)
- `ScoreboardRefereeView.tsx` - Referee controls (150 lines)  
- `ScoreboardViewerView.tsx` - Viewer display (120 lines)
- `ScoreboardHeader.tsx` - Landscape header (80 lines)
- `ScoreboardSidebar.tsx` - Portrait sidebar (80 lines)

**Only do if:** Component becomes hard to maintain or file size becomes issue.

---

## 6. BUTTON USAGE ANALYSIS

### Button Pattern Usage Summary

**Variants used correctly:**
- ✅ `variant="primary"` - Main actions (create, submit, login)
- ✅ `variant="secondary"` - Secondary actions (new table, history)
- ✅ `variant="ghost"` - Dismissal (back, logout)
- ✅ `variant="live"` - Special (not used yet, available for live indicators)

**Issue in AuthPage (Lines 84, 92):**
```tsx
className='bg-primary text-primary hover:bg-primary'
className='bg-secondary text-secondary hover:bg-secondary'
```

These className overrides duplicate variant styling. Remove them.

---

## 7. INPUT/FORM PATTERN ANALYSIS

### Form Input Inconsistencies

| Pattern | Examples | Problem |
|---------|----------|---------|
| Atom Input component | Typography, Badge | ✅ Good adoption |
| Custom `<input>` | DashboardPage (line 70), WaitingRoomPage (line 50) | ⚠️ Bypass styling system |
| PinInput atom | Exists but unused in forms | ⚠️ Component underutilized |
| PIN validation | 2 identical `replace(/\D/g)` blocks | ⚠️ DRY violation |

**Recommendation:** Standardize on Input atom + usePinInput hook

---

## 8. ESTIMATED REFACTORING IMPACT

### By Consolidation Type

| Consolidation | Effort | Impact | Risk |
|---------------|--------|--------|------|
| PageHeader extraction | 1h | Large (60 LOC reduced, 1 source of truth) | Very Low |
| PIN validation | 30m | Medium (bug fixes, consistency) | Very Low |
| Input standardization | 45m | Medium (form consistency) | Low |
| useMatchDisplay hook | 2h | Large (unlocks reusability, 100+ LOC moved) | Low |
| HistoryList molecule | 1.5h | Medium (duplication eliminated) | Low |
| MatchConfigPanel file | 1h | Medium (clarity, structure) | Very Low |
| AuthContext | 2h | Medium (consistency, testability) | Medium |
| DashboardHeader independence | 1.5h | Medium (reusability) | Low |
| ScoreboardMain breakup | 4h | Large (maintainability) | Medium |

**Total recommended (Tiers 1-2):** ~8 hours → **MASSIVE** improvement in code quality

---

## 9. SUMMARY OF KEY FINDINGS

### ✅ STRENGTHS
1. **Consistent component hierarchy** - Clear atoms → molecules → organisms → pages structure
2. **Good typography system** - Well-adopted Typography component family
3. **Solid button patterns** - Variants used correctly
4. **Socket integration** - Real-time state management solid
5. **Layout consistency** - All pages follow same flex/overflow pattern

### ⚠️ WEAKNESSES  
1. **Duplicated headers** - 4 nearly identical header divs (HIGH PRIORITY)
2. **PIN validation** - Implemented 3 different ways (MEDIUM PRIORITY)
3. **ScoreboardMain too large** - Contains display + calc + config logic (561 lines)
4. **Historical duplication** - History shown 2 ways with duplicate formatting
5. **Auth not a provider** - Inconsistent with Socket context pattern
6. **Custom form inputs** - Bypass Input atom component

### 🎯 QUICK WINS (Do first)
1. Extract `PageHeader` component (1 hour, HIGH impact)
2. Consolidate PIN validation (30 mins, small but safe)
3. Replace custom inputs with Input atom (45 mins, consistency)
4. Extract `useMatchDisplay` hook (2 hours, unlocks reuse)
5. Create `HistoryList` molecule (1.5 hours, eliminates duplication)

### 📊 OVERALL ASSESSMENT
**Grade: B+ (Good with clear improvement path)**

The codebase is well-structured with good foundation principles. Main gaps are:
- Extractable utility patterns that are duplicated
- Large components that need breaking down
- Inconsistent patterns in similar features

**Recommendation:** Implement Tier 1 immediately (4-5 hours) → solid A- grade code

---

## 10. FILE REFERENCE GUIDE

### Quick Links to Issues

**Duplication References:**
- PIN validation: [AuthPage#60](AuthPage.tsx#L60), [WaitingRoomPage#39](WaitingRoomPage.tsx#L39)
- Headers: [DashboardPage#46](DashboardPage.tsx#L46), [ScoreboardPage#63](ScoreboardPage.tsx#L63), [WaitingRoomPage#25](WaitingRoomPage.tsx#L25), [HistoryViewPage#6](HistoryViewPage.tsx#L6)
- Config logic: [ScoreboardPage#97](ScoreboardPage.tsx#L97), [ScoreboardMain#89](ScoreboardMain.tsx#L89)
- Custom inputs: [DashboardPage#70](DashboardPage.tsx#L70), [WaitingRoomPage#46](WaitingRoomPage.tsx#L46)

**Silo References:**
- ScoreboardMain complexity: [ScoreboardMain#58-77](ScoreboardMain.tsx#L58-L77) (calculations), [#89-107](#L89-L107) (config), [#280](#L280) (display)
- DashboardHeader coupling: [DashboardGrid#44-128](DashboardGrid.tsx#L44-L128)
- TableStatusChip mapping: [TableStatusChip#17-22](TableStatusChip.tsx#L17-L22)
- History duplication: [HistoryDrawer#40-84](HistoryDrawer.tsx#L40-L84) vs [HistoryViewPage#12-38](HistoryViewPage.tsx#L12-L38)
- MatchConfigPanel nesting: [ScoreboardMain#408-561](ScoreboardMain.tsx#L408-L561)

---

**End of Analysis**  
Generated: April 8, 2026
