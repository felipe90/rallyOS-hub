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
# ---------------------

echo "========================================="
echo " RallyOS Hub — Orange Pi Setup"
echo "========================================="

# ==== 1. Root check ====
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)."
  exit 1
fi

# ==== 2. System update ====
echo ""
echo "🔄 Updating system packages..."
apt-get update -qq && apt-get upgrade -qq -y || echo "⚠️  System update had warnings — continuing"

# ==== 3. Docker ====
echo ""
echo "🐳 Setting up Docker..."

if command -v docker &>/dev/null; then
    echo "✓ Docker already installed: $(docker --version 2>/dev/null || echo 'version unknown')"
else
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    echo "✓ Docker installed"
fi

# Docker Compose
if docker compose version &>/dev/null; then
    echo "✓ Docker Compose (v2) available"
elif command -v docker-compose &>/dev/null; then
    echo "✓ Docker Compose (v1) available"
else
    echo "📦 Installing Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin 2>/dev/null || {
        ARCH=$(uname -m)
        case "$ARCH" in
            aarch64) COMPOSE_ARCH="aarch64" ;;
            armv7l)  COMPOSE_ARCH="armv7" ;;
            *)       COMPOSE_ARCH="aarch64" ;;  # fallback
        esac
        COMPOSE_VER=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | head -1 | cut -d'"' -f4)
        curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-linux-${COMPOSE_ARCH}" \
            -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    }
    echo "✓ Docker Compose installed"
fi

# Enable Docker daemon
echo "🔧 Enabling Docker..."
systemctl enable docker 2>/dev/null || true
systemctl start docker 2>/dev/null || true

# ==== 4. Environment file ====
REPO_PATH="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "${REPO_PATH}/.env" ]; then
    echo "📝 Creating .env from defaults..."
    cp "${REPO_PATH}/.env.example" "${REPO_PATH}/.env" 2>/dev/null || echo "⚠️  .env.example not found — skip"
else
    echo "✓ .env already exists"
fi

# ==== 5. Detect AP interface ====
echo ""
echo "📡 Detecting WiFi AP interface..."

if ! ip link show "$AP_INTERFACE" &>/dev/null; then
    echo "⚠️  Default interface $AP_INTERFACE not found. Searching for USB WiFi..."
    FOUND_IFACE=$(iw dev 2>/dev/null | grep -B1 "addr" | grep "Interface" | awk '{print $2}' | grep -v "wlan0" | head -1)
    if [ -n "$FOUND_IFACE" ]; then
        AP_INTERFACE="$FOUND_IFACE"
        echo "✓ Found interface: $AP_INTERFACE"
    else
        echo "⚠️  No USB WiFi AP interface found — skipping AP setup"
        SKIP_AP=true
    fi
else
    echo "✓ AP interface found: $AP_INTERFACE"
fi

# ==== 6. WiFi Access Point + Captive Portal ====
if [ "$SKIP_AP" != true ]; then

echo ""
echo "📶 Setting up WiFi Access Point + Captive Portal..."

# Install deps
echo "📦 Installing hostapd and dnsmasq..."
apt-get install -y -qq hostapd dnsmasq iptables-persistent net-tools

# Stop services
echo "🛑 Stopping services..."
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# hostapd
echo "📡 Configuring hostapd..."
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

# dnsmasq
echo "📝 Configuring dnsmasq..."
cp /etc/dnsmasq.conf /etc/dnsmasq.conf.orig 2>/dev/null || true

cat > /etc/dnsmasq.conf << EOF
interface=${AP_INTERFACE}
bind-interfaces
listen-address=${AP_IP}
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h
domain=local
address=/rallyos.local/${AP_IP}
address=/rallyos-hub.local/${AP_IP}
# Captive Portal — catch all unresolved DNS queries
address=/#/${AP_IP}
EOF

