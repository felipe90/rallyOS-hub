# Delta for kiosk-notifications

## ADDED Requirements

### Requirement: Match Lifecycle Auto-Notifications

Server MUST auto-emit `KIOSK_NOTIFICATION` events on match lifecycle transitions without client request.

#### Scenario: Match start notification

- GIVEN `START_MATCH` completes successfully and state is returned
- WHEN match begins
- THEN server emits `KIOSK_NOTIFICATION` with type `info`, duration 10s, and message "Match started: {PlayerA} vs {PlayerB}"

#### Scenario: Match won notification

- GIVEN `MATCH_WON` fires and winner is determined
- WHEN match concludes
- THEN server emits `KIOSK_NOTIFICATION` with type `important`, duration 10s, and message "Winner: {Name}!"

### Requirement: Server-Sourced Notification Behavior

Server-sourced `KIOSK_NOTIFICATION` emissions MUST bypass PIN authentication and rate limiting. Player names SHALL fall back to "Player A" / "Player B" when unavailable.

#### Scenario: Bypass PIN and rate limit

- GIVEN a server-sourced notification from match lifecycle
- WHEN `KIOSK_NOTIFICATION` is emitted
- THEN no PIN validation occurs AND no rate limit check is applied

#### Scenario: Fallback names on match start

- GIVEN `START_MATCH` completes but player names are unavailable
- WHEN auto-notification emits
- THEN message reads "Match started: Player A vs Player B"

#### Scenario: Fallback name on match won

- GIVEN `MATCH_WON` fires but winner name is unavailable
- WHEN auto-notification emits
- THEN message reads "Winner: Player A!"
