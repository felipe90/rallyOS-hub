## Exploration: dnsmasq-local-setup

### Current State

**dnsmasq**: Already installed and configured by `scripts/setup-orangepi-ap.sh` with `address=/rallyos.local/${AP_IP}` — currently resolves `rallyos.local`, NOT `rallyos.com`.

**Hardcoded IPs (192.168.4.1)**:
- `.env` / `.env.example` (root): `HUB_IP=192.168.4.1`
- `server/.env.example`: `HUB_IP=192.168.4.1`
- `server/src/index.ts`: `process.env.HUB_IP || '192.168.4.1'` — used for `hubConfig.ip`
- `docker-compose.yml`: `HUB_IP=${HUB_IP:-192.168.4.1}`
- `scripts/setup-orangepi-ap.sh`: `AP_IP="192.168.4.1"` (AP + DHCP config)
- `start-orange-pi.sh`: displays `https://192.168.4.1:3000`

**Hardcoded localhost:3000**:
- `client/src/hooks/useSocketConnection.ts`: fallback `'https://localhost:3000'`
- `dev.sh`: `SERVER_URL="https://localhost:$SERVER_PORT"`
- `start.sh`, `start-orange-pi.sh`, `diagnose.sh`: health checks
- `Dockerfile`, `docker-compose.yml`: health checks
- `server/playwright.config.ts`: baseURL

**orangepi.local references**:
- `server/src/config/allowedOrigins.ts`: 2 entries (http + https)
- `docker-compose.yml`: in HUB_ALLOWED_ORIGINS defaults
- `server/tests/allowedOrigins.spec.ts`: test assertions
- `setup-orange-pi.sh`: display message
- SDD docs

**Client URL handling** (already partially dynamic):
- `buildScoreboardUrl.ts`: uses `window.location.origin` — CORRECT, works with any domain
- `useSocketConnection.ts`: uses `VITE_SERVER_URL` env var, then `window.location.origin` in prod, then falls back to `localhost:3000` — mostly correct

**QR data** (`shared/types.ts`):
- `hubIp: string` stored in QR data for deep-link connections
- `url: string` uses `rallyhub://join/` deep link scheme (not HTTP)

**SSL certificates**:
- Generated with `CN=localhost`, SAN=`DNS:localhost,IP:127.0.0.1`
- To support `rallyos.com`, the SAN must include `DNS:rallyos.com`

**Host header validation** (`server/src/app.ts`):
- Validates `req.hostname` against allowed origins hostnames
- Whitelists `192.168.*` and `10.0.0.1` as wildcard

**No `rallyos.com` references exist anywhere in the codebase.**

### Affected Areas

- `scripts/setup-orangepi-ap.sh` — dnsmasq config: change `rallyos.local` → `rallyos.com`
- `server/src/config/allowedOrigins.ts` — add `rallyos.com:3000` to defaults (or use env var)
- `server/src/app.ts` — host header validation needs to include `rallyos.com`
- `server/src/index.ts` — `hubConfig` may need domain-aware display URLs
- Dockerfile — SSL cert SAN must include `DNS:rallyos.com`
- `docker-compose.yml` — HUB_ALLOWED_ORIGINS defaults need `rallyos.com:3000`
- `.env.example` (root) — add `HUB_DOMAIN` env var documentation
- `server/.env.example` — add `HUB_DOMAIN` env var documentation
- `.env` — may need `HUB_DOMAIN` (but .env is not committed)
- `dev.sh` — SSL cert generation SAN should include `DNS:rallyos.com`
- `start-orange-pi.sh` — display messages: replace/append with `rallyos.com:3000`
- `setup-orange-pi.sh` — display messages: replace/append with `rallyos.com:3000`
- `server/src/server.ts` — SSL cert error message: update `openssl` command example
- `server/tests/allowedOrigins.spec.ts` — add tests for `rallyos.com` origins
- `client/src/hooks/useSocketConnection.ts` — may want `rallyos.com` as a documented option
- `shared/types.ts` — no change needed (hubIp stays as IP for APIPA connections)
- `client/src/services/url/buildScoreboardUrl.ts` — no change (uses `window.location.origin`)
- `openspec/specs/architecture.md` — update architecture doc
- `openspec/specs/multi-table-system.md` — update example data
- `README.md` — update docs
- `docs/sdd/*.md` — update docs

### Approaches

1. **Pure env var replacement (`HUB_DOMAIN`)** — Add `HUB_DOMAIN=rallyos.com` as a new env var. dnsmasq resolves it. CORS includes it. Host headers validate it. SSL certs SAN includes it.
   - Pros: Clean separation from IP config. Backward compatible. Single source of truth for the domain name.
   - Cons: Requires a new env var. More places to update.
   - Effort: Medium

