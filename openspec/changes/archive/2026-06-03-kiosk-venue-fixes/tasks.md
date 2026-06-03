# Tasks: Kiosk Venue Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~215 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All kiosk venue fixes | PR 1 | Under 400-line budget; single PR safe |

## Phase 1: Quick Wins (independent, low risk)

- [x] **1.1 QR WiFi WPA2 fix**
  - Files: `KioskAllTablesPage.tsx`
  - Change: `T:WPA` → `T:WPA2;H:false;;`, `level="M"` → `"H"`, remove `useResponsiveQrSize` import, hardcode `size={180}`, keep conditional on `wifiPassword`
  - Specs: QR-001 (WPA2 encoding), QR-005 (level H)
  - Deps: none
  - Accept: rendered SVG `value` contains `T:WPA2;H:false;;`; `level="H"` attribute present; `useResponsiveQrSize` import removed
  - Est. lines: ~5

- [x] **1.2 URL QR code + step labels**
  - Files: `KioskAllTablesPage.tsx`, `es.json`, `en-US.json`
  - Change: add second `QRCodeSVG` encoding `https://{domain}:{port}`, flex-row wrapper, "Paso 1: Escaneá para conectarte al WiFi"/"Step 1: Scan for WiFi" below WiFi QR, "Paso 2: Escaneá para abrir rallyOS"/"Step 2: Scan to open rallyOS" below URL QR; URL QR always visible when `hubConfig.domain`; WiFi QR conditional on `hubConfig.wifiPassword`; i18n keys `scoreboardWifiQrCta`, `scoreboardUrlQrCta`
  - Specs: QR-003 (URL QR), QR-004 (dual layout), QR-006 (no-WiFi fallback)
  - Deps: none (independent of 1.1)
  - Accept: 2 SVGs when wifiPassword present, 1 when absent; URL QR encodes correct hub URL; step labels visible
  - Est. lines: ~40

- [x] **1.3 Autoplay flag + AudioContext resilience**
  - Files: `start-kiosk.sh`, `KioskNotificationToast.tsx`
  - Change: script: add `--autoplay-policy=no-user-gesture-required` after `--kiosk`; component: singleton `getAudioContext()` (lazy-init, module-level `_audioCtx`), `ctx.resume()` when state `'suspended'`, `console.warn('[KioskSound]', err)` in catch block
  - Specs: NOTIF-002 (autoplay)
  - Deps: none
  - Accept: `start-kiosk.sh` exec line includes `--autoplay-policy=no-user-gesture-required`; `getAudioContext()` returns same instance; `resume()` called on suspended context; errors logged to `console.warn`
  - Est. lines: ~15

## Phase 2: Venue UX (depends on Phase 1 baseline)

- [x] **2.1 Toast venue typography**
  - Files: `KioskNotificationToast.tsx`, `KioskAllTablesPage.tsx`
  - Change: add `kioskMode?: boolean` prop (default false) to `KioskNotificationToastProps`; when true: container `min-h-[15vh] bg-{color}/90 rounded-xl shadow-2xl`, text `text-5xl md:text-6xl lg:text-7xl font-black`, icon `size={80}`, gap-8; when false: preserve original styling; pass `kioskMode` from `KioskAllTablesPage`
  - Specs: TOAST-002..007 (kiosk-display: venue typography, sizing, non-kiosk preservation)
  - Deps: 1.3 (same file — AudioContext baseline)
  - Accept: toast has `text-5xl`/`min-h-[15vh]` classes when `kioskMode=true`; retains `text-lg`/`size={40}` when `kioskMode=false` (default); `role="alert"` unchanged
  - Est. lines: ~25

