#!/bin/bash
#
# RallyOS Hub — Orange Pi Complete Setup (Plug & Play)
# One script. Runs everything: system update, Docker, WiFi AP, Captive Portal, HDMI Kiosk.
# Usage: sudo ./scripts/setup-orangepi-ap.sh
#
# Safe to re-run — skips what's already installed.
#

set -e

# --- CONFIGURATION ---
AP_INTERFACE="wlx90de8018370a"
AP_SSID="RallyOS-Table1"
AP_PASSPHRASE="rallyos2026"
AP_IP="192.168.4.1"
DHCP_RANGE_START="192.168.4.100"
DHCP_RANGE_END="192.168.4.200"
WAN_INTERFACE="wlan0"

TOTAL_STEPS=8
CURRENT_STEP=0
# ---------------------

# ── Progress Helpers ────────────────────────────────────────────

_step_start() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    STEP_START_TIME=$(date +%s)
    local pct=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    local bar=""
    local filled=$((pct / 10))
    local i=1
    while [ $i -le 10 ]; do
        if [ $i -le $filled ]; then bar="${bar}#"; else bar="${bar}-"; fi
        i=$((i + 1))
    done
    printf "\n[%s] %d%%  Step %d/%d: %s\n" "$bar" "$pct" "$CURRENT_STEP" "$TOTAL_STEPS" "$1"
}

_step_ok() {
    local elapsed=$(($(date +%s) - STEP_START_TIME))
    printf " ✅  done (%ds)\n" "$elapsed"
}

_step_warn() {
    local elapsed=$(($(date +%s) - STEP_START_TIME))
    printf " ⚠️  %s (%ds)\n" "$1" "$elapsed"
}

_step_skip() {
    local elapsed=$(($(date +%s) - STEP_START_TIME))
    printf " ⏭  %s (%ds)\n" "$1" "$elapsed"
}

# ── Main ────────────────────────────────────────────────────────

echo "  ╔══════════════════════════════════════╗"
echo "  ║   RallyOS Hub — Orange Pi Setup      ║"
echo "  ╚══════════════════════════════════════╝"
echo "  Plug & Play — one command, everything."
echo ""

# ==== Step 1: Root check ========================================
_step_start "Root check"

if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (sudo)."
    exit 1
fi
_step_ok

# ==== Step 2: System update ======================================
_step_start "System update"

apt-get update -qq && apt-get upgrade -qq -y || {
    _step_warn "had warnings — continuing"
}
_step_ok

# ==== Step 3: Docker =============================================
_step_start "Docker engine + compose"

if command -v docker &>/dev/null; then
    echo "  Docker: $(docker --version 2>/dev/null)"
else
    echo "  Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    echo "  Docker installed"
fi

if docker compose version &>/dev/null; then
    echo "  Compose: v2"
elif command -v docker-compose &>/dev/null; then
    echo "  Compose: v1"
else
    echo "  Installing Docker Compose..."
    apt-get install -y -qq docker-compose-plugin 2>/dev/null || {
        ARCH=$(uname -m)
        case "$ARCH" in aarch64) CA="aarch64" ;; armv7l) CA="armv7" ;; *) CA="aarch64" ;; esac
        COMPOSE_VER=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | head -1 | cut -d'"' -f4)
        curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-linux-${CA}" \
            -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    }
    echo "  Compose installed"
fi

systemctl enable docker 2>/dev/null || true
systemctl start docker 2>/dev/null || true

_step_ok

# ==== Step 4: Config =============================================
_step_start "Environment config"

REPO_PATH="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "${REPO_PATH}/.env" ]; then
    echo "  Creating .env with Orange Pi defaults..."

    # Generate a random encryption secret
    ENCRYPTION_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "CHANGE_ME_RANDOM_SECRET_32BYTES_HEX")

    cat > "${REPO_PATH}/.env" << ENVEOF
NODE_ENV=production
PORT=3000
TOURNAMENT_OWNER_PIN=${TOURNAMENT_OWNER_PIN:-12345678}
HUB_SSID=${AP_SSID}
HUB_IP=${AP_IP}
HUB_DOMAIN=rallyos-hub.local
HUB_ALLOWED_ORIGINS=https://localhost:3000,http://localhost:3000,https://${AP_IP}:3000,http://${AP_IP}:3000,https://rallyos-hub.local:3000,http://rallyos-hub.local:3000
NODE_OPTIONS_MEMORY=512
ENCRYPTION_SECRET=${ENCRYPTION_SECRET}
ENVEOF

    echo "  ✅ .env created with AP_IP=${AP_IP} and HUB_DOMAIN=rallyos-hub.local"
    _step_ok
