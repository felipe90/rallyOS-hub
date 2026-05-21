# rallyOS-hub — Command Reference

## Development (Local)

```bash
# Start full dev environment (client + server, HMR)
./scripts/dev.sh

# Or manually (two terminals):
cd client && npm run dev          # http://localhost:5173
cd server && npm run dev          # https://localhost:3000
```

## Docker (Production — macOS/Linux)

```bash
# One-command production startup
./scripts/start.sh

# Manual build & start
docker compose up -d --build

# Stop
docker compose down

# Logs
docker compose logs -f hub
docker compose logs --tail=50 hub

# Health check
curl -k https://localhost:3000/health

# Restart
docker compose restart hub
```

## Orange Pi (TTL Serial)

### One-time provisioning
```bash
sudo ./scripts/setup-orangepi-ap.sh
```

### Deploy latest version
```bash
cd /root/rallyOS-hub
git pull origin main
bash scripts/start-orange-pi.sh
```

### Diagnostics
```bash
./scripts/diagnose.sh             # full report
./scripts/diagnose.sh --errors    # errors only
```

### HDMI kiosk (manual)
```bash
./scripts/start-kiosk.sh
```

## Testing

```bash
# Client (Vitest)
cd client && npm test              # watch mode
npm run test:coverage              # with coverage
npm run test:e2e                   # Playwright

# Server (Jest)
cd server && npm test              # verbose
npm run test:e2e

# All tests
cd client && npm run test:all
```

## Lint & Build

```bash
# TypeScript check
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit

# Lint
cd client && npm run lint
cd server && npm run lint

# Build
cd client && npm run build
cd server && npm run build
```

## Environment

```bash
# Create .env from example
cp .env.example .env

# Key vars (edit .env):
#   TOURNAMENT_OWNER_PIN=12345678    # admin PIN
#   HUB_SSID=RallyOS                 # WiFi SSID
#   HUB_IP=192.168.4.1               # AP IP
#   HUB_DOMAIN=rallyos-hub.local     # domain
#   NODE_OPTIONS_MEMORY=512          # Orange Pi: 512, Mac: 256
```

## Utility Scripts

```bash
# Check shared types aren't duplicated in server
cd server && npm run guard:types

# Generate PWA icons (requires source at client/src/assets/icon.jpeg)
cd client && node scripts/generate-icons.mjs

# Pre-commit hook (auto-run via husky + lint-staged)
npx lint-staged
```

## CI/CD (GitHub Actions)

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | push/PR to `main` or `develop` | test-client, test-server, e2e, build, lint |
| `release.yml` | manual dispatch on `main` | builds client, creates draft release |

## Orange Pi URLs

| URL | Description |
|-----|-------------|
| `https://192.168.4.1:3000` | AP network |
| `https://rallyos-hub.local:3000` | Domain (PWA) |
| `https://localhost:3000` | Local (HDMI kiosk) |
| `https://localhost:3000/scoreboard/all/kiosk` | Kiosk display |

## Quick Reference

```bash
# Dev
./scripts/dev.sh

# Docker prod
docker compose up -d --build

# Orange Pi deploy
cd /root/rallyOS-hub && git pull origin main && bash scripts/start-orange-pi.sh

# Orange Pi diag
./scripts/diagnose.sh
```
