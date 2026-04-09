# RallyOS Client - Testing Plan 2026

**Date:** April 8, 2026  
**Scope:** Comprehensive Unit Testing Strategy  
**Target:** 80%+ Coverage across all component types  

---

## EXECUTIVE SUMMARY

This plan provides a structured approach to testing all RallyOS client components:
- **9 Atoms** - Pure UI presentational components
- **7 Molecules** - Composite components with logic
- **3 Organisms** - Complex feature components
- **2 Utilities** - ConnectionStatus (replaced), PrivateRoute
- **5 Pages** - Full page components
- **1 Hook** - useMatchDisplay business logic
- **2 Contexts** - SocketContext, AuthContext (NEW)

**Total Components:** 27  
**Estimated Testing Effort:** 42-50 hours  
**Target Coverage:** 80% statements, 75% branches, 70% functions

---

> **⚠️ RECENT CHANGES:**
> - Fixed: ConnectionStatus moved from Atoms to Utilities only
> - Fixed: Side swap logic corrected (ITTF rules - swap at deuce every 2 points, not between sets)
> - Added: Context Providers tests (SocketContext, AuthContext)
> - New: Folder structure per component with index exports

---

## TESTING STACK RECOMMENDATIONS

### Current Setup
```json
{
  "testing-library": "^14.0.0",
  "vitest": "^0.34.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/user-event": "^14.0.0",
  "msw": "^1.3.0"
}
```

### Tools Strategy
| Tool | Purpose | Status |
|------|---------|--------|
| **Vitest** | Test runner | ✅ Recommended |
| **React Testing Library** | Component testing | ✅ Recommended |
| **Framer Motion Mock** | Animation testing | ✅ Needed |
| **MSW** | API mocking | ✅ Optional |
| **@vitest/ui** | Visual feedback | ✅ Nice-to-have |

### Setup Files Needed
```
client/src/
├── __tests__/
│   ├── setup.ts              # Vitest config
│   ├── mocks/
│   │   ├── socket.ts         # Socket context mock
│   │   └── auth.ts           # Auth context mock
│   └── utils/
│       └── test-utils.tsx    # Render with providers
```

---

## NEW COMPONENT FOLDER STRUCTURE (Per Component)

Each component now lives in its own folder with all related files:

```
client/src/
├── components/
│   ├── atoms/
│   │   ├── index.ts                    # Barrel export for all atoms
│   │   ├── Button/
│   │   │   ├── Button.tsx              # Component definition
│   │   │   ├── Button.types.ts          # TypeScript interfaces
│   │   │   ├── Button.test.tsx         # Unit tests
│   │   │   └── index.ts                # Component export
│   │   ├── PinInput/
│   │   │   ├── PinInput.tsx
│   │   │   ├── PinInput.types.ts
│   │   │   ├── PinInput.test.tsx
│   │   │   └── index.ts
│   │   └── ...
│   ├── molecules/
│   │   ├── index.ts                    # Barrel export for all molecules
│   │   ├── PageHeader/
│   │   │   ├── PageHeader.tsx
│   │   │   ├── PageHeader.types.ts
│   │   │   ├── PageHeader.test.tsx
│   │   │   └── index.ts
│   │   └── ...
│   └── organisms/
│       ├── index.ts                    # Barrel export for all organisms
│       ├── ScoreboardMain/
│       │   ├── ScoreboardMain.tsx
│       │   ├── ScoreboardMain.types.ts
│       │   ├── ScoreboardMain.test.tsx
│       │   └── index.ts
│       └── ...
├── pages/
│   ├── index.ts                       # Barrel export for all pages
│   ├── AuthPage/
│   │   ├── AuthPage.tsx
│   │   ├── AuthPage.types.ts
│   │   ├── AuthPage.test.tsx
│   │   └── index.ts
│   └── ...
├── hooks/
│   ├── index.ts                       # Barrel export for all hooks
│   ├── useMatchDisplay/
│   │   ├── useMatchDisplay.ts
│   │   ├── useMatchDisplay.types.ts
│   │   ├── useMatchDisplay.test.ts
│   │   └── index.ts
│   └── ...
└── contexts/
    ├── index.ts                       # Barrel export for all contexts
    ├── SocketContext/
    │   ├── SocketContext.tsx
    │   ├── SocketContext.types.ts
    │   ├── SocketContext.test.tsx
    │   └── index.ts
    └── ...
```

