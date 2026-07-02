# RallyTap — Physical Score Button PoC

ESP32-based physical button device for padel/tennis referees.  
Connects to the referee's phone via **BLE GATT** (not WiFi, not HID gamepad).  
The phone bridges button presses to rallyOS-hub via Socket.IO, and writes score updates back to the OLED display.

```
Botón A ── GPIO18 ─┐
                   ├── ESP32 ── BLE GATT ──► Phone Browser (Web Bluetooth) ── WS ── Server
Botón B ── GPIO19 ─┘

           ↑ "RallyTap-01"
           ↑ se conecta como GATT server (no HID gamepad)
           ↑ el bridge web (BLEBridge) hace de intermediario
```

## Architecture

**Two independent domains** bridged by BLE GATT:

| Domain | Tech | Location | Status |
|--------|------|----------|--------|
| ESP32 firmware | PlatformIO + Arduino + BLE GATT | `firmware/rallytap/` | ✅ Built & tested |
| Browser bridge | Web Bluetooth + Socket.IO | `client/src/services/ble/` | ✅ Built & tested |

### Why BLE + phone bridge (not WiFi direct)?

- **iOS no soporta Web Bluetooth** — pero el bridge corre en el browser del referee. Android funciona perfecto. iOS cae al fallback: usar la UI táctil del scoreboard directamente.
- **El ESP32 no necesita WiFi credentials** — zero config, prende y se anuncia.
- **El teléfono ya está autenticado** como referee (courtId + PIN) ante el hub. El ESP32 no necesita saber PIN ni court ID.

---

## Hardware

| Component | Qty | Notes |
|-----------|-----|-------|
| ESP32 DevKitC (WROOM-32) | 1 | Cualquier ESP32 con BLE |
| Push buttons (4-pin tactile 6x6mm) | 2 | Una pata a GPIO, la otra (diagonal) a GND |
| OLED SSD1306 128x64 I2C | 1 | Display de 7 estados |
| Dupont cables | varios | Hembra-hembra |
| Power bank (PoC) | 1 | USB → ESP32 |
| 18650 + TP4056 (prod) | 1 | Para batería standalone |

### Wiring

```
ESP32               OLED (I2C)
─────               ──────────
GPIO21 (SDA) ─────── SDA
GPIO22 (SCL) ─────── SCK
3V3           ─────── VDD
GND           ───┬─── GND
                 │
ESP32            Botones
─────            ───────
GPIO18 ─────────── Botón A (una pata, la otra a GND)
GPIO19 ─────────── Botón B (una pata, la otra a GND)
GND    ───┬─────── Botón A (pata diagonal)
          └─────── Botón B (pata diagonal)
```

No se necesitan resistencias externas — `INPUT_PULLUP` interno del ESP32.

### Button Behavior

- Sin presión → GPIO HIGH (3.3V vía pull-up interna)
- Presionado → GPIO conectado a GND → LOW
- Debounce: 50ms (antirrebote por software)
- Cooldown: 300ms tras cada presión (ignora pulsaciones rápidas)

---

## Firmware (ESP32)

### Stack

| Component | Technology |
|-----------|-----------|
| Toolchain | PlatformIO + Arduino framework |
| BLE | ESP32 built-in BLEDevice/BLEServer |
| Display | Adafruit SSD1306 + GFX via I2C |
| JSON | ArduinoJson v7 (StaticJsonDocument\<128\>) |

### File Layout

```
firmware/rallytap/
├── platformio.ini
├── include/
│   ├── BLEHandler.h
│   ├── ButtonHandler.h
│   ├── DisplayManager.h
│   └── ScoreManager.h
└── src/
    ├── main.cpp
    ├── BLEHandler.cpp
    ├── ButtonHandler.cpp
    ├── DisplayManager.cpp
    └── ScoreManager.cpp
```

### BLE GATT Protocol

| Item | UUID | Type | Value |
|------|------|------|-------|
| Service | `f000a001-0451-4000-b000-000000000000` | — | — |
| Device Name | `f000a002` | READ | ASCII, max 16B — "RallyTap-01" |
| Button Press | `f000a003` | NOTIFY | 1B: `0x01` = A, `0x02` = B |
| Score Display | `f000a004` | WRITE | UTF-8 JSON, max 128B |

### OLED Display States (7 estados)

```
┌──────────┐  2s       ┌──────────┐  BLE paired   ┌─────────────┐
│   BOOT   │──────────→│   IDLE   │──────────────→│  CONNECTED  │
│"RallyTap"│           │"Conect.."│               │"A:2 B:1"    │
│  "-01"   │           └──────────┘               │"Conectado"  │
└──────────┘               ↑  BLE disc             └──────┬──────┘
                      ┌────┴──────┐              button   │
                      │RECONNECT. │            press──────┘
                      │"Reconect."│                  │
                      └───────────┘             ┌────▼──────┐
                                                 │ PRESSING  │
                                                 │ (flash)   │
                                                 │ 100ms     │
                                                 └────┬──────┘
                                                ┌─────▼──────┐
                                      ┌────────│ CONFIRMING │
                                      │ error  │ "A:3 B:1"  │
                                 ┌────▼───┐   │ "OK" 1.5s  │
                                 │ ERROR  │   └──────┬──────┘
                                 │"✗ {msg}"│         │
                                 └─────────┘    ┌────▼──────┐
                                                │ CONNECTED │
                                                └───────────┘
```

