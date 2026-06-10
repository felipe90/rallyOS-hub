# shared/featured Specification

## Purpose

Shared types and socket events for the "Destacado" (kiosk spotlight) feature, enabling owners to spotlight a single court on the venue TV display.

## Requirements

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

A new client→server event `SET_FEATURED` MUST be registered in `SocketEvents.CLIENT` with payload `{ targetCourtId: string | null }`. The server MUST reject non-owner senders with `ERROR` code `UNAUTHORIZED`.

#### Scenario: Owner sets featured

- GIVEN an authenticated owner socket
- WHEN `SET_FEATURED` is emitted with `{ targetCourtId: "court-1" }`
- THEN the server processes and broadcasts updates

#### Scenario: Null clears all

- GIVEN at least one court has `featured=true`
- WHEN `SET_FEATURED` is emitted with `{ targetCourtId: null }`
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
