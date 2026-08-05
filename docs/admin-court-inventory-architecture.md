# Admin Court Inventory — Architecture Design

> Working design document (draft). Conversation-driven; not yet an approved SDD
> proposal. Kept in the repo so decisions, tradeoffs, and the persistence review
> are not lost across sessions.

## Status

- **Stage**: Design discussion — not yet split into SDD work units.
- **Decisions locked**: strict mode; admin is single source of truth; caller
  responsible for inventory hygiene; availability is a derived function;
  kind-mutable `CourtRecord` + active flow slot, driven by a **rule engine
  (`FlowModeRegistry`)**; tournament never mutates existence; tournament does not
  use `HELD` (booking-only); `MAX_COURTS` cap + create/delete rate-limit dropped;
  **no v3→v4 data migration — persistence wiped** (not yet commercial);
  **admin holds general force-end stop control** (`INVENTORY_FORCE_END`).
- **Open questions**: cold-start copy (provisional set, revisit after dev);
  exact force-end cost/finalize semantics per mode.

---

## 1. Goal

Make the **admin** the single source of truth for the courts (mesas/canchas) that
can be used in a club — across **free practice, match, and tournament** flows, so
that data strictly reflects the physical world and the information system keeps
its analytical validity.

### Why

Today there are **two parallel, disconnected court worlds**:

- **Tournament / owner courts** (`CourtEventHandler`, event `CREATE_COURT`) — any
  authenticated socket can create an ephemeral court; public list
  `getAllTournamentCourts`; global `MAX_COURTS=50` cap; per-IP rate limit; the
  bracket assigns matches to these courts.
- **Club courts** (`ClubCourtHandler`, event `CLUB_CREATE_COURT`) — only the
  admin creates and manages courts through the lifecycle
  `AVAILABLE → RESERVED → OCCUPIED → FINISHED`, with player identity (name +
  encrypted phone), traceable `adminId`, `costPerMinute`, and session history.

No one owns the physical inventory; each flow invents its own courts. This
breaks data validity for anything that maps usage to real courts (billing,
analytics, audit).

### Decision: strict mode

- The tournament **must** consume courts from the admin catalog — **no ad‑hoc /
  escape-hatch court creation**. The user accepted this deliberately: a
  tournament on a hub with no catalog configured has no tournament mode (cold
  start is a hard prerequisite).
- Admin discipline is assumed: the admin is responsible for keeping the catalog
  current. The system enforces **internal consistency** (every used court exists
  in the catalog); it cannot verify external physical truth.

---

## 2. Conceptual model — three orthogonal axes

> The critical architectural choice: **do not merge EXISTENCE, AVAILABILITY, and
> SESSION/FLOW into one state machine.**

| Axis | What it is | Owner | States | Notes |
|---|---|---|---|---|
| **INVENTORY** (existence) | The court exists in the club | Admin (source of truth, durable) | `ACTIVE` · `MAINTENANCE` · `ARCHIVED` | Strict; no hard delete of used courts |
| **AVAILABILITY** (occupancy) | Court is being used right now | Runtime (transient) | `IDLE` · `BUSY` | Derived from inventory, never invented |
| **FLOW** (what happens on the court) | A match OR a club session | Runtime (transient) | per-mode rule engine: tournament `LIVE/...` · club `OCCUPIED/...` | Branches per mode; kept **separate** from inventory |

**Contract**: every court used exists always in the inventory; the inventory is
immutable except by the admin; availability and flow are transient runtime over an
inventory court.

### Availability is DERIVED, not stored 🔴

`AVAILABILITY` is NOT a third stored axis — it is a **pure function**
`availabilityOf(court)` computed on demand from (inventoryStatus, active flow,
tournament assignment). It is never persisted, so it is **consistent by
construction** — a stored parallel availability state would be a second source
of truth that can drift (the exact vice this change removes).

Its result type:

| Value | Meaning | Derived when |
|---|---|---|
| `IDLE` | Not in use | no active flow |
| `BUSY` | Occupied NOW by a live session | club flow `OCCUPIED` (timer/cost running) OR tournament match live on the court |
| `HELD` | Committed to a **future** use (general booking only) | an open future booking exists for the court (section 10) — **never** from tournament |

`BUSY` and `HELD` both block admin mutation (R7) and prevent double-use, but they
differ in **what releases them** and in **kiosk display** ("in play now" vs
"reserved later"). `HELD` is the **general booking axis only** — it is the
future-use register (section 10).

> 🔴 **Tournament does NOT use `HELD`.** The tournament runs on live `BUSY`
> courts only. When the tournament **ends, all tournament courts are released**
> (no retention window, no per-round holds). Simpler and stricter: tournament =
> transient live assignment; booking = general future note.

### One physical court = ONE mutable-flow entity (kind-mutable) 🔴

The inventory drive is mode-agnostic. Collapse `TournamentCourt` and `ClubCourt`
into a single physical court with a **mutable flow slot**:

```
CourtRecord (inventory, durable, admin-owned)   ← identity only
  courtId  · number · name · inventoryStatus (ACTIVE/MAINTENANCE/ARCHIVED)
  ··· NO knowledge of tournament/club ···

active flow (runtime, exactly ONE)               ← what is on the court NOW
  flow: { type:'tournament', ... }
      | { type:'club', sessionMode:'free'|'match', ... }
      | (future) { type:'clase', ... }
```

