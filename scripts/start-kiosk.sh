#!/bin/bash
# RallyOS Hub — Chromium Kiosk Launcher
# Auto-starts Chromium in kiosk mode pointing to the all-tables scoreboard
# Intended to run as a systemd service at boot on Orange Pi

set -e

KIOSK_URL="${1:-https://localhost:3000/scoreboard/all/kiosk}"
DISPLAY="${DISPLAY:-:0}"

# Wait for Docker containers to be healthy
MAX_RETRIES=30
RETRY=0
echo "[kiosk] Waiting for hub to be healthy..."
while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -sk https://localhost:3000/health >/dev/null 2>&1; then
        echo "[kiosk] Hub is ready."
        break
    fi
    RETRY=$((RETRY + 1))
    sleep 2
done

if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "[kiosk] WARNING: Hub health check timed out. Launching anyway..."
fi

# Start X server if not already running
if ! pgrep -x Xorg >/dev/null 2>&1; then
    echo "[kiosk] Starting X server..."
    startx &
    sleep 3
fi

# Disable DPMS / screen blanking — prevent HDMI signal loss over time
xset -dpms 2>/dev/null || true
xset s off 2>/dev/null || true
xset s noblank 2>/dev/null || true

# Auto-detect Chromium binary (chromium on Armbian ARM64, chromium-browser on Debian x86)
CHROMIUM_BIN=""
for bin in chromium chromium-browser; do
    if command -v "$bin" >/dev/null 2>&1; then
        CHROMIUM_BIN="$bin"
        break
    fi
done

if [ -z "$CHROMIUM_BIN" ]; then
    echo "[kiosk] FATAL: Chromium not found. Install with: sudo apt install chromium"
    exit 1
fi

# Launch Chromium in kiosk mode
echo "[kiosk] Launching Chromium kiosk → ${KIOSK_URL}"
exec "$CHROMIUM_BIN" \
    --kiosk \
    --no-sandbox \
    --ignore-certificate-errors \
    --no-first-run \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-translate \
    --disable-infobars \
    --disable-features=TranslateUI \
    --disk-cache-dir=/tmp/chromium-cache \
    --user-data-dir=/tmp/chromium-kiosk \
    "${KIOSK_URL}" 2>&1
