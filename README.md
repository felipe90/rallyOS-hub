# rallyOS-hub

Real-time scoreboard system for **tournaments** (🏆) and **club play** (🏢) with multi-court support, multi-sport scoring (Table Tennis + Padel), PWA, offline capabilities, and embedded deployment on Orange Pi devices.

## System Architecture

RallyOS Hub is a standalone, real-time scoreboard server optimized for embedded deployment on single-board computers (SBCs) like the Orange Pi Zero 3. It operates as a TypeScript monorepo containing a React-based PWA frontend, an Express + Socket.IO backend, and a shared module serving as the Single Source of Truth (SSoT).

Multi-sport scoring is implemented via the **Strategy pattern** — server-side `SportRules` (TableTennisRules, PadelRules) and client-side `SportDisplayAdapter` — enabling different scoring systems, display layouts, and match configuration per sport.

```mermaid
flowchart TB
    subgraph DEVICES["📱 Client Devices"]
        PWA["React 19 PWA<br/>Vite 8 · Tailwind CSS 4"]
        KIOSK_DISPLAY["🖥️ HDMI Kiosk<br/>Chromium + X11"]
    end

    subgraph NETWORK["📡 Embedded Network Stack"]
        AP["hostapd<br/>WiFi AP · WPA2-PSK"]
        DNS["dnsmasq<br/>DHCP · DNS · Captive Portal"]
        NAT["iptables<br/>NAT · Port Forwarding"]
    end

    subgraph SERVER["🖧 Server — Node.js 22 · Express 5"]
        EXPRESS["Express REST API<br/>CORS · Helmet · CSP"]
        SOCKET["Socket.IO 4<br/>Real-time Events"]

        subgraph HANDLERS["Event Handlers"]
            AUTH_H["AuthHandler"]
            COURT_H["CourtEventHandler"]
            MATCH_H["MatchEventHandler"]
            CLUB_H["Club*Handler"]
        end

        subgraph DOMAIN["Domain Layer — CourtManager"]
            MATCH_ORCH["MatchOrchestrator"]
            PLAYER_SVC["PlayerService"]
            QR_SVC["QRService"]
            PIN_SVC["PinService"]
            STORE["StateStore<br/>JSON Persistence"]

            subgraph SPORTS["Sport Rules — Strategy Pattern"]
                TT["TableTennisRules"]
                PADEL["PadelRules"]
            end
        end
    end

    subgraph SHARED["📋 Shared Module — SSoT"]
        TYPES["TypeScript Types"]
        EVENTS["Socket Event Names"]
        VALIDATION["Validation Rules"]
    end

    PWA <-->|"Socket.IO · REST"| NETWORK
    KIOSK_DISPLAY <-->|"Socket.IO"| NETWORK
    NETWORK <--> SERVER
    SERVER -->|"BLE Bridge"| ESP32["🔘 ESP32 RallyTap"]

    EXPRESS --> HANDLERS
    HANDLERS --> DOMAIN
    DOMAIN --> STORE

    SHARED -.-> PWA
    SHARED -.-> SERVER

    classDef devices fill:#0d7377,stroke:#006b5f,color:#fff
    classDef network fill:#855300,stroke:#6b4200,color:#fff
    classDef server fill:#1a1a2e,stroke:#16213e,color:#e0e0e0
    classDef shared fill:#2d6a4f,stroke:#1b4332,color:#fff
    classDef esp32 fill:#7c3aed,stroke:#5b21b6,color:#fff

    class PWA,KIOSK_DISPLAY devices
    class AP,DNS,NAT network
    class EXPRESS,SOCKET,AUTH_H,COURT_H,MATCH_H,CLUB_H,MATCH_ORCH,PLAYER_SVC,QR_SVC,PIN_SVC,STORE,TT,PADEL server
    class TYPES,EVENTS,VALIDATION shared
    class ESP32 esp32
```

### Component Breakdown

| Component | Role | Key Technologies |
|-----------|------|-----------------|
| **Client** | React 19 PWA with atomic design. Sport-specific display adapters. BLE bridge for ESP32. i18n (es-AR / en-US). | React 19, Vite 8, Tailwind CSS 4, Framer Motion |
| **Server** | Express 5 + Socket.IO 4 real-time engine. 8 event handlers delegating to domain layer. Multi-sport Strategy pattern. | Node.js 22, Express 5, Socket.IO 4, Pino |
| **Shared** | Single Source of Truth: TypeScript types (discriminated unions), event names, validation rules. | TypeScript 6 |
| **Embedded Stack** | Orange Pi configured as standalone hub with WiFi AP, DHCP/DNS, captive portal, and HDMI kiosk. | hostapd, dnsmasq, iptables, Chromium |

### Embedded Network Stack

| Service | Role | Configuration |
|---------|------|---------------|
| **hostapd** | Broadcasts RallyOS WiFi SSID (`RallyOS-Table1`) | WPA2-PSK, channel 6, 2.4 GHz |
| **dnsmasq** | DHCP (192.168.4.100–200) + DNS (`rallyos.wifi` → 192.168.4.1) | bind-dynamic, catch-all captive portal redirect |
| **iptables** | NAT masquerading, port 80 → 3000 redirect, DNS redirect for Android | Forces all DNS through dnsmasq |
| **Chromium Kiosk** | HDMI display showing scoreboard grid | X11, matchbox-window-manager, hidden cursor |