# Static IP
echo "🔧 Setting persistent static IP..."
if ! grep -q "auto ${AP_INTERFACE}" /etc/network/interfaces 2>/dev/null; then
    cat >> /etc/network/interfaces << EOF

# RallyOS AP — Persistent Config
auto ${AP_INTERFACE}
iface ${AP_INTERFACE} inet static
    address ${AP_IP}
    netmask 255.255.255.0
EOF
fi

# NAT + forwarding
echo "🌐 Configuring NAT + IP forwarding..."
echo 1 > /proc/sys/net/ipv4/ip_forward
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf 2>/dev/null || true

iptables -t nat -F POSTROUTING 2>/dev/null || true
iptables -F FORWARD 2>/dev/null || true
iptables -t nat -A POSTROUTING -o ${WAN_INTERFACE} -j MASQUERADE
iptables -A FORWARD -i ${WAN_INTERFACE} -o ${AP_INTERFACE} -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i ${AP_INTERFACE} -o ${WAN_INTERFACE} -j ACCEPT

# Captive Portal redirect
iptables -t nat -A PREROUTING -i ${AP_INTERFACE} -p tcp --dport 80 -j DNAT --to-destination ${AP_IP}:3000

netfilter-persistent save 2>/dev/null || echo "⚠️  iptables-persistent not available — rules will not survive reboot"

# Start AP services
echo "🚀 Starting AP services..."
systemctl unmask hostapd 2>/dev/null || true
systemctl enable hostapd
systemctl start hostapd
systemctl enable dnsmasq
systemctl start dnsmasq

# Bring interface up
ip addr add ${AP_IP}/24 dev ${AP_INTERFACE} 2>/dev/null || true
ip link set ${AP_INTERFACE} up

fi  # end AP setup

# ==== 7. Chromium Kiosk (HDMI display) ====
echo ""
echo "🖥️  Setting up Chromium Kiosk (HDMI display)..."

# Install X11 + Chromium
echo "📦 Installing X11 and Chromium..."
apt-get install -y -qq xserver-xorg xinit 2>/dev/null || true
apt-get install -y -qq chromium 2>/dev/null || apt-get install -y -qq chromium-browser 2>/dev/null || echo "⚠️  No Chromium package found — install manually"

# Generate service file with actual path
echo "📝 Installing kiosk systemd service..."
sed "s|__REPO_PATH__|${REPO_PATH}|g" "${REPO_PATH}/scripts/rallyos-kiosk.service" \
    > /etc/systemd/system/rallyos-kiosk.service

systemctl daemon-reload
systemctl enable rallyos-kiosk
systemctl restart rallyos-kiosk 2>/dev/null || true

# ==== 8. Final Check ====
echo ""
echo "========================================="
echo " ✅ RallyOS Hub — Setup Complete!"
echo "========================================="
echo " SSID: ${AP_SSID}"
echo " Password: ${AP_PASSPHRASE}"
echo " AP IP: ${AP_IP}"
echo " Repo: ${REPO_PATH}"
echo ""
systemctl is-active docker --quiet && echo "✓ docker: RUNNING" || echo "✗ docker: FAILED"
systemctl is-active hostapd --quiet 2>/dev/null && echo "✓ hostapd: RUNNING" || echo "✗ hostapd: NOT ACTIVE"
systemctl is-active dnsmasq --quiet 2>/dev/null && echo "✓ dnsmasq: RUNNING" || echo "✗ dnsmasq: NOT ACTIVE"
systemctl is-active rallyos-kiosk --quiet 2>/dev/null && echo "✓ rallyos-kiosk: RUNNING" || echo "✗ rallyos-kiosk: FAILED (check: journalctl -u rallyos-kiosk)"
echo ""
echo " Next:"
echo "   Connect to WiFi '${AP_SSID}' — auto-redirects to scoreboard"
echo "   HDMI display should show the kiosk grid"
echo "   Or run: ${REPO_PATH}/scripts/start-orange-pi.sh"
echo "========================================="
