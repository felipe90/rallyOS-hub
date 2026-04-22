# Testing Rules

**Framework:** Vitest + React Testing Library  
**Setup:** `client/src/test/setup.ts`  
**Utils:** `client/src/test/test-utils.tsx`  
**Mocks:** `client/src/test/mocks/`

---

## Philosophy

Tests prove that your code works. They are not optional. They are not a chore. They are the safety net that lets you refactor without fear.

> **If it's not tested, it's broken.**

---

## The Testing Pyramid

```
         /\
        /  \     E2E (Playwright)
       /----\    Slow. Expensive. Test critical paths only.
      /      \
     /--------\  Integration (React Testing Library)
    /          \  Medium speed. Test component interaction.
   /------------\
  /              \ Unit (Vitest assert/expect)
 /----------------\ Fast. Cheap. Test everything.
```

**Our ratio:** 70% unit, 25% integration, 5% E2E.

---

## Core Principles

### DRY in Tests

Tests should be **DAMP** (Descriptive And Meaningful Phrases), not DRY. It's OK to repeat setup in tests if it makes them easier to read.

**Good:**
```typescript
it('shows error for invalid PIN', () => {
  render(<PinInput onComplete={vi.fn()} />)
  const input = screen.getByRole('textbox')
  await userEvent.type(input, '123')
  expect(screen.getByText('PIN must be 4 digits')).toBeInTheDocument()
})

it('shows error for empty PIN', () => {
  render(<PinInput onComplete={vi.fn()} />)
  const input = screen.getByRole('textbox')
  await userEvent.clear(input)
  await userEvent.tab()
  expect(screen.getByText('PIN is required')).toBeInTheDocument()
})
```

**Bad:**
```typescript
// ❌ Abstracted to the point of obscurity
const testPinValidation = (pin: string, expectedError: string) => {
  render(<PinInput onComplete={vi.fn()} />)
  typePin(pin)
  expectError(expectedError)
}

it('shows error for invalid PIN', () => testPinValidation('123', 'PIN must be 4 digits'))
it('shows error for empty PIN', () => testPinValidation('', 'PIN is required'))
```

**Exception:** Use factory functions for complex mock data.

```typescript
// ✅ Factory for complex mock data — this IS DRY, and it's OK
const createMockMatch = (overrides: Partial<MatchStateExtended> = {}): MatchStateExtended => ({
  tableId: 'table-1',
  playerNames: { a: 'Player A', b: 'Player B' },
  score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
  status: 'LIVE',
  // ... defaults
  ...overrides,
})
```

---

### KISS in Tests

One test = one assertion concept. Don't test 5 things in one `it()`.

**Good:**
```typescript
it('renders button text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})

it('calls onClick when clicked', () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click</Button>)
  fireEvent.click(screen.getByText('Click'))
  expect(handleClick).toHaveBeenCalledOnce()
})
```

**Bad:**
```typescript
// ❌ Testing too many things at once
it('button works', () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click</Button>)
  expect(screen.getByText('Click')).toBeInTheDocument() // assertion 1
  expect(screen.getByRole('button')).toHaveClass('bg-primary') // assertion 2
  fireEvent.click(screen.getByText('Click'))
  expect(handleClick).toHaveBeenCalledOnce() // assertion 3
  expect(handleClick).toHaveBeenCalledWith(expect.any(Object)) // assertion 4
})
```

---

## What to Test Where

### Unit Tests — Services (Pure Functions)

**Location:** Next to the service file (`*.test.ts`)  
**Tool:** Vitest (no jsdom, no React)  
**Speed:** Milliseconds  
**Coverage target:** 100% of service functions

**What to test:**
- All code paths (if/else branches)
- Edge cases (null, undefined, empty arrays)
- Boundary conditions (min/max values)
- Error cases

**Example — Model:**
```typescript
// services/permissions/rules/scoreboard.test.ts
import { describe, it, expect } from 'vitest'
import { canEditScoreboard } from './scoreboard'

describe('canEditScoreboard', () => {
  it('returns true for referee in referee mode', () => {
    expect(canEditScoreboard('referee', 'referee')).toBe(true)
  })

  it('returns false for viewer in referee mode', () => {
    expect(canEditScoreboard('viewer', 'referee')).toBe(false)
  })

  it('returns false for null role', () => {
    expect(canEditScoreboard(null, 'referee')).toBe(false)
  })
})
```

