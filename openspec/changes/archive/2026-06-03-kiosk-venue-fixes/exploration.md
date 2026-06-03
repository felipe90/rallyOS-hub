# Exploration: Kiosk Venue Fixes

## Overview

Five issues identified from real-world venue testing of the kiosk display on Orange Pi + HDMI TV. Each verified against the actual codebase. Issue #4 (captive portal) is explicitly deferred and not part of this change.

---

## Issue 1: QR WiFi — Encoding Mismatch Prevents Auto-Connect

### Current State (Verified)

**QR code generation** — `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx:155`:
```tsx
value={`WIFI:T:WPA;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};;`}
```
- Encryption type: `T:WPA` (WPA-Personal with TKIP)

**hostapd configuration** — `scripts/setup-orangepi-ap.sh:238-241`:
```
wpa=2
wpa_passphrase=${AP_PASSPHRASE}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
```
- AP runs WPA2-PSK with CCMP (AES) only — NO TKIP fallback
- `wpa=2` means WPA2 only, `rsn_pairwise=CCMP` means AES encryption exclusively

### Root Cause

The QR code advertises `T:WPA` (WPA1/TKIP), but the access point only supports WPA2/AES. Modern phones (Android 10+, iOS 14+) interpret the QR literally: they scan, see WPA, attempt to connect with TKIP, the AP rejects it (it only speaks WPA2/AES), and the phone falls back to opening WiFi settings instead of auto-connecting. The user sees the settings screen, not a connected-to-WiFi state.

### Solution Proposed

Change line 155 from:
```tsx
value={`WIFI:T:WPA;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};;`}
```
to:
```tsx
value={`WIFI:T:WPA2;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};H:false;;`}
```

**Changes:**
- `T:WPA` → `T:WPA2` — matches hostapd `wpa=2` exactly
- Add `H:false` — explicit declaration that SSID is broadcast (matches `ignore_broadcast_ssid=0` in hostapd)
- Remove trailing `;` redundancy (original had double `;;`; the WiFi QR spec uses `;;` as terminator, but `;H:false;;` is the canonical closing)

**WiFi QR Format Reference** (Zxing standard):
```
WIFI:T:<auth>;S:<ssid>;P:<pass>;H:<hidden>;;
```
- `T:WPA` = WPA-Personal (TKIP)
- `T:WPA2` = WPA2-Personal (AES/CCMP)
- `H:false` = SSID is broadcast (not hidden)

### Complexity: **Trivial**
### Risk: **None** — one-line change, purely declarative, no logic changes

---

## Issue 2: URL Too Long to Type — Add URL QR Code

### Current State (Verified)

`KioskAllTablesPage.tsx:151-174` already shows:
1. A WiFi QR code (left side of header area)
2. The full hub URL as monospace text: `https://{hubConfig.domain}:{hubConfig.port}` (line 164-166)
3. A helper text: "Abrí {domain}" (line 168-170)

**What's missing:** There is no QR code for the URL itself. Users must manually type `https://rallyos-hub.local:3000` on their phone — error-prone, slow, and frustrating in a venue setting.

### Solution Proposed

Add a second `QRCodeSVG` component next to the WiFi QR that encodes the hub URL:
```tsx
<QRCodeSVG
  value={`https://${hubConfig.domain}:${hubConfig.port}`}
  size={qrSize}
  bgColor="#ffffff"
  fgColor="#000000"
  level="M"
  includeMargin={true}