### Barrel Export Files (index.ts at parent level)

```typescript
// components/atoms/index.ts
export { Button } from './Button'
export { PinInput } from './PinInput'
export { TextInput } from './TextInput'
export { NumberInput } from './NumberInput'
export { Badge } from './Badge'
export { Icon } from './Icon'
export { Typography } from './Typography'
export { Input } from './Input'

// components/molecules/index.ts
export { PageHeader } from './PageHeader'
export { FormField } from './FormField'
export { ScoreDisplay } from './ScoreDisplay'
export { StatCard } from './StatCard'
export { TableStatusChip } from './TableStatusChip'
export { HistoryList } from './HistoryList'

// components/organisms/index.ts
export { ScoreboardMain } from './ScoreboardMain'
export { DashboardGrid } from './DashboardGrid'
export { HistoryDrawer } from './HistoryDrawer'

// pages/index.ts
export { AuthPage } from './AuthPage'
export { DashboardPage } from './DashboardPage'
export { ScoreboardPage } from './ScoreboardPage'
export { WaitingRoomPage } from './WaitingRoomPage'
export { HistoryViewPage } from './HistoryViewPage'

// hooks/index.ts
export { useMatchDisplay } from './useMatchDisplay'

// contexts/index.ts
export { SocketContextProvider } from './SocketContext'
export { AuthContextProvider } from './AuthContext'
```

### Per-Component index.ts Template

```typescript
// components/atoms/Button/index.ts
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types'
```

---

## TIER 0: CONTEXT PROVIDERS (NEW)

### Priority: CRITICAL
Context providers are the foundation for all organisms and pages. Must be tested thoroughly.

### 1. SocketContext.tsx
```tsx
// Test: Provides connected state to children
// Test: Provides tables array
// Test: Provides currentMatch
// Test: emit() sends events correctly
// Test: createTable() creates new table
// Test: joinTable() joins existing table
// Test: disconnect() works correctly
// Test: Updates state on socket events

Coverage Target: 90%
Estimated Time: 2 hours
Complexity: Medium (requires socket mock)
```

**Test Cases:**
```typescript
describe('SocketContext', () => {
  it('provides connected=false initially')
  it('provides empty tables array initially')
  it('updates connected on socket connect event')
  it('updates tables on socket tables event')
  it('updates currentMatch on socket match event')
  it('emits correct event on createTable')
  it('emits correct event on joinTable')
  it('cleans up on unmount')
})
```

### 2. AuthContext.tsx
```tsx
// Test: Provides user object
// Test: Provides isReferee flag
// Test: Provides isViewer flag
// Test: login() sets user correctly
// Test: logout() clears user
// Test: Redirects correctly (with router mock)

Coverage Target: 90%
Estimated Time: 1.5 hours
Complexity: Low
```

**Test Cases:**
```typescript
describe('AuthContext', () => {
  it('provides user=null initially')
  it('provides isReferee=false initially')
  it('provides isViewer=false initially')
  it('login sets user and role correctly')
  it('login as referee sets isReferee=true')
  it('login as spectator sets isViewer=true')
  it('logout clears user and roles')
  it('persists auth state (localStorage mock)')
})
```

**CONTEXTS TOTAL: 3-3.5 hours**

---

## TIER 1: ATOMS (8 Components)

### Priority: HIGH
Atoms are foundation - they must be reliable.

### 1. Button.tsx
```tsx
// Test: Renders with correct variant
// Test: Handles onClick correctly
// Test: Disabled state works
// Test: Loading state shows spinner
// Test: Size variants apply correct styles
// Test: Icon prop renders
// Test: Animation props work with Framer Motion

Coverage Target: 95%
Estimated Time: 1.5 hours
Complexity: Medium (due to Framer Motion)
```

**Test Cases:**
```typescript
describe('Button', () => {
  it('renders with primary variant by default')
  it('applies correct styles for variant="secondary"')
  it('applies correct styles for variant="danger"')
  it('applies correct styles for variant="outline"')
  it('disables click when disabled prop true')
  it('shows loading spinner when loading=true')
  it('scales on hover when animate=true')
  it('shows focus ring on focus')
  it('accepts custom className')
  it('renders icon with children')
  it('supports all size variants')
})
```

