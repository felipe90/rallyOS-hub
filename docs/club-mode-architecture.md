# rallyOS — Two Business Units

## Overview

rallyOS operates two distinct business units within the same system. They
share infrastructure (courts, hardware, real-time sockets) but serve
different users with different flows and monetization.

```
┌─────────────────────────────────────────────────────────┐
│                   rallyOS system                         │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│  🏆 TORNEO               │  🏢 CLUB                    │
│                          │                              │
│  Value: manage            │  Value: walk-in play         │
│  tournaments end-to-end   │  with no friction, pay       │
│                          │  for time used                │
│                          │                              │
│  Users:                   │  Users:                      │
│  - Organizer              │  - Club owner (admin)        │
│  - Referee                │  - Players (walk-in,         │
│  - Spectator              │    no registration)           │
│                          │                              │
│  Monetization: N/A        │  Monetization:               │
│  (club tool, not billed)  │  Monthly sub per court       │
│                          │                              │
│  Status: ✅ SHIPPED       │  Status: 🔧 IN PROGRESS     │
│                          │                              │
├──────────────────────────┴──────────────────────────────┤
│              SHARED INFRASTRUCTURE                       │
│  - Courts & users                                       │
│  - ESP32 hardware (buttons + OLED, BLE GATT)            │
│  - Web Bluetooth bridge (phone ← BLE → ESP32)           │
│  - Socket.IO real-time                                  │
│  - Kiosk TV display                                     │
│  - Mini PC (on-premise server)                          │
└──────────────────────────────────────────────────────────┘
```

---

## Unit 1: 🏆 Torneo (Tournament Mode)

**Status**: Shipped. Active.

### Who uses it

| Role | Entry | PIN | What they do |
|---|---|---|---|
| Organizer | Owner PIN | Configures brackets, creates courts, manages referees |
| Referee | Court PIN | Controls match scoreboard via app + ESP32 |
| Spectator | None | Watches live scores on kiosk or public view |

### Flow

Organizer creates tournament → assigns courts/matches → referee manages
each match → ESP32 buttons score points → scoreboard updates in real-time.

### Monetization

None. Club tool for running tournaments. Not billed separately.

---

## Unit 2: 🏢 Club (Club Mode)

**Status**: In progress. Described below.

### Who uses it

| Role | Entry | PIN | What they do |
|---|---|---|---|
| Club owner | "Administrar" | Admin PIN (fixed) | Configure courts, pricing, revenue overview |
| Player | "Quiero jugar" | Court PIN (from encargado) | Play on assigned court, finish session, pay |

### Flow

Player arrives → staff assigns a court → hub generates a PIN → staff
gives the PIN to the player → player opens the app → enters PIN →
alias → plays with ESP32 buttons → finishes → pays for time used.

The PIN is per-court and per-session. The staff "activates" the court from
the admin panel (same logic as tournament) and the hub generates a PIN
bound to that specific court. The player does not pick a court — the PIN
assigns it.

### Monetization

Recurring subscription. Monthly fee per court, validated via HWID license
ping from Mini PC.

---

## Hardware & Communication Flow

**(Shared between both units)**

```
┌──────────┐   BLE (2-3m)   ┌──────────────┐   WiFi/4G   ┌────────────┐
│  ESP32   │◄──────────────►│  Player phone  │◄──────────►│  Mini PC    │
│ (buttons  │  (Web Bluetooth)  │              │            │ (server)   │
│  + OLED)  │                 │              │            │            │
└──────────┘                  └──────────────┘            └──────┬─────┘
                                                                 │ HDMI
                                                           ┌──────┴─────┐
                                                           │  Kiosk TV   │
                                                           └────────────┘
```

- ESP32 is fixed to the court. It does **not** talk to the Mini PC directly.
- Phone bridges BLE → WiFi/4G (Web Bluetooth).
- Player always has their phone nearby — solves the signal range problem.
- ESP32 remains mode-agnostic: it only sends `{"button":"A"}`. The server
  decides what that means based on the court's current mode.

---

## Security & Critical Rules

### Per-Court PIN (reuses existing mechanism)

There is no "system PIN." The PIN is per-court and per-session, using the
same mechanism as tournament mode:

1. Staff activates a court from the admin panel
2. Hub generates a PIN bound to that specific court
3. Staff gives the PIN to the player (verbally or in writing)
4. Player enters the PIN in the app → bound to that court
5. When the session ends, the PIN is invalidated permanently

