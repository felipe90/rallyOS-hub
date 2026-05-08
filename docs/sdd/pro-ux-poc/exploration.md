# Exploration: POC UX Improvements — Kiosk + Captive Portal

## Current State

### Hardware & Networking
- **Orange Pi Zero 3** running Armbian (ARM64), Docker on host.
- **WiFi AP**: hostapd on USB adapter (`RTL8821CU`), creates `RallyOS-Table1` SSID.
- **dnsmasq** provides DHCP (`192.168.4.100–200`) + DNS — resolves `rallyos-hub.local` and `rallyos.local` to `192.168.4.1`.
- **NAT** via iptables forwards AP clients to WAN interface (`wlan0`).

### Application
- Single Docker container (`rallyo-hub`) bundles:
  - Express + Socket.IO server on HTTPS port 3000 (Node 22 Alpine, ~256MB memory limit)
  - React SPA client (React Router, Socket.IO client), served as static files from `/public/dist`
- Self-signed SSL certs: `CN=localhost`, SAN includes `DNS:localhost,IP:127.0.0.1,DNS:rallyos-hub.local`
- CORS allows origins from `HUB_ALLOWED_ORIGINS` env var, including `rallyos-hub.local:3000`

### Scoreboard Architecture
- Routes: `/scoreboard/:tableId/referee` (full controls) and `/scoreboard/:tableId/view` (display only)
- **ALL scoreboard routes are protected** — require authentication via `PrivateRoute` wrapper in `App.tsx` (line 29–47)
- Authentication flow: user enters PIN → becomes Owner/Referee/Spectator role
- Table lifecycle: Owner creates table → gets PIN → Referee joins with PIN → match starts → score updates via Socket.IO
- `useMatchState` hook requests match state on mount via `GET_MATCH_STATE` socket event
- **There is NO concept of "active tournament", "active table", or "featured match" in the system**

### Key Files
| File | Role |
|------|------|
| `scripts/setup-orangepi-ap.sh` | WiFi AP + dnsmasq + iptables setup (lines 44–122) |
| `start-orange-pi.sh` | Docker startup via `docker compose up` |
| `docker-compose.yml` | Single service, port 3000, restart always |
| `server/src/app.ts` | Express app with CORS, static files, SPA fallback |
| `server/src/server.ts` | HTTPS + Socket.IO server creation |
| `server/src/index.ts` | Entry point — wires tableManager, socket, HTTPS |
| `server/src/domain/tableManager.ts` | Table CRUD, match orchestration, PIN management |
| `server/src/handlers/MatchEventHandler.ts` | All match-related socket events |
| `shared/events.ts` | Socket event name constants (CLIENT/SERVER) |
| `client/src/App.tsx` | React Router setup with `PrivateRoute` guard |
| `client/src/routes.ts` | Route constants and builders |
| `client/src/pages/ScoreboardPage/` | Scoreboard page + hooks |

---

## Affected Areas

### For Kiosk
- **New**: `/kiosk` endpoint or API on server — auto-selects a table for display
- **New**: systemd service file for Chromium kiosk on Orange Pi host
- **New**: script to detect "active" table and build kiosk URL
- **Modified**: `server/src/app.ts` — if adding a kiosk redirect endpoint
- **Modified**: `client/src/App.tsx` — if adding a kiosk-specific route that bypasses auth
- **Modified**: `scripts/setup-orangepi-ap.sh` — to optionally include Chromium installation + systemd service setup
- **Potentially modified**: scoreboard pages or a new "public view" component

### For Captive Portal
- **Modified**: `scripts/setup-orangepi-ap.sh` — dnsmasq config + iptables rules for captive portal
- **New**: Lightweight captive portal page/redirect (could be served by Node server or a separate mini HTTP server)
- **Modified**: `docker-compose.yml` — potentially expose port 80 for captive portal redirect endpoint

---

## Approaches

### 1. Chromium Kiosk HDMI Display

#### Approach A: Chromium Kiosk + "First LIVE Table" Auto-Select
Install Chromium on Armbian host (outside Docker), create systemd service that launches Chromium in kiosk mode pointing to a new `/kiosk` endpoint. The server endpoint queries all tables via `tableManager.getAllTables()`, returns the first table with `status === 'LIVE'` as a redirect target.

