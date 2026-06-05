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

# Suppress default xinitrc (no desktop, no window manager, no error popup)
cat > /root/.xinitrc << 'XINITRC_EOF'
# Minimal xinitrc — just keep the X server alive, Chromium handles everything
while true; do sleep 3600; done
XINITRC_EOF

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

# Auto-detect display resolution from DRM (EDID preferred mode)
RESOLUTION=$(cat /sys/class/drm/card*-*/modes 2>/dev/null | head -1 || echo "1920x1080")
echo "[kiosk] Detected display: ${RESOLUTION}"

# Launch Chromium in kiosk mode
echo "[kiosk] Launching Chromium kiosk → ${KIOSK_URL}"

# Start a minimal window manager so Chromium can do fullscreen
matchbox-window-manager -use_titlebar no &
sleep 1

# Hide the mouse cursor — create transparent cursor via X11 bitmap
cat > /tmp/empty.xbm << 'CURSOR_EOF'
#define empty_width 1
#define empty_height 1
static char empty_bits[] = {
0x00};
CURSOR_EOF
cp /tmp/empty.xbm /tmp/empty_mask.xbm
xsetroot -cursor /tmp/empty.xbm /tmp/empty_mask.xbm 2>/dev/null || true

# Hide cursor with unclutter as backup
unclutter -idle 0 -root &

exec "$CHROMIUM_BIN" \
    --kiosk \
    --force-device-scale-factor=2.0 \
    --autoplay-policy=no-user-gesture-required \
    --start-fullscreen \
    --window-size="${RESOLUTION}" \
    --window-position=0,0 \
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
