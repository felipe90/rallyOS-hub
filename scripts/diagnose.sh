#!/bin/bash
#
# RallyOS Hub — Orange Pi Diagnostics
# Quick health report. Run this when something breaks.
# Usage: sudo ./scripts/diagnose.sh
#
#   --log, --save    Also write output to /var/log/rallyos-diagnose.log
#   --boot           Silent mode for boot-time (no colors, no spinners)
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_PATH"

# ── Flags ────────────────────────────────────────────────────────
LOG_MODE=false
BOOT_MODE=false
for arg in "$@"; do
    case "$arg" in
        --log|--save) LOG_MODE=true ;;
        --boot)       BOOT_MODE=true; LOG_MODE=true ;;
    esac
done

LOG_FILE="/var/log/rallyos-diagnose.log"

if [ "$LOG_MODE" = true ]; then
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null
    # Bash process substitution: tee to both stdout AND log file
    exec > >(tee -a "$LOG_FILE") 2>&1
fi

# ── Colors ───────────────────────────────────────────────────────
if [ "$BOOT_MODE" = true ]; then
    GREEN=''; BLUE=''; YELLOW=''; RED=''; CYAN=''; NC=''
else
    GREEN='\033[0;32m';  BLUE='\033[0;34m'
    YELLOW='\033[1;33m'; RED='\033[0;31m'
    CYAN='\033[0;36m';   NC='\033[0m'
fi

PASS=0; FAIL=0; WARN=0

_ok()   { echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)); }
_bad()  { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)); }
_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARN++)); }
_info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         RallyOS Hub — Diagnostic Report                  ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "Date: $(date)"
    echo "Host: $(hostname) — $(uname -m)"
    [ "$LOG_MODE" = true ] && echo "Log:  ${LOG_FILE}"
    echo "Uptime: $(uptime -p | sed 's/up //')"
    echo ""
}

section() {
    echo ""
    echo -e "${CYAN}───${NC} ${BLUE}$1${NC} ${CYAN}─────────────────────────────────────────${NC}"
}

# ─── helpers ──────────────────────────────────────────────────────
_ap_iface() {
    grep -q '^interface=' /etc/hostapd/hostapd.conf 2>/dev/null \
        && grep '^interface=' /etc/hostapd/hostapd.conf | cut -d= -f2 \
        || echo "wlx90de8018370a"
}

# ── DNS ───────────────────────────────────────────────────────────
check_dns() {
    section "DNS"

    local resolv_content
    resolv_content=$(grep '^nameserver' /etc/resolv.conf 2>/dev/null || echo "MISSING")
    _info "resolv.conf nameservers: $(echo "$resolv_content" | tr '\n' ' ' || echo 'none')"

    if echo "$resolv_content" | grep -q "8.8.8.8\|1.1.1.1"; then
        _ok "External DNS configured"
    else
        _bad "No external DNS (8.8.8.8/1.1.1.1) in resolv.conf"
    fi

    # Connectivity test: try resolving
    if nslookup google.com >/dev/null 2>&1 || getent hosts google.com >/dev/null 2>&1 || ping -c1 -W2 google.com >/dev/null 2>&1; then
        _ok "DNS resolution works — internet reachable"
    else
        _bad "DNS resolution FAILED — no internet? Check WAN interface (wlan0)"
        _info "Try: ping -c3 8.8.8.8"
    fi

    # Docker DNS
    if [ -f /etc/docker/daemon.json ]; then
        local docker_dns
        docker_dns=$(grep '"dns"' /etc/docker/daemon.json 2>/dev/null | grep -oP '"dns":\s*\[([^\]]+)\]' || echo "not set")
        _info "Docker DNS config: $docker_dns"
        if echo "$docker_dns" | grep -q "8.8.8.8"; then
            _ok "Docker daemon.json has external DNS"
        else
            _warn "Docker daemon.json missing external DNS — registry pulls may fail"
        fi
    else
        _warn "No /etc/docker/daemon.json — Docker may use host DNS (dnsmasq catch-all)"
    fi
}

