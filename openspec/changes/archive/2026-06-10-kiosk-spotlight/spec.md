# Delta Spec — kiosk-spotlight

## ADDED Capability: shared/featured

### Requirement: CourtInfo.featured Field

`CourtInfo` SHALL include an optional boolean field `featured?: boolean` (i18n label: "Destacado"). When absent or `undefined`, the system MUST treat it as `false`.

#### Scenario: Default is false

- GIVEN a `CourtInfo` object without `featured`
- WHEN any consumer reads the field
- THEN `featured` is treated as `false`

#### Scenario: Set to true via TABLE_UPDATE

- GIVEN an owner sets featured on a court
- WHEN `TABLE_UPDATE` is broadcast
- THEN that court's `CourtInfo.featured` is `true`
- AND `featured` is `false` on all other courts

### Requirement: SET_FEATURED Socket Event

A new client→server event `SET_FEATURED` MUST be registered in `SocketEvents.CLIENT` with payload `{ targetTableId: string | null }`. The server MUST reject non-owner senders with `ERROR` code `UNAUTHORIZED`.

#### Scenario: Owner sets featured

- GIVEN an authenticated owner socket
- WHEN `SET_FEATURED` is emitted with `{ targetTableId: "court-1" }`
- THEN the server processes and broadcasts updates

#### Scenario: Null clears all

- GIVEN at least one court has `featured=true`
- WHEN `SET_FEATURED` is emitted with `{ targetTableId: null }`
- THEN all courts have `featured=false`

#### Scenario: Non-owner rejected

- GIVEN a socket without owner authentication
- WHEN `SET_FEATURED` is emitted
- THEN server responds with `ERROR` `{ code: "UNAUTHORIZED" }`

### Requirement: SUBSCRIBE_MATCH Socket Event

A new client→server event `SUBSCRIBE_MATCH` with payload `{ courtId: string }`. The server MUST validate that `court.featured === true` before subscribing. If validation fails, respond with `ERROR` code `FORBIDDEN`. On success, `socket.join(courtId)` and emit current `MATCH_UPDATE` to that socket.

#### Scenario: Subscribe to featured court

- GIVEN court-A has `featured=true`
- WHEN `SUBSCRIBE_MATCH` with `{ courtId: "court-A" }` is received
- THEN server validates `court-A.featured === true`
- AND `socket.join("court-A")` is called
- AND current `MATCH_UPDATE(court-A)` is emitted to the socket

#### Scenario: Subscribe to non-featured court rejected

- GIVEN court-A has `featured=false`
- WHEN `SUBSCRIBE_MATCH` with `{ courtId: "court-A" }` is received
- THEN server responds with `ERROR` `{ code: "FORBIDDEN" }`

### Requirement: UNSUBSCRIBE_MATCH Socket Event

A new client→server event `UNSUBSCRIBE_MATCH` with payload `{ courtId: string }`. The server MUST call `socket.leave(courtId)` on receipt.

#### Scenario: Unsubscribe cleans up

- GIVEN socket is subscribed to court-A
- WHEN `UNSUBSCRIBE_MATCH` with `{ courtId: "court-A" }` is received
- THEN `socket.leave("court-A")` is called

---

## ADDED Capability: server/featured-control

### Requirement: Single-Featured Invariant

The server MUST atomically enforce that at most one court has `featured=true`. Setting a new featured clears the previous one. Both the previous and new court emit `TABLE_UPDATE`.

#### Scenario: Switch to different court

- GIVEN court-1 has `featured=true`
- WHEN `SET_FEATURED` with `{ targetTableId: "court-2" }` is received
- THEN court-1.featured = false AND court-2.featured = true
- AND two `TABLE_UPDATE` events are broadcast (one per court)

#### Scenario: Non-existent tableId returns error

- GIVEN owner socket is authenticated
- WHEN `SET_FEATURED` with `{ targetTableId: "nonexistent" }` is received
- AND no court with that ID exists
- THEN server responds with `ERROR` `{ code: "TABLE_NOT_FOUND" }`

### Requirement: Auto-Clear on FINISHED