/>
```

**Layout:** Place the URL QR between the WiFi QR and the URL text. The current layout is:
```
[WiFi QR] [URL text + helper text]
```
New layout:
```
[WiFi QR] [URL QR] [URL text + helper text]
```

Label each QR with a small caption ("WiFi" / "App") so users know the two-step flow: scan WiFi first → then scan URL.

### Complexity: **Low**
### Risk: **Low** — purely additive markup, no logic changes. The `qrSize` hook already computes responsive size. The `QRCodeSVG` import is already present.

**Edge case:** The URL QR should render even when `hubConfig.wifiPassword` is absent (currently the WiFi QR is gated on `hubConfig.wifiPassword` at line 153). The URL QR only depends on `hubConfig.domain`, which is already the gate at line 151.

---

## Issue 3: Toast Notifications Illegible at Distance — Venue-Scale Typography

### Current State (Verified)

`KioskNotificationToast.tsx:134-141`:
```tsx
className={`fixed bottom-0 left-0 right-0 z-50 ${colorClass} text-white m-4 rounded-lg shadow-lg`}
// ...
<Icon size={40} />
<span className="text-lg font-semibold">{notification.message}</span>
```

**Current measurements:**
| Element | Current | Target (20-ft rule) |
|---------|---------|---------------------|
| Message text | 18px (`text-lg`) | 48-60pt bold headline (~64-80px) |
| Icon | 40px | "Badge-sized", massive |
| Container height | `py-6` (24px) + content | 15-20% viewport height (162-216px @1080p) |
| Margin | `m-4` (16px) | Should be proportional |
| Background | `bg-green-600` (solid) | Solid, near-opaque (90% opacity / slight translucency) |

### Root Cause

The toast was designed for desktop/tablet viewing distance (~2-3 feet), not for a TV viewed from across a room (15-20 feet). An 18px font on a 55" TV at 20 feet subtends approximately 3 arc-minutes — below the threshold for comfortable reading of short text (~10 arc-minutes for headlines).

### Solution Proposed

**Typography scale:**
- `text-5xl` (48px) minimum for message headline, `text-6xl` (60px) preferred
- `font-bold` instead of `font-semibold`
- No subtext needed — the single message acts as both headline and body

**Toast sizing:**
- `min-h-[15vh]` (15% viewport height) with `max-h-[20vh]`
- `px-12 py-8` (48px horizontal, 32px vertical padding)
- `bottom-0` position kept, add `mb-8` (32px) for breathing room from screen edge
- Keep `rounded-lg` for visual polish

**Background:**
- Current `bg-green-600`, `bg-amber-500`, `bg-red-600`, `bg-primary` — already fully opaque solid colors (Tailwind solid backgrounds). The original concern about "transparencia" is actually about making the text background MORE solid — current colors are already solid. 
- **Add:** `bg-opacity-90` with a dark backdrop filter (`backdrop-brightness-50`) to ensure text is legible even on bright backgrounds

**Icons:**
- Size 96px minimum (`size={96}`) for badge-like presence
- Drop the current `shrink-0` constraint — at this size the icon needs proper spacing
- Add a subtle ring/border around icon area for badge effect

### Complexity: **Medium**
### Risk: **Medium** — CSS changes only, but touch multiple visual properties that should be tested on real hardware at distance. Needs responsive testing across 720p/1080p. No logic changes.

### Existing Tests
- `KioskNotificationToast.test.tsx` (336 lines): Covers rendering, sound, auto-dismiss. No tests currently check font sizes or layout dimensions. These tests will continue to pass after the CSS changes (they check presence of text, not its pixel size). **No test breakage expected.**

---

## Issue 4: Captive Portal — DEFERRED

Explicitly excluded from this change. Not in scope.

---

## Issue 5a: Toast Sound Not Audible — Chrome Autoplay Policy

### Current State (Verified)

**Sound engine** — `KioskNotificationToast.tsx:45-85`:
```typescript
function playSound(type: KioskNotificationData['type']): void {
  try {
    const config = SOUND_MAP[type]
    const ctx = new AudioContext()
    // ... osc creation, no state check ...
    oscillator.start(ctx.currentTime)
  } catch {
    // Silent fallback — no logging
  }
}
```

**Key issues:**
1. `new AudioContext()` is called without checking `ctx.state`. Chrome's Autoplay Policy places AudioContext in `'suspended'` state when created without a prior user gesture. In kiosk mode, there's never a user gesture — Chromium auto-loads on boot. Attempting `oscillator.start()` on a suspended context **does not throw** — it silently queues the start and never plays. The `.start()` call succeeds, the oscillator just never produces output.
2. The `catch` block on line 81 **swallows all errors silently** — no logging, no alternative. If audio fails, there's zero visibility into why.
3. The `catch` comment says "kiosk already has autoplay policy configured" — **this is incorrect**. The `start-kiosk.sh` script does NOT include `--autoplay-policy=no-user-gesture-required`.

**Chrome launch flags** — `scripts/start-kiosk.sh:84-100`:
```
exec "$CHROMIUM_BIN" \
    --kiosk \
    --start-fullscreen \
    --no-sandbox \
    --ignore-certificate-errors \
    --no-first-run \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-translate \
    --disable-infobars \
    --disable-features=TranslateUI \
    --disk-cache-dir=/tmp/chromium-cache \
    --user-data-dir=/tmp/chromium-kiosk \
    "${KIOSK_URL}" 2>&1
