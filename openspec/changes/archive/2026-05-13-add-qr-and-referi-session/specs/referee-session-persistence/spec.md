# referee-session-persistence Specification

## Purpose

localStorage-based PIN session persistence for referees. The app SHALL restore a previously validated referee session on load, skipping the PIN modal when a valid session exists. Sessions self-invalidate on leave or match end.

## Requirements

### Requirement: Session Persisted on Successful SET_REF

After the server confirms `SET_REF` (Client→Server) succeeds and the referee role is assigned, the system MUST write a session entry to localStorage under key `rallyos_ref_session_{tableId}` containing `{ pin, joinedAt }`.

#### Scenario: Session saved after valid PIN

- GIVEN referee submits PIN "4821" for table "t1"
- WHEN server responds with role update to REFEREE (via `TABLE_UPDATE`)
- THEN localStorage key `rallyos_ref_session_t1` exists with `{ pin: "4821", joinedAt: <timestamp> }`

### Requirement: Session Restored on App Load

On app load, the system SHALL check localStorage for any `rallyos_ref_session_*` keys. If found and the corresponding table status is `WAITING`, `CONFIGURING`, or `LIVE`, the session MUST be restored — the referee joins the table without showing the PIN modal.

#### Scenario: Valid session skips PIN modal

- GIVEN localStorage has `rallyos_ref_session_t1` with valid pin
- AND table "t1" status is LIVE
- WHEN app loads and connects via Socket.IO
- THEN PIN modal is NOT shown
- AND referee is re-joined to table "t1"

#### Scenario: Session on FINISHED table shows PIN modal

- GIVEN localStorage has `rallyos_ref_session_t1`
- AND table "t1" status is FINISHED
- WHEN app loads
- THEN PIN modal IS shown
- AND the stale session entry is cleared from localStorage

### Requirement: Session Invalidated on Leave or Finish

The session entry MUST be removed from localStorage when the referee sends `LEAVE_TABLE` (Client→Server) or when the table transitions to `FINISHED` (Server→Client `TABLE_UPDATE`).

#### Scenario: Session cleared on leave

- GIVEN localStorage has `rallyos_ref_session_t1`
- WHEN referee sends LEAVE_TABLE for table "t1"
- THEN `rallyos_ref_session_t1` is removed from localStorage

#### Scenario: Session cleared when match ends

- GIVEN localStorage has `rallyos_ref_session_t1`
- WHEN Server→Client `TABLE_UPDATE` arrives with status=FINISHED for "t1"
- THEN `rallyos_ref_session_t1` is removed from localStorage

### Requirement: Graceful Degradation on localStorage Loss

If localStorage is unavailable (private browsing, cleared by browser), the system MUST fall back to showing the PIN modal. No error SHALL surface to the user.

#### Scenario: Browser clears localStorage

- GIVEN browser has no localStorage access
- WHEN app loads
- THEN PIN modal shows normally
- AND no console error about missing localStorage
