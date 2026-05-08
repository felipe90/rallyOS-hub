#!/bin/bash
# RallyOS Hub — Chromium Kiosk Launcher
# Auto-starts Chromium in kiosk mode pointing to the all-tables scoreboard
# Intended to run as a systemd service at boot on Orange Pi

set -e

KIOSK_URL="${1:-http://localhost:3000/scoreboard/all/kiosk}"
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

# Launch Chromium in kiosk mode
echo "[kiosk] Launching Chromium kiosk → ${KIOSK_URL}"
exec chromium-browser \
    --kiosk \
    --no-first-run \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-translate \
    --disable-infobars \
    --disable-features=TranslateUI \
    --disk-cache-dir=/tmp/chromium-cache \
    --user-data-dir=/tmp/chromium-kiosk \
    "${KIOSK_URL}" 2>&1 || {
    echo "[kiosk] FATAL: Chromium not found. Install with: sudo apt install chromium-browser"
    exit 1
}