else
    _step_skip "already exists — not overwriting"
    echo "  ℹ️  If you changed AP_IP or HUB_DOMAIN, update .env manually"
    echo "  ℹ️  Current HUB_ALLOWED_ORIGINS:"
    grep '^HUB_ALLOWED_ORIGINS=' "${REPO_PATH}/.env" 2>/dev/null || echo "     (not set — using server defaults)"
fi

# ==== Step 5: AP interface detection =============================
_step_start "WiFi interface detection"

if ! ip link show "$AP_INTERFACE" &>/dev/null; then
    FOUND_IFACE=$(iw dev 2>/dev/null | grep -B1 "addr" | grep "Interface" | awk '{print $2}' | grep -v "wlan0" | head -1)
    if [ -n "$FOUND_IFACE" ]; then
        AP_INTERFACE="$FOUND_IFACE"
        echo "  Found: $AP_INTERFACE"
    else
        echo "  No USB WiFi AP found — skipping AP setup"
        SKIP_AP=true
    fi
else
    echo "  Interface: $AP_INTERFACE"
fi

_step_ok

# ==== Step 6: AP + Captive Portal ================================
_step_start "WiFi AP + Captive Portal"

if [ "$SKIP_AP" = true ]; then
    _step_skip "no AP interface"
else
    echo "  Installing hostapd + dnsmasq..."
    # Pre-seed iptables-persistent debconf to avoid interactive prompts
    echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections 2>/dev/null || true
    echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections 2>/dev/null || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq hostapd dnsmasq iptables-persistent net-tools

    # Free port 53 from systemd-resolved
    if systemctl is-active systemd-resolved --quiet 2>/dev/null; then
        echo "  Stopping systemd-resolved (port 53 conflict)..."
        systemctl stop systemd-resolved
        systemctl disable systemd-resolved
    fi

    # Ensure host DNS works without systemd-resolved (always, not just first run)
    rm -f /etc/resolv.conf
    echo "nameserver 8.8.8.8" > /etc/resolv.conf

    # Docker daemon must use external DNS directly (dnsmasq catch-all breaks registry pulls)
    echo "  Configuring Docker DNS..."
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json << DAEMON_EOF
{
  "dns": ["8.8.8.8", "1.1.1.1"]
}
DAEMON_EOF

    systemctl stop hostapd 2>/dev/null || true
    systemctl stop dnsmasq 2>/dev/null || true

    cat > /etc/hostapd/hostapd.conf << EOF
interface=${AP_INTERFACE}
driver=nl80211
ssid=${AP_SSID}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=${AP_PASSPHRASE}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF

    sed -i 's|#DAEMON_CONF=""|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd 2>/dev/null || true

    cp /etc/dnsmasq.conf /etc/dnsmasq.conf.orig 2>/dev/null || true
    cat > /etc/dnsmasq.conf << EOF
interface=${AP_INTERFACE}
bind-dynamic
listen-address=${AP_IP}
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h
domain=local
address=/rallyos.local/${AP_IP}
address=/rallyos-hub.local/${AP_IP}
address=/#/${AP_IP}
EOF

    # Use systemd-networkd instead of /etc/network/interfaces (more reliable on Armbian)
    echo "  Configuring static IP via systemd-networkd..."
    mkdir -p /etc/systemd/network
    cat > "/etc/systemd/network/10-rallyos-${AP_INTERFACE}.network" << ND_EOF
[Match]
Name=${AP_INTERFACE}

[Network]
Address=${AP_IP}/24
ND_EOF
    systemctl enable systemd-networkd 2>/dev/null || true
    systemctl restart systemd-networkd 2>/dev/null || true

    # Cap wait-online timeout so boot doesn't hang 2 minutes
    mkdir -p /etc/systemd/system/systemd-networkd-wait-online.service.d
    cat > /etc/systemd/system/systemd-networkd-wait-online.service.d/timeout.conf << WOT_EOF
