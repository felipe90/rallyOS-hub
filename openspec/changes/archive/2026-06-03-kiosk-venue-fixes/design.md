# Design: Kiosk Venue Fixes

## Technical Approach

Five independent fixes to the kiosk scoreboard displayed on Orange Pi + HDMI TV at venues. Changes are all client-side, zero server/DB impact. Implementation split into two phases: Phase 1 (QR fixes, autoplay flag — zero regression risk) and Phase 2 (toast typography, ADSR sound — blocked by autoplay fix).

## Architecture Decisions

| # | Decision | Options | Rationale |
|---|----------|---------|-----------|
| 1 | Hardcoded `size={180}` for QRs instead of `useResponsiveQrSize()` hook | Modify hook max to 180, or inline 180 | Hook currently caps at 160px; spec requires ≥256px, user design specifies 180px. Inline 180 avoids coupling QR sizing to page layout hook. Hook left unchanged — other consumers unaffected. |
| 2 | Dual QR layout: `flex-col` (not horizontal row) | flex-col vs flex-row | User design mandates stacked layout. Note: spec QR-004 says "horizontal row" — this is a known spec/design divergence to resolve before apply. |
| 3 | `T:WPA2;H:false;;` WiFi encoding | T:WPA vs T:WPA2 vs T:WPA2+AES | `T:WPA2` matches hostapd `wpa=2` config. `H:false` explicit hidden=false prevents some phones from prompting manual entry. Double `;;` is correct spec terminator. |
| 4 | Singleton `AudioContext` via `getAudioContext()` | Singleton vs per-call | Chrome limits AudioContext count. Per-call creation leaks memory and risks "suspended" state. Lazy-init singleton shared across all sounds. |
| 5 | Toast styling: `kioskMode` prop for conditional scaling | Prop vs always-venue | Component currently only used on kiosk page, but spec TOAST-007 mandates non-kiosk preservation. Adding `kioskMode` prop (default false) future-proofs. |
| 6 | ADSR: `linearRampToValueAtTime` for attack/decay | Linear vs exponential | Linear provides cleaner onset for musical envelopes. Exponential would create unnatural "suck-in" on attack. |
| 7 | `matchbox-window-manager` still used in script | Keep vs replace | Script already uses matchbox (line 68). Only adding `--autoplay-policy` flag to existing `exec` line — no structural changes. |

## Data Flow

No changes — all data flows unchanged. `hubConfig` arrives via WebSocket `hubConfig` event → `useSocketState` → `SocketContext` → `KioskAllTablesPage`. Both QR values derived from `hubConfig.domain`, `hubConfig.port`, `hubConfig.wifiPassword`. Toast receives `kioskNotification` from same socket flow.

```
Server (hubConfig event) → SocketContext → KioskAllTablesPage
                                              ├─ QR WiFi (T:WPA2;...)
                                              └─ QR URL  (https://{domain}:{port})
```

## Component Design

### 1. KioskAllTablesPage — Dual QR Layout

**Current state**: Single QR with `T:WPA`, `level="M"`, conditional on `hubConfig.domain && hubConfig.wifiPassword`.

**Changes**:
- Replace single QR with two `QRCodeSVG` components in a `flex-col gap-6` wrapper
- WiFi QR: `T:WPA2;H:false;;`, `size={180}`, `level="H"`, conditional on `hubConfig.wifiPassword`
- URL QR: `https://{hubConfig.domain}:{hubConfig.port}`, `size={180}`, `level="H"`, always visible when `hubConfig.domain`
- Remove `useResponsiveQrSize()` import, use literal `180`
- Add i18n keys: `scoreboardWifiQrCta`, `scoreboardUrlQrCta`
- URL text line (monospace) stays below the URL QR

