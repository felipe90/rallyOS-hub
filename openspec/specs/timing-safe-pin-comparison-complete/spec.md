# Timing-Safe PIN Comparison

## Purpose

Ensure all PIN comparisons use constant-time comparison to prevent timing attacks that could leak PIN digits character by character.

## Requirements

### Requirement: Owner PIN uses timing-safe comparison

All owner PIN comparisons MUST use `crypto.timingSafeEqual()`.

#### Scenario: Owner PIN comparison via timingSafeEqual

- GIVEN a VERIFY_OWNER request with a PIN
- WHEN comparing against the stored owner PIN
- THEN `crypto.timingSafeEqual()` SHALL be used
- AND `AuthHandler`, `AdminHandler`, `TableEventHandler` SHALL all use it

#### Scenario: Mismatched length handled gracefully

- GIVEN an owner PIN of different length than stored
- WHEN comparison runs
- THEN it SHALL return false without throwing

### Requirement: Table PIN uses timing-safe comparison

All table PIN comparisons MUST use `crypto.timingSafeEqual()`, not `!==`.

#### Scenario: PlayerService validates table PIN via timingSafeEqual

- GIVEN a `joinTable()` or `setReferee()` call with a table PIN
- WHEN comparing against the stored table PIN
- THEN `PinService.validatePin()` SHALL be called
- AND `PlayerService` SHALL NOT use direct string comparison

### Requirement: No unused timing-safe code

`PinService.validatePin()` SHALL be used by at least one caller.

#### Scenario: validatePin has callers

- GIVEN the codebase
- WHEN searching for calls to `PinService.validatePin()`
- THEN at least 2 call sites SHALL exist
