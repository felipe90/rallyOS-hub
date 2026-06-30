# RallyTap — Physical Score Buttons PoC

Players press physical buttons on the table to score their own points.  
No referee needed — one player connects the device to their phone via Bluetooth.

```
Botón A ──┐
          ├── GPIO ── ESP32 ── BT Gamepad ──► Teléfono ── PWA (Gamepad API) ── WS ── Server
Botón B ──┘

         ↑ "RallyTap"
         ↑ se conecta como gamepad Bluetooth HID
         ↑ el teléfono lo ve como un mando más
```

## Hardware

| Component | Price | Notes |
|-----------|-------|-------|
| ESP32 DevKitC | ~$5 | Any ESP32 with Bluetooth (not ESP8266) |
| Push buttons ×2 | ✅ have | Large, differentiated (color/shape) |
| Dupont cables | ~$2 | Female-female for GPIO connections |
| Power bank (PoC) | ~$5 | 2000mAh+ gives ~15h runtime |
| 18650 + TP4056 (prod) | ~$6 | For standalone battery operation |

### Wiring

```
ESP32                  Buttons
─────                  ───────
GPIO 13 ─────────────── Botón A (una pata)
GPIO 14 ─────────────── Botón B (una pata)
GND     ───┬─────────── Botón A (otra pata)
           └─────────── Botón B (otra pata)
```

No external resistors needed — ESP32 has internal pull-ups (`INPUT_PULLUP`).

- Button not pressed → GPIO sees HIGH (3.3V via pull-up)
- Button pressed → GPIO connects to GND → sees LOW
- Firmware detects HIGH→LOW transition

Buttons use long cables so they sit at opposite ends of the table (one per player).

### Power

**PoC**: Power bank → USB cable → ESP32 USB port  
**Production**: 18650 battery → TP4056 charger module → ESP32 VIN pin

## Firmware (ESP32)

Language: Arduino IDE (same ecosystem as UNO)