- `kind` ceases to be a permanent type discriminator — it is **derived from the
  active flow**.
- A physical court = **one object, one `courtId`**, which runs a tournament today
  and a practice tomorrow; only `flow` is reassigned, `CourtRecord` never changes.
- This *is* Option A concretized: reuses the tested scoring/cost logic, with one
  strong decision — merge the two current arrays into a single inventory + flow
  descriptor on migration, **deduplicating by `courtId`/`number`** so a physical
  court is never doubled.

### Terminology — sport-agnostic naming 🔴

- **Stable identity is `courtId` everywhere — NOT `tableId`**, which is
  table-tennis-loaded (`tableId` today only lives in legacy/deprecated names such
  as `pinEncryption`/QR). The codebase already uses `courtId` across handlers and
  `BracketEngine.assignCourt(matchId, courtId)`. Adopt it uniformly for the
  inventory entity.
- **`getNextTableNumber()` → sport-agnostic counter** (e.g. `getNextCourtNumber` /
  next inventory id). It is not TT-specific; it numbers courts regardless of
  sport. Rename to remove the table-tennis bias.
- **Number reuse after archive**: a court number must NOT be reused for a new
  court once freed (archived/used), or session history/cost reference becomes
  ambiguous. Assign monotonic numbers; treat the number as display identity, not
  reassignment pool.
- **`courtId` is sport-agnostic by construction** — it is a pure identity string
  (confirmed in `shared/types.ts`), with no table-tennis or court semantics.
  Because the identity carries no sport meaning, a club **changing sport never
  detaches anything**: the number is only a display label and the history stays
  keyed to the stable `courtId`. This closes E9 (sport change drift) — no drift
  is possible since identity and display are fully separated.
- **Number vs name — two different display labels (coexists with sport-aware
  terminology, see section 5)**:
  - `number` — **neutral** display identity (monotonic, no reuse). Carries NO
    sport meaning: "3" is "the third physical court".
  - `name` — **sport-aware** display label the admin can set/rename. Inherits
    the sport-aware default from the merged sport-terminology work
    (`resolveCourtSport()` → `"Cancha {n}"` for padel, `"Mesa {n}"` for table
    tennis) as the **suggestion** in `INVENTORY_ADD`; the admin may override it
    (`INVENTORY_RENAME`). Persisted names render as-is (MP-2).

The current model already half-prepares for this:

- `CourtManager` already composes services (`CourtRepository`, `PlayerService`,
  `MatchOrchestrator`, `CourtFormatter`, `PinService`, `QRService`).
- `TournamentCourt.kind === 'tournament'` vs `ClubCourt.kind === 'club'` already
  discriminate modes.
- Club courts already carry `sessionMode: 'free' | 'match' | null`, and
  `shared/types.ts` already has `SESSION_MODE` and `COURT_MODE`.
- `SportDisplayRegistry.resolve(sport)` already demonstrates the
  registry/adapter plugin pattern client-side.

---

## 3. Client changes (UI / UX / flows)

1. **Admin — new "Court Inventory" surface**
   - List of club courts with inventory status (`ACTIVE` / `MAINTENANCE` /
     `ARCHIVED`).
   - Actions: **create physical court, rename (display name over stable id),
     set maintenance, archive**.
   - **Force-end** (`INVENTORY_FORCE_END`): the admin can stop ANY live session on
     a court on demand to free it — the emergency release valve (R7). UI shows a
     "End session" action when a court is `BUSY`.
   - **No delete** — used courts archive. UI copy explains: "used courts are
     archived, never deleted."
2. **Owner / tournament — stop creating courts**
   - Remove the ad‑hoc `createCourt` form from the owner dashboard.
   - Tournament **picks courts from the inventory** (picker of `ACTIVE`,
     available courts).
   - Cold start: no `ACTIVE` courts → explicit message. **Provisional copy**
     (per user: keep simple, revisit after development):
     `"No hay mesas disponibles. Configurá el inventario como admin para comenzar un torneo."`
3. **Club mode — same flow, different origin**
   - Free practice / match no longer "create" a court; they **occupy an existing
     inventory court**.
   - The mode selector (`free`/`match`, today `ClubSessionConfig`) becomes a
     mode picker over an already-chosen court.
4. **Shared semantics**
   - A single `useCourtInventory` hook replaces the duplicated
     `useCourtManagement` vs `useClubCourtManagement`.
   - All flows consume the **same** catalog and availability.

### Roles — who can do what 🔴

A role system already exists (`owner` vs `club admin`). Binding it explicitly:

| Action | Role |
|---|---|
| Mutate inventory (add/rename/maintenance/archive) | **Admin** only (`validateClubAdmin`) |
| Force-end / stop any session to free a court (`INVENTORY_FORCE_END`) | **Admin** only (emergency release) |
| Run/assign tournament courts (SELECT) | **Owner** only |
| Occupy a court (club free/match) | **Admin** or **player** via PIN |
| View inventory + availability | All |

Product consequence (decision): **owner tournament now depends on an admin having
configured the inventory.** With no `ACTIVE` courts the owner cannot run a
tournament until an admin loads the catalog (the strict cold-start).

---

## 4. Server changes (sockets / services / modules)

### Socket events