**Good practices:**
- Name tests descriptively: `it('returns false for viewer in referee mode')`
- One assertion per test (usually)
- Use factory functions for complex inputs
- Test edge cases explicitly

**Bad practices:**
- `it('works', () => { ... })` — what does "works" mean?
- Testing implementation details instead of behavior
- No edge cases

---

### Unit Tests — Hooks

**Location:** Next to the hook file (`*.test.ts`)  
**Tool:** Vitest + `@testing-library/react` (`renderHook`)  
**Speed:** Hundreds of milliseconds  
**Coverage target:** 80%+

**What to test:**
- Returned values are correct
- Hook reacts to prop changes
- Side effects happen (listeners attached/detached)
- Memoization works (same reference for same input)

**Example — Model:**
```typescript
// hooks/useMatchDisplay/useMatchDisplay.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMatchDisplay } from './useMatchDisplay'

const createMockMatch = (overrides = {}) => ({ ...defaults, ...overrides })

describe('useMatchDisplay', () => {
  it('calculates setsA correctly', () => {
    const match = createMockMatch({
      setHistory: [{ a: 11, b: 5 }, { a: 8, b: 11 }],
    })

    const { result } = renderHook(() => useMatchDisplay(match))
    expect(result.current.setsA).toBe(1)
  })

  it('returns same reference for same input (memoization)', () => {
    const match = createMockMatch()
    const { result, rerender } = renderHook(() => useMatchDisplay(match))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
```

---

### Integration Tests — Components

**Location:** Next to the component file (`*.test.tsx`)  
**Tool:** Vitest + `@testing-library/react` (`render`)  
**Speed:** Seconds  
**Coverage target:** Critical user paths

**What to test:**
- Component renders with given props
- User interactions work (click, type, submit)
- Accessibility (roles, labels)
- Conditional rendering (shows/hides elements)

**Example — Model:**
```typescript
// components/atoms/Button/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders button text', () => {
    render(<Button animate={false}>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick} animate={false}>Click</Button>)
    screen.getByText('Click').click()
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled animate={false}>Disabled</Button>)
    expect(screen.getByText('Disabled')).toBeDisabled()
  })
})
```

**Rules:**
- Query by role/text, not by test-id (`getByRole`, `getByText`, `getByLabelText`)
- Use `userEvent` over `fireEvent` when possible (more realistic)
- Test user behavior, not implementation

**Bad:**
```typescript
// ❌ Testing implementation details
it('has bg-primary class', () => {
  const { container } = render(<Button>Test</Button>)
  expect(container.firstChild).toHaveClass('bg-primary')
})

// ❌ Testing internal state
it('sets internal state to true', () => {
  const wrapper = render(<Toggle />)
  expect(wrapper.getByTestId('toggle-state').textContent).toBe('true')
})
```

**Good:**
```typescript
// ✅ Testing user-visible behavior
it('shows active state when clicked', () => {
  render(<Toggle>Activate</Toggle>)
  const button = screen.getByRole('button', { name: 'Activate' })
  userEvent.click(button)
  expect(button).toHaveAttribute('aria-pressed', 'true')
})
```

---

### E2E Tests — Critical Paths

**Location:** `client/e2e/` or `client/tests/e2e/`  
**Tool:** Playwright  
**Speed:** Minutes  
**Coverage target:** 3-5 critical user journeys

**What to test:**
- Full authentication flow
- Scoreboard scoring flow
- Table creation + QR code generation
- Cross-device synchronization (socket events)

**NOT what to test:**
- Every button click
- Form validation (covered by unit tests)
- Edge cases (covered by unit tests)

---

## Mocks

### Mock External Dependencies

Mock external libraries that don't work in jsdom or are slow.

**Already mocked in `setup.ts`:**
- `framer-motion` — renders HTML elements instead of motion components
- `matchMedia` — window.matchMedia for responsive hooks

**When to mock:**
- Browser APIs not in jsdom (`matchMedia`, `ResizeObserver`, `IntersectionObserver`)
- Animation libraries (`framer-motion`, `gsap`)
- External services (maps, charts, video players)
- `window.location` / `window.navigator`