[Service]
ExecStart=
ExecStart=/lib/systemd/systemd-networkd-wait-online --timeout=30
WOT_EOF

    echo "  Configuring NAT + iptables..."
    echo 1 > /proc/sys/net/ipv4/ip_forward
    sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf 2>/dev/null || true

    iptables -t nat -F POSTROUTING 2>/dev/null || true
    iptables -F FORWARD 2>/dev/null || true
    iptables -t nat -A POSTROUTING -o ${WAN_INTERFACE} -j MASQUERADE
    iptables -A FORWARD -i ${WAN_INTERFACE} -o ${AP_INTERFACE} -m state --state RELATED,ESTABLISHED -j ACCEPT
    iptables -A FORWARD -i ${AP_INTERFACE} -o ${WAN_INTERFACE} -j ACCEPT
    iptables -t nat -A PREROUTING -i ${AP_INTERFACE} -p tcp --dport 80 -j DNAT --to-destination ${AP_IP}:3000
    # Force Android devices to use dnsmasq — many ignore DHCP DNS and use 8.8.8.8 via DNS-over-HTTPS
    iptables -t nat -A PREROUTING -i ${AP_INTERFACE} -p udp --dport 53 -j REDIRECT --to-port 53
    iptables -t nat -A PREROUTING -i ${AP_INTERFACE} -p tcp --dport 53 -j REDIRECT --to-port 53

    netfilter-persistent save 2>/dev/null || echo "  (iptables-persistent NA — rules may not survive reboot)"

    # Bring interface up BEFORE starting services (dnsmasq needs the IP to exist)
    echo "  Bringing interface up..."
    ip addr add ${AP_IP}/24 dev ${AP_INTERFACE} 2>/dev/null || true
    ip link set ${AP_INTERFACE} up
    sleep 1

    echo "  Starting AP services..."
    systemctl unmask hostapd 2>/dev/null || true
    systemctl enable hostapd
    systemctl start hostapd
    systemctl enable dnsmasq
    systemctl start dnsmasq

    # Re-assert host DNS — dnsmasq's start-resolvconf hook overwrites resolv.conf
    echo "nameserver 8.8.8.8" > /etc/resolv.conf

    # Reload Docker to pick up daemon.json DNS config
    systemctl restart docker 2>/dev/null || true

    _step_ok
fi

# ==== Step 7: Chromium Kiosk =====================================
_step_start "Chromium Kiosk (HDMI display)"

echo "  Installing X11 + Chromium + kiosk tools..."
apt-get install -y -qq xserver-xorg xinit 2>/dev/null || true
apt-get install -y -qq chromium 2>/dev/null || apt-get install -y -qq chromium-browser 2>/dev/null || {
    _step_warn "Chromium not available — install manually"
}
apt-get install -y -qq matchbox-window-manager unclutter x11-xserver-utils 2>/dev/null || {
    _step_warn "kiosk tools not available — fullscreen/cursor may not work"
}

echo "  Installing systemd service..."
sed "s|__REPO_PATH__|${REPO_PATH}|g" "${REPO_PATH}/scripts/rallyos-kiosk.service" \
    > /etc/systemd/system/rallyos-kiosk.service

    systemctl daemon-reload
systemctl enable rallyos-kiosk
systemctl restart rallyos-kiosk 2>/dev/null || true

echo "  Installing diagnostic service..."
sed "s|__REPO_PATH__|${REPO_PATH}|g" "${REPO_PATH}/scripts/rallyos-diagnose.service" \
    > /etc/systemd/system/rallyos-diagnose.service
systemctl daemon-reload
systemctl enable rallyos-diagnose 2>/dev/null || true
echo "  ✅ rallyos-diagnose will run on every boot"

_step_ok

# ==== Step 8: Final Check ========================================
_step_start "Final check"

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │         ✅  Setup Complete!              │"
echo "  ├──────────────────────────────────────────┤"
echo "  │  SSID:     ${AP_SSID}"
echo "  │  Password: ${AP_PASSPHRASE}"
echo "  │  AP IP:    ${AP_IP}"
echo "  │  Repo:     ${REPO_PATH}"
echo "  └──────────────────────────────────────────┘"
echo ""

systemctl is-active docker --quiet 2>/dev/null       && echo "  ✓ docker          RUNNING" || echo "  ✗ docker          FAILED"
systemctl is-active hostapd --quiet 2>/dev/null      && echo "  ✓ hostapd         RUNNING" || echo "  ✗ hostapd         NOT ACTIVE"
systemctl is-active dnsmasq --quiet 2>/dev/null      && echo "  ✓ dnsmasq         RUNNING" || echo "  ✗ dnsmasq         NOT ACTIVE"
systemctl is-active rallyos-kiosk --quiet 2>/dev/null && echo "  ✓ rallyos-kiosk   RUNNING" || echo "  ✗ rallyos-kiosk   FAILED  → journalctl -u rallyos-kiosk"

echo ""
echo "  Next:"
echo "    WiFi → connect to '${AP_SSID}', opens scoreboard automatically"
echo "    HDMI → kiosk grid should be on screen"
echo "    Start hub manually: ${REPO_PATH}/scripts/start-orange-pi.sh"
_step_ok

echo ""
echo "  ────────────────────────────────────────────"
echo "  Total: 8/8 steps  (100%%)"
echo "  ────────────────────────────────────────────"
