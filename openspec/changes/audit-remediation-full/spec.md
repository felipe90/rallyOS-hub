# Spec: Audit Remediation Full

> **Change:** `audit-remediation-full`
> **Depends on:** `security-hardening-v2` (must be merged first)

## Requirements

### Requirement 1: No Default PINs

The system SHALL NOT provide default values for any authentication PIN. If a required PIN environment variable is not set, the server SHALL fail to start with a clear error message.

#### Scenarios

**Scenario 1.1: Missing TOURNAMENT_OWNER_PIN**
- **Given** the `TOURNAMENT_OWNER_PIN` environment variable is not set
- **When** the server starts
- **Then** the server SHALL exit with code 1
- **And** the error message SHALL indicate `TOURNAMENT_OWNER_PIN` is required

**Scenario 1.2: Missing table PIN in URL**
- **Given** a referee visits a scoreboard URL without a valid table PIN
- **When** the `useRefAuth` hook initializes
- **Then** it SHALL NOT default to any known PIN value
- **And** it SHALL display an authentication-required screen

### Requirement 2: PIN Submission Timeout Behavior

The PIN submission flow SHALL resolve as FAILURE when the server does not respond within the timeout period.

#### Scenarios

**Scenario 2.1: Server timeout**
- **Given** a user submits a PIN
- **When** the server does not respond within 5 seconds
- **Then** the submission SHALL resolve with `{ success: false, error: 'Timeout' }`
- **And** the user SHALL NOT be granted access

**Scenario 2.2: Socket disconnect during submission**
- **Given** a user submits a PIN
- **When** the socket disconnects before receiving a response
- **Then** the submission SHALL resolve with `{ success: false, error: 'Disconnected' }`

### Requirement 3: Owner PIN Never Logged

The owner PIN SHALL NEVER appear in any log output, regardless of log level or environment.

#### Scenarios

**Scenario 3.1: PIN loaded from environment**
- **Given** `TOURNAMENT_OWNER_PIN` is set in the environment
- **When** the server starts and logs the PIN status
- **Then** the log entry SHALL NOT contain the PIN value
- **And** the log entry SHALL indicate the PIN was loaded successfully

**Scenario 3.2: PIN randomly generated**
- **Given** `TOURNAMENT_OWNER_PIN` is not set (and server fails per Req 1)
- **When** the random generation code path is reached (legacy code)
- **Then** the log entry SHALL NOT contain the generated PIN value

### Requirement 4: AES-256-GCM PIN Encryption

The client SHALL use AES-256-GCM encryption for PINs, matching the server's encryption. XOR-based encryption SHALL be removed.

#### Scenarios

**Scenario 4.1: QR URL contains AES-encrypted PIN**
- **Given** a table is created with a PIN
- **When** the QR code is generated
- **Then** the PIN in the URL SHALL be encrypted with AES-256-GCM
- **And** the encryption SHALL use the server's `ENCRYPTION_SECRET`

**Scenario 4.2: Client decrypts AES-encrypted PIN**
- **Given** a QR URL with an AES-256-GCM encrypted PIN
- **When** the client parses the URL
- **Then** the client SHALL decrypt the PIN using the Web Crypto API
- **And** the decrypted PIN SHALL match the original

**Scenario 4.3: XOR encryption removed**
- **Given** the client codebase
- **When** searching for XOR encryption code
- **Then** no XOR encryption implementation SHALL exist
- **And** the `pinEncryption.ts` file SHALL only contain AES-256-GCM logic

### Requirement 5: No PINs in Browser Storage

Authentication PINs SHALL NOT be stored in `localStorage` or `sessionStorage`. Short-lived session tokens SHALL be used instead.

#### Scenarios

**Scenario 5.1: Owner PIN not stored**
- **Given** an owner successfully verifies their PIN
- **When** the verification completes
- **Then** the PIN SHALL NOT be stored in `localStorage` or `sessionStorage`
- **And** a session token SHALL be stored instead

**Scenario 5.2: Table PIN not stored**
- **Given** a referee authenticates with a table PIN
- **When** authentication completes
- **Then** the PIN SHALL NOT be stored in `localStorage` or `sessionStorage`
- **And** a session token SHALL be stored instead

