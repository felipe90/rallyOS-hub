# Tasks: QR Scoreboard Link + Referee Session Persistence + Spanish Default + Auth-Only Language Toggle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

## Phase 1: Server Infrastructure

- [x] 1.1 Add `wifiPassword: string` to `HubConfig` interface in `server/src/domain/types.ts`
- [x] 1.2 Add `HUB_WIFI_PASSWORD=` to root `.env.example` (after HUB_DOMAIN) and `docker-compose.yml` (after HUB_DOMAIN env line)
- [x] 1.3 Add `HUB_CONFIG: 'HUB_CONFIG'` to `SocketEvents.SERVER` in `shared/events.ts`
- [x] 1.4 Read `process.env.HUB_WIFI_PASSWORD` in `server/src/index.ts` hubConfig object (add `wifiPassword` field)
- [x] 1.5 Emit hub config `{ ssid, ip, port, wifiPassword, domain }` on client connection in `server/src/handlers/SocketHandler.ts` (after TABLE_LIST at line 98)

## Phase 2: Client Foundation

- [x] 2.1 Create `client/src/hooks/useRefereeSession.ts` with `saveSession(tableId, pin)` → localStorage key `rallyos_ref_session_{tableId}`, `getSession(tableId)`, `clearSession(tableId)`, and `findAnyValidSession(tables)` that checks table status WAITING|CONFIGURING|LIVE; wrap localStorage access in try/catch for graceful degradation
- [x] 2.2 Add `hubConfig` state + `HUB_CONFIG` listener to `client/src/hooks/useSocketState.ts`; deserialize payload into `{ ssid, ip, port, wifiPassword, domain }`
- [x] 2.3 Set `localStorage.setItem('rallyos-lang-explicit', 'true')` in `client/src/i18n/index.ts` `changeLanguage()` function (after `i18n.changeLanguage` call)
- [x] 2.4 Add `"scoreboardWifiDomain": "Abrí {{domain}}"` to `client/src/i18n/locales/es.json` and `"scoreboardWifiDomain": "Open {{domain}}"` to `en-US.json`

## Phase 3: Page Integration

- [x] 3.1 In `ScoreboardPage.tsx`: import `QRCodeSVG` from `qrcode.react`; read `hubConfig` from `useSocketContext()`; construct WiFi string `WIFI:T:WPA;S:{ssid};P:{wifiPassword};;`; render QR (when `wifiPassword` present) + domain text below via `i18nText('scoreboardWifiDomain', { domain })`
- [x] 3.2 In `ScoreboardPage.tsx`: on mount via `useEffect`, if `!localStorage.getItem('rallyos-lang-explicit')`, call `i18n.changeLanguage('es-AR')`
- [x] 3.3 In `App.tsx`: wrap `<LanguageSwitcher>` with `{location.pathname === '/auth' && <LanguageSwitcher ... />}` using `useLocation()` from react-router-dom
- [x] 3.4 In `RefereeDashboardPage.tsx` and `OwnerDashboardPage.tsx`: after `submitPin` succeeds (REF_SET response), call `saveSession(selectedTable.id, pin)`
- [x] 3.5 In both dashboard pages: on mount via `useEffect`, call `findAnyValidSession(tables)` — if found, auto-navigate to scoreboard skipping PinModal
- [x] 3.6 In both dashboard pages: call `clearSession(tableId)` on `LEAVE_TABLE` emit and on `TABLE_UPDATE` with status=FINISHED

## Phase 4: Testing

- [x] 4.1 Vitteste unit test in `client/src/hooks/useRefereeSession.test.ts`: save+restore with LIVE table → skips modal; restore with FINISHED table → clears session + shows modal; localStorage unavailable → returns null gracefully; clear removes key
- [x] 4.2 RTL test in `client/src/pages/ScoreboardPage/ScoreboardPage.test.tsx`: mock SocketContext with `hubConfig = { ssid:'test', wifiPassword:'pw' }` → QR element renders `WIFI:T:WPA;S:test;P:pw;;`; without wifiPassword → QR hidden, domain text renders
- [x] 4.3 RTL test in `client/src/__tests__/App.test.tsx`: LanguageSwitcher renders at `/auth`, not rendered at `/scoreboard/1`, `/owner`, `/admin`
- [x] 4.4 RTL test in `client/src/pages/RefereeDashboardPage/` (existing test): pre-populate localStorage with valid session → PinModal skipped; empty localStorage → PinModal shown
