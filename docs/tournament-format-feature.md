# Feature Refinement: Multi-Tournament + Optional Group Phase

> **Status**: DRAFT — working document for refining the feature before formal SDD planning.
> **Owner**: rallyOS-hub product + architecture discussion.
> **Related**: `docs/admin-court-inventory-architecture.md` (in-flight SDD that this feature builds on).

---

## 1. Problem Statement

The hub currently runs **exactly one tournament at a time** and the tournament engine is
**pure single-elimination** (`BracketEngine` → `log2(numSlots)` knockout rounds, manual
seeding, max 32 slots). Two gaps:

1. **Multiple tournaments**: a club can only ever have the one live tournament; there is no
   notion of a tournament entity with identity/history/catalog (no `Tournament.id`,
   `ownerId`, `status` — the bracket is a global singleton).
2. **No group phase**: organizers cannot run a round-robin group stage before the knockout
   bracket. Some tournaments are direct knockout; some need groups first (e.g. many
   entries → groups → qualifiers → knockout).

---

## 2. Business Rules (locked)

| # | Rule | Source |
|---|---|---|
| BR-1 | **A club runs ONE active tournament at a time.** This is the business rule. | User |
| BR-2 | One organizer can own **N tournaments** (catalog), but only one is `ACTIVE` at any time; the rest are `SETUP`/`ARCHIVED`. | User |
| BR-3 | Group phase is **optional per tournament** — direct knockout stays fully supported. | User |
| BR-4 | After the group stage, qualifier seeding into the knockout is **MANUAL** (organizer places qualifiers by hand; may rearrange for reasons outside this system). Automatic seeding is a **future, request-driven improvement** (see D3). | User (amended by D3) |
| BR-5 | **Booking is out of scope** (deferred). Because of BR-1 there are no simultaneous tournaments fighting over courts. | User |

---

## 3. Current State (verified against code)

- `BracketEngine` is a **singleton per process** (`server/src/handlers/BracketHandler.ts:46`),
  holding one `TournamentBracket | null`.
- `TournamentBracket` (`shared/types.ts:103-111`): `{ name, numSlots, includeThirdPlace, matches, thirdPlaceMatch, status, createdAt }` — `name` is only a display label, **no id, no owner**.
- Persistence: single `bracket` field in `PersistedStateV3` (`server/src/domain/ports/persistence-types.ts:128`), `PERSISTENCE_VERSION = 4` (`server/src/services/store/types.ts:40`).
- `POST /api/tournament/new|finish` clears ALL state; `BracketHandler.onCreate` replaces any existing bracket.
- Owner auth: single global PIN + JWT `sub: 'owner'` (fixed), `role: 'tournament_owner'`.
- `BracketEngine` is pure knockout: rounds from `Math.log2(numSlots)`, manual seeding
  (`assignPlayer`), winner advances `floor(position/2)` → next round.
- Court cap: `MAX_COURTS` default 50 (in-flight inventory work is changing the court model).

---

## 4. Decisions (locked)

