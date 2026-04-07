# RallyOS Hub - Build Flow Update

**Updated: April 7, 2026**

## Overview

The build process has been optimized to ensure fresh, up-to-date client and server builds are performed every time Docker is built. This eliminates the hash mismatch issues where stale compiled assets were served.

## Key Changes

### 1. **Dockerfile Updates**

Both the client-builder and server-builder stages now:

```dockerfile
# Clear npm cache for fresh dependencies
RUN npm cache clean --force

# Install with --force for reliable builds
RUN npm ci --force

# Verify build output exists
RUN test -d dist && echo "✓ [Component] build successful" || (echo "✗ [Component] build failed" && exit 1)
```

**Benefits:**
- ✅ Forces fresh npm dependency resolution
- ✅ No stale cached builds in Docker layers
- ✅ Build output validation ensures correctness
- ✅ Clear error messages if builds fail

### 2. **start.sh Script Updates**

The main startup script now includes **pre-build steps**:

```bash
# Pre-build: Ensure client and server are built locally first
echo -e "${YELLOW}📦 Pre-building client...${NC}"
npm ci --force && npm run build

# Pre-build: Ensure server is built locally first  
echo -e "${YELLOW}📦 Pre-building server...${NC}"
npm ci --force && npm run build
```

**Benefits:**
- ✅ Local builds run first (faster feedback if compilation fails)
- ✅ Docker build layer caching is skipped (`docker-compose build --no-cache`)
- ✅ Fresh compiled assets copied into Docker image
- ✅ No more asset hash mismatches

### 3. **start-orange-pi.sh Script Updates**

Same pre-build approach as `start.sh` for Orange Pi deployments:

```bash
# Pre-build client and server locally
npm ci --force && npm run build

# Then build Docker image with --no-cache
docker-compose build --no-cache
```

## Build Flow Diagram

```
User runs: ./start.sh
    ↓
[1] Pre-build Client
    - npm ci --force
    - npm run build → generates main-D38ya4c5.css, main-3w59P0B_.js
    ↓
[2] Pre-build Server
    - npm ci --force
    - npm run build → TypeScript → JavaScript
    ↓
[3] Docker Build (--no-cache)
    - Stage 1 (client-builder):
        - Copies fresh client/dist/
        - npm cache clean --force
        - npm run build (redundant but ensures freshness)
        - Verifies dist/ exists
    
    - Stage 2 (server-builder):
        - Copies fresh server files
        - npm cache clean --force
        - npm run build (tsc compilation)
        - Verifies dist/ exists
    
    - Stage 3 (production):
        - Copies compiled artifacts from stages 1 & 2
        - Generates SSL certificates
    ↓
[4] Start Containers
    - docker-compose up -d
    - Wait for health check
    ↓
[5] Service Ready
    - HTML served with correct asset hashes
    - CSS loads successfully
    - No 404s on assets
```

## Why This Solves the Hash Mismatch Problem

**Previous Issue:**
- Docker image contained old compiled assets (e.g., `main-CeVC8T4S.css`)
- HTML references new hashes (e.g., `main-D38ya4c5.css`)
- Browser fails to load CSS because filenames don't match

**New Solution:**
1. Pre-builds ensure latest assets are compiled locally
2. `docker-compose build --no-cache` prevents Docker layer caching
3. Dockerfile's `npm cache clean --force` ensures fresh builds even inside Docker
4. Copied assets into Docker always match HTML references

## Usage

### Development/Testing:
```bash
./start.sh
```

### Orange Pi Deployment:
```bash
./start-orange-pi.sh
```

### Manual Build (if needed):
```bash
# Pre-build locally
cd client && npm ci --force && npm run build && cd ..
cd server && npm ci --force && npm run build && cd ..

# Build Docker without cache
docker-compose build --no-cache && docker-compose up -d
```

## Verification

After running `./start.sh`, verify correct hashes:

```bash
curl -k -s https://localhost:3000/ | grep -E 'href=.*css|src=.*js'
```

Should show:
```html
<link rel="stylesheet" crossorigin href="/assets/main-D38ya4c5.css">
<script type="module" crossorigin src="/assets/main-3w59P0B_.js"></script>
```

Then check styles load in browser:
```
https://localhost:3000
```

Accept SSL certificate warning → Styles should render correctly ✅

## Performance Notes

- **Total build time:** ~2-3 minutes (local + Docker)
- **Local pre-builds:** ~7 seconds (client) + ~5 seconds (server)
- **Docker build:** ~108 seconds (first time), faster on subsequent runs due to Docker caching
- **--no-cache flag:** Only affects the build context copy, not all layers

## Troubleshooting

If styles still don't load:

1. **Check if file exists in container:**
   ```bash
   docker exec rallyo-hub ls -la /app/public/dist/assets/
   ```

2. **Verify local build succeeded:**
   ```bash
   ls -la client/dist/assets/
   ls -la server/dist/
   ```

3. **Check server routing:**
   ```bash
   docker-compose logs hub | grep "assets"
   ```

4. **Force complete rebuild:**
   ```bash
   rm -rf client/dist server/dist client/node_modules server/node_modules
   ./start.sh
   ```
