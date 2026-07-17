# RallyOS Server — Express 5 + Socket.IO 4

Real-time backend for rallyOS-hub. Handles tournament (🏆) and club mode (🏢) court management, scoring, authentication, persistence, and embedded deployment.

## Architecture

```
Socket.IO events → Handlers → CourtManager → Services → StateStore
```

### Event Handlers

All handlers are registered per-socket in `SocketHandler.ts`. Each handler owns a set of socket events and delegates to the domain layer.

| Handler | Events | Unit | Purpose |
|---------|--------|------|---------|
| `AuthHandler` | `VERIFY_OWNER`, `SET_REF`, `REF_ROLE_CHECK`, `REGENERATE_PIN` | 🏆 | Tournament authentication + referee management |
| `MatchEventHandler` | `RECORD_POINT`, `RECORD_SCORE`, `SUBTRACT_POINT`, `UNDO_LAST`, `START_MATCH`, `CONFIGURE_MATCH`, `SET_SERVER`, `SWAP_SIDES` | 🏆🏢 | Scoring — **shared** between tournament and club modes |
| `CourtEventHandler` | `CREATE_COURT`, `LIST_COURTS`, `DELETE_COURT`, `GET_COURTS_WITH_PINS` | 🏆 | Tournament court CRUD |
| `AdminHandler` | `SEND_NOTIFICATION`, `SET_FEATURED`, `GET_ALL_HISTORY` | 🏆 | Tournament admin operations |
| `ClubPlayerHandler` | `CLUB_JOIN`, `CLUB_RECONNECT`, `CLUB_END_SESSION` | 🏢 | Club player session lifecycle |
| `ClubCourtHandler` | `CLUB_CREATE_COURT`, `CLUB_ACTIVATE_COURT`, `CLUB_DEACTIVATE_COURT`, `CLUB_RESET_COURT`, `CLUB_DELETE_COURT`, `CLUB_FORCE_END` | 🏢 | Club court CRUD |
| `ClubAdminHandler` | `CLUB_VERIFY_ADMIN`, `CLUB_GET_CONFIG`, `CLUB_SETUP` | 🏢 | Club admin auth + configuration |
| `SpotlightHandler` | `SUBSCRIBE_MATCH`, `UNSUBSCRIBE_MATCH` | 🏆 | Featured match spotlight |

### Domain Layer

| Component | Role |
|-----------|------|
| `CourtManager` | Central orchestrator — court lifecycle, referee registration, scoring delegation, club session management |
| `MatchEngine` | Strategy pattern delegator — resolves sport type and delegates to the correct `SportRules` |
| `TableTennisRules` | Sport implementation: points/sets, win detection, serving logic |
| `PadelRules` | Sport implementation: 15-30-40-AD scoring, games, sets, tiebreak |

### Services

| Service | Role |
|---------|------|
| `StateStore` | JSON file persistence with versioned migration. Stores courts, match states, club config, optional archive |
| `MatchOrchestrator` | Coordinates court + match lifecycle — start, record point, undo, finish, notify |
| `PlayerService` | Player name management per court |
| `CourtRepository` | In-memory court registry with lookup helpers |
| `PinService` | PIN generation (5-8 digit), verification, encryption (AES-256-GCM) |
| `AdminPinService` | Admin PIN verification (8-digit `TOURNAMENT_OWNER_PIN`) |
| `RateLimiter` | Per-client rate limiting with configurable thresholds and retry-after |
| `QRService` | QR code generation for court access links |
| `CourtFormatter` | Transforms internal court state to client-safe event payloads (strips PINs for public events) |
| `CsvExporter` | Match history CSV export |

### Club Mode Server Implementation

| Feature | Handler | Domain Method |
|---------|---------|---------------|
| Court activation (AVAILABLE → RESERVED) | `ClubCourtHandler` | `courtManager.activateClubCourt()` |
| Player join (RESERVED → OCCUPIED) | `ClubPlayerHandler` | `courtManager.occupyClubCourt()` |
| Score point (both modes) | `MatchEventHandler` | `courtManager.recordPoint()` |
| Bridge ownership reconnection | `ClubPlayerHandler` | `courtManager.registerClubReferee()` |
| Session end (player/force/auto) | `ClubPlayerHandler` | `courtManager.endSession()` |
| Session timer + cost | `ClubPlayerHandler` | Computes elapsed time from `occupiedAt` + club config pricing |
| Club kiosk data | `SocketHandler` | `courtManager.getClubKioskPayload()` |
| Club config (pricing) | `ClubAdminHandler` | `ClubConfigStore` |

## Authentication

### Tournament (🏆)

- **Owner PIN**: 8-digit code set via `TOURNAMENT_OWNER_PIN` env var. Verified by `AuthHandler.VERIFY_OWNER` → `PinService`.
- **Court PIN**: Auto-generated 5-8 digit codes per court. Referee enters the PIN to claim referee role via `AuthHandler.SET_REF` → `PinService.setReferee()`.
- **Encryption**: PINs for QR-based access are encrypted with AES-256-GCM using a derived per-court key (HMAC-SHA256). The encryption secret never leaves the server.
- **Referee lifecycle**: `SET_REF` assigns → `REF_ROLE_CHECK` verifies → `REF_REVOKED` on disconnect or explicit revocation.