### 2. PinInput.tsx
```tsx
// Test: Accepts only numeric input
// Test: Limits to specified length
// Test: Calls onChange prop
// Test: Calls onComplete when full
// Test: Shows error state
// Test: Auto-focus works
// Test: Placeholder displays correctly

Coverage Target: 95%
Estimated Time: 1 hour
Complexity: Low
```

**Test Cases:**
```typescript
describe('PinInput', () => {
  it('filters non-numeric input')
  it('limits input to specified length')
  it('calls onChange callback with current value')
  it('calls onComplete when PIN reaches length')
  it('displays error styling when error prop set')
  it('shows placeholder text')
  it('auto-focuses when autoFocus=true')
  it('clears value on reset')
  it('prevents pasting invalid characters')
})
```

### 3. TextInput.tsx
```tsx
// Test: Renders as text input
// Test: Error state styling
// Test: Size variants
// Test: Placeholder and label
// Test: Disabled state
// Test: onChange callback

Coverage Target: 90%
Estimated Time: 45 minutes
Complexity: Low
```

### 4. NumberInput.tsx
```tsx
// Test: Only accepts numbers
// Test: Increment button increases value
// Test: Decrement button decreases value
// Test: Direct input changes value
// Test: Disabled state

Coverage Target: 90%
Estimated Time: 1 hour
Complexity: Low
```

### 5. Badge.tsx
```tsx
// Test: Renders text
// Test: Color variants
// Test: Size variants
// Test: Icon support

Coverage Target: 85%
Estimated Time: 30 minutes
Complexity: Very Low
```

### 6. Icon.tsx
```tsx
// Test: Renders SVG icons
// Test: Size prop works
// Test: Color prop works
// Test: Title attribute for accessibility

Coverage Target: 80%
Estimated Time: 30 minutes
Complexity: Very Low
```

### 7. Typography.tsx
```tsx
// Test: Renders various variants (title, body, label, etc.)
// Test: Custom className merges with variant styles
// Test: Children render correctly
// Test: Color prop works

Coverage Target: 85%
Estimated Time: 30 minutes
Complexity: Very Low
```

### 8. Input.tsx
```tsx
// Test: Basic input functionality
// Test: Error state
// Test: Placeholder
// Test: All HTML input attributes work

Coverage Target: 85%
Estimated Time: 30 minutes
Complexity: Low
```

**ATOMS TOTAL: 5-6 hours**

---

## TIER 2: MOLECULES (7 Components)

### Priority: HIGH
Molecules combine logic + presentation. Critical for integration.

### 1. PageHeader.tsx
```tsx
// Test: Renders title
// Test: Renders subtitle when provided
// Test: Shows ConnectionStatus when showStatus=true
// Test: Renders action slots correctly
// Test: Hidden on landscape when landscape=true

Coverage Target: 90%
Estimated Time: 1 hour
Complexity: Low
```

**Test Cases:**
```typescript
describe('PageHeader', () => {
  it('renders title')
  it('renders subtitle when provided')
  it('includes ConnectionStatus by default')
  it('hides ConnectionStatus when showStatus=false')
  it('renders actions slot')
  it('applies landscape:hidden class when landscape=true')
  it('handles multiple action buttons')
})
```

### 2. PinInput.tsx (Atom - covered above)

### 3. FormField.tsx
```tsx
// Test: Renders label
// Test: Shows required asterisk
// Test: Displays error message
// Test: Shows helper text
// Test: Children render in container

Coverage Target: 90%
Estimated Time: 45 minutes
Complexity: Low
```

### 4. ScoreDisplay.tsx
```tsx
// Test: Renders score pairs correctly
// Test: Highlights serving player
// Test: Shows handicap when provided
// Test: Displays set indicators
// Test: Score color changes based on state

Coverage Target: 85%
Estimated Time: 1.5 hours
Complexity: Medium (visual component)
```

### 5. StatCard.tsx
```tsx
// Test: Renders title and value
// Test: Icon displays
// Test: Background color variants
// Test: Loading state
// Test: Badge/badge count

Coverage Target: 85%
Estimated Time: 1 hour
Complexity: Low
```