**Scenario 5.3: Session token on reconnect**
- **Given** a user has a valid session token
- **When** the socket reconnects
- **Then** the client SHALL send the session token for re-authentication
- **And** the server SHALL validate the token and restore the session

### Requirement 6: Socket.io Authentication Middleware

Sensitive Socket.io operations SHALL require authentication via session tokens.

#### Scenarios

**Scenario 6.1: Unauthenticated sensitive operation**
- **Given** a socket without a valid session token
- **When** the socket emits `CREATE_TABLE`, `DELETE_TABLE`, or `VERIFY_OWNER`
- **Then** the server SHALL reject the operation with `UNAUTHORIZED`

**Scenario 6.2: Authenticated operation**
- **Given** a socket with a valid session token
- **When** the socket emits a sensitive operation
- **Then** the server SHALL process the operation normally

### Requirement 7: Proper Type for matchEngine

The `matchEngine` field in the `Table` type SHALL use the proper `MatchEngine` type, not `any`.

#### Scenarios

**Scenario 7.1: Type checking enabled**
- **Given** the `Table` type definition
- **When** accessing `table.matchEngine`
- **Then** TypeScript SHALL provide autocomplete and type checking
- **And** no `any` type SHALL be used for `matchEngine`

### Requirement 8: ESLint no-explicit-any Enabled

The `@typescript-eslint/no-explicit-any` rule SHALL be enabled as `warn` for all new code.

#### Scenarios

**Scenario 8.1: New any usage warned**
- **Given** a developer writes `const x: any = ...`
- **When** ESLint runs
- **Then** it SHALL emit a warning for the `any` usage

**Scenario 8.2: Existing any usage tolerated**
- **Given** existing code with `any` types
- **When** ESLint runs
- **Then** it SHALL emit warnings (not errors) for existing usages
- **And** the build SHALL NOT fail

### Requirement 9: Typed SocketData Interface

Socket.io data SHALL use a properly typed `SocketData` interface instead of `(socket as any).data`.

#### Scenarios

**Scenario 9.1: Socket data typed**
- **Given** the Socket.io server setup
- **When** accessing `socket.data`
- **Then** the data SHALL be typed as `SocketData`
- **And** `SocketData` SHALL include `isOwner?: boolean`, `sessionToken?: string`, `tableId?: string`

### Requirement 10: Rate Limiting on CREATE_TABLE

The `CREATE_TABLE` event SHALL be rate-limited to prevent memory exhaustion.

#### Scenarios

**Scenario 10.1: Rate limit enforced**
- **Given** an IP has created 10 tables in the last 60 seconds
- **When** the same IP attempts to create another table
- **Then** the server SHALL reject with `RATE_LIMITED`

**Scenario 10.2: Normal usage allowed**
- **Given** an IP has created fewer than 10 tables in the last 60 seconds
- **When** the IP attempts to create a table
- **Then** the server SHALL process the request normally

### Requirement 11: RateLimiter Memory Cleanup

The RateLimiter SHALL periodically clean up entries older than the rate limit window.

#### Scenarios

**Scenario 11.1: Old entries pruned**
- **Given** the RateLimiter has entries older than 2x the window period
- **When** cleanup runs
- **Then** those entries SHALL be removed from the Map
- **And** memory usage SHALL not grow unbounded

**Scenario 11.2: Active entries preserved**
- **Given** the RateLimiter has entries within the current window
- **When** cleanup runs
- **Then** those entries SHALL NOT be removed

### Requirement 12: Socket.io Connection Limits

Socket.io SHALL enforce connection limits to prevent abuse.

#### Scenarios

**Scenario 12.1: Per-IP connection limit**
- **Given** an IP has 10 active connections
- **When** the same IP attempts another connection
- **Then** the connection SHALL be rejected

**Scenario 12.2: Global connection limit**
- **Given** the server has 500 active connections
- **When** a new connection is attempted
- **Then** the connection SHALL be rejected

**Scenario 12.3: maxHttpBufferSize set**
- **Given** a client sends a message larger than 1MB
- **When** the message is received
- **Then** the connection SHALL be closed

