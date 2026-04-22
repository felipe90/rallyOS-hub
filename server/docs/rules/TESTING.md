# Testing Rules

**Framework:** Jest  
**Location:** `server/tests/` or next to source (`*.test.ts`)

---

## Test Pyramid

```
         /\
        /  \     E2E (Playwright) -- Critical paths
       /----\    Slow. Test socket flows end-to-end.
      /      \
     /--------\  Integration -- Handler + TableManager + MatchEngine
    /          \  Medium speed. Test event flows.
   /------------\
  /              \ Unit (Jest) -- Domain + Application + Utils
 /----------------\ Fast. Test logic in isolation.
```

**Target ratio:** 60% unit, 30% integration, 10% E2E.

---

## Unit Tests

### Domain Tests (MatchEngine)

Test game rules in isolation:
```typescript
describe('MatchEngine', () => {
  it('detects set winner', () => { ... })
  it('detects match winner', () => { ... })
  it('handles deuce', () => { ... })
  it('tracks history', () => { ... })
})
```

### Application Tests (Services)

Test orchestration logic:
```typescript
describe('PlayerService', () => {
  it('joins player to table', () => { ... })
  it('sets referee with valid PIN', () => { ... })
  it('rejects invalid PIN', () => { ... })
})
```

### Utility Tests

Test pure functions:
```typescript
describe('pinEncryption', () => {
  it('encrypts and decrypts PIN', () => { ... })
  it('rejects expired PIN', () => { ... })
})
```

---

## Integration Tests

Test handler + TableManager + MatchEngine together:
```typescript
describe('Socket Events', () => {
  it('full match flow', async () => {
    // Create table
    // Join as referee
    // Start match
    // Score points
    // Assert match state
  })
})
```

Use `socket.io-client` in tests to connect to real server.

---

## E2E Tests

Test critical user journeys:
1. Owner creates table → referee joins → match starts → score points
2. Owner PIN verification → table management
3. Kill-switch flow (regenerate PIN)

---

## Rules

1. **Domain tests don't need server running**
2. **Integration tests need server + socket connection**
3. **E2E tests need full app running**
4. **Mock external services** (don't call real APIs)
5. **Each test is independent** (clean state between tests)

---

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Specific file
npm test -- matchEngine.test.ts

# Coverage
npm test -- --coverage
```
