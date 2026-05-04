# PIN Validation

## Purpose

Ensure all PIN comparisons use constant-time comparison to prevent timing attacks. Covers both owner PIN (8-digit) and table PIN (4-digit) validation across all handlers and services.

## Requirements

### Requirement: Owner PIN uses timing-safe comparison

All owner PIN comparisons MUST use `crypto.timingSafeEqual()`.

#### Scenario: Owner PIN via AuthHandler

- GIVEN a VERIFY_OWNER request with a PIN
- WHEN comparing against the stored owner PIN
- THEN `this.comparePin()` SHALL be used (inherited from SocketHandlerBase)

#### Scenario: Owner PIN via AdminHandler

- GIVEN a REGENERATE_PIN request with an owner PIN
- WHEN comparing against the stored owner PIN
- THEN `this.comparePin()` SHALL be used

#### Scenario: Owner PIN via TableEventHandler

- GIVEN a GET_TABLES_WITH_PINS request with an owner PIN
- WHEN comparing against the stored owner PIN
- THEN `this.comparePin()` SHALL be used

### Requirement: Table PIN uses timing-safe comparison

All table PIN comparisons in PlayerService MUST use `PinService.validatePin()`.

#### Scenario: Table PIN via joinTable

- GIVEN a joinTable() call with a table PIN
- WHEN comparing against the stored table PIN
- THEN `PinService.validatePin()` SHALL be called
- AND `table.pin !== pin` SHALL NOT be used

#### Scenario: Table PIN via setReferee

- GIVEN a setReferee() call with a table PIN
- WHEN comparing against the stored table PIN
- THEN `PinService.validatePin()` SHALL be called

### Requirement: SocketHandlerBase provides comparePin()

The `comparePin()` method SHALL live in `SocketHandlerBase` and be inherited by all handlers.

#### Scenario: All handlers inherit comparePin

- GIVEN any handler extending SocketHandlerBase
- WHEN calling `this.comparePin()`
- THEN it SHALL use `crypto.timingSafeEqual()`

### Requirement: isOwner() uses timing-safe comparison

The `isOwner()` method in SocketHandlerBase SHALL use `comparePin()`.

#### Scenario: isOwner() validates via comparePin

- GIVEN the SocketHandlerBase.isOwner() method
- WHEN comparing a PIN against ownerPin
- THEN it SHALL delegate to `this.comparePin()`
- AND SHALL NOT use `===`
