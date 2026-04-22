# Tasks: Refactor Server Architecture

## Phase 1: Extract Services

### Task 1.1: Create `services/table/TableRepository.ts`
- [ ] Extract table CRUD from TableManager
- [ ] Extract getNextTableNumber
- [ ] Create `TableRepository.test.ts`
- [ ] Verify: Tests pass

### Task 1.2: Create `services/table/PlayerService.ts`
- [ ] Extract joinTable, leaveTable, setReferee
- [ ] Extract isReferee, getRefereeSocketId
- [ ] Create `PlayerService.test.ts`
- [ ] Verify: Tests pass

### Task 1.3: Create `services/table/MatchOrchestrator.ts`
- [ ] Extract configureMatch, startMatch
- [ ] Extract recordPoint, subtractPoint, undoLast
- [ ] Extract setServer, swapSides, resetTable
- [ ] Create `MatchOrchestrator.test.ts`
- [ ] Verify: Tests pass

### Task 1.4: Create `services/table/TableFormatter.ts`
- [ ] Extract tableToInfo, getTableWithPin
- [ ] Extract getPublicTableList, getAllTablesWithPins
- [ ] Create `TableFormatter.test.ts`
- [ ] Verify: Tests pass

### Task 1.5: Create `services/security/PinService.ts`
- [ ] Extract generatePin
- [ ] Extract PIN validation logic
- [ ] Create `PinService.test.ts`
- [ ] Verify: Tests pass

### Task 1.6: Create `services/security/RateLimiter.ts`
- [ ] Extract rate limiting from SocketHandlerBase
- [ ] Create `RateLimiter.test.ts`
- [ ] Verify: Tests pass

### Task 1.7: Create `services/qr/QRService.ts`
- [ ] Extract generateQRData
- [ ] Create `QRService.test.ts`
- [ ] Verify: Tests pass

---

## Phase 2: Refactor TableManager

### Task 2.1: Update TableManager
- [ ] Inject services via constructor
- [ ] Delegate all operations to services
- [ ] Maintain same public interface
- [ ] Reduce to < 200 lines
- [ ] Verify: Existing tests still pass

---

## Phase 3: Update Infrastructure

### Task 3.1: Update SocketHandlerBase
- [ ] Use RateLimiter service
- [ ] Remove inline rate limiting logic
- [ ] Verify: Existing tests still pass

---

## Phase 4: Verify

### Task 4.1: Run Tests
- [ ] Run `npm test` (all server tests pass)
- [ ] Run `npm run build` (compiles without errors)
- [ ] Run `npm run lint` (no new errors)

### Task 4.2: Documentation
- [ ] Update `server/docs/rules/` status table
- [ ] Mark completed refactor items
