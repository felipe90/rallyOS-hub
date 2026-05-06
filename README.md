# rallyOS-hub

Real-time scoreboard system for rally events with multi-table support, PWA, offline capabilities, and embedded deployment on Orange Pi devices.

## Tech Stack

### Client
- **Framework**: React 19 + TypeScript 6
- **Build**: Vite 8 + vite-plugin-pwa (service worker)
- **Styling**: Tailwind CSS 4 + PostCSS
- **Routing**: React Router v7
- **UI**: Framer Motion (animations), Lucide React (icons)
- **Real-time**: Socket.IO Client
- **QR**: qrcode.react

### Server
- **Runtime**: Node.js 22 + TypeScript 6
- **Framework**: Express 5
- **Real-time**: Socket.IO 4
- **Security**: Helmet, CORS, AES-256-GCM PIN encryption
- **Logging**: Pino (structured JSON logger)
- **QR**: qrcode
- **SSL**: Self-signed certificates for HTTPS

### Shared (monorepo)
- **`shared/`**: Single source of truth for Socket.IO event names, TypeScript types, and validation logic — consumed by both client and server.

### Testing
- **Client**: Vitest + @testing-library/react (unit), Playwright (E2E)
- **Server**: Jest + ts-jest (unit), Playwright (E2E)
- **CI**: GitHub Actions (push/PR to `main`/`develop`)

### DevOps
- **Docker**: Multi-stage build (Node 22 Alpine), optimized for ARM
- **Deployment**: Orange Pi Zero 3 / Zero 2W (ARM64)
- **Git hooks**: Husky + lint-staged

## Features

- **Multi-table system** with independent waiting rooms and referee management
- **Real-time scoreboard updates** via Socket.IO
- **PWA** installable on mobile devices with offline asset caching
- **QR code generation** for instant table access
- **PIN-based authentication** for referees and tournament owners (AES-256-GCM encrypted)
- **Full match lifecycle**: configure, start, record points, undo, swap sides, reset
- **Set/match win detection** with automatic progression
- **Match history** tracking and audit log
- **Rate limiting** per table and per client
- **Docker** deployment for production (ARM-compatible)
- **Orange Pi** embedded deployment with access point mode

## Quick Start

### Prerequisites
- Node.js 22+
- npm

### Development (local, no Docker)

```bash
# One command — installs deps, generates SSL certs, starts both
./dev.sh

# Or manually:
# Terminal 1 — Server
cd server && npm install && npm run dev

# Terminal 2 — Client
cd client && npm install && npm run dev
```

The app will be available at:
- **Client (Vite HMR)**: http://localhost:5173
- **Server (API + Socket.IO)**: https://localhost:3000

### Production Build

```bash
cd client && npm run build
# Output: client/dist/
```

## Environment Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `PORT` | `3000` | Server port |
| `TOURNAMENT_OWNER_PIN` | — | Admin PIN (8 digits) |
| `HUB_SSID` | `RallyOS` | Wi-Fi SSID broadcast by the hub |
| `HUB_IP` | `192.168.4.1` | Hub IP address (AP mode) |
| `HUB_ALLOWED_ORIGINS` | — | Comma-separated CORS origins |
| `ENCRYPTION_SECRET` | — | AES-256-GCM key (32-byte hex) |
| `NODE_OPTIONS` | `--max-old-space-size=256` | Memory limit for ARM devices |

## Docker Deployment

### Quick start (macOS / Linux / ARM)

```bash
./start.sh
```

This script:
1. Checks for `.env` (creates from `.env.example` if missing)
2. Pre-builds client and server locally
3. Builds the Docker image (multi-stage, ARM-compatible)
4. Starts the container with health checks
5. Waits for the service to be ready

### Manual

```bash
docker compose up -d --build
```

Access: **https://localhost:3000**

### Architecture

The Docker setup uses a single container with:
- Multi-stage build (client → server → production image)
- Self-signed SSL certificate (auto-generated)
- Non-root `node` user for security
- Health check via `/health` endpoint
- Configurable memory limit for ARM SBCs

## Orange Pi Deployment

RallyOS Hub is designed to run on **Orange Pi Zero 3** (or Zero 2W) as a standalone tournament hub with built-in Wi-Fi access point.

### One-time setup

```bash
# On the Orange Pi
./setup-orange-pi.sh
```

This interactive script:
- Detects the Orange Pi model
- Installs Docker + Docker Compose
- Enables Docker on boot
- Creates `.env` from template
- Pre-pulls base Docker images

### Start the hub

```bash
./start-orange-pi.sh
```

The hub will be accessible at:
- **Local**: https://localhost:3000
- **AP network**: https://192.168.4.1:3000
- **WiFi network**: https://\<orange-pi-ip\>:3000

### Access Point mode

```bash
sudo ./scripts/setup-orangepi-ap.sh
```

Configures the USB WiFi adapter (RTL8821CU) as an access point with:
- DHCP server (dnsmasq)
- NAT forwarding (iptables)
- Persistent config across reboots

### Diagnostics

```bash
./diagnose.sh
```

Non-interactive TTL-safe script that checks: system info, Docker status, disk usage, memory, network, container health, and recent logs.

## Authentication