# ── hostapd ───────────────────────────────────────────────────────
check_hostapd() {
    section "hostapd (WiFi AP)"

    if systemctl is-active hostapd --quiet 2>/dev/null; then
        _ok "hostapd is running"
    else
        _bad "hostapd is NOT running"
        journalctl -u hostapd --no-pager -n 5 2>/dev/null | while IFS= read -r line; do
            echo "    $line"
        done
        _info "Try: sudo systemctl start hostapd && sudo systemctl status hostapd"
        return
    fi

    local iface
    iface=$(_ap_iface)
    _info "AP interface: $iface"

    # Check SSID
    local ssid
    ssid=$(grep '^ssid=' /etc/hostapd/hostapd.conf 2>/dev/null | cut -d= -f2 || echo "unknown")
    _info "SSID: $ssid"

    # Channel
    local channel
    channel=$(grep '^channel=' /etc/hostapd/hostapd.conf 2>/dev/null | cut -d= -f2 || echo "unknown")
    _info "Channel: $channel"

    # Interface state
    if ip link show "$iface" &>/dev/null; then
        local state
        state=$(ip link show "$iface" | grep -oP '(?<=state )\w+')
        _ok "Interface $iface — state: $state"
    else
        _bad "Interface $iface not found"
        return
    fi

    # Connected clients
    local clients
    clients=$(iw dev "$iface" station dump 2>/dev/null)
    local client_count
    client_count=$(echo "$clients" | grep -c "Station" 2>/dev/null || echo "0")
    if [ "$client_count" -gt 0 ]; then
        _ok "Connected clients: $client_count"
        echo "$clients" | grep "Station" | while IFS= read -r line; do
            local mac
            mac=$(echo "$line" | awk '{print $2}')
            _info "  Client: $mac"
        done
    else
        _info "Connected clients: 0"
    fi

    # hostapd channel/freq info
    iw dev "$iface" info 2>/dev/null | while IFS= read -r line; do
        _info "iw: $line"
    done
}

# ── dnsmasq ───────────────────────────────────────────────────────
check_dnsmasq() {
    section "dnsmasq (WiFi AP + DHCP + DNS)"

    if systemctl is-active dnsmasq --quiet 2>/dev/null; then
        local dns_pid
        dns_pid=$(cat /var/run/dnsmasq.pid 2>/dev/null || echo "unknown")
        _ok "dnsmasq is running (pid: $dns_pid)"
    else
        _bad "dnsmasq is NOT running"
        journalctl -u dnsmasq --no-pager -n 5 2>/dev/null | while IFS= read -r line; do
            echo "    $line"
        done
        _info "Try: sudo systemctl start dnsmasq"
        return
    fi

    # bind-dynamic (survives boot without IP)
    grep -q "bind-dynamic" /etc/dnsmasq.conf 2>/dev/null \
        && _ok "bind-dynamic (survives boot without IP)" \
        || _warn "Not using bind-dynamic — may fail at boot"

    # Catch-all for captive portal
    grep -q "address=/#/" /etc/dnsmasq.conf 2>/dev/null \
        && _ok "Catch-all active (captive portal)" \
        || _warn "No catch-all — captive portal won't redirect"

    # rallyos-hub.local
    grep -q "address=/rallyos-hub.local" /etc/dnsmasq.conf 2>/dev/null \
        && _ok "rallyos-hub.local resolves" \
        || _warn "rallyos-hub.local not configured"

    # DHCP range
    local dhcp_range
    dhcp_range=$(grep '^dhcp-range=' /etc/dnsmasq.conf 2>/dev/null | head -1 || echo "not found")
    _info "DHCP range: $dhcp_range"

    # Check DHCP leases
    check_dhcp_leases
}

check_dhcp_leases() {
    local lease_file="/var/lib/misc/dnsmasq.leases"
    if [ -f "$lease_file" ] && [ -s "$lease_file" ]; then
        local lease_count
        lease_count=$(wc -l < "$lease_file")
        _info "DHCP leases: $lease_count"
        while IFS=' ' read -r ts mac ip hostname _; do
            local lease_time
            lease_time=$(date -d "@$ts" '+%H:%M' 2>/dev/null || echo "ago")
            _info "  ${ip} ← ${mac} (${hostname:-no-hostname}, since ${lease_time})"
        done < "$lease_file"
    else
        _info "DHCP leases: none (no clients have connected)"
    fi
}

