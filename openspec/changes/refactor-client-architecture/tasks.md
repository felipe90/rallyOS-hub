# Tasks: Refactor Client Architecture

## Phase 1: Extract Services

### Task 1.1: Create `services/match/`
- [x] Create `services/match/calculateSets.ts`
- [x] Create `services/match/determineWinner.ts`
- [x] Create `services/match/formatEvent.ts`
- [x] Create `services/match/getEventColor.ts`
- [x] Create `services/match/applySideSwap.ts`
- [x] Create all tests

### Task 1.2: Create `services/dashboard/`
- [x] Create `services/dashboard/calculateStats.ts`
- [x] Create tests

### Task 1.3: Create `services/validation/`
- [x] Create `services/validation/pin.ts`
- [x] Create `services/validation/auth.ts`
- [x] Create `services/validation/match.ts`
- [x] Create all tests

### Task 1.4: Create `services/url/`
- [x] Create `services/url/buildScoreboardUrl.ts`
- [x] Create tests

### Task 1.5: Create `services/errors/`
- [x] Create `services/errors/errorMessages.ts`
- [x] Create tests

### Task 1.6: Create `services/storage/`
- [x] Create `services/storage/authStorage.ts`
- [x] Create tests

### Task 1.7: Create `services/date/`
- [x] Create `services/date/formatRelativeTime.ts`
- [x] Create tests

---

## Phase 2: Refactor Hooks

### Task 2.1-2.3: Split useSocket.ts
- [x] Create `hooks/useSocketConnection.ts`
- [x] Create `hooks/useSocketState.ts`
- [x] Create `hooks/useSocketActions.ts`
- [x] Recompose `hooks/useSocket.ts`

### Task 2.4: Update useMatchDisplay.ts
- [x] Refactor to use `services/match/`

### Task 2.5: Create usePinSubmission.ts
- [x] Extract reusable PIN submission flow

### Task 2.6: Create useDashboardStats.ts
- [x] Thin wrapper over `services/dashboard/calculateStats`

---

## Phase 3: Refactor Contexts

### Task 3.1: Update AuthContext
- [x] Replace direct localStorage with `authStorage` service

---

## Phase 4: Fix Components

### Task 4.1: Update MatchHistoryTicker.tsx
- [x] Import from services/match/

### Task 4.2: Update HistoryDrawer.tsx
- [x] Import from services/date/

### Task 4.3: Update QRCodeImage.tsx
- [x] Receive `joinUrl` as prop
- [x] Update TableStatusChip.tsx to build URL via service

---

## Phase 5: Update Pages

### Task 5.1-5.2: Update Dashboard Pages
- [x] OwnerDashboardPage uses useDashboardStats + usePinSubmission
- [x] RefereeDashboardPage uses useDashboardStats + usePinSubmission

### Task 5.3: Update ScoreboardPage.tsx
- [x] Replace useScoreboardAuth with usePermissions
- [x] Update ScoreboardPage.test.tsx mocks

---

## Phase 6: Cleanup

### Task 6.1: Delete Deprecated Code
- [x] Delete `hooks/useScoreboardAuth.ts`
- [x] Update `hooks/index.ts` exports

### Task 6.2: Verify
- [x] Run `npm test` — 508 tests pass
- [x] Run `npm run build` — compiles successfully

### Task 6.3: Final Polish
- [x] Integrate usePinSubmission into dashboard pages
- [x] Complete services/validation (auth + match)
- [x] Sync ValidationError type with server