### 6. TableStatusChip.tsx
```tsx
// Test: Renders status text
// Test: Color matches status type
// Test: Icon matches status
// Test: Displays count when provided

Coverage Target: 85%
Estimated Time: 45 minutes
Complexity: Low
```

### 7. HistoryList.tsx
```tsx
// Test: Renders empty state
// Test: Renders history items in compact mode
// Test: Renders history items in full mode
// Test: Edit/delete buttons appear
// Test: Correct action labels (Point, Undo)
// Test: Timestamps format correctly

Coverage Target: 90%
Estimated Time: 1.5 hours
Complexity: Low
```

**MOLECULES TOTAL: 6-7 hours**

---

## TIER 3: ORGANISMS (3 Components)

### Priority: CRITICAL
Organisms are feature-heavy. Most complex components.

### 1. ScoreboardMain.tsx
```tsx
// Test: Displays correct scores for both players
// Test: Shows correct set counts
// Test: Highlights serving player
// Test: Handles point scoring
// Test: Undo button works
// Test: Set completion detection
// Test: Match completion detection
// Test: Side swap at ITTF deuce rules (every 2 points after 10-10)
// Test: Landscape layout
// Test: Config panel shows when not LIVE
// Test: History panel works
// Test: Handicap display

Coverage Target: 80%
Estimated Time: 4-5 hours
Complexity: Very High
```

**Test Cases:**
```typescript
describe('ScoreboardMain', () => {
  // Score Display Tests
  it('displays Player A and B names correctly')
  it('shows current set scores')
  it('shows sets won for each player')
  
  // Interaction Tests
  it('calls onScorePoint when score button clicked')
  it('calls onSubtractPoint when subtract clicked')
  it('calls onUndo when undo button clicked')
  
  // Logic Tests
  it('detects set winner at correct point threshold')
  it('detects match winner at correct sets')
  it('swaps serves every 2 points after 10-10 (ITTF deuce rule)')
  it('does NOT swap sides between sets (only at deuce)')
  
  // UI Tests
  it('shows config panel when status !== LIVE and isReferee')
  it('shows live match view when status === LIVE')
  it('hides header on landscape orientation')
  
  // State Tests
  it('disables buttons when not connected')
  it('shows referee-only controls when isReferee')
})
```

**Key Mocks Needed:**
```typescript
const mockMatch = {
  score: { currentSet: { a: 0, b: 0 }, serving: 'A' },
  status: 'LIVE',
  playerNames: { a: 'Alice', b: 'Bob' },
  setHistory: [],
  config: { bestOf: 3, pointsPerSet: 11 },
  swappedSides: false
}
```

### 2. DashboardGrid.tsx
```tsx
// Test: Renders table list
// Test: Filter/sort functionality
// Test: Table click navigation
// Test: Status indicators
// Test: Empty state

Coverage Target: 80%
Estimated Time: 3 hours
Complexity: High
```

### 3. HistoryDrawer.tsx
```tsx
// Test: Opens/closes correctly
// Test: Displays history items
// Test: Scrollable content
// Test: Close button works
// Test: Clear history function

Coverage Target: 75%
Estimated Time: 2 hours
Complexity: Medium
```

**ORGANISMS TOTAL: 9-10 hours**

---

## TIER 4: UTILITY COMPONENTS (1)

### Priority: MEDIUM

### 1. PrivateRoute.tsx
```tsx
// Test: Allows access when authenticated
// Test: Redirects to /auth when not authenticated
// Test: Passes location for redirect back

Coverage Target: 90%
Estimated Time: 1 hour
Complexity: Low
```

> **Note:** ConnectionStatus was moved to Utility tier and is now properly tested as part of Context tests in TIER 0.

**UTILITY TOTAL: 1 hour**

---

## TIER 5: HOOKS (1)

### Priority: CRITICAL
Business logic - must be thoroughly tested.

### useMatchDisplay.ts
```tsx
// Test: Calculates setsA correctly
// Test: Calculates setsB correctly
// Test: Detects set winner
// Test: Detects match winner
// Test: Applies ITTF side swap at deuce (every 2 points after 10-10)
// Test: Handles handicaps
// Test: Detects serving player
// Test: Returns consistent values

Coverage Target: 95%
Estimated Time: 2-3 hours
Complexity: High
```

