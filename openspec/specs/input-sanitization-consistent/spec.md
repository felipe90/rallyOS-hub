# Input Sanitization Consistent

## Purpose

Ensure all user-provided name inputs are sanitized to prevent XSS and injection, not just in MatchEventHandler.

## Requirements

### Requirement: All name inputs sanitized

Every user-provided name SHALL be sanitized before storage.

#### Scenario: JOIN_TABLE name sanitized

- GIVEN a `JOIN_TABLE` event with `<script>alert(1)</script>` as name
- WHEN the handler processes it
- THEN the stored name SHALL be `alert(1)` (tags stripped)

#### Scenario: CREATE_TABLE name sanitized

- GIVEN a `CREATE_TABLE` event with a name containing HTML
- WHEN the handler processes it
- THEN the stored table name SHALL have HTML tags stripped

#### Scenario: PlayerService applies sanitization

- GIVEN the `PlayerService.joinTable()` method
- WHEN storing a player name
- THEN it SHALL sanitize the input server-side