```tsx
// Header QR section (replaces lines 151-173)
{hubConfig?.domain && (
  <div className="flex flex-col items-end gap-6">
    {/* WiFi QR — conditional */}
    {hubConfig.wifiPassword && (
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-semibold">📶 {i18nText('scoreboardWifiQrCta')}</span>
        <QRCodeSVG
          value={`WIFI:T:WPA2;S:${hubConfig.ssid};P:${hubConfig.wifiPassword};H:false;;`}
          size={180} bgColor="#ffffff" fgColor="#000000"
          level="H" includeMargin={true}
        />
      </div>
    )}
    {/* URL QR — always visible */}
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm font-semibold">🔗 {i18nText('scoreboardUrlQrCta')}</span>
      <QRCodeSVG
        value={`https://${hubConfig.domain}:${hubConfig.port}`}
        size={180} bgColor="#ffffff" fgColor="#000000"
        level="H" includeMargin={true}
      />
      <Typography variant="label" className="text-text/80 text-xs font-mono">
        https://{hubConfig.domain}:{hubConfig.port}
      </Typography>
    </div>
  </div>
)}
```

### 2. KioskNotificationToast — Venue-Scale Typography

**Changes**:
- Add `kioskMode?: boolean` prop (default false)
- When `kioskMode=true`: apply venue-scale classes; when false, preserve original design
- Container: `min-h-[15vh]`, `bg-{color}/90`, `rounded-xl`, `shadow-2xl`
- Typography: `text-5xl md:text-6xl lg:text-7xl font-black`
- Icon: `size={80}` (vs current 40)
- Layout: `flex items-center justify-center gap-8` (vs current gap-6)

```tsx
const isKiosk = kioskMode ?? false

return (
  <ToastWrapper
    {...toastMotionProps}
    className={clsx(
      'fixed bottom-0 left-0 right-0 z-50 text-white m-4',
      isKiosk
        ? `${colorClass}/90 min-h-[15vh] rounded-xl shadow-2xl`
        : `${colorClass} rounded-lg shadow-lg`
    )}
    role="alert"
  >
    <div className={clsx(
      'flex items-center justify-center',
      isKiosk ? 'gap-8 px-8 py-6' : 'gap-6 px-8 py-6 max-w-6xl mx-auto'
    )}>
      <span className="shrink-0" data-testid={`toast-icon-${notification.type}`}>
        <Icon size={isKiosk ? 80 : 40} />
      </span>
      <span className={isKiosk ? 'text-5xl md:text-6xl lg:text-7xl font-black leading-tight' : 'text-lg font-semibold'}>
        {notification.message}
      </span>
    </div>
  </ToastWrapper>
)
```

### 3. Audio Engine — ADSR Synthesis + Autoplay Resilience

**Changes**: Full rewrite of `playSound()` and `SOUND_MAP`. New module-level singleton context, ADSR per note, note sequences.

```tsx
// ── Singleton AudioContext ──
let _audioCtx: AudioContext | null = null
function getAudioContext(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

// ── ADSR helper ──
function applyAdsr(
  gainNode: GainNode, ctx: AudioContext,
  attack: number, decay: number, sustain: number, release: number, duration: number, gain: number
) {
  const t = ctx.currentTime
  gainNode.gain.setValueAtTime(0, t)
  gainNode.gain.linearRampToValueAtTime(gain, t + attack)
  gainNode.gain.linearRampToValueAtTime(gain * sustain, t + attack + decay)
  gainNode.gain.setValueAtTime(gain * sustain, t + duration - release)
  gainNode.gain.linearRampToValueAtTime(0.001, t + duration)
}

// ── Extended SoundConfig ──
interface SoundConfig {
  notes: Array<{ freq: number; startOffset: number; duration: number; waveform: OscillatorType }>
  adsr: { attack: number; decay: number; sustain: number; release: number }
  totalDuration: number
  gain: number
}

const SOUND_MAP_V2: Record<KioskNotificationData['type'], SoundConfig> = {
  info: {
    notes: [
      { freq: 523, startOffset: 0, duration: 0.18, waveform: 'sine' },
      { freq: 659, startOffset: 0.18, duration: 0.18, waveform: 'sine' },
      { freq: 784, startOffset: 0.36, duration: 0.18, waveform: 'sine' },
    ],
    adsr: { attack: 0.02, decay: 0.05, sustain: 0.7, release: 0.05 },
    totalDuration: 0.6, gain: 0.4,
  },
  // ... warning, error, important follow same pattern
}

async function playSound(type: KioskNotificationData['type'], reduceMotion: boolean): Promise<void> {
  try {
    const config = SOUND_MAP_V2[type]
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const gain = reduceMotion ? config.gain * 0.6 : config.gain
    const duration = reduceMotion ? config.totalDuration * 0.5 : config.totalDuration

    for (const note of config.notes) {
      const osc = ctx.createOscillator()
      const gn = ctx.createGain()
      osc.type = reduceMotion ? (note.waveform === 'sawtooth' ? 'sine' : note.waveform) : note.waveform
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.startOffset)
      applyAdsr(gn, ctx, config.adsr.attack, config.adsr.decay, config.adsr.sustain, config.adsr.release, note.duration, gain)
      osc.connect(gn); gn.connect(ctx.destination)
      osc.start(ctx.currentTime + note.startOffset)
      osc.stop(ctx.currentTime + note.startOffset + note.duration + 0.05)
    }
  } catch (err) {
    console.warn('[KioskSound]', err)
  }
}
```

### 4. Chrome Kiosk Launch Script

**File**: `scripts/start-kiosk.sh` (line 84, `exec` call)

Add `--autoplay-policy=no-user-gesture-required` to the existing Chromium flags:

```bash
exec "$CHROMIUM_BIN" \
    --kiosk \
    --autoplay-policy=no-user-gesture-required \
    # ... rest of flags unchanged
