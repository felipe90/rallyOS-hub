# server/featured-control Specification

## Purpose

Server-side enforcement of the single-featured invariant and auto-clear logic for the kiosk spotlight feature.

## Requirements

### Requirement: Single-Featured Invariant

The server MUST atomically enforce that at most one court has `featured=true`. Setting a new featured clears the previous one. Both the previous and new court emit `TABLE_UPDATE`.

#### Scenario: Switch to different court

- GIVEN court-1 has `featured=true`
- WHEN `SET_FEATURED` with `{ targetCourtId: "court-2" }` is received
- THEN court-1.featured = false AND court-2.featured = true
- AND two `TABLE_UPDATE` events are broadcast (one per court)

#### Scenario: Non-existent courtId returns error

- GIVEN owner socket is authenticated
- WHEN `SET_FEATURED` with `{ targetCourtId: "nonexistent" }` is received
- AND no court with that ID exists
- THEN server responds with `ERROR` `{ code: "TABLE_NOT_FOUND" }`

### Requirement: Auto-Clear on FINISHED

When a match transitions to FINISHED status and that court has `featured=true`, the server MUST auto-clear `featured` and broadcast `TABLE_UPDATE` for that court.

#### Scenario: Match ends while featured

- GIVEN court-A is LIVE and `featured=true`
- WHEN the match engine transitions court-A to FINISHED
- THEN court-A.featured becomes `false`
- AND `TABLE_UPDATE` is broadcast with the updated `CourtInfo`