**Test Cases:**
```typescript
describe('useMatchDisplay', () => {
  // Score Calculation
  it('calculates sets won correctly')
  it('determines set winner at point threshold')
  it('determines match winner at sets threshold')
  
  // ITTF Side Swap Logic - CORRECTED
  it('swaps player positions every 2 points after 10-10 (deuce)')
  it('swaps serving detection with swappedSides at deuce')
  it('does NOT swap between sets (only at deuce)')
  it('calculates total sets from bestOf config')
  
  // Edge Cases
  it('handles undefined playerNames gracefully')
  it('handles zero handicaps')
  it('handles match in progress')
  it('handles finished match')
  
  // Memoization
  it('memoizes results (same input = same reference)')
})
```

**HOOKS TOTAL: 2-3 hours**

---

## TIER 6: PAGES (5 Components)

### Priority: MEDIUM-HIGH
Page-level integration tests are important for E2E scenarios.

### 1. AuthPage.tsx
```tsx
// Test: Shows role selection initially
// Test: Shows PIN entry for referee
// Test: Validates PIN (must be 5 digits)
// Test: Login as spectator skips PIN
// Test: Invalid PIN shows error
// Test: Navigation after successful login

Coverage Target: 85%
Estimated Time: 2 hours
Complexity: Medium
```

### 2. DashboardPage.tsx
```tsx
// Test: Displays table list
// Test: Create new table flow
// Test: Table selection navigation
// Test: Logout works
// Test: Handles no tables state

Coverage Target: 80%
Estimated Time: 2 hours
Complexity: Medium
```

### 3. ScoreboardPage.tsx
```tsx
// Test: Loads match data
// Test: Authenticates as referee when needed
// Test: Shows scoreboard for LIVE match
// Test: Shows config panel for non-LIVE match
// Test: Back navigation works
// Test: History drawer opens/closes

Coverage Target: 75%
Estimated Time: 2.5 hours
Complexity: High (socket async)
```

### 4. WaitingRoomPage.tsx
```tsx
// Test: Lists available tables
// Test: PIN entry shows when table selected
// Test: Validates PIN before join
// Test: Joins table with valid PIN
// Test: Error handling for join failure

Coverage Target: 80%
Estimated Time: 1.5 hours
Complexity: Medium
```

### 5. HistoryViewPage.tsx
```tsx
// Test: Displays match history
// Test: Shows empty state when no history
// Test: Back navigation works

Coverage Target: 75%
Estimated Time: 1 hour
Complexity: Low
```

**PAGES TOTAL: 9 hours**

---

## TESTING STRATEGY BY COMPONENT TYPE

### ATOMS Strategy
```
Approach: Snapshot Testing + Behavior Testing
├── Unit test each variant
├── Test all props combinations
├── Test accessibility attributes
├── Skip heavy animation testing (mock Framer Motion)
└── Test disabled/loading states
```

### MOLECULES Strategy
```
Approach: Component Testing + Integration Testing
├── Test rendering with different props
├── Test child component interactions
├── Test error/loading states
├── Mock child components when complex
└── Test passed callback functions
```

### ORGANISMS Strategy
```
Approach: Integration Testing + Mock Services
├── Mock context providers (Socket, Auth)
├── Test component state changes
├── Test async data loading
├── Test user interactions (clicks, typed)
├── Mock child molecules/organisms
└── Test responsive layouts
```

### PAGES Strategy
```
Approach: E2E-like Testing + Full Context
├── Provide real context providers
├── Mock Socket/API calls
├── Test complete user flows
├── Test navigation
├── Test authentication checks
└── Test error handling
```

### HOOKS Strategy
```
Approach: Pure Unit Testing
├── Test with various inputs
├── Test edge cases thoroughly
├── Test memoization/performance
├── No component rendering needed
└── 95%+ coverage required
```

---

## TEST UTILITIES & HELPERS