- **Table PINs**: Auto-generated 6-digit numeric codes for referee access
- **Owner PIN**: 8-digit admin code set via `TOURNAMENT_OWNER_PIN` env var
- **Encryption**: All PINs are encrypted client-side with AES-256-GCM before transmission
- **Referee management**: Assign, verify, and revoke referee roles per table

## Socket Events

All event names use `UPPER_CASE` convention. Client and server types are generated from `shared/events.ts` (single source of truth).

### Client → Server

| Event | Description |
|-------|-------------|
| `CREATE_TABLE` | Create a new scoring table |
| `JOIN_TABLE` | Join an existing table |
| `LEAVE_TABLE` | Leave a table |
| `LIST_TABLES` | Get all tables (public) |
| `GET_TABLES_WITH_PINS` | Get all tables with PINs (owner only) |
| `GET_MATCH_STATE` | Get current match state |
| `SET_REF` | Assign/change referee |
| `REF_ROLE_CHECK` | Verify referee role |
| `DELETE_TABLE` | Delete a table (owner only) |
| `VERIFY_OWNER` | Verify owner PIN |
| `CONFIGURE_MATCH` | Configure match settings |
| `START_MATCH` | Start a match |
| `RECORD_POINT` | Record a point |
| `SUBTRACT_POINT` | Subtract a point |
| `UNDO_LAST` | Undo the last action |
| `SET_SERVER` | Set serving team/player |
| `RESET_TABLE` | Reset table state |
| `SWAP_SIDES` | Swap team sides |
| `REQUEST_TABLE_STATE` | Request full table state |
| `REGENERATE_PIN` | Generate new table PIN |
| `GET_RATE_LIMIT_STATUS` | Check rate limit status |
| `GET_ALL_HISTORY` | Get complete match history |

### Server → Client

| Event | Description |
|-------|-------------|
| `TABLE_LIST` | List of all tables |
| `TABLE_LIST_WITH_PINS` | Table list including PINs |
| `TABLE_UPDATE` | Table state changed |
| `TABLE_CREATED` | New table created |
| `TABLE_JOINED` | A client joined a table |
| `TABLE_DELETED` | Table removed |
| `MATCH_UPDATE` | Match state changed |
| `ALL_HISTORY` | Complete match history |
| `REF_SET` | Referee assigned |
| `REF_ROLE_CHECK_RESULT` | Referee verification result |
| `REF_REVOKED` | Referee access revoked |
| `QR_DATA` | QR code data for table |
| `PIN_REGENERATED` | Table PIN changed |
| `OWNER_VERIFIED` | Owner authentication result |
| `SET_WON` | A set was won |
| `MATCH_WON` | The match was won |
| `PLAYER_LEFT` | A player disconnected |
| `ERROR` | Error event |
| `RATE_LIMIT_STATUS` | Rate limit state |

## PWA

The client is configured as a Progressive Web App:
- **Installable** on mobile devices
- **Offline** support for static assets (service worker caching)
- **Auto-updates** when new versions are released

## Testing

```bash
# Client unit tests
cd client && npm test                  # Vitest (watch)
cd client && npm run test:coverage     # With coverage

# Client E2E
cd client && npm run test:e2e          # Playwright (headless)
cd client && npm run test:e2e:ui       # Playwright UI mode

# Server unit tests
cd server && npm test                  # Jest

# Everything
cd client && npm run test:all          # Vitest + Playwright
```

### CI/CD

GitHub Actions runs on push/PR to `main` and `develop`:
- **Client tests**: Vitest unit + coverage
- **Server tests**: Jest unit
- **E2E tests**: Playwright (Chromium)
- **Build**: Client production build
- **Lint**: ESLint (client + server)

Manual release workflow (`workflow_dispatch` on `main`) creates a GitHub release with the production build artifact.

## Project Structure

```
rallyOS-hub/
├── client/               # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Route pages
│   │   ├── services/     # Socket.IO client service
│   │   ├── server/       # Server-side rendering / mock server
│   │   ├── shared/       # Client copy of shared types
│   │   └── test/         # Test utilities & setup
│   └── public/
├── server/               # Express + Socket.IO backend
│   └── src/
│       ├── config/       # App configuration
│       ├── domain/       # Domain logic (tables, matches, pins)
│       ├── handlers/     # Socket.IO event handlers
│       ├── services/     # Business logic services
│       ├── utils/        # Utilities (rate limiter, encryption)
│       ├── app.ts        # Express app setup
│       ├── server.ts     # HTTP + Socket.IO server
│       ├── socket.ts     # Socket.IO initialization
│       └── index.ts      # Entry point
├── shared/               # Shared types, events, validation (SSoT)
├── scripts/              # Utility scripts
│   └── setup-orangepi-ap.sh  # Orange Pi AP configuration
├── openspec/             # SDD documentation
├── docs/                 # Additional documentation
├── .github/workflows/    # CI/CD pipelines
├── .husky/               # Git hooks
│
├── docker-compose.yml    # Production Docker setup
├── Dockerfile            # Multi-stage ARM-compatible build
├── dev.sh                # Local development launcher
├── start.sh              # Docker production launcher
├── setup-orange-pi.sh    # Orange Pi one-time setup
├── start-orange-pi.sh    # Orange Pi startup
├── diagnose.sh           # Orange Pi diagnostics
└── .env.example          # Environment template
```

## License

MIT
