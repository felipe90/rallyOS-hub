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

Four notification types MUST render distinct color-coded toasts AND play ADSR-enveloped Web Audio API sounds. The sound engine SHALL check `AudioContext.state` and call `ctx.resume()` if suspended before playback. Errors in audio context creation or playback MUST log via `console.warn` — no silent failure. Each sound SHALL be instantaneously distinguishable by audio alone. All sounds MUST use ADSR envelope via `setValueAtTime` + `exponentialRampToValueAtTime` on the gain node. Overall gain SHALL be boosted (from current `INITIAL_GAIN=0.3`) for venue audibility.

| Type | Color | Sound Design | Duration |
|------|-------|-------------|----------|
| info | Green | Major 3rd arpeggio (3 notes ascending C5→E5→G5, sine), quick attack 0.01s | ~600ms |
| warning | Amber | Perfect 4th staccato (2 notes G4→C5 alternating, triangle), medium attack 0.03s | ~400ms |
| error | Red | Descending tritone C5→F#4 + sub-oscillator A4 (sawtooth), long decay 0.4s | ~800ms |
| important | Primary | Perfect 5th fanfare (arpeggiated C major chord ascending, sine + 5th harmony), quick attack | ~900ms |

#### Scenario: Type-driven color and sound

- GIVEN `error` notification arrives
- WHEN toast renders
- THEN red background AND descending tritone sound with sawtooth waveform plays

#### Scenario: AudioContext resume on suspended

- GIVEN AudioContext is in `'suspended'` state (no prior user gesture in kiosk)
- WHEN `playSound()` is called
- THEN `ctx.resume()` is invoked AND sound plays after context transitions to `'running'`

#### Scenario: Error logging on audio failure

- GIVEN AudioContext creation or playback fails
- WHEN `playSound()` catch block executes
- THEN `console.warn('[KioskSound]', ...)` logs the error AND toast still renders visibly

#### Scenario: Auditory discriminability

- GIVEN a warning notification sound plays without visual context
- WHEN a listener hears it
- THEN they can distinguish it from info, error, and important sounds by timbre and interval

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

### Requirement: Chrome Kiosk Autoplay Flag

The `scripts/start-kiosk.sh` launch script MUST include `--autoplay-policy=no-user-gesture-required` in the Chromium command-line flags. This flag SHALL allow AudioContext to start in `'running'` state without prior user interaction.

(NOTIF-002)

#### Scenario: Audio works without user gesture

- GIVEN Chromium kiosk launched with `--autoplay-policy=no-user-gesture-required`
- WHEN a notification fires without any prior user interaction
- THEN audio plays without Chrome blocking the AudioContext

### Requirement: Reduced Motion Sound

When the user has `prefers-reduced-motion: reduce`, the system SHALL use lower gain and gentler sequences — no aggressive sawtooth or rapid staccato patterns. Sine and triangle waveforms with reduced amplitude SHALL be used instead.

(NOTIF-008)

#### Scenario: Reduced motion triggers softer sounds

- GIVEN user's OS/browser has `prefers-reduced-motion: reduce`
- WHEN a notification fires
- THEN sound uses lower gain AND waveform defaults to sine/triangle with no aggressive sequences