### Data Flow (main loop)

```
loop()
  ├─ ButtonHandler::poll()
  │   └─ Press detected (debounced + cooldown OK):
  │       ├─ BLEHandler::notifyButtonPress(player)
  │       └─ DisplayManager::setState(PRESSING)
  │
  ├─ BLEHandler::isConnected()
  │   ├─ true (was disconnected) → CONNECTED state
  │   └─ false (was connected) → RECONNECTING + startAdvertising()
  │
  ├─ Pending score write (from BLE)
  │   ├─ JSON válido → ScoreManager actualiza + CONFIRMING/ERROR
  │   └─ JSON inválido → silencioso
  │
  └─ DisplayManager::tick() — avanza estados temporizados
```

---

## Bridge Web (browser — pendiente)

El bridge son 3 archivos del lado del cliente web, aún no implementados:

| File | Ruta | Función |
|------|------|---------|
| `BLEBridge.ts` | `client/src/services/ble/bridge.ts` | Clase que conecta via Web Bluetooth, se subscribe a notificaciones y escribe score |
| `useRallyTapBridge.ts` | `client/src/hooks/useRallyTapBridge.ts` | Hook React: conecta BLEBridge con Socket.IO |
| `RallyTapConnectButton.tsx` | `client/src/components/molecules/` | Botón UI + badge de estado |

### Event Flow (cuando esté implementado)

```
BLE notification (button_press: 0x01)
  │
  ▼
BLEBridge.onButtonPress
  │
  ▼
socket.emit(RECORD_POINT, { courtId, player: 'A' })
  │
  ▼
hub → MatchEventHandler → courtManager.recordPoint()
  │
  ▼
hub emite MATCH_UPDATE (broadcast)
  │
  ▼
socket.on(MATCH_UPDATE) en useRallyTapBridge
  │
  ▼
BLEBridge.writeScore({ a, b, status, msg })
  │
  ▼
BLE GATT write a score_display characteristic
  │
  ▼
ESP32 parsea JSON → OLED se actualiza
```

---

## Implementation Status

| Step | Status |
|------|--------|
| **Hardware** | |
| ESP32 + cables | ✅ |
| OLED cableado | ✅ |
| Botones cableados | ✅ (GPIO18, GPIO19) |
| Power | ✅ (USB) |
| **Firmware** | |
| PlatformIO project | ✅ |
| BLE GATT server (service + 3 characteristics) | ✅ |
| ButtonHandler (debounce 50ms + cooldown 300ms) | ✅ |
| DisplayManager (7 estados OLED) | ✅ |
| ScoreManager (JSON parse/format) | ✅ |
| Build & upload | ✅ |
| OLED boot "RallyTap-01" → "Conectando..." | ✅ |
| BLE advertising como "RallyTap-01" | ✅ |
| BLE conectado → OLED "Conectado A:0 B:0" | ✅ |
| PRESSING state (blink en botón) | ✅ |
| **Bridge** | |
| BLEBridge.ts | ✅ |
| useRallyTapBridge.ts | ✅ |
| RallyTapConnectButton.tsx | ✅ |

---

## Error Handling

| Escenario | Mitigación |
|-----------|-----------|
| Presión accidental (bola golpea el botón) | Cooldown 300ms ignora pulsaciones rápidas |
| Jugador equivocado anota | UI táctil del teléfono sigue funcionando para corregir |
| Batería del RallyTap muere | Continuar en el teléfono (touch, sin BLE) |
| BLE se desconecta | OLED muestra RECONNECTING, advertising se reinicia automáticamente |
| OLED falla (I2C sin ACK) | Modo headless — firmware sigue funcionando sin display |
| iOS Safari (no Web Bluetooth) | El árbitro usa la UI táctil directamente en vez del puente BLE |
| Hub rechaza RECORD_POINT | BLE escribe status=error → OLED muestra ✗ + mensaje |

---

## QR + Quick Connect (futuro)

Para producción, un sticker QR en el RallyTap codifica:

```
https://rallyos.app/join?c=<courtId>&p=<pin>
```

Flujo:
1. Escanear QR → abre el scoreboard con PIN auto-completado
2. Browser Chrome pide conectar Bluetooth → "RallyTap-01"
3. Bridge activo → botones físicos funcionan

Sin QR: el referee abre el scoreboard manualmente, conecta BLE desde el botón "Conectar RallyTap" en la UI.

---

## Out of Scope (Phase 1)

- iOS Web Bluetooth (no existe en Safari)
- Batería recargable / cargador integrado
- Caja 3D / PCB
- Botón de restar / undo
- WiFi provisioning
- Múltiples RallyTaps simultáneos