### Requirement 13: Room-Based Table Broadcasts

Table-specific updates SHALL be broadcast only to clients subscribed to that table's room.

#### Scenarios

**Scenario 13.1: Table update to room only**
- **Given** a point is scored on table `table-1`
- **When** `TABLE_UPDATE` is emitted
- **Then** only clients in room `table-1` SHALL receive the update
- **And** clients in other rooms SHALL NOT receive it

**Scenario 13.2: TABLE_LIST broadcast to all**
- **Given** a new table is created
- **When** `TABLE_LIST` is emitted
- **Then** all connected clients SHALL receive the update

**Scenario 13.3: Client joins table room on auth**
- **Given** a referee authenticates with table `table-1`
- **When** authentication completes
- **Then** the client's socket SHALL join room `table-1`

### Requirement 14: Table List Pagination

The table list SHALL support pagination or have a maximum limit.

#### Scenarios

**Scenario 14.1: Paginated table list**
- **Given** 100 tables exist
- **When** a client requests the table list
- **Then** the response SHALL contain at most 50 tables
- **And** the response SHALL include pagination metadata

**Scenario 14.2: Max table count**
- **Given** the server reaches 200 tables
- **When** a new table creation is attempted
- **Then** the server SHALL reject with `MAX_TABLES_REACHED`

### Requirement 15: Timing-Safe PIN Comparison

PIN comparisons SHALL use constant-time comparison to prevent timing attacks.

#### Scenarios

**Scenario 15.1: Owner PIN comparison**
- **Given** a VERIFY_OWNER request with a PIN
- **When** comparing against the stored owner PIN
- **Then** `crypto.timingSafeEqual()` SHALL be used
- **And** the comparison time SHALL NOT vary based on PIN content

**Scenario 15.2: Table PIN comparison**
- **Given** a table authentication request with a PIN
- **When** comparing against the stored table PIN
- **Then** `crypto.timingSafeEqual()` SHALL be used

### Requirement 16: ENCRYPTION_SECRET Required in Production

The `ENCRYPTION_SECRET` environment variable SHALL be required when running in production mode.

#### Scenarios

**Scenario 16.1: Missing secret in production**
- **Given** `NODE_ENV=production`
- **When** `ENCRYPTION_SECRET` is not set
- **Then** the server SHALL exit with code 1
- **And** the error message SHALL indicate `ENCRYPTION_SECRET` is required

**Scenario 16.2: Missing secret in development**
- **Given** `NODE_ENV=development`
- **When** `ENCRYPTION_SECRET` is not set
- **Then** the server SHALL generate a random secret
- **And** a warning SHALL be logged

### Requirement 17: Content Security Policy Headers

All HTTP responses SHALL include Content Security Policy and security headers.

#### Scenarios

**Scenario 17.1: CSP header present**
- **Given** any HTTP response from the server
- **When** the response headers are inspected
- **Then** `Content-Security-Policy` SHALL be present
- **And** it SHALL restrict script sources to `'self'`

**Scenario 17.2: Security headers present**
- **Given** any HTTP response from the server
- **When** the response headers are inspected
- **Then** `X-Content-Type-Options: nosniff` SHALL be present
- **And** `X-Frame-Options: DENY` SHALL be present
- **And** `X-XSS-Protection: 0` SHALL be present

### Requirement 18: Player Name Sanitization

Player names SHALL be sanitized to prevent XSS and injection attacks.

#### Scenarios

**Scenario 18.1: HTML tags stripped**
- **Given** a player name `<script>alert('xss')</script>`
- **When** the name is submitted
- **Then** the stored name SHALL be `alert('xss')` (tags stripped)
- **Or** the submission SHALL be rejected with `INVALID_NAME`

**Scenario 18.2: Special characters escaped**
- **Given** a player name with special characters `"; DROP TABLE`
- **When** the name is submitted
- **Then** the name SHALL be stored as-is (no SQL injection possible)
- **And** the name SHALL be escaped when rendered

### Requirement 19: Generic Error Messages to Clients

Error messages sent to clients SHALL NOT leak internal state or implementation details.