### Club Mode (🏢)

- **Admin PIN**: Same 8-digit `TOURNAMENT_OWNER_PIN` for club admin dashboard. Verified via `CLUB_VERIFY_ADMIN`.
- **Court PIN**: 4-digit auto-generated when staff activates a court (`CLUB_ACTIVATE_COURT`). Player enters the PIN via `CLUB_JOIN` → the server validates, binds the socket as court referee, transitions RESERVED → OCCUPIED, and starts the session.
- **Session binding**: PIN is invalidated when the session ends. A new PIN is generated on next activation.
- **Bridge ownership**: After page refresh, `CLUB_RECONNECT` restores referee role without re-entering the PIN — `registerClubReferee()` checks the socket's existing session binding.
- **Rate limiting**: `RateLimiter` enforces per-client backoff on failed PIN attempts.

## Socket Events

All event names use `UPPER_CASE` convention. Types generated from `shared/events.ts` (single source of truth).

### Client → Server

| Event | Unit | Description |
|-------|------|-------------|
| `CREATE_COURT` | 🏆 | Create a new scoring court |
| `JOIN_COURT` | 🏆 | Join an existing court |
| `LEAVE_COURT` | 🏆 | Leave a court |
| `LIST_COURTS` | 🏆 | Get all courts (public) |
| `GET_COURTS_WITH_PINS` | 🏆 | Get all courts with PINs (owner only) |
| `GET_MATCH_STATE` | 🏆 | Get current match state |
| `SET_REF` | 🏆 | Assign/change referee |
| `REF_ROLE_CHECK` | 🏆 | Verify referee role |
| `DELETE_COURT` | 🏆 | Delete a court (owner only) |
| `VERIFY_OWNER` | 🏆 | Verify owner PIN |
| `CONFIGURE_MATCH` | 🏆 | Configure match settings |
| `START_MATCH` | 🏆 | Start a match |
| `RECORD_POINT` | 🏆🏢 | Record a point (shared handler for both modes) |
| `RECORD_SCORE` | 🏆 | Record a score event |
| `SUBTRACT_POINT` | 🏆 | Subtract a point |
| `UNDO_LAST` | 🏆 | Undo the last action |
| `SET_SERVER` | 🏆 | Set serving team/player |
| `RESET_COURT` | 🏆🏢 | Reset court state |
| `SWAP_SIDES` | 🏆 | Swap team sides |
| `REQUEST_COURT_STATE` | 🏆 | Request full court state |
| `REGENERATE_PIN` | 🏆 | Generate new court PIN |
| `GET_RATE_LIMIT_STATUS` | 🏆 | Check rate limit status |
| `GET_ALL_HISTORY` | 🏆 | Get complete match history |
| `SEND_NOTIFICATION` | 🏆 | Send kiosk notification |
| `CLUB_VERIFY_ADMIN` | 🏢 | Verify club admin PIN |
| `CLUB_GET_CONFIG` | 🏢 | Get club configuration (pricing, currency) |
| `CLUB_JOIN` | 🏢 | Join a club court with 4-digit PIN |
| `CLUB_SETUP` | 🏢 | Configure club (pricing, currency) |
| `CLUB_CREATE_COURT` | 🏢 | Create a new club court |
| `CLUB_ACTIVATE_COURT` | 🏢 | Activate a club court (generates PIN) |
| `CLUB_FORCE_END` | 🏢 | Force-end an active session |
| `CLUB_RECONNECT` | 🏢 | Re-establish bridge ownership after refresh |
| `CLUB_DELETE_COURT` | 🏢 | Delete a club court |
| `CLUB_DEACTIVATE_COURT` | 🏢 | Deactivate a club court |
| `CLUB_RESET_COURT` | 🏢 | Reset a finished club court to AVAILABLE |
| `CLUB_END_SESSION` | 🏢 | End a session (player-initiated) |

### Server → Client