# ── Firewall / iptables ──────────────────────────────────────────
check_iptables() {
    section "iptables (NAT + redirect)"

    # Port 80 → 3000 redirect (captive portal)
    local port80_rule
    port80_rule=$(iptables -t nat -L PREROUTING 2>/dev/null | grep "dpt:80" | head -1)
    if [ -n "$port80_rule" ]; then
        local dest
        dest=$(echo "$port80_rule" | grep -oP 'to:[0-9.]+:[0-9]+' || echo "unknown")
        _ok "Port 80 → $dest (captive portal redirect)"
    else
        _bad "Missing port 80 redirect — captive portal won't intercept"
        _info "Fix: sudo iptables -t nat -A PREROUTING -i $(_ap_iface) -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:3000"
    fi

    # DNS redirect (Android fix)
    local dns53_rule
    dns53_rule=$(iptables -t nat -L PREROUTING 2>/dev/null | grep "dpt:53" | head -1)
    if [ -n "$dns53_rule" ]; then
        _ok "DNS redirect (port 53 → dnsmasq) — Android compatible"
    else
        _warn "No DNS redirect — Android may ignore captive portal"
        _info "Fix: sudo iptables -t nat -A PREROUTING -i $(_ap_iface) -p udp --dport 53 -j REDIRECT --to-port 53"
        _info "      sudo iptables -t nat -A PREROUTING -i $(_ap_iface) -p tcp --dport 53 -j REDIRECT --to-port 53"
    fi

    # MASQUERADE (NAT for client internet)
    local masq_rule
    masq_rule=$(iptables -t nat -L POSTROUTING 2>/dev/null | grep "MASQUERADE" | head -1)
    if [ -n "$masq_rule" ]; then
        local masq_iface
        masq_iface=$(echo "$masq_rule" | grep -oP 'to:\S+' || echo "$(echo "$masq_rule" | awk '{print $NF}')")
        _ok "NAT MASQUERADE active"
    else
        _warn "No MASQUERADE — AP clients won't reach internet"
    fi

    # IP forwarding
    local ip_forward
    ip_forward=$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null || echo "0")
    if [ "$ip_forward" = "1" ]; then
        _ok "IP forwarding enabled"
    else
        _bad "IP forwarding DISABLED — no traffic between AP and internet"
        _info "Fix: echo 1 > /proc/sys/net/ipv4/ip_forward"
    fi
}

# ── AP Interface ──────────────────────────────────────────────────
check_ap_interface() {
    local iface
    iface=$(_ap_iface)
    section "WiFi AP Interface ($iface)"

    if ip link show "$iface" &>/dev/null; then
        local state
        state=$(ip link show "$iface" | grep -oP '(?<=state )\w+')
        _ok "Interface found — state: $state"
    else
        _bad "AP interface not found — USB WiFi adapter?"
        _info "Check: ip link show | grep -E 'wlx|wlan'"
        return
    fi

    local ap_ip
    ap_ip=$(ip addr show "$iface" 2>/dev/null | grep 'inet ' | awk '{print $2}')
    if [ -n "$ap_ip" ]; then
        _ok "AP IP: $ap_ip"
    else
        _bad "AP interface has NO IP — DHCP/DNS won't work"
        _info "Fix: sudo ip addr add 192.168.4.1/24 dev $iface && sudo ip link set $iface up"
    fi

    # systemd-networkd config
    local nd_file="/etc/systemd/network/10-rallyos-${iface}.network"
    if [ -f "$nd_file" ]; then
        _ok "systemd-networkd config present: $nd_file"
        _info "  $(grep 'Address=' "$nd_file" 2>/dev/null | head -1)"
    else
        _warn "No systemd-networkd config — IP may not survive reboot"
        _info "Expected: $nd_file"
    fi

    # Check routes
    _info "Routing table for $iface:"
    ip route show dev "$iface" 2>/dev/null | while IFS= read -r line; do
        _info "  route: $line"
    done
}

