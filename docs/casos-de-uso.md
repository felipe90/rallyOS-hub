# rallyOS-hub — Use Cases (CU)

> **Living document.** Reference for the implemented use cases.
> Updated at the end of each development phase/cycle (see [Update Protocol](#update-protocol)).

## How to read this document

- Each CU describes **one user-facing, verifiable functionality** (not technical tasks).
- Format: `CU-{AREA}-{NN} — description`, with the routes, components, and socket events that implement it.
- Quoted strings are the **current** ones from `client/src/i18n/locales/es.json` (verified against code).
- The CU → e2e test mapping lives in the [E2E coverage matrix](#e2e-coverage-matrix).

---

## 1. Authentication (`/auth`)

| CU | Description | Destination route | Events |
|---|---|---|---|
| **CU-AUTH-01** | Choose role. Selection screen: "Quiero jugar" CTA, "Torneo" divider, "Organizador" / "Árbitro" / "Espectador" buttons, "Administrar" footer + connection status | — | — |
| **CU-AUTH-02** | Referee login: click "Árbitro" → `login('referee')` | `/dashboard/referee` | — |
| **CU-AUTH-03** | Spectator login: click "Espectador" → `login('viewer')` | `/dashboard/spectator` | — |
| **CU-AUTH-04** | Owner login: click "Organizador" → 8-digit PIN → verification. No tournament → navigate straight to owner dashboard; tournament exists → resume modal | `/dashboard/owner` | C `VERIFY_OWNER` · S `OWNER_VERIFIED` |
| **CU-AUTH-05** | ~~Post-owner sport selection: "Tenis de Mesa" or "Pádel"~~ **[removed]** — sport selector deleted (sport-aware terminology change); club config (`ClubConfigStore.sport`) is the single source of truth, a bare tournament defaults to `tableTennis` (see `docs/technical-debt.md`) | `/dashboard/owner` | — |
| **CU-AUTH-06** | Club player: click "Quiero jugar" → court PIN (4 digits) → `CLUB_JOIN` | `/club/play/:courtId` | C `CLUB_JOIN` · S `CLUB_JOIN_RESULT` |
| **CU-AUTH-07** | "Administrar" link (club admin) | `/club/admin` | — |

### Current auth strings (es.json)

- Tagline: **"Jugá sin complicaciones"** (`authTagline`)
- Club CTA: **"Quiero jugar"** + **"Ingresá el PIN de tu cancha"** (`authClubPlay`, `authClubPlaySubtitle`)
- Roles: **"Organizador"** / **"Árbitro"** / **"Espectador"** (`authRoleOwner/Referee/Spectator`)
- Footer: **"Administrar"** (`authAdminClub`) · Status: **"Conectado" / "Desconectado"**
- Owner PIN: title **"Organizador"**, description **"Ingresá el PIN de Organizador del torneo"** (`authOwnerPinEnterPin`), 8-digit input placeholder `••••••••`, button **"Ingresar"**
- Club PIN: heading **"Jugar"**, description **"Ingresá el PIN de tu cancha"**, 4-digit input placeholder `••••`, button **"Ingresar"**

> ⚠️ `authEnterOwnerPin` = "Ingresa tu PIN de Organizador" (es.json:11) is **dead code** — the title ternary already covers all modes (AuthPage.tsx:217-221). It never renders.

### PIN lengths (real validation)

| PIN | Length | Rule |
|---|---|---|
| Tournament owner | exactly 8 | `/^\d{8}$/` (`shared/validation.ts`) · env `TOURNAMENT_OWNER_PIN=12345678` in `.env` |
| Table PIN (referee) | exactly 4 | `/^\d{4}$/` |
| Club court PIN (player) | exactly 4 | generated `randomInt(1000,9999)` (`PinService.ts`) |
| Club admin PIN | 6–8 | `/^\d{6,8}$/` · stored as scrypt hash (chosen at `/setup`) |

---

## 2. Owner / Tournament (`/dashboard/owner`)

| CU | Description | Events |
|---|---|---|
| **CU-OWNER-01** | Manage courts: grid with PINs + QR, clean (PIN regeneration), feature, notify kiosk, export CSV, finish tournament, auto-restore referee session. **[rewritten]** — create/delete removed: court existence is admin-only via the inventory (INVENTORY_*); the owner can no longer create or hard-delete courts | C `RESET_COURT`, `SET_FEATURED`, `SEND_NOTIFICATION`, `GET_COURTS_WITH_PINS`, `GET_ALL_HISTORY` · S `COURT_LIST_WITH_PINS`, `COURT_UPDATE`, `PIN_REGENERATED`, `QR_DATA`, `KIOSK_MODE` |
| **CU-OWNER-01b** | **[new]** Owner tournament picker: courts come from the ACTIVE inventory (same catalog/availability as the admin — D12); "TOURNAMENT_SELECT_TABLE { matchId, courtId }" binds a bracket match to a court (TCS-1); strict cold-start empty-state copy "No hay mesas disponibles. Configurá el inventario como admin para comenzar un torneo." when no ACTIVE court exists (TCS-4) | C `TOURNAMENT_SELECT_TABLE` · S `INVENTORY_UPDATED`, `BRACKET_STATE` |
| **CU-OWNER-02** | Manage bracket: create (4/8/16/32, optional 3rd place), assign player, set winner, assign court, undo result, 2-step reset. **[updated]** — a bracket court must be an inventory-ACTIVE court; SELECT is blocked when the court is MAINTENANCE / club RESERVED / live (BUSY) / already assigned | C `BRACKET_CREATE`, `BRACKET_ASSIGN_PLAYER`, `BRACKET_SET_WINNER`, `BRACKET_ASSIGN_COURT`, `TOURNAMENT_SELECT_TABLE`, `BRACKET_UNDO_MATCH`, `BRACKET_GET`, `BRACKET_RESET` · S `BRACKET_STATE`, `BRACKET_ERROR`, `BRACKET_RESET_CONFIRM` |
| **CU-OWNER-03** | Set remote kiosk mode: "Kiosko" / "Torneo" / "Bracket" | C `SET_KIOSK_MODE` · S `KIOSK_MODE` |

---

## 3. Referee (`/dashboard/referee`, `/scoreboard/:tableId/referee`)

| CU | Description | Events |
|---|---|---|
| **CU-REFEREE-01** | Pick a court and join as referee: courts WITHOUT visible PIN → tap → 4-digit `PinModal` → join. **[updated]** — the court list comes from the ACTIVE inventory (D11); tournament courts are materialized at SELECT time so the PIN exists | C `SET_REF`, `JOIN_COURT`, `LIST_COURTS`, `REQUEST_COURT_STATE` · S `COURT_LIST`, `REF_SET`, `REF_ROLE_CHECK_RESULT`, `COURT_UPDATE` |
| **CU-REFEREE-02** | Configure + start match: auto-opened "Configurar Partido" modal (Player A/B, "Mejor de", "Desventaja", teams) → `START_MATCH` | C `START_MATCH` (legacy `CONFIGURE_MATCH`) · S `MATCH_UPDATE`, `MATCH_WON`, `SET_WON`, `GAME_WON`, `DEUCE`, `TIEBREAK_START` |
| **CU-REFEREE-03** | Score/correct/undo/swap sides: tap scoreboard halves → `RECORD_POINT`; minus button → `SUBTRACT_POINT`; undo → `UNDO_LAST`; swap → `SWAP_SIDES`; set server → `SET_SERVER`; `HistoryDrawer`; winner dialog "¡Partido Finalizado! / Ganador: {{name}} / Continuar"; coachmark "Tocá cualquier lado del marcador para sumar un punto"; optional RallyTap BLE bridge | C `RECORD_POINT`, `SUBTRACT_POINT`, `UNDO_LAST`, `SWAP_SIDES`, `SET_SERVER` · S `MATCH_UPDATE`, `MATCH_WON` |
| **CU-REFEREE-04** | Referee revoked: `REF_REVOKED` (PIN regenerated / displaced) → "Árbitr@ removido" view → "Redirigiendo a sala de espera..." → `/dashboard/spectator` after 3s | S `REF_REVOKED` |

---

## 4. Spectator (`/dashboard/spectator`, `/scoreboard/:tableId/view`)

| CU | Description | Events |
|---|---|---|
| **CU-SPECTATOR-01** | View available courts: "Canchas Disponibles" list, empty state "No hay canchas disponibles / Intenta más tarde", card shows "Player A vs Player B" + "Tocá para spectar". **[updated]** — the list is the ACTIVE inventory catalog (D11), mode-agnostic | — |
| **CU-SPECTATOR-02** | Join as viewer and watch a read-only scoreboard (no edit controls, no config modal, no undo) | C `JOIN_COURT`, `GET_MATCH_STATE` · S `MATCH_UPDATE` |

---

## 5. Club Admin (`/club/admin`)

| CU | Description | Events |
|---|---|---|
| **CU-CLUBADMIN-01** | Verify admin PIN: 8-digit input `••••••••`, "Ingresar" button → `CLUB_VERIFY_ADMIN`; JWT session persisted and restored after reload (`CLUB_SESSION_RESTORED`); disconnect clears admin state | C `CLUB_VERIFY_ADMIN` · S `CLUB_ADMIN_VERIFIED`, `ERROR`, `CLUB_SESSION_RESTORED` |
| **CU-CLUBADMIN-02** | **[rewritten]** Add court to the inventory: FAB "Agregar Mesa/Cancha" → `INVENTORY_ADD` (counter-assigned number, sport-aware suggested name "Mesa N"/"Cancha N"); the court appears ACTIVE/Disponible. The old `CLUB_CREATE_COURT` create flow is **removed** (CE-1) | C `INVENTORY_ADD` · S `INVENTORY_UPDATED` |
| **CU-CLUBADMIN-02b** | **[new]** Rename / maintenance / archive inventory courts: display name over the stable courtId (`INVENTORY_RENAME`); ACTIVE↔MAINTENANCE gated on !BUSY (`INVENTORY_MAINTENANCE`); archive-not-delete with the no-delete copy "used courts are archived, never deleted" — ARCHIVE blocked while BUSY (`INVENTORY_ARCHIVE`, INV-5/R7); the catalog is the single source of truth (D3) | C `INVENTORY_RENAME`, `INVENTORY_MAINTENANCE`, `INVENTORY_ARCHIVE` · S `INVENTORY_UPDATED` |
| **CU-CLUBADMIN-03** | Activate court (generates 4-digit PIN): "Activar" on AVAILABLE → RESERVED, badge `PIN 3629` (no colon). **[updated]** — the court now comes from the inventory (materialized on first activate) | C `CLUB_ACTIVATE_COURT` · S `CLUB_COURT_ACTIVATED`, `CLUB_KIOSK_DATA` |
| **CU-CLUBADMIN-04** | **[rewritten — archive]** Deactivate / Reset by status; the hard DELETE path (`CLUB_DELETE_COURT`) is **removed** — used courts are archived via `INVENTORY_ARCHIVE` (blocked while BUSY; force-end first) | C `CLUB_DEACTIVATE_COURT`, `CLUB_RESET_COURT`, `INVENTORY_ARCHIVE` |
| **CU-CLUBADMIN-04b** | **[new]** Admin force-end (general stop control, R7/AFE-1): "Finalizar sesión" on a BUSY court ends ANY live session (club OCCUPIED or tournament LIVE) → IDLE, `adminId`-traceable; a tournament force-end unbinds the bracket match WITHOUT advancing it (AFE-2) | C `INVENTORY_FORCE_END` · S `INVENTORY_UPDATED`, `CLUB_KIOSK_DATA` |
| **CU-CLUBADMIN-05** | Force-end an OCCUPIED session: "Finalizar Sesión" → confirm "¿Finalizar esta sesión? La cancha se pondrá en FINISHED." **[updated]** — the court comes from the inventory; `INVENTORY_FORCE_END` (CU-CLUBADMIN-04b) is the cross-mode stop control | C `CLUB_FORCE_END` · S `CLUB_SESSION_ENDED` |
| **CU-CLUBADMIN-06** | Admin starts a session for a player (occupy): "Iniciar sesión — {{courtName}}" modal with name/phone/mode Libre-Partido; phone encrypted client-side. **[updated]** — occupies an inventory court (materialized on demand) | C `CLUB_ADMIN_OCCUPY` |
| **CU-CLUBADMIN-07** | Session history + phone reveal: table Cancha/Jugador/Duración/Costo/Fecha, "Ver teléfono" → modal with number (10s auto-dismiss); 2-step "Limpiar historial"; "Exportar CSV" (`/api/club/sessions/export`) | C `CLUB_REVEAL_PHONE`, `CLUB_CLEAR_HISTORY`, `CLUB_CLEAR_HISTORY_CONFIRM` · S `CLUB_SESSION_HISTORY`, `CLUB_REVEAL_PHONE_RESULT` |
| **CU-CLUBADMIN-08** | Kiosk mode + notifications: "Kiosko"/"Torneo" toggle; bell → `KioskNotificationModal` (type/message/duration/scope) | C `SET_KIOSK_MODE`, `CLUB_SEND_NOTIFICATION` · S `KIOSK_MODE`, `KIOSK_NOTIFICATION` |
| **CU-CLUBADMIN-09** | Feature a court for kiosk spotlight ("Destacar"/"Quitar Destacado") on OCCUPIED match-mode courts | C `SET_FEATURED` |

---

## 6. Club Player (`/club/play/:courtId`)

| CU | Description | Events |
|---|---|---|
| **CU-CLUBPLAY-01** | Join with court PIN (4 digits): `CLUB_JOIN` → court OCCUPIED + match auto-initialized; the joining socket becomes referee (displaced referee gets `REF_REVOKED`) | C `CLUB_JOIN` · S `CLUB_JOIN_RESULT`, `REF_REVOKED` |
| **CU-CLUBPLAY-02** | Session config: name ("Tu nombre (opcional)") + phone + mode (Libre/Match); **"Comenzar" enabled ONLY with name + phone + mode**; phone encrypted AES-256-GCM client-side | — |
| **CU-CLUBPLAY-03** | Free mode: MM:SS timer, "🟢 En cancha — Modo Libre" badge, "🏆 Jugar partido" and "⏹ Terminar sesión" buttons | C `CLUB_START_FREE` · S `CLUB_FREE_STARTED`, `CLUB_SESSION_TIMER` |
| **CU-CLUBPLAY-04** | Match mode (named players, scoreboard): config (points per set, "Al mejor de", handicap) → `CLUB_NEW_MATCH` → live scoreboard (point/subtract/undo/swap), "A vs B" header, "🎯 Volver a modo libre", RallyTap BLE | C `CLUB_NEW_MATCH`, `RECORD_POINT`, `SUBTRACT_POINT`, `UNDO_LAST`, `SWAP_SIDES`, `GET_MATCH_STATE` · S `MATCH_UPDATE`, `CLUB_MATCH_RESET` |
| **CU-CLUBPLAY-05** | End session (player): "⏹ Terminar sesión" → confirm "Tiempo transcurrido:" → "Sí, terminar" → `FinishedView` ("Sesión finalizada", "Tiempo: {{minutes}} min", "Total: {{cost}} {{currency}}") | C `CLUB_END_SESSION` · S `CLUB_END_SESSION_CONFIRM`, `CLUB_SESSION_ENDED` |
| **CU-CLUBPLAY-06** | Reconnect after page refresh: `MATCH_UPDATE` LIVE → reconnecting view → `CLUB_RECONNECT` with PIN from `sessionStorage['rallyos-club-pin']` → session restored; missing PIN → `SESSION_EXPIRED` | C `CLUB_RECONNECT` · S `CLUB_RECONNECT_RESULT` |
| **CU-CLUBPLAY-07** | Post-match menu (match FINISHED): "🔄 Reset" / "🆕 Nuevo partido" / "🎯 Modo Libre" / "⏹ Terminar sesión" | C `CLUB_RESET_MATCH`, `CLUB_NEW_MATCH`, `CLUB_START_FREE`, `CLUB_END_SESSION` · S `CLUB_MATCH_RESET` |

---

## 7. Player Identity (cross-cutting)

| CU | Description | Events |
|---|---|---|
| **CU-PID-01** | Player self-identification: name + phone BEFORE mode (`ClubSessionConfig`); phone encrypted with `encryptionKey` from `CLUB_JOIN_RESULT` | — |
| **CU-PID-02** | Admin-entered identity (`AdminOccupyModal`, phone encrypted) | — |
| **CU-PID-03** | Phone reveal (admin only): `CLUB_REVEAL_PHONE` requires `isClubAdmin` → "Teléfono:" + number modal | C `CLUB_REVEAL_PHONE` · S `CLUB_REVEAL_PHONE_RESULT` |
| **CU-PID-04** | History with identity: `CLUB_SESSION_HISTORY` carries `playerName`, `phone` (encrypted), `mode`, `elapsedMinutes`, `cost`, `currency`, `endedBy`, `adminId` | S `CLUB_SESSION_HISTORY` |

---

## 8. Kiosk

| CU | Description | Routes | Events |
|---|---|---|---|
| **CU-KIOSK-01** | Club kiosk: staff auto-rotating grid (8 cards, 10s) with Disponible/Reservada/En Juego/Finalizada status and "PIN: {{pin}}"; featured + OCCUPIED + match court → `KioskScoreboard` spotlight; notification toasts | `/kiosk/club` (forced) or `/kiosk` in club mode | S `CLUB_KIOSK_DATA`, `MATCH_UPDATE`, `KIOSK_NOTIFICATION` · C `CLUB_GET_CONFIG`, `SUBSCRIBE_MATCH`/`UNSUBSCRIBE_MATCH` |
| **CU-KIOSK-02** | Tournament kiosk: rotating grid (3/2/1 columns, 10s, paused with hidden tab) of LIVE/WAITING courts; featured → `SUBSCRIBE_MATCH` spotlight; `KioskSportsTicker`; 10s auto-reload when disconnected | `/kiosk/tournament`, `/scoreboard/all/kiosk`, `/kiosk` in tournament mode | S `COURT_LIST`, `COURT_UPDATE`, `MATCH_UPDATE`, `KIOSK_NOTIFICATION`, `HUB_CONFIG` |
| **CU-KIOSK-03** | Bracket kiosk: read-only tree; COMPLETED → podium Campeón/Subcampeón/3er puesto (`derivePodium`); "Esperando bracket..." when null | `/kiosk` in bracket mode (NO URL override — only `SET_KIOSK_MODE`) | S `BRACKET_STATE` |

---

## 9. Bracket

| CU | Description | Events |
|---|---|---|
| **CU-BRACKET-01** | Owner bracket management (equivalent to CU-OWNER-02): create, assign player ("Asignar jugador", "Tocá para asignar"), confirm winner ("Ganó {{name}}"), assign court (incl. "Sin cancha"), undo, 2-step reset (token + "Reiniciar ahora", 30s). **[updated]** — court assignment requires an inventory-ACTIVE court (TOURNAMENT_SELECT_TABLE); a SELECT on a MAINTENANCE / club-RESERVED / BUSY / already-assigned court is rejected (TCS-2) | C `BRACKET_CREATE/ASSIGN_PLAYER/SET_WINNER/ASSIGN_COURT/UNDO_MATCH/GET/RESET`, `TOURNAMENT_SELECT_TABLE` · S `BRACKET_STATE/BRACKET_ERROR/BRACKET_RESET_CONFIRM` |

---

## E2E coverage matrix

Current state of the `client/tests/e2e/` suite (verified 2026-08-03, post-fix): **green — 57 passed, 3 skipped, 0 failed** across chromium/firefox/webkit. The 3 skips are the pre-existing `CU-TIMER-01` (match auto-finish → elapsed+cost) which requires full match state.

**SLICE 5 REWRITE (admin-court-inventory) — matrix regenerated 2026-08-05.** The club specs now seed courts via the admin inventory (INVENTORY_ADD FAB "Agregar Mesa/Cancha") instead of the removed CLUB_CREATE_COURT create button; the stale 'Cancha' selector drift in `club-free-mode.spec.ts` / `player-identity.spec.ts` is fixed (tableTennis fixture renders "Agregar Mesa"). **VERIFIED LIVE 2026-08-05** (chromium, fresh hub, `CLUB_ADMIN_PIN` set): client suite **19 passed / 1 skipped / 0 failed** (the skip is the pre-existing `CU-TIMER-01`); server Playwright **10/10 passed** (`security.spec.ts` 5/5 + `bracketCourtFlow.spec.ts` 5/5, including the slice-5 referee-play auto-advance). Also fixed during the live run: `useCourtInventory.loading` now clears on every source snapshot (buttons were stuck disabled after INVENTORY_ADD / CLUB_ACTIVATE), and the ClubAdminPage renders Activar/Ocupar for catalog-only courts (clubStatus undefined → AVAILABLE).

| Spec | CU covered | Status after slice 5 |
|---|---|---|
| `auth.spec.ts` | CU-AUTH-01..04 | ✅ verified live |
| `dashboard.spec.ts` | CU-AUTH-02/03 | ✅ verified live |
| `scoreboard.spec.ts` | CU-REFEREE-02 | ✅ verified live |
| `club-mode.spec.ts` | CU-CLUBADMIN-01..04, CU-CLUBPLAY-06 | ✅ verified live — inventory FAB seeding ("Agregar Mesa/Cancha") |
| `club-free-mode.spec.ts` | CU-CLUBPLAY-02/03 | ✅ verified live — inventory FAB seeding + 'Cancha' drift fixed |
| `player-identity.spec.ts` | CU-PID-01..04 | ✅ verified live — inventory FAB seeding + 'Cancha' drift fixed |
| `server/tests/security.spec.ts` | RF-01, INV-1, CE-3, RF-03 | ✅ verified live — CREATE_COURT removed; admin-gated INVENTORY_ADD + legacy-event rejection + SET_REF rate limit |
| `server/tests/bracketCourtFlow.spec.ts` | TCS-1..4 + slice-5 referee-play | ✅ verified live — SELECT materializes runtime tournament court; START_MATCH → MATCH_WON auto-advance; reset releases flow (`CLUB_ADMIN_PIN` env) |

### Removed CU rows (per Update Protocol)

- **CU-OWNER-01 (create/delete part)** — `[removed]` CREATE_COURT/DELETE_COURT: owner can no longer mutate court existence (CE-1/CE-2); migrated to the inventory (CU-OWNER-01b picker + CU-CLUBADMIN-02b).
- **CU-CLUBADMIN-02 (old create)** — `[removed]` CLUB_CREATE_COURT: creation moved to INVENTORY_ADD (CE-1).
- **CU-CLUBADMIN-04 (delete part)** — `[removed]` CLUB_DELETE_COURT: hard delete removed, archive-only (CE-2, INV-3).

### Harness notes (for future e2e rewrites)

- **Owner PIN is deterministic**: `TOURNAMENT_OWNER_PIN=12345678` (`.env`). Use `12345678` in tests.
- **Club admin PIN**: chosen at `/setup` (scrypt hash). Current dev config uses **`12345678`** (regenerated deterministically). NOTE: it is NOT the owner PIN.
- **Hub state**: `server/data/rallyos-state.json`, `club-config.json`, `session-history.json` (club-config.json is gitignored runtime config). Delete for fresh state (restart server after).
- **Rate limits affecting tests**: `CLUB_VERIFY_ADMIN` 3-5/60s/IP (records every attempt incl. successes), `CLUB_JOIN` 5/60s/IP, scoring 30/60s per court. `workers: 1` is set in `client/playwright.config.ts` because parallel projects against the shared hub would hit the verify limit and make PIN extraction non-deterministic.
- **API `/api/*` from :5173 does not work** (Vite without proxy). Socket flows work; CSV export and TournamentResumeModal only from `https://localhost:3000` (built app served by hub).
- **`/kiosk` auto-mode**: use URL-forced modes (`/kiosk/club`, `/kiosk/tournament`) in tests to avoid KIOSK_MODE push races.
- **Admin JWT-restore**: `CLUB_GET_CONFIG` re-emits `CLUB_SESSION_RESTORED` + history for admin sockets (fixed race: reload landing on PIN screen).

---

## Update Protocol

> Established pattern (memory `workflow/cu-documentation`): document CU at the end of each phase, verified with Playwright.

1. **At the end of each development phase/cycle**: add new CUs in their area (numbering `CU-{AREA}-{NN}`) with routes + events + strings.
2. **Verify with Playwright**: after running the suite, update the [E2E coverage matrix](#e2e-coverage-matrix) — mark which CUs are covered and each spec's status.
3. **Rules**:
   - Each CU = ONE user-facing verifiable functionality (not technical tasks).
   - Quoted strings must match the current `es.json` (if they change, update this document).
   - PIN lengths and validation rules live in `shared/validation.ts` — reflect changes here.
   - If a CU disappears, mark it `[removed]` with the reason instead of deleting it without a trace.
4. **Save to Engram**: when closing a phase, include the CUs in the session summary (topic_key `workflow/cu-documentation`).
