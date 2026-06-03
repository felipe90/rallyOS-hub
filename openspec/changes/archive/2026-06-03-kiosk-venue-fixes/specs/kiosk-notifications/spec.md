# Delta for kiosk-notifications

## MODIFIED Requirements

### Requirement: Notification Type System

Four notification types MUST render distinct color-coded toasts AND play ADSR-enveloped Web Audio API sounds. The sound engine SHALL check `AudioContext.state` and call `ctx.resume()` if suspended before playback. Errors in audio context creation or playback MUST log via `console.warn` — no silent failure. Each sound SHALL be instantaneously distinguishable by audio alone. All sounds MUST use ADSR envelope via `setValueAtTime` + `exponentialRampToValueAtTime` on the gain node. Overall gain SHALL be boosted (from current `INITIAL_GAIN=0.3`) for venue audibility.

| Type | Color | Sound Design | Duration |
|------|-------|-------------|----------|
| info | Green | Major 3rd arpeggio (3 notes ascending C5→E5→G5, sine), quick attack 0.01s | ~600ms |
| warning | Amber | Perfect 4th staccato (2 notes G4→C5 alternating, triangle), medium attack 0.03s | ~400ms |
| error | Red | Descending tritone C5→F#4 + sub-oscillator A4 (sawtooth), long decay 0.4s | ~800ms |
| important | Primary | Perfect 5th fanfare (arpeggiated C major chord ascending, sine + 5th harmony), quick attack | ~900ms |

(Previously: simple sine/square oscillator beeps without ADSR envelope, musical intervals, AudioContext resume, error logging, gain boost, or reduced-motion sensitivity.)

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

## ADDED Requirements

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
