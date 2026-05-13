# Design: add-qr-and-referi-session

## Technical Approach

Four independent client-side capabilities. The only server change is extending the existing Socket.IO hub config payload with a `wifiPassword` field. The existing `QR_DATA` event is **not** reused — it encodes per-table join URLs, while this change needs a static WiFi QR.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Build-time Vite `VITE_HUB_*` env vars | Requires rebuild per environment; breaks plug-and-play Orange Pi | ✗ |
| New REST endpoint `/api/hub-config` | Extra HTTP fetch; duplicates existing hub config channel | ✗ |
| Extend existing Socket.IO hub config | Zero new endpoints; same channel that frontend already uses | ✓ |

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Route check in `LanguageSwitcher` atom (useLocation) | Atom becomes route-aware; couples atom to router | ✗ |
| Conditional render in `App.tsx` parent | Keeps atom pure; one-line gate in App | ✓ |

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Force `es` in ScoreboardPage useEffect | Simple; but always fires on mount (flicker risk) | ✓ |
| Server-controlled locale per route | Over-engineering for a single page | ✗ |

## Data Flow

### WiFi QR + Domain Display
```
Server ──[hub config via Socket.IO]──→ SocketContext → ScoreboardPage
                                           │
                         { ssid, domain, wifiPassword }
                                           │
                                  ┌────────┴────────┐
                                  │  WiFi QR string  │   Domain text
                                  │  WIFI:T:WPA;...  │   "Abrí {domain}"
                                  │  ↓               │   ↓
                                  │  QRCodeSVG       │   i18nText('scoreboardWifiDomain')
                                  └─────────────────┘
```

### Referee Session Persistence
```
SET_REF success → saveSession(tableId, pin) → localStorage: rallyos_ref_session_{tableId}
App mount → restoreSession() → check localStorage + table status → skip or show PinModal
TABLE_UPDATE(status=FINISHED) | LEAVE_TABLE → clearSession(tableId)
```

### Scoreboard Spanish Default + Language Toggle
```
AuthPage → user clicks toggle → changeLanguage(lng) + set 'rallyos-lang-explicit': 'true'
ScoreboardPage mount → no 'rallyos-lang-explicit'? → force 'es'
App.tsx → useLocation().pathname === '/auth' ? render LanguageSwitcher : null
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/domain/types.ts` | Modify | Add `wifiPassword` to `HubConfig` |
| `server/src/index.ts` | Modify | Read `HUB_WIFI_PASSWORD` env var; include `wifiPassword` in hub config payload |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | Modify | Read hub config from SocketContext; render WiFi QR + domain text; force Spanish on mount |
| `client/src/App.tsx` | Modify | Conditional `<LanguageSwitcher>` — only when route is `/auth` |
| `client/src/i18n/index.ts` | Modify | Add `rallyos-lang-explicit` localStorage flag in `changeLanguage()` |
| `client/src/hooks/useRefereeSession.ts` | **Create** | `saveSession(tableId, pin)`, `restoreSession()`, `clearSession(tableId)` |
| `client/src/pages/RefereeDashboardPage/RefereeDashboardPage.tsx` | Modify | After `SET_REF` success → `saveSession`; on mount → `restoreSession` |
| `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx` | Modify | After `SET_REF` success → `saveSession`; on mount → `restoreSession` |

## Interfaces / Contracts

```typescript
// HubConfig extension (server/src/domain/types.ts)
interface HubConfig { ssid, ip, port, wifiPassword: string }

// Existing Socket.IO hub config event already carries { ssid, ip, port }
// Extended with wifiPassword — no new endpoint needed

// useRefereeSession hook
saveSession(tableId: string, pin: string): void
getSession(tableId: string): { pin, joinedAt } | null
clearSession(tableId: string): void
findAnyValidSession(tables): { tableId, pin } | null
```

## Environment-Aware WiFi QR Logic

Hub config arrives via the existing Socket.IO connection — no extra fetch. The server reads `HUB_SSID` and `HUB_WIFI_PASSWORD` env vars and includes them in the hub config payload. ScoreboardPage reads from SocketContext, constructs the WiFi string `WIFI:T:WPA;S:{ssid};P:{password};;`, and renders it with `<QRCodeSVG value={wifiString} />`. Domain text uses `HUB_DOMAIN` env var: `i18nText('scoreboardWifiDomain', { domain })` rendering "Abrí rallyos-hub.local". Same codebase works on Mac dev, Docker, and Orange Pi without rebuild.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `useRefereeSession` persistence + invalidation | Vitest + `localStorage` mock |
| Unit | LanguageSwitcher hidden on non-auth routes | RTL + `MemoryRouter` |
| Integration | ScoreboardPage renders QR from hub config | RTL + SocketContext mock with `wifiPassword` |
| Integration | PinModal skipped with valid localStorage session | RTL + pre-populated storage |
| E2E | Referee flow: enter PIN → refresh → skip modal | Playwright |

## Migration / Rollout

No migration required. All new state is client-local (localStorage). Existing `QR_DATA` flow untouched. Rollback per proposal: remove `useRefereeSession` calls, remove QR from ScoreboardPage, restore LanguageSwitcher to unconditional render.

## Open Questions

- [x] **Spec conflict**: Resolved — specs regenerated to WiFi QR approach. Design follows proposal.
- [x] **`HUB_WIFI_PASSWORD` env var**: `AP_PASSPHRASE` from setup script already holds the value. Adds `HUB_WIFI_PASSWORD` to `.env.example` and `docker-compose.yml`.
- [x] **QR visibility rules**: Display on all scoreboard pages (kiosk/all-tables view on TV).