```
**`--autoplay-policy=no-user-gesture-required` is MISSING.**

### Root Cause

Two-fold:
1. **Chrome flag missing** — without `--autoplay-policy=no-user-gesture-required`, Chrome requires a user interaction before any AudioContext can leave the `suspended` state. The kiosk auto-loads at boot with no user interaction possible.
2. **Code doesn't handle suspended state** — even if the flag were present, good practice is to check `ctx.state` and call `ctx.resume()` if suspended. The current code assumes the context is always `'running'`.

### Solution Proposed

**1. Chrome launch flag** — Add to `scripts/start-kiosk.sh`:
```bash
--autoplay-policy=no-user-gesture-required \
```

**2. Code fix** — `KioskNotificationToast.tsx` `playSound()` function:
```typescript
function playSound(type: KioskNotificationData['type']): void {
  try {
    const config = SOUND_MAP[type]
    const ctx = new AudioContext()
    
    // Resume if suspended (Chrome autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch((e) => {
        console.warn('[KioskSound] AudioContext resume failed:', e.message)
      })
    }
    
    const durationSeconds = config.durationMs / 1000
    // ... rest of oscillator setup ...
  } catch (e) {
    console.warn('[KioskSound] AudioContext creation failed:', e instanceof Error ? e.message : e)
  }
}
```

**3. Add error logging** to the catch block so failures are visible in Chromium's console / system logs.

### Complexity: **Low**
### Risk: **Low** — Chrome flag is purely additive. AudioContext.resume() is a standard API with graceful fallback. The `.resume()` call is async but non-blocking for the rest of the function.

### Dependency: **Issue 5a is a prerequisite for Issue 5b** — improved sounds are useless if no sound plays at all.

---

## Issue 5b: Sound Synthesis Needs Musical Personality

### Current State (Verified)

`SOUND_MAP` — `KioskNotificationToast.tsx:31-36`:
```typescript
const SOUND_MAP: Record<KioskNotificationData['type'], SoundConfig> = {
  info:      { waveform: 'sine',   frequency: 880,  durationMs: 200 },                     // A5 sine, 200ms
  warning:   { waveform: 'sine',   frequency: 660,  durationMs: 300 },                     // E5 sine, 300ms
  error:     { waveform: 'square', frequency: 440,  durationMs: 400 },                     // A4 square, 400ms
  important: { waveform: 'sine',   frequency: 1047, durationMs: 500, secondFrequency: 1319 }, // C6+E6 sine chord, 500ms
}
```

**Analysis of current sounds:**

| Type | Frequencies | Interval | Musical feel | Duration | Issues |
|------|------------|----------|-------------|----------|--------|
| info (880Hz A5) | Single tone | — | Neutral | 200ms | Too short; can't register before it ends. Same octave as chord tones but as single note feels empty. |
| warning (660Hz E5) | Single tone | — | Ambiguous | 300ms | Too close to info in timbre (both sine). Barely distinguishable at distance. |
| error (440Hz A4) | Single tone | — | Harsh | 400ms | Square wave = aggression, correct intent. But still just a beep. |
| important (1047+1319 C6+E6) | Major 3rd | Consonant, "happy" | 500ms | Best of the bunch — actually a chord. But the major 3rd feels celebratory, not "important/urgent". |

**Problems:**
1. **No ADSR envelope** — oscillators start/stop abruptly. There's a fade-out via `exponentialRampToValueAtTime`, but no attack, decay, or sustain phase. This makes every sound feel like a "beep" (instant on, linear fade out).
2. **Arbitrary frequencies** — they happen to be musical notes (A440 scale) but without deliberate interval relation to their purpose.
3. **Info and warning are nearly indistinguishable** — both sine waves, similar duration, frequencies only 220Hz apart (a perfect 4th, which is a very stable interval).
4. **Durations too short** — 200ms is barely perceptible; 300-500ms is a brief blip. For venue use, sounds need to CUT THROUGH ambient noise and register clearly.

### Solution Proposed

Redesign `SOUND_MAP` with **ADSR envelope** + **purposeful musical intervals** + **note sequences** + **longer durations**:

**Envelope system:**
Add ADSR parameters to `SoundConfig`:
```typescript
interface SoundConfig {
  waveform: OscillatorType
  frequency: number
  durationMs: number
  secondFrequency?: number
  // ADSR envelope (in seconds)
  attack?: number   // time to peak volume
  decay?: number    // time from peak to sustain
  sustain?: number  // sustain volume level (0-1 multiplier of INITIAL_GAIN)
  release?: number  // time from sustain to silent
  notes?: number[]  // sequence of frequencies (overrides single frequency)
  noteDuration?: number // ms per note in sequence
}
```

**New sound design:**

| Type | Musical Intent | Notes | Duration | ADSR | Waveform |
|------|---------------|-------|----------|------|----------|
| **info** | Joyous, uplifting — "something good happened" | C5→E5→G5 (ascending major triad arpeggio) | 600ms | Quick attack (0.01s), medium decay (0.3s), medium sustain (0.6), medium release (0.1s) | sine |
| **warning** | Attention, heads-up — "pay attention, change coming" | G4→C5 (ascending perfect 4th, repeated) | 700ms | Medium attack (0.03s), quick decay (0.1s), high sustain (0.8), medium release (0.15s) | triangle |
| **error** | Tension, urgency — "something is wrong" | C5→F#4 (descending tritone) + A4 simultaneous | 800ms | Medium attack (0.05s), slow decay (0.4s), medium sustain (0.5), long release (0.2s) | sawtooth |
| **important** | Power, authority — "winner announced, critical moment" | G4→C5→E5→C6 (arpeggiated C major chord, ascending) | 900ms | Quick attack (0.01s), medium decay (0.2s), high sustain (0.7), long release (0.3s) | sine + second sine a 5th above |

**Musical rationale:**
- **Info = major triad (C-E-G):** Universally recognized as "happy/positive/complete." Ascending = forward motion.
- **Warning = perfect 4th (G→C):** The "here comes the bride" / fanfare interval. Historically used for announcements/attention. Open, questioning feel — not yet resolved.
- **Error = tritone (C→F#):** The "diabolus in musica" — the most dissonant interval in Western music. Descending = negative, falling, wrong.
- **Important = ascending C major arpeggio with 5th harmonization:** The 5th (C→G) is the most stable, powerful interval — "pillar" of Western harmony. Arpeggiated chord = ceremonial, trumpets/announcement.

### Complexity: **Medium-High**
### Risk: **Medium** — Pure code changes (AudioContext Web API only). The ADSR system adds implementation complexity but no new dependencies. Must test across Chrome versions on ARM64 (Orange Pi). The `SoundConfig` interface changes are internal to this file only.

### Dependency: **Blocked by Issue 5a** — sound improvements are meaningless if audio doesn't play. Issue 5a MUST be resolved first.

### Existing Tests
- Tests mock `AudioContext` and check that `oscillator.start()` was called. They don't test specific frequencies, waveforms, or durations. The ADSR changes are internal to `playSound()` and won't break existing tests as long as `start()` is still called. However, the `SOUND_MAP` export is tested indirectly through AudioContext mock behavior.
- **New tests needed:** Test that ADSR envelope parameters are applied (gain scheduling), verify musical intervals for each type, test note sequences produce multiple oscillator starts.

---

## Dependencies Between Issues

```
Issue 5a (autoplay fix)
    └── BLOCKS ──→ Issue 5b (sound synthesis)
                    (sound improvements worthless if audio never plays)