# ── WAN Interface ─────────────────────────────────────────────────
check_wan() {
    section "WAN / Internet"

    local wan_iface
    wan_iface=$(ip route show default 2>/dev/null | awk '{print $5}' | head -1)
    if [ -n "$wan_iface" ]; then
        local wan_ip
        wan_ip=$(ip addr show "$wan_iface" 2>/dev/null | grep 'inet ' | awk '{print $2}' | head -1)
        _ok "Default route via $wan_iface (IP: ${wan_ip:-none})"

        # Verify connectivity
        if ping -c1 -W3 8.8.8.8 >/dev/null 2>&1; then
            _ok "Internet reachable (ping 8.8.8.8)"
        else
            _warn "Internet NOT reachable — services may not sync"
            _info "Check: ping -c3 8.8.8.8"
        fi
    else
        _warn "No default route — no internet connection"
        _info "If using WiFi client mode: check nmcli or wpa_supplicant on wlan0"
    fi
}

# ── Port Listening ────────────────────────────────────────────────
check_ports() {
    section "Listening Ports"

    local ports="3000 80 53"
    for port in $ports; do
        # Check with ss (modern) or netstat (legacy)
        local listener
        listener=$(ss -tlnp "sport = :$port" 2>/dev/null | tail -n+2 | head -3)
        if [ -n "$listener" ]; then
            local proc
            proc=$(echo "$listener" | grep -oP 'users:\(\([^)]+\)\)' || echo "")
            _ok "Port $port — LISTENING ${proc}"
        else
            local legacy
            legacy=$(netstat -tlnp 2>/dev/null | grep ":$port " | head -1)
            if [ -n "$legacy" ]; then
                _ok "Port $port — LISTENING (netstat)"
            else
                _warn "Port $port — NOT listening"
                case $port in
                    3000) _info "  Docker container may not be running" ;;
                    80)   _info "  captive portal redirect expects nothing on :80" ;;
                    53)   _info "  dnsmasq should be listening here" ;;
                esac
            fi
        fi
    done
}

# ── Kiosk (HDMI) ─────────────────────────────────────────────────
check_kiosk() {
    section "HDMI Kiosk"

    # Service status
    if systemctl is-active rallyos-kiosk --quiet 2>/dev/null; then
        _ok "rallyos-kiosk service is running"
    else
        _bad "rallyos-kiosk service is NOT running"
        journalctl -u rallyos-kiosk --no-pager -n 5 2>/dev/null | while IFS= read -r line; do
            echo "    $line"
        done
    fi

    # Chromium running
    if pgrep -x chromium >/dev/null 2>&1 || pgrep -x chromium-browser >/dev/null 2>&1; then
        local pid
        pid=$(pgrep -x chromium 2>/dev/null || pgrep -x chromium-browser 2>/dev/null | head -1)
        local chrom_mem
        chrom_mem=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.0fM", $1/1024}')
        _ok "Chromium is running (~${chrom_mem:-unknown})"
    else
        _bad "Chromium is NOT running"
        _info "If kiosk service is active, check: journalctl -u rallyos-kiosk -n 20 --no-pager"
    fi

    # Xorg
    if pgrep -x Xorg >/dev/null 2>&1; then
        _ok "X server is running"
    else
        _bad "X server is NOT running — no display possible"
        _info "Fix: startx & (or restart the kiosk service)"
    fi

    # HDMI connected
    if [ -d /sys/class/drm ]; then
        local hdmi_found=false
        for card in /sys/class/drm/card*-*/status; do
            local name status
            name=$(basename "$(dirname "$card")")
            status=$(cat "$card" 2>/dev/null || echo "unknown")
            _info "Display: $name → $status"
            [ "$status" = "connected" ] && hdmi_found=true
        done
        if [ "$hdmi_found" = false ]; then
            _warn "No HDMI display connected"
        fi
    fi

    # DPMS check
    if grep -q "xset.*-dpms" "$REPO_PATH/scripts/start-kiosk.sh" 2>/dev/null; then
        _ok "DPMS disabled in kiosk script"
    else
        _warn "DPMS not disabled — HDMI may go blank over time"
    fi

    # No zombie xmessage
    if pgrep -x xmessage >/dev/null 2>&1; then
        _warn "xmessage zombie detected — may block display"
    fi
}