Library: [ESP32-BLE-Gamepad](https://github.com/lemmingDev/ESP32-BLE-Gamepad)

```cpp
#include <BleGamepad.h>

BleGamepad bleGamepad("RallyTap", "RallyOS", 100);

#define BTN_A 13
#define BTN_B 14

void setup() {
  pinMode(BTN_A, INPUT_PULLUP);
  pinMode(BTN_B, INPUT_PULLUP);
  BleGamepadConfiguration config;
  config.setButtonCount(2);
  bleGamepad.begin(&config);
}

void loop() {
  if (bleGamepad.isConnected()) {
    bleGamepad.setButton(1, digitalRead(BTN_A) == LOW);
    bleGamepad.setButton(2, digitalRead(BTN_B) == LOW);
  }
  delay(20);
}
```

Phone sees it as Bluetooth gamepad **"RallyTap"** with 2 buttons.

## QR + Quick Connect

A sticker on the RallyTap has a QR that encodes:

```
https://rallyos.wifi:3000/join?c=<courtId>&p=<pin>
```

New route `/join`:
- Parses `c` (courtId) and `p` (pin)
- Redirects to `/scoreboard/:courtId` with PIN auto-filled
- Also triggers Web Bluetooth `navigator.bluetooth.requestDevice()` to discover and connect to "RallyTap" directly from the browser

### UX Flow

1. RallyTap is on the table, powered on
2. Player scans QR on the RallyTap → opens phone browser
3. Browser loads `/join?c=abc&p=1234` → redirects to scoreboard
4. Chrome prompts "RallyTap wants to connect" → tap to pair
5. Scoreboard shows **PIN auto-filled** → player taps "Ingresar"
6. PWA detects gamepad → shows "RallyTap conectado ✓"
7. Player A presses left button → point scores
8. Phone screen also works for corrections if needed

**No Settings, no Bluetooth menu, no typing PIN.**

### Web Bluetooth fallback

If `navigator.bluetooth` is not available (iOS, some browsers):
- Pair manually once (Settings → Bluetooth → RallyTap)
- Then Gamepad API works as normal
- QR still opens the scoreboard with PIN pre-filled

## PWA Changes

### New: `client/src/hooks/useGamepad.ts`

```
- Poll navigator.getGamepads() in requestAnimationFrame
- Detect button transitions (edge-triggered, not level — avoid double-fires)
- Map: gamepad button 0 → player A, button 1 → player B
- Call existing handleScorePoint('A' | 'B')
- Show connected status indicator
```

### New: `client/src/pages/JoinPage/JoinPage.tsx`

```
- Route: /join?c=&p=
- Extracts courtId + pin from URL params
- Stores PIN in session/auto-fills on redirect
- Optionally triggers Web Bluetooth scanning
- Redirects to /scoreboard/:courtId
```

### Modified: `ScoreboardPage.tsx`

```
- Import useGamepad hook
- When gamepad connected: show "🎮 RallyTap conectado" pill
- Gamepad button → same handleScorePoint as touch/click
- Both input methods work simultaneously
```

**Zero server changes** — courtId + PIN auth already exists.

## Error Handling

| Scenario | Mitigation |
|----------|-----------|
| False press (ball hits RallyTap) | Long-press mode: hold 300ms → point |
| Wrong player scores | Phone screen still works — tap to correct |
| Battery dies | Continue on phone (touch, no gamepad) |
| Gamepad disconnects mid-match | PWA detects, shows "RallyTap desconectado", re-pair on button press |
| Organizer forgot to charge | Power bank swap in 10s |

## Use Case Walkthrough

```
1. Organizer creates court → RallyTap assigned to that court
2. Organizer puts RallyTap on table, gives PIN to players
3. Players arrive, no referee
4. Player A scans QR on RallyTap → phone opens scoreboard
5. Phone pairs with RallyTap via Web Bluetooth
6. Player A enters PIN (or auto-filled from QR) → referee auth
7. Match starts, both players press their buttons to score
8. Kiosk shows live score, phone shows same + corrections
9. If RallyTap battery dies → continue on phone touch
10. Match ends → organizer retrieves RallyTap, charges for next
```

## Implementation Steps

```
[ ] Hardware
  [ ] Buy ESP32 + cables + power bank
  [ ] Connect buttons to GPIO 13, 14, GND (long cables)
  [ ] Power ESP32 via USB

[ ] Firmware
  [ ] Install ESP32 board support in Arduino IDE
  [ ] Install ESP32-BLE-Gamepad library
  [ ] Flash firmware (device name: "RallyTap")
  [ ] Verify: phone pairs as gamepad, buttons register

[ ] PWA — Gamepad support
  [ ] Create useGamepad.ts hook
  [ ] Show connection status indicator
  [ ] Map button 0 → A, button 1 → B
  [ ] Integrate in ScoreboardPage.tsx
  [ ] Test with USB gamepad first (dev)

[ ] PWA — QR + Join route
  [ ] Create /join route (extracts courtId + pin)
  [ ] Auto-fill PIN on scoreboard redirect
  [ ] Web Bluetooth scanning (optional, PoC)
  [ ] Generate QR code for sticker

[ ] Validation
  [ ] Button A → player A point
  [ ] Button B → player B point
  [ ] Both buttons simultaneously
  [ ] QR scan → scoreboard with PIN pre-filled
  [ ] Gamepad disconnect/reconnect mid-match
  [ ] Battery drain test
  [ ] Accidental press prevention (debounce + hold)
```

## Future Iterations

- 3D-printed enclosure with large arcade buttons (distinct colors)
- ESP32 touch GPIO (no moving parts)
- WiFi direct to server (no phone needed) — same ESP32, different firmware
- Multiple court support (multiple RallyTaps)
- Undo button on device
- Haptic feedback on point scored
- NFC tag instead of QR for faster pairing