### Setup File (setup.ts)
```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => cleanup())

// Mock Framer Motion - COMPREHENSIVE
vi.mock('framer-motion', () => {
  const React = require('react')
  return {
    motion: {
      div: ({ children, ...props }: any) => React.createElement('div', props, children),
      button: ({ children, ...props }: any) => React.createElement('button', props, children),
      span: ({ children, ...props }: any) => React.createElement('span', props, children),
      input: ({ children, ...props }: any) => React.createElement('input', props),
      svg: ({ children, ...props }: any) => React.createElement('svg', props, children),
      path: (props: any) => React.createElement('path', props),
      circle: (props: any) => React.createElement('circle', props),
      g: ({ children, ...props }: any) => React.createElement('g', props, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
    }),
    useMotionValue: (initial: number) => ({
      get: () => initial,
      set: vi.fn(),
      subscribe: () => () => {},
    }),
    useTransform: (value: any, input: any[], output: any[]) => ({
      get: () => output[0],
    }),
    useSpring: () => ({
      get: () => 0,
    }),
    // Animation variants as simple objects
    variant: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
  }
})

// Mock Socket Context
// Mock Auth Context
// Setup MSW if needed
```

### Custom Render Helper (test-utils.tsx)
```typescript
import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { SocketContextProvider } from '@/contexts/SocketContext'
import { AuthContextProvider } from '@/contexts/AuthContext'

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthContextProvider>
      <SocketContextProvider>
        {children}
      </SocketContextProvider>
    </AuthContextProvider>
  )
}

export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { renderWithProviders as render }
```

### Context Mocks
```typescript
// mocks/socket.ts
export const mockSocketContext = {
  currentMatch: null,
  tables: [],
  connected: true,
  emit: vi.fn(),
  createTable: vi.fn(),
}

// mocks/auth.ts
export const mockAuthContext = {
  user: null,
  isReferee: false,
  isViewer: true,
  login: vi.fn(),
  logout: vi.fn(),
}
```

---

## IMPLEMENTATION ROADMAP

### Phase 0: Contexts & Setup (Week 1 - NEW)
- [ ] Setup Vitest configuration
- [ ] Create test utilities and mocks
- [ ] Refactor folder structure to component-per-folder
- [ ] Create barrel exports (index.ts) for each category
- [ ] Write SocketContext tests
- [ ] Write AuthContext tests

**Target Coverage:** 90%  
**Estimated Time:** 4 hours  
**Output:** 2 .test.tsx files + 6 index.ts files + setup refactor

### Phase 1: Atoms (Week 1)
- [ ] Write Button.tsx tests
- [ ] Write PinInput.tsx tests
- [ ] Write TextInput.tsx tests
- [ ] Write NumberInput.tsx tests
- [ ] Write Badge.tsx tests
- [ ] Write Icon.tsx tests
- [ ] Write Typography.tsx tests
- [ ] Write Input.tsx tests

**Target Coverage:** 90%+  
**Estimated Time:** 5-6 hours  
**Output:** 8 .test.tsx files

### Phase 2: Molecules (Week 1-2)
- [ ] Write PageHeader.tsx tests
- [ ] Write FormField.tsx tests
- [ ] Write ScoreDisplay.tsx tests
- [ ] Write StatCard.tsx tests
- [ ] Write TableStatusChip.tsx tests
- [ ] Write HistoryList.tsx tests

**Target Coverage:** 85%+  
**Estimated Time:** 6-7 hours  
**Output:** 6 .test.tsx files

### Phase 3: Utilities (Week 2)
- [ ] Write PrivateRoute.tsx tests

**Target Coverage:** 90%  
**Estimated Time:** 1 hour  
**Output:** 1 .test.tsx file

### Phase 4: Hooks (Week 2)
- [ ] Write useMatchDisplay.ts tests
- [ ] Achieve 95% coverage

**Target Coverage:** 95%+  
**Estimated Time:** 2-3 hours  
**Output:** 1 .test.ts file

### Phase 5: Organisms (Week 2-3)
- [ ] Mock child components
- [ ] Write ScoreboardMain.tsx tests
- [ ] Write DashboardGrid.tsx tests
- [ ] Write HistoryDrawer.tsx tests

**Target Coverage:** 80%+  
**Estimated Time:** 9-10 hours  
**Output:** 3 .test.tsx files

### Phase 6: Pages (Week 3-4)
- [ ] Write AuthPage.tsx tests
- [ ] Write DashboardPage.tsx tests
- [ ] Write ScoreboardPage.tsx tests
- [ ] Write WaitingRoomPage.tsx tests
- [ ] Write HistoryViewPage.tsx tests

