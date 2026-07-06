# ESP32 Dual-Mode Validation — Hardware Checklist

This document is the **manual validation procedure** for Phase 6 of the
rallyOS Club Mode project. It verifies that the ESP32 (RallyTap) button
works correctly in **both tournament and club modes** with the complete
hardware stack: Orange Pi → hub → phone (Web Bluetooth) → ESP32.

---

## Test Environment

### What You Need

| Item | Role | Notes |
|------|------|-------|
| Orange Pi Zero 3 | Hub server | Running rallyOS with Docker, kiosk, services |
| ESP32 RallyTap | Physical button + OLED | Flashed with standard firmware (no changes) |
| Android phone | BLE bridge | Chrome browser, Web Bluetooth enabled |
| HDMI monitor | Kiosk display | Connected to Orange Pi |
| Network | Captive portal | Orange Pi WiFi AP (rallyos.wifi) |

### Pre-Flight Checks

Before touching hardware, validate the infrastructure:

```bash
sudo ./scripts/validate-esp32-dual-mode.sh --save
```

All steps should PASS (warnings are OK — see each warning's detail).
If any step FAILS, fix that issue before proceeding to hardware validation.

---

## Manual Validation Checklist

### 🟢 1. ESP32 Button → Point Registered in Club Session

- [ ] Boot the Orange Pi — wait for kiosk to show club dashboard
- [ ] Open Chrome on the Android phone
- [ ] Navigate to `https://rallyos.wifi:3000` (accept SSL warning)
- [ ] Tap **"Quiero jugar"** on the home screen
- [ ] Staff activates a court → generates a PIN
- [ ] Enter the court PIN on the phone → alias prompt appears
- [ ] Enter an alias (e.g. "Test1") → session starts
- [ ] Tap **"Conectar RallyTap"** → phone scans for ESP32
- [ ] Select the ESP32 device (named `RallyTap-XXXX`) from the scan list
- [ ] Press the ESP32 **Button A** (player 1)
- [ ] **Expected:** Score increments to 1-0 on the phone screen and kiosk
- [ ] Press the ESP32 **Button B** (player 2)
- [ ] **Expected:** Score shows 1-1
- [ ] Verify OLED on the ESP32 shows the current score

### 🟢 2. ESP32 Button → Point Registered in Tournament Match

- [ ] From the same kiosk/home screen, tap **"Torneo"**
- [ ] Log in as **Organizador** with the owner PIN
- [ ] Create a tournament or assign a court to a match
- [ ] Set an existing court to tournament mode (must be AVAILABLE first)
- [ ] As **Árbitro**, enter the court PIN → match control screen loads
- [ ] Configure the match (players, format) and tap **"Comenzar"**
- [ ] Tap **"Conectar RallyTap"** → phone scans for ESP32
- [ ] Select the ESP32 device
- [ ] Press the ESP32 **Button A**
- [ ] **Expected:** Score updates in the match (tournament referee view)
- [ ] Press the ESP32 **Button B**
- [ ] **Expected:** Both scores visible on the match scoreboard
- [ ] Verify OLED shows the correct tournament score

### 🟢 3. OLED Shows Correct Score in Both Modes

- [ ] While in club mode (from test 1), note the score on OLED
- [ ] Verify OLED matches the phone app and kiosk display
- [ ] End the club session
- [ ] Switch to tournament mode (from test 2)
- [ ] Note the OLED displays the tournament match score
- [ ] Verify OLED matches the tournament scoreboard
- [ ] **Acceptance:** OLED always reflects the **current session's score** —
      no mode-specific formatting needed, same protocol in both modes

### 🟢 4. No Firmware or Bridge Changes Required

- [ ] Verify the ESP32 is running the **standard RallyTap firmware**
      (no custom build for this test)
- [ ] Repeat tests 1-3 using the same ESP32 firmware binary
- [ ] **Acceptance:** All tests pass without reflashing the ESP32 or
      modifying the BLE bridge (`bridge.ts` / `useRallyTapBridge.ts`)

### 🟢 5. Validated with Real Phone + Mini PC + ESP32

- [ ] Complete test 1 (club mode) end-to-end with real hardware
- [ ] Complete test 2 (tournament mode) end-to-end with real hardware
- [ ] Complete both modes sequentially without restarting the ESP32
- [ ] **Acceptance:** Full hardware stack works in both modes without
      any configuration changes between modes

---

## How the Architecture Supports Dual Mode

The ESP32 is **mode-agnostic** — it only sends `{"button":"A"}` or
`{"button":"B"}` via BLE. The phone bridge forwards this as a
`RECORD_POINT` event to the hub. The server determines the court's
current mode and routes the point accordingly.

```
ESP32 ──BLE──► Phone ──RECORD_POINT──► Hub ──MATCH_UPDATE──► Phone + Kiosk + OLED
   │                                    │
   │  Same firmware                     │
   │  Same protocol                     │  Server decides based on
   │  No mode switching                 │  court mode (club/tournament)
   ▼                                    ▼
   Mode-agnostic                        Mode-aware
```

This means:
- **No firmware changes** for club mode vs tournament mode
- **No bridge changes** — the `useRallyTapBridge` hook emits the same
  `RECORD_POINT` event regardless of mode
- **Same OLED updates** — the hub sends `MATCH_UPDATE` with score,
  which the phone writes back to the ESP32 in both modes

---

## Automated Test Coverage (No Hardware Required)

These automated tests cover the same paths as this checklist.
Run them during development — no ESP32 or phone needed.

### Server: `MatchEventHandler.test.ts` (13 tests)

| Test | What It Covers |
|------|----------------|
| RECORD_POINT — club mode (T1) | Point registered via club referee path |
| RECORD_POINT — tournament mode (T2) | Point registered via SET_REF path |
| Same MATCH_UPDATE structure | Both modes emit identical event format |
| Handler registration | Server wires RECORD_POINT correctly |
| Invalid player rejection | `player: 'C'` is rejected |
| Non-referee rejection | Unauthorized socket cannot send points |
| Score field matching | Both modes produce `{config, courtId, score, ...}` |

### Client: `bridge.test.ts` (7 tests)

| Test | What It Covers |
|------|----------------|
| Button press A | `0x01` byte → `'A'` callback |
| Button press B | `0x02` byte → `'B'` callback |
| Reconnect exhaust | All 5 reconnect attempts → error |
| writeScore strips ok | `status: 'ok'` → stripped from BLE write |
| writeScore keeps error | `status: 'error'` → msg preserved |
| Disconnect cleanup | Listeners removed, state reset |
| Browser not supported | Missing `navigator.bluetooth` → error |

### Client: `useRallyTapBridge.test.ts` (5 tests)

| Test | What It Covers |
|------|----------------|
| BLE→Socket forwarding | Button press → `RECORD_POINT` emit |
| Socket→BLE writeback | `MATCH_UPDATE` → `writeScore` |
| Error propagation | Hub error → React state |
| Lifecycle cleanup | Unmount disconnects bridge |
| Multiple button presses | Sequential press events handled |

```bash
# Run all tests
pnpm --filter server test         # MatchEventHandler tests
pnpm --filter client test         # bridge + useRallyTapBridge tests
```

---

## Troubleshooting

### Web Bluetooth Not Available (iOS)

**Symptom:** The "Conectar RallyTap" button does nothing or shows
"Browser not supported".

**Cause:** Safari on iOS does not support Web Bluetooth. The BLE bridge
requires Chrome or a Chromium-based browser.

**Fix:**
1. Use an **Android phone** with Chrome
2. If iOS is unavoidable, the BLE bridging path will not work on this
   platform. Consider a custom native app as a future enhancement

### ESP32 Not Pairing

**Symptom:** Scan does not find any RallyTap devices, or pairing fails.

**Checks:**
1. Is the ESP32 powered on? Check the LED indicator
2. Is the phone within 2-3 meters of the ESP32? BLE range is limited
3. Is the ESP32 already connected to another phone? Only one BLE
   connection at a time — disconnect the other phone first
4. Did the ESP32 crash? Try power cycling it (unplug/replug USB)
5. Verify the ESP32 is advertising: use a BLE scanner app like
   *nRF Connect* to see if `RallyTap-XXXX` appears with service UUID
   `f000a001-0451-4000-b000-000000000000`

**Fix:** Power cycle the ESP32, close and reopen Chrome, try scanning again.
If it still fails, reflash the ESP32 firmware.

### Score Not Updating on OLED

**Symptom:** Pressing the button sends the point (score changes in
app/kiosk) but the ESP32 OLED does not update.

**Checks:**
1. Is the ESP32 still connected? Check `bridge.getState().connected`
   in the browser console
2. Does `writeScore` log appear in the browser console?
   Look for `[BLEBridge] writeScore: ...` and `[BLEBridge] writeScore OK`
3. Is the `scoreDisplayChar` writable? The firmware characteristic
   `f000a004-0451-4000-b000-000000000000` must support `writeValue`

**Fix:**
- Reconnect the ESP32 (disconnect and scan again)
- Check browser console for errors — if `writeScore` shows but OLED
  doesn't update, the firmware's score display handler may need review
- If `writeScore` doesn't log, ensure `MATCH_UPDATE` is being received
  (check the WebSocket connection)

### Club Session Ended Unexpectedly

**Symptom:** The session ends or the court becomes free without the
player ending it.

**Checks:**
1. Did the ESP32 disconnect? Check if `gattserverdisconnected` fired
2. Was the bridge ownership lost? Only the registered socket can send
   events — a page refresh or navigation without reconnection loses
   ownership
3. Check server logs: `docker logs rallyo-hub --tail 20`
4. Check for `REF_REVOKED` event — if another client took over, the
   bridge was displaced

**Fix:**
- If it was a disconnect: the `useRallyTapBridge` hook should
  auto-reconnect. If not, tap "Conectar RallyTap" again
- If bridge ownership was lost: re-enter the PIN to reclaim ownership
- If the session actually ended: start a new session from the admin panel

### Validation Script Cannot Test WebSocket

**Symptom:** `validate-esp32-dual-mode.sh` shows "WS test skipped"
or "WS test: unexpected" during steps 5-7.

**Checks:**
1. Is the container running? `docker ps | grep rallyo-hub`
2. Is `socket.io-client` installed in the container?
   ```
   docker exec rallyo-hub node -e "require('socket.io-client')"
   ```
3. Is the Socket.IO endpoint reachable from inside the container?
   ```
   docker exec rallyo-hub wget -q --no-check-certificate --spider https://localhost:3000/health
   ```

**Fix:** Rebuild the container: `docker compose -f docker-compose.yml build`
and restart: `sudo ./scripts/start-orange-pi.sh`

---

## Acceptance Criteria Summary

| # | Criterion | Automated Test | Manual Check |
|---|-----------|---------------|--------------|
| 1 | ESP32 button → club point | `MatchEventHandler.test.ts` T1 | ✅ Checklist 1 |
| 2 | ESP32 button → tournament point | `MatchEventHandler.test.ts` T2 | ✅ Checklist 2 |
| 3 | OLED shows correct score (both modes) | `bridge.test.ts` (writeScore) | ✅ Checklist 3 |
| 4 | No firmware or bridge changes | N/A (design invariant) | ✅ Checklist 4 |
| 5 | Validated with real hardware | N/A (end-to-end) | ✅ Checklist 5 |

---

## Quick Start

```bash
# 1. Validate infrastructure (no hardware needed)
sudo ./scripts/validate-esp32-dual-mode.sh --save

# 2. Run automated tests
pnpm --filter server test -- --testPathPattern=MatchEventHandler
pnpm --filter client test -- --testPathPattern="bridge|RallyTap"

# 3. Proceed to hardware checklist above
```