| Event | Unit | Description |
|-------|------|-------------|
| `COURT_LIST` | 🏆🏢 | List of all courts |
| `COURT_LIST_WITH_PINS` | 🏆 | Court list including PINs (owner only) |
| `COURT_UPDATE` | 🏆🏢 | Court state changed |
| `COURT_CREATED` | 🏆 | New court created |
| `COURT_JOINED` | 🏆 | A client joined a court |
| `COURT_DELETED` | 🏆 | Court removed |
| `MATCH_UPDATE` | 🏆🏢 | Match state changed (shared format for both modes) |
| `ALL_HISTORY` | 🏆 | Complete match history |
| `REF_SET` | 🏆 | Referee assigned |
| `REF_ROLE_CHECK_RESULT` | 🏆 | Referee verification result |
| `REF_REVOKED` | 🏆🏢 | Referee access revoked (also used in club mode) |
| `QR_DATA` | 🏆 | QR code data for court |
| `PIN_REGENERATED` | 🏆 | Court PIN changed |
| `OWNER_VERIFIED` | 🏆 | Owner authentication result |
| `SET_WON` | 🏆 | A set was won |
| `GAME_WON` | 🏆 | A game was won (padel) |
| `DEUCE` | 🏆 | Deuce reached (padel) |
| `TIEBREAK_START` | 🏆 | Tiebreak started (padel) |
| `MATCH_WON` | 🏆 | The match was won |
| `PLAYER_LEFT` | 🏆 | A player disconnected |
| `ERROR` | 🏆🏢 | Error event |
| `RATE_LIMIT_STATUS` | 🏆 | Rate limit state |
| `HUB_CONFIG` | 🏆 | Hub configuration (WiFi, domain) |
| `KIOSK_NOTIFICATION` | 🏆 | Kiosk notification event |
| `CLUB_ADMIN_VERIFIED` | 🏢 | Club admin PIN verification result |
| `CLUB_CONFIG` | 🏢 | Club configuration (pricing, currency) |
| `CLUB_KIOSK_DATA` | 🏢 | Club kiosk court data with PINs (staff-only) |
| `CLUB_SETUP_COMPLETE` | 🏢 | Club setup saved |
| `CLUB_COURT_CREATED` | 🏢 | New club court created |
| `CLUB_COURT_ACTIVATED` | 🏢 | Club court activated (PIN generated) |
| `CLUB_COURT_DEACTIVATED` | 🏢 | Club court deactivated |
| `CLUB_COURT_RESETTED` | 🏢 | Club court reset to AVAILABLE |
| `CLUB_JOIN_RESULT` | 🏢 | Club PIN verification result + court assignment |
| `CLUB_SESSION_ENDED` | 🏢 | Session ended (with elapsed time and cost) |
| `CLUB_RECONNECT_RESULT` | 🏢 | Reconnection result with court state |

## Environment Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `PORT` | `3000` | Server port |
| `TOURNAMENT_OWNER_PIN` | — | Admin PIN (8 digits) |
| `HUB_SSID` | `RallyOS` | Wi-Fi SSID broadcast by the hub |
| `HUB_WIFI_PASSWORD` | `rallyos2026` | Wi-Fi WPA2 password |
| `HUB_IP` | `192.168.4.1` | Hub IP address (AP mode) |
| `HUB_DOMAIN` | `rallyos.wifi` | Hub domain name |
| `HUB_ALLOWED_ORIGINS` | — | Comma-separated CORS origins |
| `ENCRYPTION_SECRET` | — | AES-256-GCM key (32-byte hex) |
| `NODE_OPTIONS` | `--max-old-space-size=256` | Memory limit for ARM devices |

## Testing

```bash
# Unit + integration tests (Jest + ts-jest)
pnpm run test

# Run with verbose output
pnpm run test -- --verbose

# Test a specific file
npx jest --verbose src/handlers/MatchEventHandler.test.ts
```

### Test coverage highlights

| Area | Tests | What it covers |
|------|-------|----------------|
| `courtManager.test.ts` | 30+ | Court lifecycle, club mode, scoring |
| `MatchEventHandler.test.ts` | 19 | RECORD_POINT in both modes, cross-mode event shape |
| `ClubPlayerHandler.test.ts` | 10+ | CLUB_JOIN, CLUB_RECONNECT, CLUB_END_SESSION |
| `MatchOrchestrator.test.ts` | 20+ | Match lifecycle, sport rules delegation |
| `StateStore.test.ts` | 15+ | Persistence, migration v1→v2 |
| `ClubConfigStore.test.ts` | 5+ | Club pricing configuration |
| `sport.registry.test.ts` | 5+ | Sport rules registration |

## Project Structure

```
server/
└── src/
    ├── config/             # App configuration (ownerPin, allowedOrigins)
    ├── domain/             # Domain logic
    │   ├── courtManager.ts      # Central orchestrator
    │   ├── matchEngine.ts       # Strategy delegator
    │   └── sports/              # Sport rules (TableTennis, Padel, registry)
    │       ├── tableTennis.rules.ts
    │       ├── padel.rules.ts
    │       ├── sport.registry.ts
    │       └── types.ts
    ├── handlers/           # Socket.IO event handlers (8 handlers)
    ├── middleware/          # Express middleware (ownerAuth)
    ├── routes/              # REST routes (tournament, CSV export)
    ├── services/            # Business logic
    │   ├── store/           # StateStore, ClubConfigStore, migration
    │   ├── table/           # MatchOrchestrator, PlayerService, CourtRepository
    │   ├── security/        # PinService, AdminPinService, RateLimiter
    │   └── qr/              # QRService
    ├── utils/               # Logger, encryption, validation
    ├── app.ts               # Express app setup
    ├── server.ts            # HTTPS server + graceful shutdown
    ├── socket.ts            # Socket.IO initialization
    └── index.ts             # Entry point
```
