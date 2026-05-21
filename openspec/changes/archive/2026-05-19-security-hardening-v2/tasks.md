# Tasks: Security Hardening v2

> **Change:** `security-hardening-v2`  
> **Depends on:** Spec + Design v2 (corrections applied)  
> **Mode:** TDD where applicable — strict Vitest on server, Vitest + React Testing Library on client

---

## Phase 1: Config / Environment (Foundation)
*Sequential — all other phases depend on these env values.*

- [ ] **1.1** Rename `REFEREE_PIN` → `TOURNAMENT_OWNER_PIN` in `docker-compose.yml:18`, `.env:11`, `.env.example:11`, `server/.env:2`. Update values to 8 digits (`12345678`).
- [ ] **1.2** Update `diagnose.sh:99`: `grep REFEREE_PIN` → `grep TOURNAMENT_OWNER_PIN`.
- [ ] **1.3** Rename client constant `REFEREE_PIN` → `DEFAULT_TABLE_PIN` in `client/src/pages/AuthPage/AuthPage.types.ts:14` and update its export in `client/src/pages/AuthPage/index.ts:3`. *Grep: `grep -r "REFEREE_PIN" client/src --include="*.ts" --include="*.tsx"`*

---

## Phase 2: Server — Critical Fixes
*Mostly sequential per handler. Tests can be written in parallel before green tasks.*

- [ ] **2.1 [RED]** Write test: `VERIFY_OWNER` 6th attempt from same IP in <60s emits `RATE_LIMITED`. File: `server/src/handlers/AuthHandler.test.ts` (create if missing).
- [ ] **2.2 [GREEN]** Add rate limiting to `VERIFY_OWNER` in `AuthHandler.ts:89`: `const rateLimitKey = \`VERIFY_OWNER:${clientIp}\`; if (this.isRateLimited(rateLimitKey)) { ... }`. Pattern identical to `SET_REF` at lines 39-43.
- [ ] **2.3 [RED]** Write test: `DELETE_TABLE` without `isOwner` and without active ref emits `UNAUTHORIZED`; owner and active ref succeed.
- [ ] **2.4 [GREEN]** Add auth guard in `TableEventHandler.ts:156`:
  ```ts
  const isOwner = (socket as any).data?.isOwner === true;
  const isRef = this.tableManager.isReferee(data.tableId, socket.id);
  if (!isOwner && !isRef) return this.emitError(socket, 'UNAUTHORIZED', 'No autorizado');
  ```
  Remove optional PIN backwards-compat block (lines 161-164).
- [ ] **2.5 [RED]** Write test: `CONFIGURE_MATCH` with `format: 0` or `ptsPerSet: 100` emits `VALIDATION_ERROR`; valid values pass.
- [ ] **2.6 [GREEN]** Add numeric validation in `MatchEventHandler.ts:58-63`:
  ```ts
  format: { type: 'number', required: false, min: 1, max: 9 },
  ptsPerSet: { type: 'number', required: false, min: 1, max: 99 }
  ```
- [ ] **2.7 [GREEN]** Change `generatePin()` in `server/src/tableManager.ts:336`:
  `Math.floor(1000 + Math.random() * 9000).toString()` → `crypto.randomInt(1000, 9999).toString()`.
  **Table PIN stays 4 digits.** Do NOT change any `/^\d{4}$/` patterns.
- [ ] **2.8 [GREEN]** Change `resetTable()` in `server/src/tableManager.ts:282`:
  - Return type `MatchStateExtended | null` → `void`.
  - Remove `return table.matchEngine.startMatch()` at line 295.
  - Ensure `table.status = 'WAITING'` and `notifyUpdate(table)` remain.
- [ ] **2.9 [GREEN]** Adapt `RESET_TABLE` handler in `MatchEventHandler.ts:245-248`:
  - Remove `const state = this.tableManager.resetTable(...)`.
  - Call `this.tableManager.resetTable(...)` directly (void).
  - Emit `TABLE_UPDATE` with `WAITING` status instead of `MATCH_UPDATE`.