| # | Decision | Lock |
|---|---|---|
| D1 | **Catalog model (Variant B)**: entity `Tournament { id, name, ownerId, format, status }` + persisted collection. One `ACTIVE` per club; live `BracketEngine` stays singleton. | ✅ |
| D2 | **Format is optional per tournament**: `format.kind: 'knockout'` (current behavior unchanged) vs `'groups'` (round-robin group stage → standings → qualifiers → knockout of the SAME tournament). | ✅ |
| D3 | **Qualifier seeding: MANUAL (single mode for now)** — after the group stage, the organizer places qualified players into knockout slots by hand from a label/palette list of qualifiers (reuses today's `assignPlayer` interaction). **Automatic seeding is a FUTURE improvement, only if organizers request it.** | ✅ |
| D4 | **Booking deferred** — not part of this feature (BR-5). | ✅ |
| D5 | **Build on the in-flight inventory SDD** (`admin-court-inventory`): courts come from the admin inventory + `FlowModeRegistry`; never design against legacy ephemeral `tournamentCourts`. | ✅ |
| D6 | **Execution order**: do NOT start this feature until `admin-court-inventory` SDD closes (group stage needs many concurrent matches on inventory courts). | ✅ |
| D7 | **Group config baseline (first slice)**: 4 groups × 4 players, top 2 advance → 8-player knockout. Group numbers/configurable per tournament; this is the default + initial scope. | ✅ |
| D8 | **Standings tie-break order**: set difference → game difference → if still tied, organizer resolves manually (no head-to-head factor). | ✅ |
| D9 | **Post-finish retention**: catalog keeps tournament **identity + podium** (winner/runner-up/third); `format`/`status` records. Design so it can **scale later to a full bracket snapshot** (future evolution, not a blocker). | ✅ |
| D10 | **Tournament history UI is DEFERRED** (out of scope for this feature): catalog is structural-only for now; no list/select of past tournaments, no podium display, no history navigation. | ✅ |
| D11 | **Qualifier placement UX (manual mode)**: a dropdown/palette list of group-stage qualifiers; the organizer assigns each to a knockout slot by hand (reuses `assignPlayer` interaction). Automatic seeding is a future request-driven improvement. | ✅ |
| D12 | **Ownership boundary (security)**: every tournament mutation must verify the caller owns the `Tournament.ownerId` (not just "is owner" of the hub) — extends the existing `guardOwner`/`validateClubAdmin` pattern. | ✅ |
| D13 | **Group config strict validation**: `numGroups`/`groupSize`/`topN` bounded and typed via const-enum/discriminants (same pattern as `VALID_BRACKET_SLOTS`); no unbounded numeric input. | ✅ |
| D14 | **Qualifier uniqueness**: manual slot assignment must reject placing the same qualifier in two slots (extend the existing court→match uniqueness guard). | ✅ |
| D15 | **Standings & tie-break pure**: ranking computed deterministically and reversibly (set diff → game diff → manual); never mutates data mid-transition; reproducible for audit. | ✅ |
| D16 | **Separate tournament persistence** (`data/tournaments.json`, v1, greenfield): tournament catalog + ACTIVE bracket live in their own file, decoupled from club state. FIXES current bug where `POST /new|/finish` `stateStore.clear()` wipes the WHOLE state file incl. club data. MUST be written through the single-writer coordinator (inventory slice 6), never as an independent 3rd writer. State file stays v4 (bracket field removed via wipe window — no v5 bump needed for state file; tournaments.json gets v1). | ✅ |
| D17 | **Finish with LIVE matches = auto-end**: finishing a tournament force-ends any in-progress matches atomically (releaseAll + force-end flow → IDLE), completes the tournament and keeps the podium. No forced sequential closing by the organizer. | ✅ |
| D18 | **SETUP tournament can be closed**: finishing a `SETUP` (never-started) tournament is allowed — it produces no podium (empty), leaves no orphan bracket. | ✅ |
| D19 | **Stable participant ID (not name-string)**: introduce an internal `participantId` per player from the start (in addition to display name), because future player registration in the system will require ids anyway. `BracketMatch.playerA/playerB` move from `string` (name) to participant identity. **Scope impact: inflates first slice** (touches `BracketMatch`, `assignPlayer`, persistence, tests, e2e) — but avoids a structural migration later. | ✅ |
| D20 | **participantId scope = per-tournament + scalable shape**: id is generated per-tournament (assigned when the player joins that tournament) — NO global PlayerRegistry now. BUT the player field in `BracketMatch` is shaped to scale: `{ participantId, displayName, tournamentId }` (tournamentId present even if redundant within one tournament), so when a future PlayerRegistry arrives only the *source* of the id changes, not the bracket model. No player CRUD / persistence / UI — stays in slice 1. | ✅ |
| D21 | **Hub owner model = mono-organizer**: a hub has exactly ONE owner (as today: single owner PIN, JWT `sub: 'owner'` fixed). `Tournament.ownerId` is always `'owner'` → D12 ownership check exists by contract/shape but does NOT require multi-tenant auth. Multi-organizer hub is explicitly out of scope (see §6d). | ✅ |
| D22 | **Duplicate display names = allow + auto-disambiguate in UI**: two players with the same `displayName` in the same tournament ARE allowed (D19/D20 ids distinguish them internally), but the UI renders disambiguation context (e.g. `Juan (Grupo A)`, `Juan #2`). Organizers are NOT forced to enter unique display names. Adds UI work in slice 1 (standings/bracket/scoreboard rendering). | ✅ |

---

## 5. Open Questions / Evaluation Notes

> Track open product/technical questions here as we refine. Answered → move to Decisions.

- [x] **Q-G1**: What is the max group size / number of groups for the first slice? → **4 groups × 4 (16 players), top 2 advance → 8-player knockout. Configurable per tournament.** ✅ (D7)
- [x] **Q-G2**: Tie-break rules for standings → **set difference → game difference → manual resolution if still tied** (no head-to-head). ✅ (D8)
- [x] **Q-M1**: Does a tournament keep its catalog entry after finishing? → **Yes: identity + podium (winner/runner-up/third), designed to scale later to full snapshot.** ✅ (D9)
- [x] **Q-M2**: Does the organizer need to see past tournaments in UI? → **No, deferred entirely** (catalog structural-only; no history UI). ✅ (D10)
- [x] **Q-S1**: Manual seeding after groups — **organizer places qualified players into slots by hand from a dropdown/palette of group-stage qualifiers; automatic seeding deferred as a future request-driven improvement.** ✅ (D3, D11)

> **All open questions CLOSED (5/5).** Edge-case resolutions: EC-C2 → D17 (auto-end LIVE on finish), EC-C3 → D18 (SETUP closable, empty podium), EC-G7 → D19/D22 (stable participant id + auto-disambiguate display). Persistence separation → D16 (✅). Product questions D20 (participantId scope), D21 (mono-organizer), D22 (duplicate names) → all CLOSED (22 decisions total).


---

## 6. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Breaking persistence (bracket moves out of v4 state file) | Med | Wipe window still open (no live data); state file stays v4 via wipe, tournaments.json is v1 greenfield — no migration (see D16). |
| Engine scope creep (groups + seeding + catalog + participant id at once) | High | Chained slices; knockout-only is zero-risk baseline. D19 participant id inflates slice 1 — slice it early. |
| Coupling with in-flight inventory SDD | Med | D5/D6: sequence after inventory closes |
| Manual-seeding UX complexity | Med | Reuse existing `BracketView` interaction patterns |
| D19 participantId scope creep (global registry creep) | Med | Decide per-tournament vs global in D20; defer player registry to a separate feature. |
| Multi-organizer auth if hub becomes multi-owner | Low (today) | Today hub is single-owner (`sub: 'owner'` fixed); ownerId trivial now. If multi-owner opens later, D12 needs real auth — tracked as EC-S1. |

## 6b. Quality Evaluation (maintainability / scalability / security)

| Aspect | Verdict | Key point |
|---|---|---|
| Maintainability | ✅ Good | Format-stage registry pattern (precedent: `SportRegistry`); build on inventory (D5); singleton engine preserved (BR-1). Watch point: groups→knockout transition isolated in one module + tests. |
| Scalability | ✅ Adequate | BR-1 (one ACTIVE) removes the hard concurrency/court-sharing problem; real ceiling is court count (`MAX_COURTS` ~50), not the engine — groups queue on courts. Catalog growth is light (identity+podium only, D9/D10); snapshot evolution (D3) needs archiving later. |
| Security | ✅ Viable, one watch item | D12 ownership boundary (`Tournament.ownerId` check on all mutations); D13 strict group-config validation; D14 qualifier slot uniqueness; D15 pure/reversible tie-break + standings. No sensitive data exposure beyond existing player names. |

---

## 6c. Edge Case Evaluation (expert)

### Catalog / tournament lifecycle
- **EC-C1** Creating a 2nd tournament while one is ACTIVE → BR-1: reject ACTIVE, but allow `SETUP`/`ARCHIVED` entries to be created (catalog with only one ACTIVE).
- **EC-C2** Finish while group/bracket matches are still LIVE → **auto-end (D17)**: finish force-ends live matches atomically (releaseAll + force-end → IDLE), keeps podium. ✅
- **EC-C3** Finish a `SETUP` (never-started) tournament → **allowed (D18)**: empty podium, no orphan bracket. ✅
- **EC-C4** Identity: ids are generated (not names) — duplicate names allowed, id is canonical.
- **EC-C5** Crash mid-tournament → boot restores catalog+bracket from `tournaments.json` and flows from v4 separately; reconcile bracket court refs against inventory (missing court → clear binding, heal).
- **EC-C6** Empty catalog + owner opens dashboard → new "create tournament" empty state (today: `bracket === null` → create form).

### Group phase
- **EC-G1** Uneven groups (e.g. 15 players → 4/4/4/3) → 3-player group allowed; round-robin bye round for odd counts.
- **EC-G2** Set/game detail MUST be recorded per match for D8 tie-break (`Score.detailScore`) — verify match flow persists it; if missing, tie-break is impossible → hard requirement.
- **EC-G3** Full points tie unresolved after set/game diff → manual resolution (D8); **guard: knockout cannot advance until standings are resolved** (organizer cannot skip).
- **EC-G4** Manual seeding (D3/D11): same qualifier into two slots → **reject (D14)**; empty slots at KO start → reject start with missing slots (today requires `assignPlayer`).
- **EC-G5** Qualified count vs KO size must map to valid slots (4/8/16/32) — e.g. top2×4=8 ✓; top3×4=12 → needs 16-slot KO with byes. Validate at group-config time.
- **EC-G6** Editing/undoing a group match AFTER seeding started → standings change → qualifiers change → cascade invalidation of KO. **Guard: lock group results once seeding begins** (mirror `undoMatch` cascade rules).
- **EC-G7** Duplicate player names across groups ("Juan" twice) → **resolved by D19**: stable `participantId` distinguishes them; display-name policy answered in D20. ✅

### Persistence / consistency
- **EC-P1** Torn write between `tournaments.json` (bracket structure) and v4 (live flows) → single-writer coordinator flush + boot reconciliation (see §5 condition).
- **EC-P2** Mixed sync/debounce on the SAME file: catalog create/finish should be sync; bracket mutations are debounced (2s today) → ordering hazard (create → immediate finish before flush). Unify policy per file.
- **EC-P3** Existing `data/archive/torneo-*.json` vs new catalog podium → redundancy decision: does archive stay (full snapshot) while catalog keeps identity+podium (D9)? Keep archive files; catalog is the query surface.

### Security (extends D12–D15)
- **EC-S1** Cross-owner mutation: non-owner (or another club_admin) token mutating tournament data → D12 ownership check on every mutation.
- **EC-S2** Group config validation bounds: `numGroups`, `groupSize`, `topN`; `topN × numGroups` must be a valid KO size (EC-G5) — reject otherwise.
- **EC-S3** `tournamentId` in every bracket event payload validated against the ACTIVE tournament (replay/foreign-id rejection).

---

## 6d. Out of Scope (consolidated)

| Item | Where locked | Notes |
|---|---|---|
| Court booking / `HELD` / scheduling | D4 / BR-5 | Deferred; BR-1 (one ACTIVE) means no cross-tournament court conflict for now |
| Automatic qualifier seeding (groups → KO) | D3 / D11 | Future, request-driven improvement; manual only in slice 1 |
| Tournament history UI (list/podium display/navigation) | D10 | Catalog is structural-only; UI deferred entirely |
| Full bracket snapshot retention | D9 | Identity + podium now; full snapshot is a future evolution (scale later) |
| Player self-registration / global player registry | D20 | Per-tournament id now; global registry is a separate future feature |
| Multi-organizer hub (multi-tenant auth) | D21 | Hub is mono-organizer; multi-owner auth explicitly deferred |
| Forced unique display names | D22 | Duplicates allowed; auto-disambiguate in UI instead |

---

## 7. Next Steps

1. ~~Close open questions (§5)~~ — ✅ ALL CLOSED (D1–D22, 5/5 questions + 3 product decisions).
2. Formal SDD planning in a separate session: `sdd-explore` → `sdd-propose` → ... This feature waits for `admin-court-inventory` SDD to close (D6).
