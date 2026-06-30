# Physical Score Buttons — PoC Plan

Players press physical buttons on the table to score their own points.  
Connects via Bluetooth to the referee's phone → PWA → WebSocket → RallyOS Hub.

## Hardware

| Component | Price | Notes |
|-----------|-------|-------|
| ESP32 DevKitC | ~$5 | Any ESP32 with Bluetooth (not ESP8266) |
| Push buttons ×2 | ✅ have | Your existing buttons |
| Dupont cables | ~$2 | Female-female for GPIO connections |
| Power bank (temporary) | ~$5 | 2000mAh+ gives ~15h runtime |
| 18650 + TP4056 (final) | ~$6 | For standalone battery operation |

### Wiring

```
ESP32                  Buttons
─────                  ───────
GPIO 13 ─────────────── Pulsador A (one leg)
GPIO 14 ─────────────── Pulsador B (one leg)
GND     ───┬─────────── Pulsador A (other leg)
           └─────────── Pulsador B (other leg)
```

No external resistors needed — ESP32 has internal pull-ups (`INPUT_PULLUP`).

- Button not pressed → GPIO sees HIGH (3.3V via pull-up)
- Button pressed → GPIO connects to GND → sees LOW
- Firmware detects HIGH→LOW transition

### Power

**PoC**: Power bank → USB cable → ESP32 USB port  
**Production**: 18650 battery → TP4056 charger module → ESP32 VIN pin

## Firmware (ESP32)

Language: Arduino IDE (same ecosystem as UNO)

Library: [ESP32-BLE-Gamepad](https://github.com/lemmingDev/ESP32-BLE-Gamepad)

```cpp
#include <BleGamepad.h>

BleGamepad bleGamepad("RallyOS Score", "RallyOS", 100);

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

Phone sees it as a Bluetooth gamepad named "RallyOS Score" with 2 buttons.

## PWA Changes

New file: `client/src/hooks/useGamepad.ts`

```
- Poll navigator.getGamepads() in requestAnimationFrame
- Detect button transitions (not just state — avoid repeat fires)
- Map: gamepad button 0 → player A, button 1 → player B
- Call existing handleScorePoint('A' | 'B')
- Show connected status indicator
```

Integration in `ScoreboardPage.tsx`:
```
- Import useGamepad hook
- When gamepad connected, show pill: "🎮 Conectado"
- Button → same handleScorePoint as touch/click
- No conflict: gamepad + touch both work simultaneously
```

**Zero server changes** — all PWA-side.

## UX Flow

1. Referee/player opens scoreboard on phone → PWA loads
2. Pairs Bluetooth gamepad → phone sees "RallyOS Score"
3. PWA detects gamepad → shows "Conectado" indicator
4. Player presses button A → `RECORD_POINT { courtId, player: 'A' }`
5. Point appears on kiosk + phone in real time

## Implementation Steps

```
[ ] Hardware
  [ ] Buy ESP32 + cables + power bank
  [ ] Connect buttons to GPIO 13, 14, GND
  [ ] Power ESP32 via USB

[ ] Firmware
  [ ] Install ESP32 board support in Arduino IDE
  [ ] Install ESP32-BLE-Gamepad library
  [ ] Flash firmware
  [ ] Verify: phone pairs as gamepad, buttons register

[ ] PWA
  [ ] Create useGamepad.ts hook
  [ ] Integrate in ScoreboardPage.tsx
  [ ] Add connection status indicator
  [ ] Test: button press → point scored

[ ] Validation
  [ ] Button A → player A point
  [ ] Button B → player B point
  [ ] Both buttons simultaneously
  [ ] Disconnect/reconnect gamepad
  [ ] Battery drain test (power bank)
```

## Future Iterations (post-PoC)

- 3D-printed enclosure with large arcade buttons
- ESP32 touch GPIO (no mechanical buttons, no wear)
- WiFi direct to server (no phone needed) — same ESP32, just different firmware
- Multiple court support
- Undo button
- Vibration/haptic feedback on point scored