**When NOT to mock:**
- Your own components (test the real thing)
- Your own hooks (test the real thing)
- Your own services (test the real thing)

### Mock Contexts for Component Tests

Use `renderWithProviders` from `test-utils.tsx` instead of mocking contexts.

**Good:**
```typescript
import { renderWithProviders } from '@/test/test-utils'

it('shows admin button for owner', () => {
  renderWithProviders(<DashboardPage />, {
    mockSocketContext: { tables: [mockTable] }
  })
  expect(screen.getByText('Create Table')).toBeInTheDocument()
})
```

**Bad:**
```typescript
// ❌ Mocking the entire context module
vi.mock('@/contexts/SocketContext', () => ({
  useSocketContext: () => ({ tables: [], connected: true })
}))
```

---

## Test File Structure

### Naming

```
services/permissions/rules/scoreboard.ts
services/permissions/rules/scoreboard.test.ts      ✅ Same folder

hooks/useMatchDisplay/useMatchDisplay.ts
hooks/useMatchDisplay/useMatchDisplay.test.ts      ✅ Same folder

components/atoms/Button/Button.tsx
components/atoms/Button/Button.test.tsx            ✅ Same folder
```

### Structure

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from './MyComponent'

// 1. Factory functions (if needed)
const createMockData = (overrides = {}) => ({ ...defaults, ...overrides })

// 2. Test suite
describe('MyComponent', () => {
  // 3. Group related tests with nested describe
  describe('rendering', () => {
    it('renders with default props', () => { ... })
    it('renders with custom props', () => { ... })
  })

  describe('interactions', () => {
    it('calls onClick when clicked', () => { ... })
  })

  describe('edge cases', () => {
    it('handles empty data', () => { ... })
    it('handles null props', () => { ... })
  })
})
```

---

## Coverage Rules

### Minimum Coverage (enforced by CI)

| Layer | Target |
|-------|--------|
| Services | 90% |
| Hooks | 80% |
| Components (organisms) | 70% |
| Components (molecules/atoms) | 60% |
| Pages | 50% |

### What Counts as Covered

**Covered:**
- All branches of `if/else`
- All cases of `switch`
- Error handling paths
- Edge cases (empty, null, undefined)

**NOT an excuse for low coverage:**
- "It's just UI" — UI has logic too (conditional rendering)
- "It's hard to test" — refactor to make it testable
- "I'll add tests later" — later never comes

---

## Testing Anti-Patterns

| Anti-Pattern | Example | Why It's Wrong |
|--------------|---------|----------------|
| Testing implementation | `expect(component.state).toBe(true)` | Breaks when refactoring |
| Testing CSS classes | `expect(button).toHaveClass('bg-primary')` | Tests styling, not behavior |
| Shallow rendering | `shallow(<Component />)` | Doesn't test child components |
| Snapshot tests for everything | `expect(tree).toMatchSnapshot()` | Snapshots break constantly, hide real bugs |
| Testing library internals | `expect(socket.emit).toHaveBeenCalled()` | Tests how it works, not what it does |
| No edge cases | Only testing happy path | Real users hit edge cases |
| Async without await | `fireEvent.click(); expect(...)` | Race conditions |
| Mocking everything | Every dependency mocked | Tests nothing real |

---

## Checklist

When writing tests:

- [ ] Service tests run without React (pure unit tests)
- [ ] Component tests query by role/text, not test-id
- [ ] Each test has one clear purpose
- [ ] Edge cases are covered (null, empty, undefined)
- [ ] Error paths are tested
- [ ] Tests are descriptive (`it('returns false when...')` not `it('works')`)
- [ ] Mocks are used for external deps, not internal code
- [ ] `renderWithProviders` used instead of mocking contexts
- [ ] Coverage meets layer target
- [ ] Tests are in same folder as source file

---

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:ui

# With coverage
npm run test:coverage

# Specific file
npx vitest src/services/permissions/rules/scoreboard.test.ts

# E2E
npm run test:e2e
```

---

## Related Documents

- [SERVICES.md](SERVICES.md) — Pure function rules (impacts service tests)
- [HOOKS.md](HOOKS.md) — Hook rules (impacts hook tests)
- [COMPONENTS.md](COMPONENTS.md) — Component rules (impacts component tests)