- `CREATE_COURT`, `CLUB_CREATE_COURT`, and `DELETE_COURT` → **removed** (all ad‑hoc /
  existence-mutating paths). The tournament/owner **cannot change court existence
  at all** — that is admin-only via the inventory. `CREATE_COURT`/`DELETE_COURT`
  removal is a **breaking change**: `bracketCourtFlow.spec` and the owner dashboard
  create/delete courts ad‑hoc; those tests/e2e must be removed or rewritten against
  the new inventory picker as part of this work.
- New (admin): `INVENTORY_LIST / INVENTORY_ADD / INVENTORY_RENAME /
  INVENTORY_MAINTENANCE / INVENTORY_ARCHIVE`. The existence rules that used to
  live on `CREATE_COURT` (**`MAX_COURTS` cap + create/delete rate-limit**) are
  **dropped, not moved** — an admin is a single trusted, authed actor, so those
  rules no longer apply and are removed with `CREATE_COURT`/`DELETE_COURT`.
- New (admin): `INVENTORY_FORCE_END` — the admin holds the **stop/force-end
  control for ANY court mode** (club `OCCUPIED` or tournament live). This frees
  the court on demand (→ `IDLE`) so a stuck session can never block the system;
  it is the admin's emergency release, mirroring `CLUB_FORCE_END` with `adminId`
  traceability. See section 4 flow rules / R7.
- New (owner): `TOURNAMENT_SELECT_TABLE { courtId }` — binds a bracket match to an
  inventory court (`BracketEngine.assignCourt` already uses `courtId`). SELECT
  mutates availability (→ live `BUSY` while the match runs), **never existence**.
  When the tournament ends, all tournament courts are released.
- `CLUB_JOIN` / `CLUB_ADMIN_OCCUPY` → target an existing inventory court.

### Services / modules

- New **`InventoryManager`** (a.k.a. `CourtInventoryService`) — the **only
  authority over EXISTENCE**. CourtManager consumes it, does not create courts.
- New **`FlowModeRegistry`** — the rule engine that resolves the flow contract
  per mode (see "Flow slot = rule engine"). Mirrors `SportDisplayRegistry` but
  for the session-mode axis.
- **Repository**: persist `CourtRecord` (inventory, mode-agnostic) separately
  from transient active flows / sessions.
- **CourtManager** becomes the **availability/flow orchestrator** delegating to
  `InventoryManager` + `FlowModeRegistry`. It owns the active flow slot and the
  derived `availabilityOf()` function.

### Flow slot = rule engine (flow contract per mode) 🔴

The `flow` slot is NOT a loose type tag — it is a **rule engine** that fully
specifies each mode's behavior. The active flow is an instance of a **flow
contract** that defines its own states, transitions, availability mapping, and
teardown. This is what "flows must be well-defined for each mode" means in code:
no `if mode`, no free-form fields.

```
CourtRecord.flow — a state machine instance, ONE per court:
  {
    mode: 'tournament' | 'club',         // discriminator (rule engine key)
    state: <mode-specific>,
    startedAt, ...,
    contract: FlowModeRegistry.get(mode) // the rule object
  }

rule contract `FlowMode` (a.k.a. SessionModeContract):
  key: 'tournament' | 'club'
  registry: FlowModeRegistry            // resolution, no enum+switch
  states + allowedTransitions           // full machine, per mode
  availabilityOf(state)                 // how state → IDLE/BUSY/HELD
  occupy(court) | start(court) | end(court)->Cost
  forceEnd(court) -> release            // admin stop control (section 4)
  serialize()
  canArchive(court) -> bool             // guard for admin mutation (R7)
```

`FlowModeRegistry.get(mode)` returns the one rule object; CourtManager only
drives it. **The two modes each define their own machine**:

| Mode | States & transitions | availabilityOf |
|---|---|---|
| **`club`** | `OCCUPIED → FINISHED` (timer/cost runs while `OCCUPIED`); `forceEnd` → finalize & release (cost settled) | `OCCUPIED` → `BUSY`; else → `IDLE` |
| **`tournament`** | `LIVE` (match running on court); on tournament **end/reset** → every tournament court released; `forceEnd` at tournament level (admin) | `LIVE` → `BUSY`; else → `IDLE` |

### Tournament release — precise semantics 🔴

"All tournament courts are released" is defined at the **bracket level, not per
court**. On tournament `complete | cancel | reset`:

1. The **bracket engine** `releaseAll()` walks every match→`courtId` binding and
   **clears it** (`match.courtId = null`), so no court is bound to a finished
   tournament.
2. Each affected `CourtRecord.flow` (mode `tournament`, state `LIVE`) is **set to
   none** → `availabilityOf` recomputes to `IDLE`.
3. The bracket in-memory cache is dropped; the persisted state is written once.

This is atomic from the owner's `END_TOURNAMENT` / `RESET_TOURNAMENT` action —
one rule-engine call `FlowModeRegistry.get('tournament').release(courtList)`. A
live scoring match is force-concluded (same finalization as a finished match);
a court *reserved but not started* is simply unbound. Result: no `HELD`, no
stale reference, courts free for the next tournament or club session.

The `FlowMode` contract is the **rule engine**: every behavior (occupying,
starting, ending, force-ending, releasing, archiving guard) is a method on the
contract, so `clase con tutor` registers one new contract instead of touching
CourtManager. This replaces the enum+switch anti-pattern (section 8).