Issue 1 (WiFi QR encoding)    ─── INDEPENDENT ───
Issue 2 (URL QR)              ─── INDEPENDENT ───
Issue 3 (toast typography)    ─── INDEPENDENT ───
```

Issues 1, 2, and 3 are fully independent and can be implemented in any order. Issues 1 and 2 share the same file (`KioskAllTablesPage.tsx`) but affect different lines — no merge conflicts expected. Issue 5a blocks 5b.

---

## Affected Files Summary

| File | Issues | Nature of change |
|------|--------|-----------------|
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | #1, #2 | One-line QR fix (#1), add second QR component (#2) |
| `client/src/components/organisms/KioskNotificationToast/KioskNotificationToast.tsx` | #3, #5a, #5b | CSS typography overhaul (#3), AudioContext resume (#5a), ADSR + musical sounds (#5b) |
| `client/src/components/organisms/KioskNotificationToast/KioskNotificationToast.test.tsx` | #5b | New tests for ADSR envelope, note sequences |
| `scripts/start-kiosk.sh` | #5a | Add `--autoplay-policy=no-user-gesture-required` flag |
| `openspec/specs/kiosk-display/spec.md` | #1, #2, #3 | Delta specs for QR WiFi encoding, URL QR, venue typography |
| `openspec/specs/kiosk-notifications/spec.md` | #5a, #5b | Delta specs for autoplay fix, ADSR sound design |

### Files NOT affected
- `server/src/index.ts` — hubConfig shape already includes all fields needed (ssid, wifiPassword, domain, port). No server changes needed for QR fixes.
- `scripts/setup-orangepi-ap.sh` — hostapd config is correct (WPA2/AES). The bug is in the QR, not the AP config.
- `.env` / `.env.example` — existing env vars sufficient.
- `shared/types.ts` — KioskNotificationData shape unchanged.

---

## Complexity Estimation

| Issue | Complexity | Description |
|-------|-----------|-------------|
| #1 QR WiFi encoding | Trivial | One-line string change, zero logic |
| #2 URL QR | Low | Add second QRCodeSVG, label, no logic changes |
| #3 Toast typography | Medium | CSS overhaul: font sizes, sizing units, icon scale, background. No JS logic changes. Needs visual QA on TV. |
| #5a Autoplay fix | Low | Add Chrome flag + `ctx.resume()` call + logging. Standard Web Audio API pattern. |
| #5b Sound redesign | Medium-High | ADSR system, musical intervals, note sequences. Pure JS, no dependencies. Requires new tests. |
| **Total** | **Medium** | 5 changes across 4 files (+1 script). Independent issues can parallelize. |

---

## Recommendation: Quick Wins First

### Phase 1 — Quick Wins (ship immediately, low risk)
1. **Issue #1 (QR WiFi):** One line. Fixes the primary onboarding friction. Zero regression risk.
2. **Issue #5a (Autoplay):** Script flag + 3 lines of JS. Unblocks sound entirely. Add logging so we can see what's happening in kiosk console.
3. **Issue #2 (URL QR):** Purely additive. Immediate UX improvement for venue users.

### Phase 2 — Venue-Scale UX (needs visual QA)
4. **Issue #3 (Toast typography):** CSS-only, but needs testing on actual TV at distance. No logic changes → low regression risk. But font sizes should be validated at 20ft before finalizing.
5. **Issue #5b (Sound redesign):** Most complex change. Should be done AFTER 5a is verified working. Musical/interactive design benefits from iteration — test the sounds in the actual venue environment.

---

## Related Specs (for reference)

- `openspec/specs/kiosk-display/spec.md` — QR display, toast overlay, responsive sizing
- `openspec/specs/kiosk-notifications/spec.md` — notification events, type system, sound, validation
- `openspec/specs/qr-scoreboard-link/spec.md` — QR link generation for scoreboard

---

## Key Learnings from Code Verification

1. **WiFi QR `T:WPA` vs `wpa=2` mismatch is confirmed real.** The QR advertises WPA1/TKIP, the AP only speaks WPA2/AES. Phones interpret this literally — they try WPA1, fail, and open Settings instead of auto-connecting.
2. **`--autoplay-policy=no-user-gesture-required` is NOT in `start-kiosk.sh`.** The catch block comment claiming "kiosk already has autoplay policy configured" is false. This is the root cause of silent toasts.
3. **Current `SOUND_MAP` frequencies ARE musical notes** (A440-scale: A4=440, E5=660, A5=880, C6=1047, E6=1319) — they're just not being used with musical intent. The `important` type uses C6+E6 which IS a major 3rd interval (consonant), making it the most pleasant sound by accident.
4. **Toast background colors are already fully opaque** (`bg-green-600` etc. are solid Tailwind colors). The "10% transparencia" request from the user means they want near-opaque — the current colors already satisfy this. The real readability issue is font size, not background transparency.
5. **Existing tests will pass through all proposed changes** — the test suite checks behavior (rendering, auto-dismiss, sound calls), not pixel sizes or specific frequencies. Only Issue #5b may need new tests for ADSR verification.
