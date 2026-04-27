#!/bin/bash
#
# RallyOS Orange Pi Access Point Setup Script
# Configures the AC 6000 USB WiFi adapter as an Access Point.
# Assumes: Orange Pi Zero 3 with RTL8821CU drivers already installed.
#
# Usage: sudo ./setup-orangepi-ap.sh
#

set -e # Exit on error

# --- CONFIGURATION (Edit these variables) ---
AP_INTERFACE="wlx90de8018370a"  # Interface name of the USB WiFi adapter
AP_SSID="RallyOS-Table1"
AP_PASSPHRASE="rallyos2026"
AP_IP="192.168.4.1"
DHCP_RANGE_START="192.168.4.100"
DHCP_RANGE_END="192.168.4.200"
WAN_INTERFACE="wlan0"           # Interface connected to the internet (usually wlan0)
# -------------------------------------------

echo "========================================="
echo " RallyOS Orange Pi AP Setup"
echo "========================================="

# 1. Check for root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)."
  exit 1
fi

# 2. Install dependencies
echo "📦 Installing hostapd and dnsmasq..."
apt update
apt install -y hostapd dnsmasq iptables-persistent

# 3. Stop services to configure
echo "🛑 Stopping services for configuration..."
systemctl stop hostapd
systemctl stop dnsmasq

# 4. Configure Static IP for AP Interface
echo "🔧 Setting static IP for $AP_INTERFACE..."
# Using ip command (runtime)
ip addr add ${AP_IP}/24 dev ${AP_INTERFACE} 2>/dev/null || true
ip link set ${AP_INTERFACE} up

# Make it persistent (Armbian way)
cat > /etc/network/interfaces.d/${AP_INTERFACE} << EOF
auto ${AP_INTERFACE}
iface ${AP_INTERFACE} inet static
    address ${AP_IP}
    netmask 255.255.255.0
EOF

# 5. Configure hostapd (The Access Point)
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

# Tell hostapd where the config is
sed -i 's|#DAEMON_CONF=""|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd

# 6. Configure dnsmasq (DHCP & DNS)
echo "📝 Configuring dnsmasq..."
# Backup original
cp /etc/dnsmasq.conf /etc/dnsmasq.conf.orig 2>/dev/null || true

cat > /etc/dnsmasq.conf << EOF
interface=${AP_INTERFACE}
bind-interfaces
listen-address=${AP_IP}
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h
domain=local
address=/rallyos.local/${AP_IP}
EOF

# 7. Enable IP Forwarding (Optional: If you want AP clients to have internet)
echo "🌐 Configuring NAT for internet access via ${WAN_INTERFACE}..."
# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf

# NAT rules (Corrected POSTROUTING spelling)
iptables -t nat -A POSTROUTING -o ${WAN_INTERFACE} -j MASQUERADE
iptables -A FORWARD -i ${WAN_INTERFACE} -o ${AP_INTERFACE} -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i ${AP_INTERFACE} -o ${WAN_INTERFACE} -j ACCEPT

# Save iptables rules
netfilter-persistent save

# 8. Start and Enable Services
echo "🚀 Starting services..."
systemctl unmask hostapd
systemctl enable hostapd
systemctl start hostapd

systemctl enable dnsmasq
systemctl start dnsmasq

# 9. Final Check
echo ""
echo "========================================="
echo " ✅ Setup Complete!"
echo "========================================="
echo " SSID: ${AP_SSID}"
echo " Password: ${AP_PASSPHRASE}"
echo " AP IP: ${AP_IP}"
echo ""
echo "Service Status:"
systemctl status hostapd --no-pager | grep -E "Active|hostapd"
systemctl status dnsmasq --no-pager | grep -E "Active|dnsmasq"
echo "========================================="