| PIN | Who | How | Visible |
|---|---|---|---|
| Admin PIN | Club owner | Fixed, chosen by owner | Never. Only the owner knows it. |
| Court PIN | Players | Generated by hub per session | Only the assigned player receives it from staff. **Not public.** |

### No PINs on the Kiosk

The kiosk displays court occupancy and times, but **shows no PINs**.
PINs are handed out verbally by staff.

### Rate Limiting (PIN entry)

The server rate-limits PIN validation attempts per IP/device. After N
consecutive failures (configurable, default 5), the device is temporarily
blocked for 60 seconds. This prevents brute-force attacks on 4-digit
court PINs (10,000 combinations).

### Admin PIN Recovery

If the club owner forgets their admin PIN, a local recovery mechanism is
available on the Mini PC itself (physical access required):

- Connect a monitor and keyboard to the Mini PC
- Run a recovery command or visit a local URL
- The system generates a one-time recovery code

This is NOT a remote password reset — it requires physical presence at
the Mini PC, which is acceptable since the Mini PC is on-premise.

### Bridge Ownership

When a player occupies a court, the server registers their `socketId` as
the **bridge owner** of that session. Only the bridge owner's socket may
send button events for that court. If another phone tries to send points,
the server rejects them.

This prevents:
- Two phones competing for the same ESP32
- A player from another court accidentally sending points to the wrong court
- A disconnected session remaining "live" for score events

### Court Move (Relocation)

A court in use (occupied or in tournament) cannot be interrupted or
reassigned. However, if the club needs players to physically relocate
(e.g., court maintenance, a tournament match needs the court), the admin
can **move** the entire session to another court.

Move preserves:
- Current score
- Time elapsed
- Player aliases
- Mode (club or tournament)

```
C3 (occupied) ──move──► C6 (available)
  ├── players: Juan/Pedro     ├── Same data
  ├── score: 15-10            ├── Same score
  ├── elapsed: 22 min         └── Same timer
  └── mode: club
      
C6 was available → now occupied with Juan/Pedro's session.
C3 becomes available.
```

This is NOT a feature for players — it's an admin tool for when real-world
logistics require moving people between courts.

### Court State Machine

```
                    ┌──────────┐
                    │ AVAILABLE │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┬──────────┐
              │          │          │          │
              ▼          ▼          ▼          ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐
       │ RESERVED  │ │TOURNAMENT│ │  MAINT   │ │OCCUP │
       │ (PIN gen) │ │ (match)  │ │          │ │(club)│
       └─────┬────┘ └────┬─────┘ └──────────┘ └──┬───┘
             │           │                       │
             ▼           ▼                       ▼
       ┌──────────┐ ┌──────────┐           ┌──────────┐
       │ OCCUPIED  │ │ FINISHED  │           │ FINISHED  │
       │ (club)    │ │           │           │           │
       └─────┬────┘ └──────────┘           └──────────┘
             │
             ▼
       ┌──────────┐
       │ FINISHED  │
       └──────────┘
```

Rules:
- A court can only change mode (club ↔ tournament) when **AVAILABLE**
- Staff activates a court → PIN generated → state becomes **RESERVED**
- RESERVED → OCCUPIED: player enters the PIN, starts the session
- RESERVED → AVAILABLE: PIN expires without use (auto-cleanup, no timer started)
- A court in OCCUPIED or TOURNAMENT state **cannot** be interrupted
- OCCUPIED → FINISHED: session ended by player or admin force-end
- TOURNAMENT → FINISHED: match completed normally
- PIN is **invalidated permanently** when the court reaches FINISHED
- MOVE preserves state and metadata. The source court becomes AVAILABLE,
  the target court inherits the full session data.
- MAINTENANCE: admin can set a court as unavailable (hidden from kiosk,
  cannot be occupied or assigned)

---



## Development Phases

Six independent phases. Each is its own SDD: specify, design, implement,
and verify. Dependencies are explicit — a phase should only depend on its
input being available (courts exist, sessions exist, etc.), not on the
previous phase's code being merged.

```
 1 ──► 2 ──► 3a ──┬──► 3b
                   ├──► 4
                   ├──► 5
                   └──► 6
```

- Phase 2 needs Phase 1 (admin config creates courts + admin PIN)
- Phase 3a needs Phase 1 (courts + PIN generation exist)
- Phase 3b needs Phase 3a (active session)
- Phases 4, 5, 6 need Phase 3a (sessions exist), but are independent of each other