- [ ] **2.10 [GREEN]** Update owner PIN regex to exactly 8 digits (`/^\d{8}$/`):
  - `AuthHandler.ts:90` (VERIFY_OWNER)
  - `TableEventHandler.ts:60` (GET_TABLES_WITH_PINS)
  - `client/src/hooks/useSocket.ts:37` (validateOwnerPin)
  *Grep: `grep -rn "d{5,8}" server/src client/src`*

---

## Phase 3: Client — Storage & Hook Cleanup
*Can run in parallel with Phase 2 (no server contract changes block these).*

- [ ] **3.1** Migrate `ownerPin` from `localStorage` → `sessionStorage` in `client/src/contexts/AuthContext/AuthContext.tsx`:
  - Line 24: `localStorage.getItem('ownerPin')` → `sessionStorage.getItem('ownerPin')`
  - Line 46: `localStorage.setItem('ownerPin', pin)` → `sessionStorage.setItem('ownerPin', pin)`
  - Line 54: `localStorage.removeItem('ownerPin')` → `sessionStorage.removeItem('ownerPin')`
  - Line 67: `localStorage.setItem('ownerPin', pin)` → `sessionStorage.setItem('ownerPin', pin)`
- [ ] **3.2** Update `client/src/hooks/useSocket.ts` to read `ownerPin` from `sessionStorage`:
  - Line 119 (`reconnect` listener)
  - Line 142 (`TABLE_CREATED` listener)
- [ ] **3.3** Migrate `OwnerDashboardPage.tsx:14,37`: replace `useDashboardAuth` with `useAuthContext` (`isOwner` already available).
- [ ] **3.4** Migrate `HistoryViewPage.tsx:9,18`: replace `useDashboardAuth` with `useAuthContext` (`isOwner`, `isReferee` available).
- [ ] **3.5** Update `HistoryViewPage.test.tsx`: replace `useDashboardAuth` mock with `useAuthContext` mock.

---

## Phase 4: Wiring / Regression
*Sequential — verify nothing broke after all changes land.*

- [ ] **4.1** Delete deprecated hooks:
  - `client/src/hooks/useAuth.ts`
  - `client/src/hooks/useDashboardAuth.ts`
  - `client/src/hooks/useAuth.test.ts`
- [ ] **4.2** Remove exports from `client/src/hooks/index.ts` (lines 4-5 and 10-11).
- [ ] **4.3** Run server tests: `cd server && npm test`
- [ ] **4.4** Run client tests: `cd client && npm test`
- [ ] **4.5** Type-check client: `cd client && npx tsc --noEmit`
- [ ] **4.6** Type-check server: `cd server && npx tsc --noEmit`

---

## Phase 5: Manual Validation

- [ ] **5.1** `docker-compose up` — verify server starts with `TOURNAMENT_OWNER_PIN` (no `REFEREE_PIN` errors).
- [ ] **5.2** Create table → verify PIN is 4 digits (not 6) in owner dashboard.
- [ ] **5.3** Owner verify → DevTools: `sessionStorage.getItem('ownerPin')` returns PIN; `localStorage.getItem('ownerPin')` is `null`.
- [ ] **5.4** Close tab → reopen → owner requires re-auth (sessionStorage cleared).
- [ ] **5.5** 6 wrong `VERIFY_OWNER` attempts → 6th returns `RATE_LIMITED`.
- [ ] **5.6** Non-owner/non-ref socket calls `DELETE_TABLE` → table remains.
- [ ] **5.7** Reset table → status stays `WAITING`, does not auto-start.
- [ ] **5.8** `CONFIGURE_MATCH` with `format: 0` or `ptsPerSet: 100` → `VALIDATION_ERROR`.

---

## Summary

| Phase | Tasks | Focus | Parallel?
|-------|-------|-------|----------|
| 1 | 3 | Env unification | Sequential |
| 2 | 10 | Server critical fixes | Tests parallel; impl sequential per file |
| 3 | 5 | Client storage + hook cleanup | Parallel with Phase 2 |
| 4 | 6 | Regression + type checks | Sequential |
| 5 | 8 | Manual validation | Sequential |
| **Total** | **32** | | |
