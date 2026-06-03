# Archive Report: kiosk-venue-fixes

**Date archived**: 2026-06-03
**Artifact store**: openspec
**Status**: PASS

---

## Final Test Results

| Suite | Tests | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Client | 865 | 860 | 0 | 5 |
| Server | 347 | 347 | 0 | 0 |
| **Total** | **1,212** | **1,207** | **0** | **5** |

**Changed-file tests**: 67 passed / 0 failed (KioskAllTablesPage.test.tsx + KioskNotificationToast.test.tsx)
**Build**: ✅ Passed — No TypeScript compilation errors.

---

## Spec Sync Status

| Domain | Action | Details |
|--------|--------|---------|
| `kiosk-display` | Updated | 1 MODIFIED (Kiosk Notification Toast Overlay — venue-scale typography, sizing, accessibility, 180px), 1 ADDED (Non-Kiosk Toast Unaffected) |
| `kiosk-notifications` | Updated | 1 MODIFIED (Notification Type System — ADSR sound design, AudioContext resume, error logging), 2 ADDED (Chrome Kiosk Autoplay Flag, Reduced Motion Sound) |
| `qr-scoreboard-link` | Updated | 3 MODIFIED (WiFi QR WPA2+180px+H, Missing Credentials Fallback URL-only, Kiosk-Only Visibility dual QR), 2 ADDED (URL QR Code, Dual QR Layout) |

---

## Files Changed Summary

| File | Change | Lines |
|------|--------|-------|
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | Dual QR layout: WPA2 fix, URL QR, i18n CTAs, hardcoded 180px | ~40 |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.test.tsx` | Updated QR tests: T:WPA2, dual SVGs, i18n keys | ~40 |
| `client/src/components/organisms/KioskNotificationToast/KioskNotificationToast.tsx` | kioskMode prop, venue typography, ADSR sound engine, singleton AudioContext, [KioskSound] prefix | ~110 |
| `client/src/components/organisms/KioskNotificationToast/KioskNotificationToast.test.tsx` | Extended sound mocks for ADSR, resume(), console.warn, note sequences, 4+4 color tests | ~70 |
| `client/src/i18n/locales/es.json` | Added `scoreboardWifiQrCta`, `scoreboardUrlQrCta` | ~4 |
| `client/src/i18n/locales/en-US.json` | Added `scoreboardWifiQrCta`, `scoreboardUrlQrCta` | ~4 |
| `scripts/start-kiosk.sh` | Added `--autoplay-policy=no-user-gesture-required` | ~1 |

**Estimated total**: ~269 lines changed across 7 files.

---

## Tasks Completion

| # | Task | Status |
|---|------|--------|
| 1.1 | QR WiFi WPA2 fix | [x] Complete |
| 1.2 | URL QR code + step labels | [x] Complete |
| 1.3 | Autoplay flag + AudioContext resilience | [x] Complete |
| 2.1 | Toast venue typography | [x] Complete |
| 2.2 | ADSR sound synthesis + musical intervals | [x] Complete |
| 3.1 | Update existing tests | [x] Complete |
| 3.2 | New tests | [x] Complete |

**7/7 tasks complete**

---

## Warnings Resolved Pre-Archive

1. ✅ QR size spec: ≥256px → 180px (confirmed for venue TV readability)
2. ✅ Warning sound: second note 392→523Hz (G4→C5 alternating, perfect 4th)
3. ✅ Error sound: sub-oscillator C4→A4 (262→440Hz, sawtooth)
4. ✅ console.warn prefix: `[KioskToast]` → `[KioskSound]`
5. ✅ Color tests: 8 new tests (4 kiosk + 4 non-kiosk) verifying bg color class per type
6. ✅ QR error correction: level="H" confirmed via code inspection
7. ✅ Kiosk-only visibility: architectural — component only renders on kiosk route
8. ⚠️ No apply-progress TDD artifact (acknowledged, not blocking — all tasks marked complete)

---

## Spec Compliance

23/23 scenarios compliant. 0 untested. 0 partial.

---

## Architecture Decisions Applied

| # | Decision | Applied |
|---|----------|---------|
| 1 | Hardcoded `size={180}` for QRs | ✅ |
| 2 | Dual QR layout: `flex-row` (spec over design.md's `flex-col`) | ✅ |
| 3 | `T:WPA2;H:false;;` WiFi encoding | ✅ |
| 4 | Singleton AudioContext via `getAudioContext()` | ✅ |
| 5 | `kioskMode` prop for conditional scaling | ✅ |
| 6 | ADSR: `linearRampToValueAtTime` | ✅ |
| 7 | `matchbox-window-manager` preserved in script | ✅ |

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Source of truth specs in `openspec/specs/` now reflect the new behavior. Ready for the next change.