- **Pros**: Simple, leverages existing table status; no new UI; Chromium handles all rendering
- **Cons**: No table selection if multiple matches are live; requires Chromium on 1GB RAM (tight but viable for a single page); requires auth bypass for kiosk viewer
- **Effort**: Low-Medium
- **Key detail for auth bypass**: The `/kiosk` endpoint needs to either:
  1. Serve a special HTML page that auto-joins as a spectator and redirects to `/scoreboard/:tableId/view`
  2. Add a new unauthenticated route in `App.tsx` specifically for kiosk

#### Approach B: Chromium Kiosk + "Active Table" Marker on Server  
Add an "active table" concept to `TableManager` — owner can mark one table as "on display". The kiosk endpoint reads this marker. If no table is marked, show a "no active match" placeholder page.

- **Pros**: Explicit control over what's shown; no ambiguity with multiple tables
- **Cons**: Adds more state management; requires UI change to OwnerDashboard to set/clear active table; more effort
- **Effort**: Medium

#### Approach C: Kiosk Landing Page (No Auto-Select)
Kiosk opens a landing page that shows all tables with LIVE/WAITING status. A timer cycles through them or user taps to select. No auto-selection logic needed — just a display-friendly dashboard.

- **Pros**: No auth issues (can be a new unauthenticated page); works even when no match is live; future-proof for multi-table tournaments
- **Cons**: Needs a full new page component; more client-side work
- **Effort**: Medium

#### Recommendation: **Approach A** (First LIVE Table)
For a POC, this gives the fastest "it just works" experience. The server already tracks table status. The implementation path:
1. Create `/api/kiosk-table` endpoint that returns the first LIVE table's ID and URL (or null)
2. Create `/kiosk` HTML redirect page (server-served) that calls the API then redirects to `/scoreboard/:id/view`
3. Client-side: add a lightweight auto-join-as-spectator flow if the redirect lands on a protected scoreboard
4. Shell script: `setup-kiosk.sh` installs Chromium + creates systemd service
5. systemd service: `rallyos-kiosk.service` launches `chromium-browser --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble https://localhost:3000/kiosk`

**Chromium memory note**: On Orange Pi Zero 3 with 1GB RAM, a single kiosk tab with a static scoreboard page (no heavy JS frameworks beyond the existing SPA) should use ~200-300MB. Combined with the Docker container (256MB limit), total system usage is in the 500-600MB range — tight but viable. Alternative: use `surf` (suckless WebKit browser, ~50MB) or `midori` (~100MB) if Chromium is too heavy.

---

### 2. Captive Portal

#### Approach A: dnsmasq Catch-All + iptables HTTP Redirect (Simplest POC)
Add `address=/#/192.168.4.1` to dnsmasq (catch-all DNS → AP IP). Add iptables rule to redirect all port 80 traffic to a local redirector. The redirector returns HTTP 302 to `https://rallyos-hub.local:3000`.

- **Pros**: Minimal setup; leverages existing dnsmasq; standard approach
- **Cons**: 
  - HTTPS (port 443) cannot be transparently proxied without certificate injection → browsers will show SSL warnings for intercepted HTTPS
  - OS captive portal detection will NOT auto-open because most OSes check specific URLs (connectivitycheck.gstatic.com, captive.apple.com, etc.) — those need to be intercepted AND return a specific HTTP status
  - Requires a web server on port 80 (currently nothing listens there)
- **Effort**: Low

#### Approach B: Full Captive Portal with Detection Standards
Implement proper captive portal detection by intercepting known check URLs and returning the expected responses. Add a small HTTP server on port 80 to serve the portal page. Redirect all other HTTP traffic to the portal.

Known detection URLs:
| OS | Check URL | Expected Response |
|----|-----------|-------------------|
| Android | `connectivitycheck.gstatic.com/generate_204` | HTTP 204 or 200 with specific body |
| iOS/macOS | `captive.apple.com/hotspot-detect.html` | HTTP 200 with "Success" |
| Windows | `www.msftncsi.com/ncsi.txt` | HTTP 200 with "Microsoft NCSI" |
| Linux/NetworkManager | Various (typically same as Android) | HTTP 204 |

- **Pros**: Triggers native "Sign in to network" OS notification; zero-friction user experience
- **Cons**: More iptables complexity; need to serve different responses per check URL; DNS catch-all plus port 80 HTTP redirect doesn't handle HTTPS checks; SSL cert warning for `https://rallyos-hub.local:3000` is unavoidable with self-signed certs
- **Effort**: Medium-High

