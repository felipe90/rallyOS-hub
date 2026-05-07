# Proposal: dnsmasq-local-setup — PWA Accessible via `rallyos-hub.local:3000`

## Intent

The Hub's PWA is currently accessible only via IP (`192.168.4.1:3000`) or the legacy `orangepi.local` / `rallyos.local` mDNS names. Users want a real domain name (`rallyos-hub.local`) for CORS, PWA install, and browser compatibility. dnsmasq already runs; the foundation exists — we need to wire it together.

## Scope

### In Scope

- Add `HUB_DOMAIN=rallyos-hub.local` env var (server config, defaults)
- Update dnsmasq: resolve `rallyos-hub.local` alongside `rallyos.local` (keep backward compatibility)
- Update CORS defaults: add `https://rallyos-hub.local:3000`, keep `orangepi.local` and `rallyos.local` for backward compatibility
- Update host header validation to use `HUB_DOMAIN`
- Update SSL cert generation (Dockerfile + dev.sh) — add `DNS:rallyos-hub.local` to SAN
- Update display messages, docs, and README
- Update `allowedOrigins.spec.ts` tests

### Out of Scope

- Client URL handling (already dynamic via `window.location.origin`)
- QR code handshake (stays with `hubIp` as IP)
- `shared/types.ts` / `hubIp` field (stays as IP)
- PWA manifest/service worker (already dynamic)
- Non-Orange Pi DNS resolution (users manage `/etc/hosts` or equivalent)

## Capabilities

### New Capabilities

None — this is a config change, not a new feature domain.

### Modified Capabilities

- `host-header-validation`: default allowed hosts add `HUB_DOMAIN` (`rallyos-hub.local`), keep `orangepi.local` and `rallyos.local` for backward compatibility

## Approach

**Hybrid env var approach** (recommended by exploration):

- `HUB_IP` stays for networking (dnsmasq, hostapd, DHCP)
- `HUB_DOMAIN` is added for the application layer (CORS, SSL SAN, host validation, display URLs)
- dnsmasq resolves `HUB_DOMAIN` (`rallyos-hub.local`) → `HUB_IP`, keep `rallyos.local` for backward compatibility
- Client code is already dynamic (`window.location.origin`), no changes needed

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `scripts/setup-orangepi-ap.sh` | Modified | dnsmasq: add `rallyos-hub.local` alongside `rallyos.local` |
| `server/src/config/allowedOrigins.ts` | Modified | Add `HUB_DOMAIN:3000` origins, keep `orangepi.local` and `rallyos.local` |
| `server/src/app.ts` | Modified | Host validation: extract hostname from `HUB_DOMAIN` |
| `server/src/index.ts` | Modified | `hubConfig` display URLs use `HUB_DOMAIN` |
| `Dockerfile` | Modified | SSL cert SAN: add `DNS:${HUB_DOMAIN}` |
| `docker-compose.yml` | Modified | `HUB_DOMAIN` env var, update `HUB_ALLOWED_ORIGINS` |
| `.env.example` (root) | Modified | Document `HUB_DOMAIN` |
| `server/.env.example` | Modified | Document `HUB_DOMAIN` |
| `dev.sh` | Modified | SSL cert SAN: add `DNS:rallyos-hub.local` |
| `start-orange-pi.sh` | Modified | Display messages |
| `setup-orange-pi.sh` | Modified | Display messages |
| `server/tests/allowedOrigins.spec.ts` | Modified | Add `rallyos-hub.local` test cases |
| `README.md`, `openspec/specs/architecture.md` | Modified | Docs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Self-signed cert warnings for `rallyos-hub.local` | High | Expected — same as IP. Documented as known limitation for local DNS. |
| Users must re-install PWA from new URL | High | Document in release notes. QR codes redirect to new URL automatically. |
| Non-Orange Pi devs need `/etc/hosts` entry | Med | Document in README. Env var still works; just DNS needs manual setup. |
| `HUB_DOMAIN` not set → host validation rejects all | Low | Default to `rallyos-hub.local` in code; only explicit empty string breaks. |

## Rollback Plan

1. Revert `HUB_DOMAIN` env var (remove or set to `rallyos.local`)
2. Revert dnsmasq to remove `rallyos-hub.local` entry, keep `rallyos.local`
3. Revert CORS/host validation defaults to remove `rallyos-hub.local`
4. Redeploy — no data migration needed

## Dependencies

None. All changes are self-contained within the monorepo.

## Success Criteria

- [ ] `https://rallyos-hub.local:3000` resolves via dnsmasq and serves the PWA
- [ ] CORS accepts `https://rallyos-hub.local:3000` origins
- [ ] Host header `rallyos-hub.local` passes validation (no 400)
- [ ] SSL cert includes `DNS:rallyos-hub.local` in SAN
- [ ] `allowedOrigins.spec.ts` includes `rallyos-hub.local` test cases (passing)
- [ ] Display messages reference `rallyos-hub.local` domain, not IP-only
