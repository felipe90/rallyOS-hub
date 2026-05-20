# kiosk-notifications Specification

## Purpose

Real-time organizer-to-kiosk alerts via Socket.IO. PIN-authenticated, rate-limited, typed notifications with color-coded toast and distinct audio.

## Requirements

### Requirement: Notification Events

Server MUST handle `SEND_NOTIFICATION` (Client→Server): validate PIN, strip HTML, rate-limit (5/min/IP), broadcast `KIOSK_NOTIFICATION` (Server→Client). Latency under 500ms.

| Event | Direction | Payload |
|-------|-----------|---------|
| `SEND_NOTIFICATION` | Client→Server | `{pin, type, message, duration}` |
| `KIOSK_NOTIFICATION` | Server→Client | `{type, message, duration}` |

#### Scenario: Owner sends notification

- GIVEN valid PIN
- WHEN `SEND_NOTIFICATION` fires
- THEN server validates, sanitizes, checks rate limit, broadcasts within 500ms

#### Scenario: Invalid PIN rejected

- GIVEN incorrect PIN
- WHEN `SEND_NOTIFICATION` fires
- THEN rejected, no broadcast, error to sender

#### Scenario: Rate limit exceeded

- GIVEN 5 from same IP in current minute
- WHEN 6th sent
- THEN error, no broadcast

### Requirement: Notification Type System

Four types with distinct color, Web Audio API sound, silent fallback if audio blocked:

| Type | Color | Sound |
|------|-------|-------|
| `info` | Green | Soft chime |
| `warning` | Yellow/amber | Attention tone |
| `error` | Red | Alert sound |
| `important` | Blue/purple | Bell |

#### Scenario: Type-driven color and sound

- GIVEN `error` notification
- WHEN toast renders
- THEN red background AND alert sound plays

#### Scenario: Audio blocked

- GIVEN audio context blocked
- WHEN toast renders
- THEN displays without sound, no error

### Requirement: Message Validation

Server MUST strip HTML tags. Messages SHALL NOT exceed 280 chars. Only PIN-authenticated owner MAY send.

#### Scenario: HTML stripped

- GIVEN owner sends `<b>break</b>`
- WHEN processed
- THEN broadcast is `break`

#### Scenario: Over 280 chars rejected

- GIVEN message is 281 characters
- WHEN `SEND_NOTIFICATION` fires
- THEN validation error, no broadcast

### Requirement: Configurable Duration

Duration MUST be selectable: 5, 10, 15, or 30 seconds. Default SHALL be 5s.

#### Scenario: Default 5s

- GIVEN no duration selected
- WHEN toast appears
- THEN auto-dismiss at 5s

#### Scenario: Custom 30s

- GIVEN owner selects 30s
- WHEN sent
- THEN auto-dismiss at 30s