### Scalability

- `sessionMode` becomes a **discriminator of a session contract**, not a flag.
  Each mode implements `occupiable()`, `onStart()`, `onEnd() → Cost`,
  `serialize()`. Scaling to new modes = registering an object, not branching in
  CourtManager (your `clase con tutor` example enters without touching the
  tournament flow or club billing).

### Security

- Availability must derive from the inventory: a session can only occupy a court
  that exists and is `ACTIVE`. Eliminates ghost-court creation.
- **Soft-delete / archive only** — protects session-history and cost integrity.
  `DELETE_COURT` is removed; archive is the only way to drop a court.
- Only the admin mutates existence (`validateClubAdmin`, already present);
  tournament can affect **availability only** (SELECT → live `BUSY`), never
  existence.
- **Admin holds general stop control over every court** — via `INVENTORY_FORCE_END`
  the admin can end ANY session (club or tournament) on demand to free the court
  (→ `IDLE`). A stuck session can never block the system or a future booking;
  this is the admin's release valve. Every force-end is `adminId`-traceable.
- `SessionMode` stays an **closed enum** in `shared/types` with socket-payload
  validation — rejects unknown modes (as `CLUB_ADMIN_OCCUPY` already does with
  `enum: [FREE, MATCH]`).

### Maintainability

- The key anti-pattern to avoid: `if sessionMode === FREE` branches inline in
  CourtManager (~lines 713, 819). The promise of Option A holds **only if** we
  implement the `FlowModeRegistry` **rule engine from day one**, not an
  enum+switch.

---

## 5. Coexistence with recent SDD work (sport-aware terminology)

> The `terminologia-deporte` SDD was merged as PRs #28/#29/#30
> (`feat/sport-aware-terminology-01-core`, `-02`, `-03`) while this design was
> drafted. It changed the SAME files this design plans to rework, so coexistence
> is explicit, not implicit.

### 5.1 What landed (relevant surface)

- **`resolveCourtSport()`** (server, `courtManager.ts`) — default name for NEW
  courts is sport-aware: `"Cancha {n}"` (padel) vs `"Mesa {n}"` (table tennis).
  MP-2: persisted names render as-is.
- **`SportContext` + `useSportTerms`/`TERM_KEYS`** (client) — typed contract
  resolving every court label per the club's configured sport; ST-3
  coverage test fails until every key exists in BOTH locales.
- Touched the same core files: `courtManager.ts`, `StateStore.ts`,
  `BracketHandler.ts`, `ClubAdminHandler.ts`, `MatchEventHandler.ts` (scoring
  rate-limit 30/min stays).

### 5.2 How each piece coexists