# ── Docker Hub ────────────────────────────────────────────────────
check_hub() {
    section "Docker Hub"

    if ! command -v docker &>/dev/null; then
        _bad "Docker not installed"
        return
    fi
    _info "Docker version: $(docker --version 2>/dev/null || echo 'unknown')"

    if docker info &>/dev/null; then
        _ok "Docker daemon running"
    else
        _bad "Docker daemon stopped"
        _info "Fix: sudo systemctl start docker"
        return
    fi

    # Running containers (all, not just rallyo-hub)
    local containers
    containers=$(docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null)
    if echo "$containers" | grep -q "rallyo-hub"; then
        _ok "Container rallyo-hub status:"
        echo "$containers" | grep "rallyo-hub" | while IFS= read -r line; do
            _info "  $line"
        done

        # Health status
        local health
        health=$(docker inspect rallyo-hub --format '{{.State.Health.Status}}' 2>/dev/null || echo "no healthcheck")
        _info "Health check: $health"

        # Container IP
        local cip
        cip=$(docker inspect rallyo-hub --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "unknown")
        _info "Container IP: $cip"

        # Container uptime
        local started
        started=$(docker inspect rallyo-hub --format '{{.State.StartedAt}}' 2>/dev/null | cut -d. -f1 | tr 'T' ' ')
        _info "Started at: ${started:-unknown}"

        # Container logs (last 5 lines)
        _info "Recent container logs:"
        docker logs rallyo-hub --tail 5 2>&1 | while IFS= read -r line; do
            echo "    $line"
        done || true

        # Test health endpoint
        if curl -sk https://localhost:3000/health >/dev/null 2>&1; then
            _ok "Health endpoint responds (https://localhost:3000/health)"
            local http_code
            http_code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:3000/health 2>/dev/null)
            _info "HTTP status: $http_code"
        else
            _bad "Health endpoint NOT reachable"
            _info "Try: docker logs rallyo-hub --tail 20"
        fi

        # SSL cert info
        local cert_expiry
        cert_expiry=$(echo | openssl s_client -connect localhost:3000 -servername localhost 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep 'notAfter' | cut -d= -f2 || echo "unknown")
        if [ "$cert_expiry" != "unknown" ]; then
            _info "SSL cert expires: $cert_expiry"
        fi

    else
        _bad "Container rallyo-hub NOT running"
        _info "Other running containers:"
        if [ -n "$containers" ]; then
            echo "$containers" | tail -n+2 | while IFS= read -r line; do
                _info "  $line"
            done
        else
            _info "  (none)"
        fi
        _info "Run: sudo ./scripts/start-orange-pi.sh"
    fi

    # Old conflicting container
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "rallyos-hub"; then
        _warn "Old container 'rallyos-hub' exists — may conflict"
        _info "Fix: docker rm -f rallyos-hub"
    fi

    # Check docker compose file
    if [ -f "docker-compose.yml" ]; then
        _info "docker-compose.yml exists — ready for build"
    else
        _warn "docker-compose.yml missing — can't start hub"
    fi
}