2. **Just hardcode `rallyos.com` alongside existing refs** — Add `rallyos.com:3000` to the CORS defaults, update dnsmasq, update SSL SAN. Don't introduce a new env var.
   - Pros: Simpler. Fewer env vars. Less code change.
   - Cons: Bakes the domain name into defaults. If domain changes later, more places to update. Still need `HUB_IP` for actual networking.
   - Effort: Low

3. **Use existing `HUB_IP` to derive domain** — If `HUB_IP` is `192.168.4.1`, the domain is always `rallyos.com`. Server constructs full URLs.
   - Pros: No new env vars.
   - Cons: Mixes IP config with domain config. Not semantically clean. The IP changes if DHCP is used.
   - Effort: Low

4. **Hybrid: `HUB_DOMAIN` with sensible defaults + dynamic client** — Add `HUB_DOMAIN` env var (default: `rallyos.com`). Use it in server for CORS, host validation, SSL. Client already handles itself via `window.location.origin`. dnsmasq resolves `HUB_DOMAIN` to `HUB_IP`.
   - Pros: Cleanest separation. Backward compatible. Minimal client changes. Works with any domain.
   - Cons: More setup work than option 2.
   - Effort: Medium

### Recommendation

**Approach 4 (Hybrid)** — Add a new `HUB_DOMAIN=rallyos.com` env var. This is the cleanest approach because:

1. **`HUB_IP` stays for networking** — dnsmasq + hostapd need the actual IP for DHCP leases, AP config, etc. `HUB_DOMAIN` is ONLY for application-layer DNS resolution.

2. **Client code is already mostly correct** — `buildScoreboardUrl.ts` uses `window.location.origin`, and `useSocketConnection.ts` uses `window.location.origin` in production. The fallback to `localhost:3000` only matters in dev.

3. **Server-side changes are localized** — CORS, host header validation, SSL cert SAN, and display messages all reference `HUB_DOMAIN`.

4. **dnsmasq change is trivial** — One line in `setup-orangepi-ap.sh`.

5. **Backward compatible** — Still works with IP access for legacy clients. The domain is additive, not a replacement.

Specific changes:
- Add `HUB_DOMAIN=rallyos.com` to `.env.example` and `server/.env.example`
- Update dnsmasq: `address=/rallyos.com/${AP_IP}` (replace `rallyos.local`)
- Update CORS defaults: add `http://${HUB_DOMAIN}:3000`, `https://${HUB_DOMAIN}:3000` and remove `orangepi.local`
- Update host header validation: add `${HUB_DOMAIN}` to allowed hosts
- Update SSL cert SAN: add `DNS:${HUB_DOMAIN}` to both `Dockerfile` and `dev.sh`
- Update display messages in `start-orange-pi.sh`, `setup-orange-pi.sh`
- Update `allowedOrigins.spec.ts` tests
- Update docs/README

What does NOT change:
- `shared/types.ts` — `hubIp` stays as the IP (used for deep-link handshake)
- `QRService.ts` — uses `hubConfig.ip`, which stays as IP
- `buildScoreboardUrl.ts` — already dynamic
- PWA manifest/service worker — these use `window.location`, no change needed

### Risks

- **SSL certs**: Self-signed certs with SAN for `rallyos.com` may still trigger browser warnings. Since `rallyos.com` is not a real public domain (it resolves locally via dnsmasq), this is expected. No way around this for local DNS.
- **PWA scope**: If PWA was previously installed with IP address, users must re-install from the domain URL. Cannot migrate in-place.
- **dnsmasq on non-Orange Pi**: If someone runs the stack elsewhere (Mac dev, RPi), dnsmasq changes don't apply — those environments need their own DNS resolution for `rallyos.com`. The env var still works; they just need `/etc/hosts` or equivalent.
- **Host header validation**: The current code allows `192.168.*` as a wildcard. Adding `rallyos.com` to the allowlist is explicit but if we make it env-var-driven, it could be blank → connection refused. Must handle the "not set" case by falling back to defaults.
- **`orangepi.local` removal**: Some users may depend on `orangepi.local` for mDNS access. Should keep it in CORS as a backward-compatible entry, or remove only from defaults and let env overrides handle it.

### Ready for Proposal
Yes. All findings are clear. The approach is well-defined with clear boundaries between backend (server env config) and client (already dynamic). The orchestrator should tell the user: "The exploration is complete. We recommend adding a `HUB_DOMAIN` env var and updating ~15 files. The client code is surprisingly already well set up for this — the heavy lifting is on the server config."