| Piece landed | Collision with this design | Coexistence |
|---|---|---|
| `resolveCourtSport()` names new courts | Inventory removes ad-hoc creation | **Reused, not killed**: the sport-aware default becomes the **suggested name** in `INVENTORY_ADD`; admin may override via `INVENTORY_RENAME`. MP-2 (persisted names render as-is) IS the inventory rule (`name` display over stable `courtId`) |
| `TERM_KEYS` include create/delete keys (`ownerCreateCourt`, `clubAdminCreateCourt`, `clubAdminDeleteConfirm`, `toastCourtCreated/Deleted`, `toastClubCourtCreated/Deleted`, `bracketCourtOrphan`, `bracketCourtOccupiedWarn`, …) | Those CUs/events disappear in this design | **Keys are marked deprecated and removed together with their consumers/tests.** Because `TERM_KEYS` is a compile-time contract + ST-3 coverage test, leaving a dead key breaks the build — removal is mechanical: drop key + its locale entries + its consumers in the same work unit (see section 12) |
| `SportContext` (club's sport) | Inventory is mode-agnostic (`courtId` has no sport) | **Orthogonal axes, no collision**: sport belongs to the CLUB (resolves terms), existence belongs to the INVENTORY (says what exists). `SportContext` keeps resolving labels; the inventory never learns the sport |
| Scoring rate-limit 30/min | Design touches scoring handlers | **Stays** — only create/delete existence rate-limits are dropped |
| `number` vs `name` display labels | Design said "number = display identity"; SDD said "name = sport-aware" | **Both hold**: `number` = neutral monotonic identity (no reuse); `name` = sport-aware label (section 2 terminology) |

### 5.3 What the inventory inherits

- `CourtRecord.name` → **sport-aware display label** (admin settable/renamable),
  rendered as-is.
- `CourtRecord.number` → **neutral identity label** (monotonic, no reuse).
- `INVENTORY_ADD` suggests `resolveCourtSport()`-based default name, matching
  the club's current sport; rename after a sport change is a normal admin action
  (E9 stays closed because `courtId` never changes).

---

## 6. Decision rationale: Option A vs Option B

- **Option A — one physical court + mutable flow slot (bridge over current)**:
  `TournamentCourt`/`ClubCourt` collapse into a single mode-agnostic `CourtRecord`
  (identity) + an active flow slot that is the match/session type. Reuses
  already-tested scoring/cost logic. Lowest risk.
- **Option B — court + separable flow**: the court is only
  inventory+availability; the flow is a per-session object attached externally.
  Cleaner conceptually, natural multi-mode, but a deep refactor of CourtManager
  and the socket lifecycle.

**Chosen: Option A**, concretized as `CourtRecord` + active flow slot (see
"One physical court = ONE mutable-flow entity"). The repo already validates the
extensible-mode pattern twice (`SESSION_MODE` discriminator,
`SportDisplayRegistry`), so option A is the low-risk path to multi-mode
extensibility without over-engineering. A future `clase con tutor` mode becomes a
new registered flow in the slot (`flow.type === 'clase'`), added without touching
the tournament flow or club billing.

---

## 7. Persistence — performance and problem review

> Evaluated against the current implementation (`StateStore` +
> `CourtManager.persistState`). This is the highest-risk area of the change.

### How it works today

- Single JSON file `data/rallyos-state.json` (v3 schema:
  `{ version, savedAt, tournamentCourts[], clubCourts[], bracket? }`).
- **Atomic write**: write `tmp` then `rename` (`StateStore.save`).
- **Trailing debounce**: `CourtManager` re-arms a single 600 ms timer per
  mutation; one write per burst (`schedulePersist`). Timer is `unref`'d.
- **Synchronous `writeFileSync` + `renameSync`** on the event loop.
- `flush()` on graceful shutdown and on discrete lifecycle events (delete, PIN
  regen).
- `persistState()` only persists LIVE/FINISHED tournament and OCCUPIED/FINISHED
  club courts (not idle courts).
- Bracket carried via an in-memory cache to avoid re-reading the whole file per
  point (P2).

### Performance characteristics relevant to the new model

1. **Write cost scales with the whole file.** `save()` serializes the *entire*
   persisted document on every write (JSON.stringify + atomic rename). With a
   modest inventory this is fine; the danger is unbounded growth of session
   history / score history inside the same document.
2. **Synchronous I/O on a single-threaded event loop — the "two writers" problem
   (R2).** Two different parts of the server write the SAME file
   `rallyos-state.json`:
   - `CourtManager.persistState` — triggered on **point bursts** (every point
     re-arms a 600 ms debounce) and writes its view of the whole document.
   - `BracketHandler.setBracket` — triggered on bracket changes and writes the
     whole document too, carrying its bracket.
   Each write is "read the whole file → change your slice → write the whole
   file". The **torn-write risk**: two such write transactions can interleave —
   writer A reads, writer B reads, writer A writes its whole version, writer B
   writes its whole version → **one of the two changes is silently lost** because
   each overwrote the other's slice with a stale copy. Node's single thread avoids
   true byte-level corruption, but NOT the lost-update of a last-writer-wins whole
   file. The codebase calls this "extremely unlikely on the single-owner RPi" —
   that's a hope, not a guarantee. The fix is a **single writer coordinator**: one
   queue that owns every write to the live-state file and re-serializes the full
   document from an in-memory source of truth at flush time, so both sources'
   changes land in ONE atomic write instead of two competing ones.
3. **Debounce means potential loss on crash-hard.** Any points inside the 600 ms
   window between the last mutation and the debounced write are lost on abrupt
   power loss (mitigated only by `flush()` on *graceful* shutdown). This is
   already true today, but the new model adds an **inventory write** whose loss
   semantics matter more (catalog drift vs. a few points).
4. **Single-file coupling of inventory + transient sessions + bracket.** The new
   model wants the inventory to be durable and authoritative, but writes are
   triggered by *any* session mutation. A session point burst would rewrite the
   inventory file, and an inventory change would rewrite all live sessions.

### Problems this change must solve (or consciously accept)

| # | Risk | Severity | Mitigation for the design |
|---|---|---|---|
| R1 | **Write amplification**: every point rewrites the whole document including inventory + all sessions | Medium | Decouple inventory file from session file (inventory = low-frequency admin writes; sessions = high-frequency debounced). Separate `CourtInventoryStore` from `StateStore`. |
| R2 | **Torn write between two writers** (CourtManager vs BracketHandler) on the same file | High | Route all writes through a **single atomic writer/coordinator** (the codebase already flags this as a future revision — the new model should ship it, not defer). |
| R3 | **History unbounded in one file** → file grows, every write gets slower | Medium/High | Bound score/session history (already `slice(-MAX_HISTORY_LENGTH)`), and **move session history to its own store** (`SessionHistoryStore` already exists separately). Keep the live-state file bounded and append-only history elsewhere. |
| R4 | **Loss window on crash** (600 ms debounce) | Medium (accepted today) | Keep debounce for sessions; **persist inventory synchronously + immediately** on admin mutations (low frequency, high value). Inventory mutations should be **synchronous add/write**, not debounced. |
| R5 | **Cold start / migration** of existing persisted tournament and club courts into the inventory | **Resolved / removed** | **This is not yet a commercial product** (user decision) — the persistence layer can be **wiped on upgrade, so existing data never conflicts with THIS development**. No v3→v4 data migration is needed now: start the inventory from a fresh catalog. A real migration (E1/dedupe) is deferred to when the product ships to users with live data. |
| R6 | **Single file = single point of corruption** | Medium | Keep atomic tmp+rename; add backup/rotation (already have `archive()`). Consider a checksum or version-marker per document. |
| R7 | **Availability derived from inventory changes validity of in-flight flows** | Medium | The admin holds the **general stop control** (`INVENTORY_FORCE_END`): a session that must end on demand is force-ended and the court freed (→ `IDLE`). This mirrors existing `CLUB_FORCE_END` `adminId` traceability but **extends to any mode** (club OR tournament). So a `BUSY`/`HELD` court is never deadlocked — the admin can always end the session first, then archive/maintenance becomes allowed. Archive itself stays guarded: block archive while `BUSY` (live) or `HELD` (open booking) **until** the admin force-ends it. |

### Recommended persistence shape (new model)

```
CourtInventoryStore   → data/court-inventory.json   (admin-owned, ACTIVE/MAINTENANCE/ARCHIVED, durable)
   — synchronous write on admin mutation (no debounce), low frequency
   — stable courtId, display name separate; monotonic numbers (no reuse)

StateStore (v4)       → data/rallyos-state.json      (transient LIVE sessions: tournament + club OCCUPIED/FINISHED)
   — trailing-debounced as today, high frequency
   — single atomic writer coordinator for bracket + courts (fixes R2)

SessionHistoryStore   → data/session-history/…      (append-only, already exists)
   — long-lived records; bounded live-state file (R3)
```

This keeps **inventory authoritative and low-frequency** (not rewritten on every
point), **live sessions transient and debounced** (fast), and **history
append-only** (durable, off the critical live-state file).

### Open items for the migration task

> Updated: **no v3→v4 data migration is NEEDED for this development** — the
> persistence layer is wiped on upgrade (not a commercial product yet), so the
> catalog starts fresh and nothing orphans. The items below therefore reduce to:

- **Drop / ignore existing persisted courts** — since data is reset, the old
  `tournamentCourts` / `clubCourts` arrays are simply not carried over; the new
  inventory starts empty and the admin builds the catalog. (WAITING/CONFIGURING
  courts and legacy `CLUB_CREATE_COURT` courts are moot — all gone.)
- Rename `getNextTableNumber()` → sport-agnostic counter and enforce **no
  number reuse** post-archive (display/identity correctness).
- Rewrite/remove `CREATE_COURT`/`DELETE_COURT`-dependent tests and e2e
  (`bracketCourtFlow.spec`, owner dashboard, `security.spec`) against the new
  inventory picker.
- Collapse `TournamentCourt`/`ClubCourt` → `CourtRecord` + active flow slot;
  deduplicate merged courts by `courtId`/`number` **if / when a real migration
  lands** (deferred to commercial launch, not now).
- Define `availabilityOf()` as a pure derived function (no stored availability).
- Decide cold-start copy/flow in the owner UI when inventory is empty
  (deferred — see section 3).

---

## 8. Risks / anti-patterns summary

- **Enum+switch instead of rule engine** — the single biggest risk; kills
  the extensibility promise of Option A. Must ship `FlowModeRegistry` (rule
  engine) from day one.
- **Mixing the three axes** into one state machine — re-introduces the exact
  validity problem we are trying to remove.
- **Hard-delete of used courts** — breaks session-history/cost referential
  integrity.
- **Write amplification / multi-writer torn writes** in persistence — must be
  addressed as part of the inventory decoupling, not after.

---

## 9. Next steps

1. Formalize as an SDD exploration/proposal with work-unit partitioning once the
   current `terminologia-deporte` SDD is archived.
2. Recommended work-unit slicing:
   - Inventory domain + `CourtInventoryStore` (v4) — **no migration: fresh
     catalog** (persistence wiped; dedupe/migration deferred to commercial
     launch).
   - `getNextTableNumber` → sport-agnostic counter + no-number-reuse rule.
   - **`FlowModeRegistry` rule engine** (flow contract per mode) + refactor
     `CourtManager` branches into contract methods.
   - Admin inventory UI (`useCourtInventory`).
   - **Admin force-end** (`INVENTORY_FORCE_END`, general stop control).
   - Owner tournament picker + cold-start copy (provisional).
   - Tournament release (`releaseAll()` on tournament end/reset).
   - Club occupy refactor; remove ad-hoc create.
   - Rewrite/remove `CREATE_COURT`/`DELETE_COURT`-dependent tests/e2e (unit +
     `security.spec` + `bracketCourtFlow.spec`).
   - **Single-writer persistence coordinator** (fixes R2 — a distinct,
     risk-bearing work unit, not a footnote) + history offload.
   - **Update `docs/casos-de-uso.md`** (affected CUs + new inventory/picker/force-end
     CUs) and regenerate the E2E coverage matrix (see section 12).

---

## 10. What's next (post-development): minimal future court booking

> Deliberately scoped AFTER the inventory + session-mode work ships. Booking in
> this product must stay **minimal**: it is a *future-use register*, not a
> calendar/scheduling system.

### Scope (what it is)

A booking is simply a record that **a court will be used in the future by a
person**. It is a forward-looking note on an inventory court:

- **Booked**: `court X reserved for person P at datetime D`.
- **Completed**: if P actually shows up at that day/time, the booking is
  marked complete — and that's it. The real occupancy/session then starts
  through the normal live flow (the person occupies the court as usual).

### What it is NOT

- No duration slots, no overlap detection, no recurring bookings, no calendar
  UI, no timezone logic, no auto-start at D, no no-show enforcement. All of
  that is out of scope by design.

### Where it sits in the model

Booking is a **4th axis — SCHEDULING (future plan)** above the inventory,
distinct from the three live axes:

```
INVENTORY    (exists)         admin-owned, durable
AVAILABILITY (occupied now)   runtime IDLE / BUSY / HELD   ← live, "now"
FLOW         (what happens)   tournament | free | match    ← live, "now"
SCHEDULING   (future plan)    BOOKED → COMPLETED | CANCELLED   ← future note
```

Key properties to preserve:

- A booking **only ever references an inventory court** (same strict source of
  truth — no ghost bookings).
- A booking does **not** set `AVAILABILITY` to `BUSY` in the present — it is a
  future note; the live flow decides `BUSY` when the time comes. An **open
  booking renders the court `HELD`** (the general-booking hold): it blocks admin
  archive (R7) and prevents double-booking, but the court is still usable by a
  live session until the booking's datetime arrives.
- Booking is **mode-agnostic**: the record stores the person + court + datetime,
  not a session contract. When the person arrives, the normal flow creates the
  session (`free` / `match` / `clase` ...) — no coupling to `FlowModeRegistry`.
- Referential integrity extends naturally: an admin cannot archive/remove a
  court that has an open future booking (mirror of the R7 `BUSY`/`HELD` rule).

### Minimal shape (design sketch, not a contract)

```
BookingRecord {
  id: string;
  courtId: string;      // inventory court id (stable)
  personName: string;
  startAt: number;      // expected arrival datetime
  status: 'BOOKED' | 'COMPLETED' | 'CANCELLED';
  createdAt: number;
}
```

- Stored in its own low-frequency store (`data/bookings.json` or append-only),
  **not** in the live `StateStore` — keeps the live-state file bounded (R3).
- UI: a small "upcoming bookings" list per court in the admin inventory view;
  mark COMPLETED when the person arrives, CANCELLED otherwise.

### When to revisit

Only if product feedback shows people need real time-slot booking (conflicts,
recurrence, calendar). At that point the minimal register evolves into a proper
scheduling layer — but that is a **separate, much larger** effort and should
not be pre-built now.

---

## 11. Edge cases & decisions (review pass)

> Added after a critical self-review pass. Each item records whether it is
> **decided** or **open** so nothing is lost when the change becomes an SDD
> proposal.

| # | Edge case | Decision |
|---|---|---|
| E1 | **Migration must seed inventory from USED courts too** (LIVE/FINISHED tournament + OCCUPIED/FINISHED club), so existing session history and cost keep mapping to a real court | ✅ Decided (superseded) — **no data migration in this development**: persistence is wiped on upgrade (not yet commercial), so the catalog starts fresh and nothing orphans. The seed/dedupe rule stays in the doc as the *future* commercial-launch migration |
| E2 | **Stable identity is `courtId`, not `tableId`** — `tableId` is table-tennis-loaded; codebase already uses `courtId` (handlers, `BracketEngine.assignCourt`) | ✅ Decided — adopt `courtId` uniformly (incl. booking record) |
| E3 | **`getNextTableNumber()` is TT-biased → sport-agnostic counter** | ✅ Decided — rename; treat court number as display identity, **no reuse** after archive |
| E4 | **Tournament retention** — a tournament holds a court across rounds, not at an instant. Does continuous `BUSY` solve it? | ✅ Decided (simplified) — **tournament does NOT use `HELD`**. Tournament courts are live `BUSY` only; **when the tournament ends, all tournament courts are released**. `HELD` is reserved for general future booking (section 10) |
| E5 | **Roles** — who may mutate inventory vs run tournament vs occupy | ✅ Decided — admin mutates inventory (`validateClubAdmin`); owner runs tournament (SELECT); admin or player-with-PIN occupies; **owner tournament depends on admin-configured inventory** (strict cold-start) |
| E6 | **Removing `CREATE_COURT` is a breaking change** — `bracketCourtFlow.spec` + owner dashboard create courts ad-hoc | ✅ Decided — remove/rewrite the affected tests/e2e as part of this work |
| E7 | **History keyed by `courtId` (stable), not name** — rename must not detach history | ✅ Decided — history references stable `courtId` + display-name snapshot |
| E8 | **Future booking** — minimal register; must not set present availability; references `courtId` | ✅ Decided (section 10) |
| E9 | **Sport change drift** (rename vs club sport change, MP-2) | ✅ Decided — impossible by construction: `courtId` is sport-agnostic identity, so changing sport never detaches history; number is display-only |
| E10 | **Booking completion + session start not transactional across files** | 🟡 Deferred — accepted; annotate in persistence design |
| E11 | **One physical court can switch modes over its life** — `TournamentCourt`/`ClubCourt` are distinct types today; a physical court must be ONE entity | ✅ Decided — collapse into `CourtRecord` (mode-agnostic identity) + one active flow slot; `kind` derived from active flow; dedupe merged courts by `courtId`/`number` on migration |
| E12 | **AVAILABILITY projection from FLOW** — how FLOW states map to IDLE/BUSY/HELD | ✅ Decided (improved) — availability is a **pure derived function** `availabilityOf(court)`, not a stored axis; consistent by construction, cannot drift. `BUSY`↔club `OCCUPIED` or tournament match live; `HELD`↔open future booking only |
| E13 | **Dead existence-mutation code + rules target** — `DELETE_COURT`, `MAX_COURTS`, CREATE rate-limit were tournament/owner existence defenses | ✅ Decided — tournament can never mutate existence. `DELETE_COURT` removed (archive only); `MAX_COURTS` cap + create/delete rate-limit **dropped** (admin is a single authed, trusted actor; the rules no longer apply) |
| E14 | **Use-case doc + test matrix impact** — `docs/casos-de-uso.md` CUs and the unit/integration/e2e suites must be updated when events/semantics change (per the doc's Update Protocol) | ✅ Decided — see section 12 |

---

## 12. Use-case & test impact

> Every change that **removes socket events or changes creation semantics** must
> update `docs/casos-de-uso.md` (its Update Protocol requires CU changes at end
> of each phase, verified with Playwright) plus the matching test suites. This
> section is the impact checklist for THIS change.

### 12.1 Affected use cases (`docs/casos-de-uso.md`)

| CU | Current | Impact | Action |
|---|---|---|---|
| **CU-OWNER-01** (manage courts: create/clean/delete) | Uses `CREATE_COURT`, `DELETE_COURT` | Events removed; owner no longer creates/deletes courts | Rewrite: owner only **picks inventory courts** (`TOURNAMENT_SELECT_TABLE`); create/delete move to admin inventory |
| **CU-CLUBADMIN-02** (create court: FAB "Cancha") | Uses `CLUB_CREATE_COURT` | Event removed; creation moves to inventory | Rewrite → `INVENTORY_ADD` + admin inventory UI |
| **CU-CLUBADMIN-04** (deactivate/reset/delete by status) | Uses `CLUB_DELETE_COURT` | Hard delete removed; archive-only | Rewrite delete → `INVENTORY_ARCHIVE` with BUSY/HELD guard (R7) |
| **CU-CLUBADMIN-03/05/06** (activate / force-end / occupy) | Target a created court | Court comes from inventory; flow same | Update wording only (source of court) |
| **CU-OWNER-02 / CU-BRACKET-01** (assign court) | `BRACKET_ASSIGN_COURT` | Bracket court must be an inventory court (SELECT → live `BUSY`) | Update: validation requires inventory court; blocked when not ACTIVE |
| **CU-REFEREE-01 / CU-SPECTATOR-01** (list courts) | `LIST_COURTS` | List comes from inventory ACTIVE | Update wording only (no CREATE path remains) |
| New — Admin inventory | — | New surface | **Add** `CU-*` (add/rename/maintenance/archive; BUSY/HELD guards; no-delete copy) |
| New — Admin force-end (stop any session) | — | New surface | **Add** `CU-*` (admin ends a `BUSY` session on demand to free a court; `adminId` traceability; extends `CLUB_FORCE_END` to any mode) |
| New — Owner tournament picker | — | New flow | **Add** `CU-*` (picker from ACTIVE; empty-state cold-start copy) |

### 12.2 Test impact

| Layer | Suite | Impact |
|---|---|---|
| **Server unit** | `courtManager.test.ts`, `courtManager.test-factory.test.ts` | `createCourt`/`createClubCourt`/`deleteCourt`/`deleteClubCourt` tests rewritten around `CourtRecord` + flow slot; add `availabilityOf()` + inventory guard tests |
| **Server unit** | `ClubCourtHandler.test.ts`, `ClubAdminHandler.test.ts`, `SocketHandler.test.ts` | Event-level tests for `CLUB_CREATE_COURT`/`CLUB_DELETE_COURT` removed/rewritten to `INVENTORY_*`; occupy/activate target inventory courts |
| **Server unit** | `CourtEventHandler.test.ts` | `CREATE_COURT`/`DELETE_COURT` tests removed; new `TOURNAMENT_SELECT_TABLE` tests |
| **Server unit** | `persistence-types` / `StateStore.test.ts` / `migration.test.ts` | **No v3→v4 data migration in this phase** (persistence wiped). Migration/dedupe tests deferred to future commercial-launch migration; `StateStore` tests updated to the v4 single-writer coordinator + new shape |
| **Server integration** | `server/tests/security.spec.ts` | Uses `CREATE_COURT`/`DELETE_COURT` (rate-limit, ref-promotion) — must be rewritten against inventory semantics + admin-scoped limits |
| **Server e2e** | `server/tests/bracketCourtFlow.spec.ts` | Entirely built on `CREATE_COURT`/`DELETE_COURT` ad-hoc courts — **rewrite against inventory picker**, or remove |
| **Server e2e** | `server/tests/handicap.spec.ts` | Uses `manager.createCourt` at unit level — update to `CourtRecord` + flow |
| **Client unit** | `useCourtManagement` / `useClubCourtManagement` tests | Replaced by `useCourtInventory` tests (admin + owner picker) |
| **Client e2e** | `client/tests/e2e/club-mode.spec.ts`, `club-free-mode.spec.ts` | Club flow unchanged in essence, but creation path gone; update setup steps + assertions to inventory |
| **Client e2e** | `client/tests/e2e/dashboard.spec.ts`, `auth.spec.ts`, `scoreboard.spec.ts`, `player-identity.spec.ts` | Re-check: owner dashboard no longer creates courts; bracket/owner flows reference inventory |

### 12.3 E2E coverage matrix note

`docs/casos-de-uso.md` keeps a living E2E coverage matrix (57 passed / 3 skipped,
verified 2026-08-03). After this change the matrix **must** be regenerated:
removed CU rows are marked `[removed]` with the reason (per Update Protocol), new
inventory/picker CUs added, and each affected spec's status updated after the
Playwright run.