# ── Memory ───────────────────────────────────────────────────────
check_memory() {
    section "Memory"

    local total used avail
    read -r total used _ avail <<< "$(free -m | awk '/^Mem:/{print $2, $3, $4, $7}')"
    local pct=$(( (total - avail) * 100 / total ))

    echo "  Total: ${total}MB  |  Used: ${used}MB  |  Available: ${avail}MB  |  Usage: ${pct}%"

    if [ "$pct" -gt 85 ]; then
        _bad "Memory critical (>85%) — OOM risk. Close Chromium tabs or reduce Docker memory"
    elif [ "$pct" -gt 65 ]; then
        _warn "Memory high (${pct}%)"
    else
        _ok "Memory OK (${pct}%)"
    fi

    # Top memory consumers
    _info "Top 3 memory consumers:"
    ps -eo pid,comm,%mem,rss --sort=-%mem 2>/dev/null | head -4 | tail -n+2 | while IFS= read -r line; do
        _info "  $line"
    done

    # Swap
    if swapon --show 2>/dev/null | grep -q .; then
        local swap_total swap_used
        swap_total=$(swapon --show 2>/dev/null | awk 'NR>1{print $3}' | head -1)
        swap_used=$(swapon --show 2>/dev/null | awk 'NR>1{print $4}' | head -1)
        _ok "Swap active (${swap_total:-?} total, ${swap_used:-?} used)"
    else
        _warn "No swap — OOM killer may strike under load"
        _info "Add swap: sudo fallocate -l 1G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile"
    fi

    # CPU temp
    local temp
    temp=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{printf "%.1f°C", $1/1000}' || echo "unknown")
    _info "CPU temperature: $temp"

    # Load average
    _info "Load average: $(cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}')"
}

# ── Boot ─────────────────────────────────────────────────────────
check_boot() {
    section "Boot Performance"

    # wait-online timeout
    if [ -f /etc/systemd/system/systemd-networkd-wait-online.service.d/timeout.conf ]; then
        _ok "wait-online timeout capped (30s)"
    else
        _warn "wait-online not capped — boot may hang 2 min"
    fi

    # Failed units
    local failed_units
    failed_units=$(systemctl --failed --no-legend 2>/dev/null | awk '{print $1}')
    if [ -n "$failed_units" ]; then
        _warn "Failed systemd units:"
        systemctl --failed --no-legend 2>/dev/null | while IFS= read -r line; do
            _info "  $line"
        done
    else
        _ok "No failed systemd units"
    fi

    # Boot time
    local boot_ts now_ts boot_sec
    boot_ts=$(cat /proc/stat 2>/dev/null | grep btime | awk '{print $2}')
    if [ -n "$boot_ts" ]; then
        now_ts=$(date +%s)
        boot_sec=$((now_ts - boot_ts))
        _info "System running for: $((boot_sec / 3600))h $(((boot_sec % 3600) / 60))m"
    fi
}

# ── System ───────────────────────────────────────────────────────
check_system() {
    section "System"

    # OS info
    if [ -f /etc/os-release ]; then
        _info "OS: $(grep 'PRETTY_NAME' /etc/os-release | cut -d= -f2 | tr -d '"')"
    fi
    _info "Kernel: $(uname -r)"

    # Disk
    local disk_pct
    disk_pct=$(df -h / 2>/dev/null | awk 'NR==2{print $5}')
    _info "Disk usage: $disk_pct on /"

    # Processes
    local proc_count
    proc_count=$(ps aux 2>/dev/null | wc -l)
    _info "Processes: $proc_count"
}

# ── Summary ──────────────────────────────────────────────────────
print_summary() {
    section "Summary"
    echo ""
    echo -e "  ${GREEN}Passed:  $PASS${NC}"
    echo -e "  ${YELLOW}Warnings: $WARN${NC}"
    echo -e "  ${RED}Failed:  $FAIL${NC}"
    echo ""

    if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
        echo -e "  ${GREEN}✅ Everything looks good!${NC}"
    elif [ "$FAIL" -eq 0 ]; then
        echo -e "  ${YELLOW}⚠️  Warnings only — system should work but has non-critical issues.${NC}"
    else
        echo -e "  ${RED}❌ $FAIL critical issue(s) found — fix FAILED items above.${NC}"
    fi

    if [ "$LOG_MODE" = true ]; then
        echo ""
        _info "Full log saved to: $LOG_FILE"
    fi
    echo ""
}

main() {
    header
    check_dns
    check_hostapd
    check_dnsmasq
    check_iptables
    check_ap_interface
    check_wan
    check_ports
    check_kiosk
    check_hub
    check_memory
    check_system
    check_boot
    print_summary
}

main "$@"