```

## File Manifest

| File | Action | Summary |
|------|--------|---------|
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | Modify | Dual QR layout: WPA2 fix, URL QR, i18n CTAs, remove `useResponsiveQrSize` |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.test.tsx` | Modify | Update QR tests: expect `T:WPA2`, second SVG, new i18n keys |
| `client/src/components/organisms/KioskNotificationToast/KioskNotificationToast.tsx` | Modify | Add `kioskMode` prop, venue typography, ADSR sound engine |
| `client/src/components/organisms/KioskNotificationToast/KioskNotificationToast.test.tsx` | Modify | Extend sound mocks for ADSR, `resume()`, `console.warn`, note sequences |
| `client/src/i18n/locales/es.json` | Modify | Add `scoreboardWifiQrCta`, `scoreboardUrlQrCta` |
| `client/src/i18n/locales/en-US.json` | Modify | Add `scoreboardWifiQrCta`, `scoreboardUrlQrCta` |
| `scripts/start-kiosk.sh` | Modify | Add `--autoplay-policy=no-user-gesture-required` |

## Interfaces / Contracts

**KioskNotificationToastProps** (extended):
```tsx
export interface KioskNotificationToastProps {
  notification: KioskNotificationData
  onDismiss: () => void
  kioskMode?: boolean  // NEW — default false
}
```

**KioskAllTablesPage**: Pass `kioskMode={true}` to toast:
```tsx
<KioskNotificationToast
  notification={visibleNotification}
  onDismiss={() => setVisibleNotification(null)}
  kioskMode
/>
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit — QR | WiFi encoding `T:WPA2;H:false;;` in rendered SVG value | Query `svg` elements, assert count=2 when wifiPassword present, count=1 when absent, check `value` attr |
| Unit — QR | URL QR encodes `https://{domain}:{port}` | Assert second SVG exists with correct value |
| Unit — QR | WiFi QR hidden when `wifiPassword` absent, URL QR still visible | Conditional render test |
| Unit — Toast | Venue typography classes applied when `kioskMode=true` | `toHaveClass('text-5xl')`, `toHaveClass('min-h-[15vh]')` |
| Unit — Toast | Original design preserved when `kioskMode=false` (default) | Assert `text-lg`, icon `size={40}`, no viewport-height |
| Unit — Sound | ADSR envelope: `linearRampToValueAtTime` called with correct attack/decay params | Extend mock `GainNode.gain` with spy on `setValueAtTime` + `linearRampToValueAtTime` |
| Unit — Sound | `ctx.resume()` called when state is `'suspended'` | Mock `AudioContext.state` as `'suspended'`, assert `resume` called |
| Unit — Sound | `console.warn` on error; toast still renders | `shouldThrowContextCreation=true`, spy on `console.warn` |
| Unit — Sound | `prefers-reduced-motion` reduces gain and duration | Pass `reduceMotion=true`, assert lower gain values |
| Integration | Full page renders both QRs with real hubConfig | Existing `KioskAllTablesPage` test extended |

**Tests that may break**: 
- QR test at line 132 checks for single `svg` — expect 2 now
- QR test at line 464 checks `toHaveAttribute('width')` — still valid
- Sound tests check `audioContextCreated` — singleton means created once, need test isolation

## Rollback Plan

- **QR**: Revert `T:WPA2` → `T:WPA`, remove second QR block, restore `useResponsiveQrSize()`
- **Toast**: Remove `kioskMode` prop, revert `className` + `Icon size` to original values
- **Sound**: Restore original `playSound()` + `SOUND_MAP`, remove `getAudioContext()` singleton
- **Script**: Remove `--autoplay-policy` flag
- All changes are additive or single-line — no DB, no API, no migration

## Open Questions

- [ ] **Spec conflict**: QR-004 mandates horizontal row layout; user design specifies `flex-col` stack. Resolve before apply.
- [ ] **QR size**: Spec says ≥256px but `useResponsiveQrSize` caps at 160px. Design uses hardcoded 180px as compromise. Confirm acceptable.