**Target Coverage:** 75-80%+  
**Estimated Time:** 9 hours  
**Output:** 5 .test.tsx files

### Phase 7: Coverage & CI/CD (Week 4)
- [ ] Review coverage reports
- [ ] Add missing edge case tests
- [ ] Setup coverage gates in CI
- [ ] Document testing best practices

**Target Coverage:** 80% overall  
**Estimated Time:** 3-4 hours

---

## COVERAGE GOALS

| Component Type | Target | Comments |
|---|---|---|
| **Contexts** | 90%+ | Foundation for all components |
| **Atoms** | 90%+ | Simple, must be reliable |
| **Molecules** | 85%+ | Some complexity allowed |
| **Organisms** | 80%+ | Complex logic, difficult to test |
| **Pages** | 75%+ | E2E-like, external dependencies |
| **Hooks** | 95%+ | Pure logic, must have high coverage |
| **Utilities** | 90%+ | Simple but critical |
| **Overall** | 80%+ | Achievable goal |

---

## TEST FILE STRUCTURE (New Component-First Organization)

```
client/
├── src/
│   ├── components/
│   │   ├── atoms/
│   │   │   ├── index.ts                    # Barrel export
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.types.ts         # NEW
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── PinInput/
│   │   │   │   ├── PinInput.tsx
│   │   │   │   ├── PinInput.types.ts
│   │   │   │   ├── PinInput.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── TextInput/
│   │   │   │   ├── TextInput.tsx
│   │   │   │   ├── TextInput.types.ts
│   │   │   │   ├── TextInput.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── NumberInput/
│   │   │   │   ├── NumberInput.tsx
│   │   │   │   ├── NumberInput.types.ts
│   │   │   │   ├── NumberInput.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Badge/
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Badge.types.ts
│   │   │   │   ├── Badge.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Icon/
│   │   │   │   ├── Icon.tsx
│   │   │   │   ├── Icon.types.ts
│   │   │   │   ├── Icon.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Typography/
│   │   │   │   ├── Typography.tsx
│   │   │   │   ├── Typography.types.ts
│   │   │   │   ├── Typography.test.tsx
│   │   │   │   └── index.ts
│   │   │   └── Input/
│   │   │       ├── Input.tsx
│   │   │       ├── Input.types.ts
│   │   │       ├── Input.test.tsx
│   │   │       └── index.ts
│   │   │
│   │   ├── molecules/
│   │   │   ├── index.ts
│   │   │   ├── PageHeader/
│   │   │   ├── FormField/
│   │   │   ├── ScoreDisplay/
│   │   │   ├── StatCard/
│   │   │   ├── TableStatusChip/
│   │   │   └── HistoryList/
│   │   │
│   │   └── organisms/
│   │       ├── index.ts
│   │       ├── ScoreboardMain/
│   │       ├── DashboardGrid/
│   │       └── HistoryDrawer/
│   │
│   ├── pages/
│   │   ├── index.ts
│   │   ├── AuthPage/
│   │   ├── DashboardPage/
│   │   ├── ScoreboardPage/
│   │   ├── WaitingRoomPage/
│   │   └── HistoryViewPage/
│   │
│   ├── hooks/
│   │   ├── index.ts
│   │   └── useMatchDisplay/
│   │
│   ├── contexts/
│   │   ├── index.ts
│   │   ├── SocketContext/
│   │   └── AuthContext/
│   │
│   └── utils/
│       └── index.ts
│
├── __tests__/
│   ├── setup.ts
│   ├── mocks/
│   │   ├── socket.ts
│   │   └── auth.ts
│   └── utils/
│       └── test-utils.tsx
│
└── vitest.config.ts
```

### File Count (New Structure)
| Category | Folders | Files per Folder | Total Files |
|----------|---------|------------------|-------------|
| Atoms | 8 | 4 (tsx, types, test, index) | 32 |
| Molecules | 6 | 4 | 24 |
| Organisms | 3 | 4 | 12 |
| Pages | 5 | 4 | 20 |
| Hooks | 1 | 4 | 4 |
| Contexts | 2 | 4 | 8 |
| **TOTAL** | **25** | - | **100 files** |