---

### Phase 1 — Admin Config

**Goal**: Club owner can configure the system. Admin PIN + court setup.

| Component | What it does |
|---|---|
| Setup wizard | First boot: club name, sport, admin PIN, default courts. |
| Admin PIN | Fixed PIN chosen by owner. NEVER displayed. Separate from tournament PINs. |
| Admin PIN recovery | Local recovery flow: one-time code accessible from the Mini PC console (physical access required). No remote reset. |
| Court CRUD | Admin adds/removes/edits courts: name/number, price per time block. |
| Court PIN generation | Reuses existing mechanism: hub generates a PIN when the staff activates a court. The court transitions to **RESERVED**. |
| Court state machine | Implements the full state machine: AVAILABLE → RESERVED → OCCUPIED → FINISHED, including MOVE and MAINTENANCE transitions. |

**Acceptance:**
- [ ] First-boot wizard creates admin PIN and default courts
- [ ] Admin can add/remove/edit courts with name, sport, price
- [ ] Staff activates a court → hub generates a PIN → court becomes RESERVED
- [ ] Same PIN mechanism works for club mode and tournament mode
- [ ] Admin PIN is separate from court PINs
- [ ] Admin PIN recovery works from Mini PC console (physical access)
- [ ] RESERVED state visible in the admin panel
- [ ] Tournament flow unchanged

---

### Phase 2 — Home Screen + Role Routing

**Goal**: New entry points that route each role/mode to its correct UI.

| Component | What it does |
|---|---|
| Home screen redesign | Three entries: "Quiero jugar" / "Torneo" / "Administrar". |
| Court PIN entry | Player enters the PIN given by staff → identifies the court and starts/joins session. |
| Role routing | Each entry + PIN combination routes to the correct page. |
| Rate limiting | Server rate-limits PIN validation per device/IP: 5 failures → blocked 60s. Prevents brute force on 4-digit PINs. |

**Route matrix:**

| Entry | PIN | Routes to |
|---|---|---|
| "Quiero jugar" | Court PIN | Session page (Phase 3a) — alias prompt if new |
| "Torneo" → Organizador | Owner PIN | Existing tournament panel |
| "Torneo" → Árbitro | Court PIN | Existing referee scoreboard |
| "Torneo" → Espectador | None | Existing spectator view |
| "Administrar" | Admin PIN | Admin config (Phase 1) |

**Acceptance:**
- [ ] Home screen shows three entries
- [ ] Each entry + PIN combination routes correctly
- [ ] "Quiero jugar" + court PIN identifies the correct court
- [ ] Tournament routing unchanged — same pages behind "Torneo" button
- [ ] Invalid PIN shows error (does not route)

**What does NOT change:** Court system, sessions, kiosk, ESP32, tournament pages.

---

### Phase 3a — Session Init + Alias

**Goal**: Player enters the court PIN → assigns alias → session activates.

| Component | What it does |
|---|---|
| PIN validation | Server validates the court PIN and returns the associated court. |
| Alias prompt | First time on this court: player enters an alias (no registration). |
| Bridge ownership | Server registers socketId as session owner for that court. |
| Reconnection | If a court is OCCUPIED and the same PIN is entered again, the server detects a reconnection — it reassigns the socketId to the new socket. The session resumes without data loss. |
| Session activation | Court transitions RESERVED → OCCUPIED. Timer starts. ESP32 linked to the session. |

**Acceptance:**
- [ ] Player enters court PIN → server identifies the correct court
- [ ] First visit: player enters alias → alias shown on kiosk
- [ ] Second player on same court: enters same PIN → added to same session (no alias prompt)
- [ ] Bridge ownership registered server-side
- [ ] Reconnection: same PIN on an OCCUPIED court → socketId reassigned, session resumes
- [ ] Invalid PIN shows error (including rate-limited state)
- [ ] Cannot activate a session on an already-occupied court (reconnection excepted)
- [ ] RESERVED court shows as reserved on kiosk (Phase 5)

**What does NOT change:** Home screen, tournament, timer/cost, kiosk, ESP32.

---

### Phase 3b — Session Timer + Cost + End Session

**Goal**: Track session duration and calculate cost when players finish.

