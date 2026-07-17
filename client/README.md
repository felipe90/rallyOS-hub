# RallyOS Client — React 19 PWA

Frontend for rallyOS-hub, a real-time scoreboard system for tournaments (🏆) and club play (🏢).

## Architecture

### Atomic Design

Components follow atomic design methodology:

```
components/
├── atoms/          # Primitives: Button, PinInput, Typography, ConnectionStatus, Badge
├── molecules/      # Composed atoms: Toast, TournamentResumeModal, ClubKioskCard, TableStatusChip
└── organisms/      # Complex composites: ClubKioskCard (with status-based variants)
```

### Pages

| Route | Page | Unit | Purpose |
|-------|------|------|---------|
| `/auth` | AuthPage | 🏆🏢 | Entry point: role selection, PIN entry (owner, court) |
| `/dashboard/owner` | OwnerDashboardPage | 🏆 | Tournament owner dashboard |
| `/dashboard/referee` | — (redirect) | 🏆 | Referee auto-redirect |
| `/dashboard/spectator` | SpectatorDashboardPage | 🏆 | Live match viewing |
| `/scoreboard/:tableId/referee` | ScoreboardPage | 🏆 | Referee scoring controls |
| `/scoreboard/:tableId/view` | ScoreboardPage | 🏆 | Public scoreboard view |
| `/scoreboard/all/kiosk` | KioskAllTablesPage | 🏆 | Tournament kiosk grid |
| `/kiosk` | ClubKioskPage | 🏢 | Club staff kiosk (auto-detect) |
| `/club/admin` | ClubAdminPage | 🏢 | Club court management |
| `/club/play/:courtId` | ClubPlayPage | 🏢 | Player scoring + session |
| `/setup` | ClubSetupPage | 🏢 | Pricing configuration |
| `/history` | HistoryViewPage | 🏆 | Match history |

### Key Architecture Decisions

- **Auth state machine**: `useAuthFlow` hook manages a multi-step auth flow (role select → PIN entry → verification → redirect). Modes: `select`, `owner-pin`, `sport-select`, `club-pin`.
- **Socket context**: `useSocketContext` provides a singleton Socket.IO connection. All real-time data flows through this single connection.
- **Sport display adapters**: Strategy pattern via `SportDisplayRegistry` maps sport types to display components — currently Table Tennis (points/sets) and Padel (15-30-40-AD format).

## ESP32 / BLE Integration

The client includes a Web Bluetooth bridge for the RallyTap physical score button:

```
ESP32 (BLE GATT) ←→ Phone (Web Bluetooth) ←→ rallyOS Hub (Socket.IO)
```

| File | Purpose |
|------|---------|
| `services/ble/bridge.ts` | `BLEBridge` class — GATT connect, notification parsing, score write-back |
| `services/ble/web-bluetooth.d.ts` | Web Bluetooth API type declarations |
| `hooks/useRallyTapBridge.ts` | React hook wiring BLEBridge ↔ Socket.IO |

The ESP32 is **mode-agnostic** — it sends `{button: "A"}` or `{button: "B"}`. The server decides what that means based on the court's current mode (tournament or club).

**Coverage**: BLEBridge is tested with mocked Web Bluetooth API (7 tests). The hook is integration-tested with mocked socket + bridge (5 tests).

## i18n

Two locales: Spanish (es-AR) and English (en-US), managed via i18next.

| File | Description |
|------|-------------|
| `i18n/locales/es.json` | Spanish translations |
| `i18n/locales/en-US.json` | English translations |

## State Management

No external state library — React Context + hooks:

- **AuthContext**: Current user role (owner, referee, viewer, admin, player), login/logout
- **SocketContext**: Socket.IO connection instance + connection status
- **Custom hooks**: Per-page state management (useClubAdmin, useClubCourtManagement, useAuthFlow, useRallyTapBridge, etc.)

## Testing

```bash
# Unit + integration tests (Vitest + @testing-library/react)
pnpm run test

# With coverage
pnpm run test:coverage

# E2E (Playwright — local only, disabled in CI)
pnpm run test:e2e

# All
pnpm run test:all
```

### Test conventions

- Tests co-locate with source files (`Component.test.tsx` next to `Component.tsx`)
- E2E tests in `tests/e2e/`
- Socket mocks use a Map-based EventEmitter pattern
- Web Bluetooth mocks use `vi.stubGlobal('navigator', { bluetooth: ... })`

## Tech Stack

- **Framework**: React 19 + TypeScript 6
- **Build**: Vite 8 + vite-plugin-pwa
- **Styling**: Tailwind CSS 4 + PostCSS
- **Routing**: React Router v7
- **Animations**: Framer Motion 12
- **Icons**: Lucide React + react-icons
- **i18n**: i18next + react-i18next
- **Real-time**: Socket.IO Client 4
- **QR**: qrcode.react
- **Testing**: Vitest 4 + @testing-library/react + Playwright 1.59
