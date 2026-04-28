#!/bin/bash
#
# RallyOS Orange Pi AP Setup Script - FULLY AUTOMATED (Non-interactive)
# Configures the AC 6000 USB WiFi adapter as an Access Point.
# Assumes: Orange Pi Zero 3 with RTL8821CU drivers already installed.
# Usage: sudo ./setup-orangepi-ap.sh
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
echo " RallyOS Orange Pi AP Setup"
echo "========================================="

# 1. Check for root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)."
  exit 1
fi

# 2. Detect AP interface automatically if default is not found
if ! ip link show "$AP_INTERFACE" &>/dev/null; then
    echo "⚠️  Default interface $AP_INTERFACE not found. Searching for Realtek USB..."
    FOUND_IFACE=$(iw dev | grep -B1 "addr" | grep "Interface" | awk '{print $2}' | grep -v "wlan0" | head -1)
    if [ -n "$FOUND_IFACE" ]; then
        AP_INTERFACE="$FOUND_IFACE"
        echo "✓ Found interface: $AP_INTERFACE"
    else
        echo "❌ No suitable USB WiFi interface found."
        exit 1
    fi
fi

# 3. Install dependencies (silent)
echo "📦 Installing hostapd and dnsmasq..."
apt-get update -qq
apt-get install -y -qq hostapd dnsmasq iptables-persistent net-tools

# 4. Stop services
echo "🛑 Stopping services..."
systemctl stop hostapd 2>/dev/null || true
systemctl stop dnsmasq 2>/dev/null || true

# 5. Configure hostapd
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

sed -i 's|#DAEMON_CONF=""|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd

# 6. Configure dnsmasq (fixing port 53 conflict with bind-interfaces)
echo "📝 Configuring dnsmasq..."
cp /etc/dnsmasq.conf /etc/dnsmasq.conf.orig 2>/dev/null || true

cat > /etc/dnsmasq.conf << EOF
interface=${AP_INTERFACE}
bind-interfaces
listen-address=${AP_IP}
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h
domain=local
address=/rallyos.local/${AP_IP}
EOF

# 7. Configure static IP (persistent in /etc/network/interfaces)
echo "🔧 Setting persistent static IP..."
if ! grep -q "auto ${AP_INTERFACE}" /etc/network/interfaces 2>/dev/null; then
    cat >> /etc/network/interfaces << EOF

# RallyOS AP - Persistent Config
auto ${AP_INTERFACE}
iface ${AP_INTERFACE} inet static
    address ${AP_IP}
    netmask 255.255.255.0
EOF
fi

# 8. Enable IP Forwarding and NAT
echo "🌐 Configuring NAT..."
echo 1 > /proc/sys/net/ipv4/ip_forward
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf

# Clear old rules to avoid duplicates
iptables -t nat -F POSTROUTING 2>/dev/null || true
iptables -F FORWARD 2>/dev/null || true

iptables -t nat -A POSTROUTING -o ${WAN_INTERFACE} -j MASQUERADE
iptables -A FORWARD -i ${WAN_INTERFACE} -o ${AP_INTERFACE} -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i ${AP_INTERFACE} -o ${WAN_INTERFACE} -j ACCEPT

netfilter-persistent save

# 9. Start services
echo "🚀 Starting services..."
systemctl unmask hostapd
systemctl enable hostapd
systemctl start hostapd

systemctl enable dnsmasq
systemctl start dnsmasq

# 10. Bring interface up with IP
ip addr add ${AP_IP}/24 dev ${AP_INTERFACE} 2>/dev/null || true
ip link set ${AP_INTERFACE} up

# 11. Final Check
echo ""
echo "========================================="
echo " ✅ Setup Complete!"
echo "========================================="
echo " SSID: ${AP_SSID}"
echo " Password: ${AP_PASSPHRASE}"
echo " AP IP: ${AP_IP}"
echo " Interface: ${AP_INTERFACE}"
echo ""
systemctl is-active hostapd --quiet && echo "✓ hostapd: RUNNING" || echo "✗ hostapd: FAILED"
systemctl is-active dnsmasq --quiet && echo "✓ dnsmasq: RUNNING" || echo "✗ dnsmasq: FAILED"
echo "========================================="