| Component | What it does |
|---|---|
| Session timer | Server-side: start → end → duration (minute precision). Timer persists `start_time` in DB — survives server restart. |
| End session flow | Player taps "Finalizar" → timer stops → cost calculated → PIN invalidated permanently. |
| Admin force-end session | Admin can force-end any active session from the admin panel. Stops the timer, calculates cost, invalidates the PIN, frees the court. |
| PIN invalidation | When a session reaches FINISHED, the PIN is permanently invalidated. Cannot be reused for a new session. |
| Cost display | Shows amount owed based on duration × price config. |

**Acceptance:**
- [ ] Timer starts when court is occupied
- [ ] Timer stops on "Finalizar sesión"
- [ ] Admin can force-end any active session from the admin panel
- [ ] PIN permanently invalidated on both player end and admin force-end
- [ ] Cost is calculated from duration × court price
- [ ] Display shows correct amount
- [ ] Timer survives server restart (start_time in DB)

**What does NOT change:** Occupy flow, home screen, tournament, kiosk, ESP32.

---

### Phase 4 — Bridge Ownership + Court Move

**Goal**: Secure session ownership. Admin can relocate sessions.

| Component | What it does |
|---|---|
| Bridge ownership validation | Server rejects button events from non-owner sockets. |
| Court move (admin) | Admin relocates session (score, time, aliases) to another court. |

**Acceptance:**
- [ ] Only the session owner's socket can send button events
- [ ] A different phone cannot send points to the session
- [ ] Admin can move session to another available court
- [ ] All metadata preserved after move (score, aliases, elapsed time)
- [ ] Source court becomes available, target court inherits session

**What does NOT change:** Occupy flow, timer, kiosk, ESP32.

---

### Phase 5 — Kiosk Club Mode

**Goal**: Kiosk TV shows club occupancy alongside tournament scores.

| Component | What it does |
|---|---|
| Kiosk club dashboard | Shows all courts: libre/ocupada, players, score, time elapsed. |
| Auto mode switch | Kiosk detects mode per court. Defaults to club if no tournament. |

**Kiosk display (club mode):**

```
┌──────────────────────────────────────────────┐
│              Club Pádel Norte                 │
│                                              │
│  🟢 C1 — Juan/Pedro   15-10    22 min        │
│  🟡 C2 — Libre                               │
│  🟠 C3 — Reservada                           │
│  🟢 C4 — María/Ana    8-3     6 min          │
│  🔴 C5 — Mantenimiento                       │
│  🟢 C6 — Luis/Carlos   11-9    35 min        │
│                                              │
│  4/6 canchas ocupadas                        │
└──────────────────────────────────────────────┘
```

**Acceptance:**
- [ ] Kiosk shows club view with court occupancy
- [ ] No PINs displayed on kiosk
- [ ] RESERVED state shown as "Reservada" (distinct visual, e.g. orange)
- [ ] Kiosk switches between tournament/club mode per court
- [ ] Real-time updates via Socket.IO

---

### Phase 6 — ESP32 Dual-Mode Validation

**Goal**: Verify ESP32 works in both modes without firmware changes.

**What to validate:**
- Button press in club mode → point registered for correct player
- Button press in tournament match → point registered
- OLED shows score from server (same protocol, both modes)
- Web Bluetooth bridge handles both modes

**Acceptance:**
- [ ] ESP32 button → point registered in club session
- [ ] ESP32 button → point registered in tournament match
- [ ] OLED shows correct score in both modes
- [ ] No firmware or bridge changes required
- [ ] Validated with real phone + Mini PC + ESP32

---

## Summary: What Stays vs. What's New

| Component | Phase |
|---|---|
| ESP32 firmware | Unchanged across all phases |
| Web Bluetooth bridge | Unchanged |
| Socket.IO infra | Unchanged |
| Tournament flows | Unchanged |
| Club config + admin PIN + recovery | **Phase 1** |
| Court state machine (incl. RESERVED) | **Phase 1** |
| Home screen + role routing + rate limit | **Phase 2** |
| Session init + alias + reconnection | **Phase 3a** |
| Session timer + cost + force-end + PIN invalidation | **Phase 3b** |
| Bridge ownership + court move | **Phase 4** |
| Kiosk club mode (incl. RESERVED) | **Phase 5** |
| ESP32 dual-mode validation | **Phase 6** |

## Out of Scope (for now)

- ❌ Player registration / accounts
- ❌ Player history or stats
- ❌ Rankings / ELO
- ❌ Integrated payment gateway (manual for MVP)
- ❌ License dashboard for admin (serverless API only)
- ❌ ESP32 rental inventory management
- ❌ Multiport clubs or multi-sport courts