When a match transitions to FINISHED status and that court has `featured=true`, the server MUST auto-clear `featured` and broadcast `TABLE_UPDATE` for that court.

#### Scenario: Match ends while featured

- GIVEN court-A is LIVE and `featured=true`
- WHEN the match engine transitions court-A to FINISHED
- THEN court-A.featured becomes `false`
- AND `TABLE_UPDATE` is broadcast with the updated `CourtInfo`

---

## MODIFIED Capability: kiosk-display

### Requirement: Public Kiosk Route

The system MUST serve `/scoreboard/all/kiosk` without authentication. When at least one LIVE or WAITING court has `featured=true`, the kiosk SHALL subscribe via `SUBSCRIBE_MATCH` to receive real-time `MATCH_UPDATE` and render a fullscreen `ScoreboardMain` view for that court. When no court has `featured=true`, the kiosk SHALL display all active tables (LIVE/WAITING) as cards in a responsive grid. Each card SHALL show table name, players, and current score/set. No input controls.

(Previously: always rendered grid of all active tables, no fullscreen featured mode.)

#### Scenario: No featured — grid mode

- GIVEN no court has `featured=true`
- WHEN kiosk loads or receives `TABLE_UPDATE`
- THEN normal responsive grid renders (zero regression)

#### Scenario: Featured activates fullscreen

- GIVEN kiosk shows grid mode
- WHEN `TABLE_UPDATE` arrives with `featured: true` on a LIVE court
- THEN kiosk emits `SUBSCRIBE_MATCH` and transitions to fullscreen `ScoreboardMain` for that court

#### Scenario: Return to grid when match ends

- GIVEN kiosk shows fullscreen for featured court-A
- WHEN court-A transitions to FINISHED
- THEN kiosk emits `UNSUBSCRIBE_MATCH` and transitions back to grid mode

#### Scenario: Return to grid when featured cleared

- GIVEN kiosk shows fullscreen for featured court-A
- WHEN `TABLE_UPDATE` arrives with `featured: false` on court-A
- THEN kiosk emits `UNSUBSCRIBE_MATCH` and transitions back to grid mode

### Requirement: Kiosk Featured Transition

The kiosk MUST apply a 500ms CSS opacity fade when transitioning between grid↔fullscreen and between different featured courts. The transition SHALL use the same `transition-all duration-500` pattern as the existing auto-rotation.

#### Scenario: Grid to fullscreen fade

- GIVEN kiosk is in grid mode
- WHEN a court becomes featured
- THEN grid fades out (500ms) and `ScoreboardMain` fades in (500ms)

#### Scenario: Switch between featured courts

- GIVEN kiosk shows fullscreen for court-A (featured)
- WHEN featured switches to court-B
- THEN court-A view fades out (500ms) and court-B view fades in (500ms)

---

## ADDED Capability: owner-dashboard

### Requirement: Destacar Toggle in CourtStatusChip

Each LIVE or WAITING court card in `OwnerDashboardPage` MUST display a "Destacar" / "Quitar Destacado" toggle button (i18n labels mapped to `featured` field). The button SHALL emit `SET_FEATURED` on click. FINISHED courts SHALL NOT show the button.

#### Scenario: LIVE court shows Destacar

- GIVEN owner views dashboard with LIVE courts
- WHEN each court card renders
- THEN each LIVE card displays a "Destacar" button

#### Scenario: FINISHED court hides button

- GIVEN a FINISHED court card on the dashboard
- THEN no Destacar button is rendered

#### Scenario: Currently featured shows Quitar

- GIVEN court-A is currently `featured=true`
- WHEN the dashboard renders
- THEN court-A's button reads "Quitar Destacado" (active state)

#### Scenario: Click Destacar emits SET_FEATURED

- GIVEN owner sees a LIVE court with "Destacar" button
- WHEN owner clicks it
- THEN `SET_FEATURED` is emitted with `{ targetTableId: courtId }`

#### Scenario: Click Quitar Destacado clears

- GIVEN owner sees the featured court with "Quitar Destacado"
- WHEN owner clicks it
- THEN `SET_FEATURED` is emitted with `{ targetTableId: null }`