- [x] **2.2 ADSR sound synthesis + musical intervals**
  - Files: `KioskNotificationToast.tsx`
  - Change: replace `SOUND_MAP`+`playSound()` with `SOUND_MAP_V2` (note sequences with ADSR envelopes per spec table: info=major 3rd arpeggio sine, warning=perfect 4th staccato triangle, error=descending tritone sawtooth, important=perfect 5th fanfare sine); `applyAdsr()` helper using `linearRampToValueAtTime`; `reduceMotion` parameter reduces gain×0.6 and duration×0.5; uses singleton `getAudioContext()` from 1.3
  - Specs: NOTIF-001 (ADSR sounds), NOTIF-008 (reduced motion)
  - Deps: 1.3 (AudioContext singleton)
  - Accept: `linearRampToValueAtTime` called with correct attack/decay params; 4 sound types produce distinct note sequences per spec table; `reduceMotion=true` uses lower gain, sine/triangle only
  - Est. lines: ~100

## Phase 3: Verification

- [x] **3.1 Update existing tests**
  - Files: `KioskAllTablesPage.test.tsx`, `KioskNotificationToast.test.tsx`
  - Change: QR tests: expect `T:WPA2` (not `T:WPA`), assert 2 SVGs when wifiPassword present, 1 when absent; URL QR encodes correct `https://{domain}:{port}`; toast mock receives `kioskMode` prop. Sound tests: extend mock `AudioContext` with `state='suspended'`/`resume=vi.fn()`, spy on `console.warn`, singleton-aware (reset `_audioCtx` between tests)
  - Specs: all modified requirements
  - Deps: Phase 1+2 complete
  - Accept: all 36 existing tests pass; no test failures from `T:WPA2`, dual SVG, or singleton AudioContext
  - Est. lines: ~40

- [x] **3.2 New tests**
  - Files: `KioskNotificationToast.test.tsx`, `KioskAllTablesPage.test.tsx`
  - Change: QR: WiFi hidden without password, URL visible; WiFi+URL QR values. Toast: `toHaveClass('text-5xl')`/`min-h-[15vh]` when kiosk, `text-lg` when default. Sound: ADSR `linearRampToValueAtTime` spy on `GainNode.gain`, `mockContextResume` called, `console.warn` on error, `reduceMotion` reduces gain
  - Specs: QR-003, QR-006, TOAST-002, TOAST-007, NOTIF-001, NOTIF-008
  - Deps: 3.1 (clean baseline)
  - Accept: 10+ new tests pass; coverage across all 7 spec scenarios
  - Est. lines: ~70

## Dependencies & Execution Order

```
Phase 1:  1.1 │ 1.2 │ 1.3   (parallel — different sections, no conflicts)
               │      │
Phase 2:       │  2.1 │ 2.2  (parallel — both touch KioskNotificationToast.tsx)
               │      │       (implement 1.3→2.1→2.2 sequentially in same file)
               ▼      ▼
Phase 3:     3.1 → 3.2       (sequential — fix baseline, then add new)
```

**Merge conflict mitigation**: Tasks 1.3, 2.1, 2.2 all modify `KioskNotificationToast.tsx`. Implement in order: 1.3 (singleton + resume) → 2.1 (kioskMode prop + styling) → 2.2 (sound engine). Alternatively, implement 2.1+2.2 as a single commit after 1.3.

## Spec Coverage Matrix

| Spec | Requirement | Task |
|------|-------------|------|
| qr-scoreboard-link | QR-001 WPA2 encoding | 1.1 |
| qr-scoreboard-link | QR-003 URL QR | 1.2 |
| qr-scoreboard-link | QR-004 dual layout | 1.2 |
| qr-scoreboard-link | QR-005 error correction H | 1.1 |
| qr-scoreboard-link | QR-006 no-WiFi fallback | 1.2 |
| kiosk-display | TOAST-002..006 venue typography | 2.1 |
| kiosk-display | TOAST-007 non-kiosk preservation | 2.1 |
| kiosk-notifications | NOTIF-001 ADSR sounds | 2.2 |
| kiosk-notifications | NOTIF-002 autoplay flag | 1.3 |
| kiosk-notifications | NOTIF-008 reduced motion | 2.2 |
