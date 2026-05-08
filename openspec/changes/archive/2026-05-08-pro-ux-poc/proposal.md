# Proposal: Professional UX — Kiosk + Captive Portal

## Intent

POC UX improvements: TV auto-displays live scoreboard via Chromium kiosk on HDMI, and WiFi users get auto-redirected to the app (cafe-style captive portal). Both currently require manual URL entry or login — defeating the "plug & play" vision.

## Scope

### In Scope
- Public `/scoreboard/:tableId/kiosk` route — read-only display, no auth required
- Chromium kiosk systemd service + launch script, auto-starts after Docker
- Auto-detect first LIVE/WAITING table via server endpoint, fallback "waiting" page
- dnsmasq catch-all DNS (`address=/#/`) + iptables port 80 → 3000 redirect for captive portal

### Out of Scope
- HTTPS captive portal interception (impossible with self-signed certs)
- Kiosk landing page with cycle timer or multi-table rotation
- Explicit "active table" marker in OwnerDashboard
- Native TWA/Electron apps (PWA sufficient)

## Capabilities

### New Capabilities
- `kiosk-display`: Public read-only scoreboard for HDMI/TV. No auth. Auto-selects first LIVE table; falls back to "waiting for match" when no tables live.
- `captive-portal`: HTTP redirect on WiFi connect. dnsmasq catches all DNS, iptables DNAT redirects port 80 to Express HTTP listener, which 302-redirects to app.

### Modified Capabilities
None — existing auth guard remains for `referee` and `view` routes.

## Approach

**Kiosk**: Server endpoint `/kiosk` → queries TableManager for first LIVE table → redirects to kiosk route. Systemd service `rallyos-kiosk.service` launches Chromium `--kiosk --no-first-run http://localhost:3000/kiosk`, depends on `docker.service`.

**Captive Portal**: Extend `setup-orangepi-ap.sh` with dnsmasq `address=/#/192.168.4.1` (catch-all DNS) + iptables DNAT port 80 → localhost:3000. Express HTTP listener on port 3000 serves `/captive-portal` → 302 to `http://rallyos-hub.local:3000`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/App.tsx` | Modified | Add public `/scoreboard/:tableId/kiosk` route (outside PrivateRoute) |
| `client/src/routes.ts` | Modified | Add `SCOREBOARD_KIOSK` constant + builder |
| `server/src/` | New routes | `/kiosk` (auto-detect table) + `/captive-portal` (302 redirect) |
| `scripts/start-kiosk.sh` | NEW | Chromium kiosk launch with `--ignore-certificate-errors` |
| `scripts/rallyos-kiosk.service` | NEW | systemd unit, depends on docker.service |
| `scripts/setup-orangepi-ap.sh` | Modified | dnsmasq catch-all + iptables DNAT |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RAM pressure (1GB Pi + Docker + Chromium) | High | Monitor; fallback to Midori/Epiphany |
| Public scoreboard: data leak | Low | Read-only socket mode, no write access |
| Chromium unavailable ARM64 Armbian | Low | `apt install chromium-browser` from Debian backports |
| HTTP redirect triggers browser warnings | Med | Expected — same as hotel/cafe WiFi behavior |

## Rollback Plan

1. Remove kiosk route from `App.tsx` + delete `/kiosk` server endpoint
2. `systemctl disable rallyos-kiosk && rm /etc/systemd/system/rallyos-kiosk.service`
3. Revert `setup-orangepi-ap.sh`: remove `address=/#/` line + iptables DNAT rule (backup at `/etc/dnsmasq.conf.orig`)

## Success Criteria

- [ ] Orange Pi boots → TV shows live scoreboard within 60s
- [ ] User connects to WiFi → browser auto-opens to app
- [ ] Public kiosk route works without login
- [ ] RAM < 900MB (100MB buffer on 1GB Pi)