---

## CONTINUOUS IMPROVEMENT

### Pre-Commit Hook
```bash
# Run tests before commit
npm run test -- --coverage
```

### GitHub Actions
```yaml
name: Test & Coverage
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Coverage Gates
```typescript
// vitest.config.ts
coverage: {
  lines: 80,
  statements: 80,
  functions: 75,
  branches: 75,
  exclude: ['node_modules/', 'dist/'],
  reporter: ['text', 'json', 'html'],
}
```

---

## TIME ESTIMATE SUMMARY

| Phase | Component Type | Hours | Files |
|-------|---|---|---|
| 0 | Contexts & Setup | 4 | 2 tests + 6 indexes + setup |
| 1 | Atoms | 5-6 | 8 |
| 2 | Molecules | 6-7 | 6 |
| 3 | Utilities | 1 | 1 |
| 4 | Hooks | 2-3 | 1 |
| 5 | Organisms | 9-10 | 3 |
| 6 | Pages | 9 | 5 |
| 7 | Coverage + CI/CD | 3-4 | 4 |
| **TOTAL** | - | **39-44 hours** | **~100 files** |

**Effort:** ~1 week full-time or 2-3 weeks part-time

---

## SUCCESS METRICS

✅ After implementation, you should:

1. **Run `npm run test`** → All tests pass ✓
2. **Run `npm run coverage`** → 80%+ coverage ✓
3. **Add new component** → Write tests first (TDD) ✓
4. **Refactor component** → Tests validate behavior ✓
5. **Deploy with confidence** → Tests catch regressions ✓

---

## DEPENDENCIES CHECKLIST

```
✅ @testing-library/react
✅ @testing-library/user-event
✅ vitest
✅ jsdom (or happy-dom)
✅ @vitest/ui
⬜ @testing-library/jest-dom (optional)
⬜ react-test-utils (optional)
```

---

## NEXT STEPS

1. **Approve this plan**
2. **Update vitest.config.ts** with test configuration
3. **Create setup.ts** and test utilities
4. **Start with Phase 1 (Atoms)** - lowest risk
5. **Track coverage** with reports
6. **Integrate into CI/CD** pipeline

---

## NOTES

- Focus on **behavior** not **implementation** details
- Mock external dependencies (sockets, API calls)
- Test **user interactions**, not internal state
- Use **accessibility queries** (getByRole, getByLabelText)
- Keep tests **readable** and **maintainable**
- Aim for **high coverage** but not 100% (diminishing returns)

---

## COMPONENT FILE NAMING CONVENTIONS

### Per-Component Folder Structure

```
ComponentName/
├── ComponentName.tsx           # Main component (PascalCase)
├── ComponentName.types.ts      # TypeScript interfaces/exports
├── ComponentName.test.tsx     # Unit tests (or .test.ts for hooks)
└── index.ts                   # Barrel export
```

### Type File Template (ComponentName.types.ts)

```typescript
// Button.types.ts example
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  animate?: boolean
}
```

### Index File Template (index.ts)

```typescript
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types'
```

### Test File Naming

- Components: `ComponentName.test.tsx`
- Hooks: `useHookName.test.ts`
- Contexts: `ContextName.test.tsx`

### Test Description Pattern

```typescript
describe('ComponentName', () => {
  describe('rendering', () => {
    it('renders correctly with required props')
    it('renders null when hidden prop is true')
  })

  describe('interactions', () => {
    it('calls onClick when clicked')
    it('does not call onClick when disabled')
  })

  describe('variants', () => {
    it('applies primary styles by default')
    it('applies secondary styles when variant="secondary"')
  })

  describe('accessibility', () => {
    it('has correct role attribute')
    it('has accessible label')
  })
})
```

---

## MIGRATION CHECKLIST (Existing Components)

If migrating existing components to new structure:

- [ ] Create folder for component
- [ ] Move component.tsx to new location
- [ ] Create types.ts file (extract interfaces)
- [ ] Create index.ts barrel export
- [ ] Create test file
- [ ] Update imports across the codebase
- [ ] Update parent barrel exports
- [ ] Run tests to verify nothing broke

**Note:** This is a refactoring effort - existing tests may need updates to match new structure.

