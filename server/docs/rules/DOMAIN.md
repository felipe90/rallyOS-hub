# Domain Layer Rules

**Location:** Domain objects (MatchEngine, future domain services)  
**Rule:** Pure game logic. No I/O. No infrastructure.

---

## MatchEngine (Model)

`MatchEngine` is the gold standard in this codebase:

**Good:**
- Pure game logic (scoring, winner detection, side swap)
- No Socket.IO, no Express, no filesystem
- Testable in isolation
- Immutable state updates (returns new state)

**Pattern:**
```typescript
// Create
const engine = new MatchEngine({ pointsPerSet: 11, bestOf: 3 })

// Action returns state
const state = engine.recordPoint('A')

// Query state
const current = engine.getState()
```

**Rules for domain objects:**
1. Constructor takes config, initializes state
2. Action methods mutate internal state (OK for performance) but return updated state
3. Query methods return state snapshot (JSON.parse(JSON.stringify(...)))
4. No async operations
5. No external dependencies

---

## Testing Domain Objects

```typescript
import { MatchEngine } from './matchEngine'

describe('MatchEngine', () => {
  it('awards set at 11 points with 2 point lead', () => {
    const engine = new MatchEngine({ pointsPerSet: 11, bestOf: 3 })
    
    // Score 11 points for A
    for (let i = 0; i < 11; i++) {
      engine.recordPoint('A')
    }
    
    const state = engine.getState()
    expect(state.score.sets.a).toBe(1)
    expect(state.score.currentSet.a).toBe(0) // Reset for next set
  })
})
```

**Key point:** Test runs without server, database, or Socket.IO.

---

## Future Domain Services

As the app grows, extract pure logic from TableManager into domain services:

```typescript
// services/pinGenerator.ts
export function generatePin(): string {
  return crypto.randomInt(1000, 9999).toString()
}

// services/tableNumberGenerator.ts
export function getNextTableNumber(usedNumbers: Set<number>): number {
  let next = 1
  while (usedNumbers.has(next)) {
    next++
  }
  return next
}
```

These are pure functions that don't need a class.