#### Scenarios

**Scenario 19.1: Validation error**
- **Given** a validation failure on the server
- **When** the error is sent to the client
- **Then** the message SHALL be generic (e.g., "Invalid input")
- **And** the detailed error SHALL be logged server-side only

**Scenario 19.2: Internal error**
- **Given** an internal server error
- **When** the error is sent to the client
- **Then** the message SHALL be "Internal error"
- **And** stack traces SHALL NOT be included

### Requirement 20: Decoupled Validation

The `validateSocketPayload` function SHALL NOT depend on Socket.io directly.

#### Scenarios

**Scenario 20.1: Validation with callback**
- **Given** a payload to validate
- **When** `validateSocketPayload` is called
- **Then** it SHALL accept an `emitError` callback instead of a socket object
- **And** it SHALL call the callback with error details on failure

**Scenario 20.2: Validation returns result**
- **Given** a payload to validate
- **When** `validateSocketPayload` is called
- **Then** it SHALL return a `{ valid: boolean, errors: string[] }` result

### Requirement 21: React Error Boundaries

The client application SHALL use Error Boundaries to prevent full app crashes.

#### Scenarios

**Scenario 21.1: Component error contained**
- **Given** a component throws an error during render
- **When** the error occurs
- **Then** the Error Boundary SHALL catch it
- **And** the rest of the app SHALL remain functional
- **And** a fallback UI SHALL be displayed

**Scenario 21.2: Error boundary at route level**
- **Given** the application routes
- **When** a route is rendered
- **Then** it SHALL be wrapped in an Error Boundary

### Requirement 22: Shared Validation Rules

PIN validation rules SHALL be defined in `shared/` and used by both client and server.

#### Scenarios

**Scenario 22.1: Shared PIN rules**
- **Given** PIN validation rules
- **When** both client and server validate PINs
- **Then** they SHALL import rules from `shared/validation.ts`
- **And** the rules SHALL be identical

### Requirement 23: ESLint no-unused-vars Enabled

The `no-unused-vars` rule SHALL be enabled in both client and server ESLint configs.

#### Scenarios

**Scenario 23.1: Unused variable detected**
- **Given** a variable is declared but never used
- **When** ESLint runs
- **Then** it SHALL report the unused variable

### Requirement 24: Dead Code Removed

All unused variables and dead code SHALL be removed from the codebase.

#### Scenarios

**Scenario 24.1: No _emit variables**
- **Given** the codebase
- **When** searching for `_emit` destructuring
- **Then** no instances SHALL be found

**Scenario 24.2: No any parameters**
- **Given** the AuthPage component
- **When** inspecting `handlePinSubmit`
- **Then** the parameter SHALL be properly typed (not `any`)

### Requirement 25: Unified Node Version

CI and Docker SHALL use the same Node.js version (Node 22).

#### Scenarios

**Scenario 25.1: CI uses Node 22**
- **Given** the CI workflow
- **When** the Node.js setup action runs
- **Then** it SHALL use Node.js 22

**Scenario 25.2: Docker uses Node 22**
- **Given** the Dockerfile
- **When** the base image is specified
- **Then** it SHALL use Node.js 22-alpine

### Requirement 26: Updated GitHub Actions

All GitHub actions SHALL use maintained versions.

#### Scenarios

**Scenario 26.1: Release action updated**
- **Given** the release workflow
- **When** the create-release action is used
- **Then** it SHALL use `softprops/action-gh-release@v1` (not deprecated `actions/create-release@v1`)

### Requirement 27: Configurable NODE_OPTIONS

The `NODE_OPTIONS` memory limit SHALL be configurable via environment variable.

#### Scenarios

**Scenario 27.1: Default memory limit**
- **Given** `NODE_OPTIONS_MEMORY` is not set
- **When** the server starts
- **Then** `NODE_OPTIONS` SHALL default to `--max-old-space-size=256`

**Scenario 27.2: Custom memory limit**
- **Given** `NODE_OPTIONS_MEMORY=512`
- **When** the server starts
- **Then** `NODE_OPTIONS` SHALL be `--max-old-space-size=512`
