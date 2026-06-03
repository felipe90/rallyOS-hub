# Proposal: Kiosk Venue Fixes

## Intent

Resolve five production issues from venue testing on Orange Pi + HDMI TV: incorrect WiFi QR encoding blocks auto-connect, missing URL QR forces manual typing, toast illegible at 20 feet, silent audio from Chrome autoplay policy, and notification sounds lacking personality.

## Scope

### In Scope
- QR WiFi: `T:WPA` → `T:WPA2` + `H:false` (match hostapd `wpa=2`/AES)
- URL QR: second `QRCodeSVG` encoding `https://rallyos.local:3000` with label
- Toast: venue-scale typography (48-60pt headline, 15-20vh height, 96px icons, near-opaque bg)
- Chrome kiosk flag: `--autoplay-policy=no-user-gesture-required`
- AudioContext: `resume()` suspended state, add `console.warn` error logging
- Sound redesign: ADSR envelope, musical intervals, note sequences, longer durations

### Out of Scope
- Captive portal (explicitly deferred)
- `HUB_DOMAIN=localhost` env bug (separate change)
- `HUB_WIFI_PASSWORD` missing from `.env.example` (separate quick fix)

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `kiosk-display`: QR rendering (add URL QR, fix WiFi encoding), toast overlay sizing
- `kiosk-notifications`: sound engine behavior (autoplay resilience, ADSR synthesis)
- `qr-scoreboard-link`: WiFi QR format spec currently mandates `T:WPA` — changes to `T:WPA2`

## Approach

**Phase 1 — Quick wins**: Fix WiFi QR encoding (1 line). Add autoplay flag + AudioContext resume (4 lines + 1 script flag). Add URL QR with label (25 lines). All independent, zero regression risk.

**Phase 2 — Venue UX**: Toast typography overhaul (CSS only, ~20 lines). ADSR sound redesign: expand `SoundConfig` with envelope + note sequences, rewrite `playSound()` (~80 lines). Sound blocked by autoplay fix — verify 5a before 5b.

## Affected Areas

| Area | Impact | Files |
|------|--------|-------|
| Kiosk QR display | Modified | `KioskAllTablesPage.tsx`, `locales/en-US.json`, `locales/es.json` |
| Toast + sound | Modified | `KioskNotificationToast.tsx` |
| Sound tests | Modified | `KioskNotificationToast.test.tsx` |
| Kiosk launch | Modified | `scripts/start-kiosk.sh` |
| Specs (deltas) | Modified | `kiosk-display`, `kiosk-notifications`, `qr-scoreboard-link` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Toast too large on 720p | Low | 15vh relative sizing adapts to any resolution |
| ADSR sound annoying in quiet venue | Low | `shouldReduceMotion` preference respected; sine/triangle waves avoid harsh timbres |
| `AudioContext.resume()` race condition | Low | Oscillator scheduling uses `ctx.currentTime`; Web Audio handles late-start gracefully |

## Rollback Plan

- **QR**: Revert one-line string change. Remove URL QR component (additive only).
- **Toast**: Revert `className` to original values. No logic changed.
- **Sound**: Revert `playSound()` and `SOUND_MAP`. Remove `--autoplay-policy` flag.
- All changes are client-only — no server, no DB migration, no API schema changes.

## Dependencies

- Issue 5a blocks 5b: ADSR sounds useless if audio never plays.
- Issues 1, 2, 3 are fully independent.

## Success Criteria

- [ ] Phone scans WiFi QR → auto-connects without opening Settings
- [ ] Phone scans URL QR → opens `https://rallyos.local:3000`
- [ ] Toast text readable at 20 feet on 55" TV
- [ ] All 4 sound types play distinctly in kiosk mode (no silent fallback)
- [ ] Existing tests pass; sound tests extended for ADSR envelope

## Estimated Complexity

| Issue | Lines Δ | Test Δ | Risk |
|-------|---------|--------|------|
| #1 QR WiFi encoding | ~1 | 0 | None |
| #2 URL QR | ~25 | 0 | Low |
| #3 Toast typography | ~20 | 0 | Low |
| #5a Autoplay fix | ~5 + 1 script | 0 | Low |
| #5b Sound redesign | ~80 | ~50 | Medium |
| **Total** | **~131** | **~50** | — |

**Review Workload**: ~180 lines total. Single PR safe under 400-line budget.

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low
