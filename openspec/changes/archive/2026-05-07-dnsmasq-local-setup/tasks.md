# Tasks: dnsmasq-local-setup — PWA accessible via rallyos-hub.local:3000

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 95–110 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Server Core

- [x] 1.1 Update `server/src/config/allowedOrigins.ts` — add `rallyos.local:3000` origins (latent bug fix) + dynamic `http://{HUB_DOMAIN}:3000` / `https://{HUB_DOMAIN}:3000` origins derived from env var, defaulting to `rallyos-hub.local`. Keep `orangepi.local` for backward compatibility.
- [x] 1.2 Update `server/src/app.ts` — ensure `HUB_DOMAIN` hostname passes host header validation (extract hostname from env, add to whitelist alongside existing wildcards)
- [x] 1.3 Update `server/src/index.ts` — display `https://{HUB_DOMAIN}:3000` in startup URL messages, keep IP fallback

## Phase 2: Config & Infrastructure

- [x] 2.1 Add `HUB_DOMAIN=rallyos-hub.local` to `.env.example` (root) and `server/.env.example` with comments
- [x] 2.2 Update `docker-compose.yml` — add `HUB_DOMAIN` env var with `rallyos-hub.local` fallback
- [x] 2.3 Update `Dockerfile` — add `DNS:${HUB_DOMAIN:-rallyos-hub.local}` to SSL cert SAN in `openssl req`
- [x] 2.4 Update `dev.sh` — add `DNS:rallyos-hub.local` to SSL cert SAN in `openssl req`
- [x] 2.5 Update `scripts/setup-orangepi-ap.sh` — add `address=/rallyos-hub.local/${AP_IP}` line in dnsmasq config block; keep existing `rallyos.local` line

## Phase 3: Display & Documentation

- [x] 3.1 Update `start-orange-pi.sh` — show `https://rallyos-hub.local:3000` as primary access URL, keep IP fallback
- [x] 3.2 Update `setup-orange-pi.sh` — show `https://rallyos-hub.local:3000` in completion message

## Phase 4: Testing

- [x] 4.1 Update `server/tests/allowedOrigins.spec.ts` — add test cases: `rallyos.local` origins present (latent fix verification), `rallyos-hub.local` origins present by default, custom `HUB_DOMAIN` overrides default, `orangepi.local` backward compatibility; update the "exactly 10 defaults" assertion to match new count