#### Approach C: DHCP Option 114 + Browser Auto-Open
Some modern OS/browsers support DHCP option 114 (Captive Portal URI). Instead of DNS hijacking, the DHCP server tells the client "there's a captive portal at this URL". Combined with the existing dnsmasq DNS resolution.

- **Pros**: Clean — no iptables tricks; OS gives the browser the URL and it opens naturally
- **Cons**: Not universally supported; Android and iOS don't use it; effectively only works on some Linux distributions
- **Effort**: Low but unreliable

#### Recommendation: **Approach A then iterate to B**
For the POC, start with the simplest DNS catch-all + HTTP redirect. This gets 80% of the value (users just have to open their browser). Then, if time permits, add the Android/iOS detection endpoints to trigger the native captive portal notification.

Implementation path:
1. Add to dnsmasq: `address=/#/192.168.4.1` (catch-all DNS → AP IP)
2. Add iptables rules to redirect port 80 → a lightweight HTTP server listening on port 80 locally
3. Create a minimal captive portal responder:
   - Option 1: Small Node http server as a sidecar (separate Docker container or host process)
   - Option 2: Add a `/captive` route on the existing Express server, exposed on port 80 via iptables redirect
4. The portal page serves a simple HTML page with `<meta http-equiv="refresh" content="0;url=https://rallyos-hub.local:3000">` and a "Continue to RallyOS Hub" link
5. SSL strategy: **Accept the warning** for the POC. Users connect to WiFi → browser opens → sees cert warning → clicks "accept/proceed" → PWA loads. This is the standard POC tradeoff. For real production, proper Let's Encrypt certs are needed (but require a real domain and internet connectivity).

---

## Recommendation

**Both features are feasible as a POC.** The main architectural tension is **authentication**:

- The kiosk needs to view a scoreboard without interacting as a referee/owner/spectator. Currently, ALL scoreboard routes require authentication. The cleanest fix is a **new `/kiosk` redirect endpoint on the server** that auto-selects a LIVE table and directs the user to a **new unauthenticated kiosk-view route** `/scoreboard/:tableId/kiosk` that renders the scoreboard as a read-only display without needing a PIN.

- The captive portal needs a port 80 HTTP listener. The simplest approach is a **small Node HTTP server** (or extending the existing Express app to listen on port 80 as well) that serves a redirect page.

**Suggested implementation order:**
1. Kiosk (value is immediate — scoreboard on TV)
2. Captive Portal (adds polish to the WiFi experience)

---

## Risks

1. **RAM pressure**: Orange Pi Zero 3 with 1GB RAM running Docker (256MB Node) + Chromium (~200-300MB) + dnsmasq/hostapd (~20MB) = ~500-600MB total. There's headroom, but the container memory limit may need adjustment. Monitor with `docker stats`.

2. **Chromium on ARM64 Armbian**: Package name may be `chromium-browser` or `chromium`. Some Armbian builds ship with `chromium` preinstalled. If not, `apt install chromium-browser` should work but may pull ~200MB of dependencies. Verify availability before scripting.

3. **Self-signed cert on kiosk**: Chromium in kiosk mode with `--ignore-certificate-errors` flag should bypass the SSL warning. Some Chromium versions require `--ignore-certificate-errors-spki-list` with the cert's SPKI fingerprint for security. Test both approaches.

4. **HTTPS interception for captive portal**: Cannot transparently redirect HTTPS (port 443) traffic without certificate injection. Users visiting `https://anything.com` will get SSL errors. The redirect strategy only works for HTTP (port 80) requests — which covers most captive portal detection triggers.

5. **No active table fallback**: If no table has `LIVE` status, the kiosk endpoint needs a graceful fallback — either show a "waiting for match" page or display the last finished match.

6. **XDG/display manager**: On Armbian headless setups, Chromium may fail to start without a display manager (`Xorg` or `Wayland`). The systemd service must set `DISPLAY=:0` and ensure the display manager starts first. Armbian with a desktop environment is ideal; headless Armbian needs `xserver-xorg` installed.

---

## Ready for Proposal

**Yes.** The codebase is well-understood, the approaches are clear, and both features have low-medium implementation effort. The orchestrator can proceed to `sdd-propose` with these findings.

Key decisions to make in the proposal:
- Auth bypass strategy for kiosk (new route vs. auto-join spectator)
- Active table selection logic (first LIVE vs. owner-marked vs. landing page)
- Captive portal HTTP responder implementation (node sidecar vs. Express dual-listen vs. separate script)
- Whether to scope captive portal as a separate change or bundle with kiosk
