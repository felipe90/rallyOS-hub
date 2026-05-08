# Tasks: Professional UX — Kiosk + Captive Portal POC

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 400–480 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No (POC, single PR acceptable per user) |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

> Note: Estimate is borderline 400-line budget. POC scope + user confirmation that single PR is fine resolves the risk. If apply exceeds budget, chained: PR#1 (client components + wiring), PR#2 (scripts + docs + captive portal).

## Phase 1: Foundation (dependencies for components)

- [ ] 1.1 Add `SCOREBOARD_KIOSK: '/scoreboard/all/kiosk'` to `client/src/routes.ts`
- [ ] 1.2 Add i18n keys to `client/src/i18n/locales/en-US.json`: `kiosk.title`, `kiosk.waiting`, `kiosk.live`, `kiosk.noActiveMatches`
- [ ] 1.3 Add i18n keys to `client/src/i18n/locales/es.json`: Spanish translations for kiosk keys
  - Scenarios: `es` keys mirror `en-US` structure; verify via `t()` in tests

## Phase 2: Core Client Components

- [ ] 2.1 Create `client/src/components/organisms/KioskTableCard/` — component + types + barrel + test
  - Component: TV-optimized card showing table name, players, scores, sets, status badge. No onClick/buttons.
  - Types: `KioskTableCardProps { table: TableInfo; className?: string }`
  - Test: renders with TableInfo data, score display, LiveBadge/WaitingBadge variants
  - Design ref: TV Optimization Guidelines table; reuse existing `LiveBadge`, `WaitingBadge`, `Typography`

- [ ] 2.2 Create `client/src/pages/KioskAllTablesPage/` — page + types + barrel + test
  - Component: reads `tables` from `useSocketContext()`, filters LIVE/WAITING, renders grid with `AnimatePresence`
  - Types: `KioskAllTablesPageProps {}` (follows existing empty props pattern)
  - Test: grid renders multi-table layout, empty state ("No active matches"), filters FINISHED, renders without AuthProvider (auth bypass)
  - Design ref: component spec code snippet, `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`

## Phase 3: Client Wiring

- [ ] 3.1 Export `KioskTableCard` from `client/src/components/organisms/index.ts`
- [ ] 3.2 Add public route to `client/src/App.tsx`: `<Route path={Routes.SCOREBOARD_KIOSK} element={<KioskAllTablesPage />} />` outside `<PrivateRoute>` (after `{Routes.AUTH}` line)
  - Note: SPA fallback in `server/src/app.ts:147` already serves index.html for unmatched routes — no server route needed

## Phase 4: Kiosk Launch Infrastructure (Orange Pi)

- [ ] 4.1 Create `scripts/start-kiosk.sh` — launches Chromium in kiosk mode at `http://localhost:3000/scoreboard/all/kiosk`
  - Flags: `--kiosk --no-first-run --disable-infobars --check-for-update-interval=604800`
  - Auto-detect display: `export DISPLAY=:0`; retry loop (5s) if Chromium fails
- [ ] 4.2 Create `scripts/rallyos-kiosk.service` — systemd unit, `After=docker.service`, `Wants=docker.service`
  - User context: ensures TV auto-displays scoreboard within 60s of boot

## Phase 5: Captive Portal (Orange Pi)

- [ ] 5.1 Modify `scripts/setup-orangepi-ap.sh`: add `address=/#/192.168.4.1` to dnsmasq config (catch-all DNS)
  - Insert after line 85 (`address=/rallyos-hub.local/${AP_IP}`) + comment line
- [ ] 5.2 Modify `scripts/setup-orangepi-ap.sh`: add iptables DNAT rules after line 113 (FORWARD rules)
  - `iptables -t nat -A PREROUTING -i ${AP_INTERFACE} -p tcp --dport 80 -j DNAT --to-destination 127.0.0.1:3000`
  - Persist with `netfilter-persistent save`
- [ ] 5.3 Add `GET /captive-portal` → 302 redirect to `server/src/app.ts` **before** SPA fallback (line 147)
  - Returns `302` with `Location: http://rallyos-hub.local:3000`
  - Optional: if skipped, iptables-only approach still works but browsers don't detect portal automatically

## Phase 6: Documentation

- [ ] 6.1 Update `README.md` with Kiosk + Captive Portal sections
  - Kiosk: systemd enable/start commands, display requirements, troubleshooting (Chromium unavailable flag `--no-sandbox` for root)
  - Captive Portal: AP setup commands, WiFi behavior, browser compatibility notes