## Navigation Map

```mermaid
flowchart TD
    ROOT["/"] -->|redirect| AUTH

    AUTH["/auth<br/>AuthPage"] -->|owner PIN| AUTH
    AUTH -->|referee access| SCOREBOARD_R
    AUTH -->|spectator access| SPECTATOR
    AUTH -.->|public| KIOSK
    AUTH -->|sport select| OWNER
    AUTH -->|"Quiero jugar"| CLUB_PIN
    AUTH -->|"Administrar"| CLUB_ADMIN

    CLUB_PIN["/auth → club-pin"] -->|valid PIN| CLUB_PLAY
    CLUB_PLAY["/club/play/:courtId<br/>ClubPlayPage"]
    CLUB_ADMIN["/club/admin<br/>ClubAdminPage"]
    CLUB_SETUP["/setup<br/>ClubSetupPage"]

    OWNER["/dashboard/owner<br/>OwnerDashboardPage"]
    SPECTATOR["/dashboard/spectator<br/>SpectatorDashboardPage"]
    SCOREBOARD_R["/scoreboard/:tableId/referee<br/>ScoreboardPage"]
    SCOREBOARD_V["/scoreboard/:tableId/view<br/>ScoreboardPage"]
    KIOSK["/scoreboard/all/kiosk<br/>KioskAllTablesPage"]
    CLUB_KIOSK["/kiosk<br/>ClubKioskPage"]
    HISTORY["/history<br/>HistoryViewPage"]

    OWNER --> SCOREBOARD_R & SCOREBOARD_V & HISTORY
    SPECTATOR --> SCOREBOARD_V
    CLUB_ADMIN --> CLUB_SETUP
    CLUB_PLAY -->|session ended| AUTH
    ROOT -.->|auto-detect| CLUB_KIOSK

    classDef public fill:#006b5f,stroke:#004d40,color:#fff
    classDef club fill:#7c3aed,stroke:#5b21b6,color:#fff
    classDef kiosk fill:#00897b,stroke:#004d40,color:#fff

    class AUTH,KIOSK,CLUB_KIOSK public
    class OWNER,SCOREBOARD_R,SCOREBOARD_V,SPECTATOR,HISTORY protected
    class CLUB_PIN,CLUB_PLAY,CLUB_ADMIN,CLUB_SETUP club
```

### Role-Based Access

| Role | Unit | Access | Primary Flow |
|------|------|--------|-------------|
| **Owner** | 🏆 | Dashboard, all scoreboards, history, kiosk | Auth → OwnerDashboard |
| **Referee** | 🏆 | Scoreboard with scoring controls | Auth → ScoreboardPage |
| **Spectator** | 🏆 | View-only scoreboard | Auth → SpectatorDashboard |
| **Club Admin** | 🏢 | Court management, pricing, force-end | Auth → "Administrar" → ClubAdmin |
| **Player** | 🏢 | Play on court, view score, end session | Auth → "Quiero jugar" → PIN → ClubPlay |
| **Staff (Kiosk)** | 🏢 | Public court status display | Direct URL `/kiosk` |

## Quick Start

### Prerequisites
- Node.js 22+
- [pnpm](https://pnpm.io/) 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)

### Development
```bash
pnpm install
./scripts/dev.sh
# Client: http://localhost:5173  |  Server: https://localhost:3000
```

### Docker
```bash
./scripts/start.sh
# Access: https://localhost:3000
```

## Orange Pi Deployment

```bash
# One-time setup — everything (Docker, WiFi AP, captive portal, HDMI kiosk)
sudo ./scripts/setup-orangepi-ap.sh

# Start hub
./scripts/start-orange-pi.sh
```

The hub is accessible at:
- **https://rallyos.wifi:3000** (recommended — survives IP changes)
- **https://192.168.4.1:3000** (AP network)
- **https://\<orange-pi-ip\>:3000** (WiFi network)

> Use the domain URL for PWA installation — it survives Orange Pi IP changes.

### Diagnostics
```bash
./scripts/diagnose.sh
```

### Hardware Validation (ESP32)
```bash
# Validates hub → BLE → tournament → club round-trip on real hardware
./scripts/validate-esp32-dual-mode.sh
```

## Testing

```bash
# Client (Vitest)
cd client && pnpm run test

# Server (Jest)
cd server && pnpm run test

# Client E2E (Playwright — local only, disabled in CI)
cd client && pnpm run test:e2e
```

See [`client/README.md`](client/README.md) and [`server/README.md`](server/README.md) for detailed testing guides.

### CI/CD

GitHub Actions runs on push/PR to `main` and `develop`:
- **Client tests**: Vitest unit + coverage
- **Server tests**: Jest unit
- **Build**: Client production build
- **Lint**: ESLint (client + server)

E2E tests are disabled in CI — they require both server + client running simultaneously.

## Project Structure

```
rallyOS-hub/
├── client/          → React 19 PWA (atomic design, BLE bridge, i18n)
├── server/          → Express 5 + Socket.IO 4 (8 handlers, CourtManager, services)
├── shared/          → Types, events, validation (SSoT)
├── scripts/         → Deployment, diagnostics, validation
├── docs/            → Architecture docs (club mode, ESP32, decisions)
├── .github/workflows/ → CI/CD
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

See [`client/README.md`](client/README.md) and [`server/README.md`](server/README.md) for detailed documentation.

## License

MIT
