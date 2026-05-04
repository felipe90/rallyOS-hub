# Delta for pin-validation

## MODIFIED Requirements

### Requirement: Timing-safe PIN comparison (Req 15 from audit-remediation-full)

All PIN comparisons MUST use `crypto.timingSafeEqual()` — across ALL handlers and services, not just AuthHandler.
(Previously: Only AuthHandler and PinService used timingSafeEqual; PlayerService, AdminHandler, TableEventHandler used `===`/`!==`)

#### Scenario: Owner PIN via timingSafeEqual (AuthHandler) — UNCHANGED

- GIVEN a VERIFY_OWNER request with a PIN
- WHEN comparing against the stored owner PIN
- THEN `crypto.timingSafeEqual()` SHALL be used

#### Scenario: Owner PIN via timingSafeEqual (AdminHandler) — UPDATED

- GIVEN a REGENERATE_PIN request with an owner PIN
- WHEN comparing against the stored owner PIN
- THEN `crypto.timingSafeEqual()` SHALL be used
- AND `data.pin === this.ownerPin` SHALL NOT be used

#### Scenario: Owner PIN via timingSafeEqual (TableEventHandler) — UPDATED

- GIVEN a GET_TABLES_WITH_PINS request with an owner PIN
- WHEN comparing against the stored owner PIN
- THEN `crypto.timingSafeEqual()` SHALL be used
- AND `data?.ownerPin === this.ownerPin` SHALL NOT be used

#### Scenario: Table PIN via timingSafeEqual (PlayerService) — UPDATED

- GIVEN a joinTable() or setReferee() call with a table PIN
- WHEN comparing against the stored table PIN
- THEN `PinService.validatePin()` SHALL be called
- AND `table.pin !== pin` SHALL NOT be used

## ADDED Requirements

### Requirement: SocketHandlerBase.isOwner() uses timing-safe comparison

The `isOwner()` method in SocketHandlerBase SHALL use constant-time comparison.

#### Scenario: isOwner() uses timingSafeEqual

- GIVEN the `SocketHandlerBase.isOwner()` method
- WHEN comparing a PIN against ownerPin
- THEN it SHALL use `crypto.timingSafeEqual()`
- AND SHALL NOT use `===`
