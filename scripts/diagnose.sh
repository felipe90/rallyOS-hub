#!/bin/bash
#
# RallyOS Hub — Orange Pi Diagnostics
# Quick health report. Run this when something breaks.
# Usage: sudo ./scripts/diagnose.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_PATH"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

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
    echo ""
}

section() {
    echo ""
    echo -e "${CYAN}───${NC} ${BLUE}$1${NC} ${CYAN}─────────────────────────────────────────${NC}"
}

# ── DNS ─────────────────────────────────────────────────────
check_dns() {
    section "DNS"

    # resolv.conf
    if grep -q "^nameserver 8.8.8.8" /etc/resolv.conf 2>/dev/null; then
        _ok "resolv.conf → 8.8.8.8"
    else
        _bad "resolv.conf missing or wrong DNS (check: cat /etc/resolv.conf)"
    fi

    # Can resolve
    if nslookup google.com >/dev/null 2>&1 || getent hosts google.com >/dev/null 2>&1; then
        _ok "DNS resolution works"
    else
        _bad "Cannot resolve external hosts"
    fi

    # Docker daemon.json
    if grep -q '"8.8.8.8"' /etc/docker/daemon.json 2>/dev/null; then
        _ok "Docker daemon.json has external DNS"
    else
        _warn "Docker daemon.json missing DNS config — registry pulls may fail"
    fi
}

# ── dnsmasq ─────────────────────────────────────────────────
check_dnsmasq() {
    section "dnsmasq (WiFi AP + DHCP)"

    if systemctl is-active dnsmasq --quiet 2>/dev/null; then
        _ok "dnsmasq is running"
    else
        _bad "dnsmasq is NOT running"
        journalctl -u dnsmasq --no-pager -n 3 2>/dev/null | while IFS= read -r line; do
            echo "    $line"
        done
        return
    fi

    grep -q "bind-dynamic" /etc/dnsmasq.conf 2>/dev/null \
        && _ok "bind-dynamic (survives boot without IP)" \
        || _warn "Not using bind-dynamic — may fail at boot"

    grep -q "address=/#/" /etc/dnsmasq.conf 2>/dev/null \
        && _ok "Catch-all active (captive portal)" \
        || _warn "No catch-all — captive portal won't redirect"

    grep -q "address=/rallyos-hub.local" /etc/dnsmasq.conf 2>/dev/null \
        && _ok "rallyos-hub.local resolves" \
        || _warn "rallyos-hub.local not configured"
}

# ── Firewall ────────────────────────────────────────────────
check_iptables() {
    section "iptables (NAT + redirect)"

    # Port 80 → 3000 redirect (captive portal)
    if iptables -t nat -L PREROUTING 2>/dev/null | grep -q "dpt:80.*192.168.4.1:3000"; then
        _ok "Port 80 → 192.168.4.1:3000 redirect"
    else
        _bad "Missing port 80 redirect — captive portal won't intercept"
    fi

    # DNS redirect (Android fix)
    if iptables -t nat -L PREROUTING 2>/dev/null | grep -q "dpt:53.*REDIRECT"; then
        _ok "DNS redirect (port 53) — Android compatible"
    else
        _warn "No DNS redirect — Android may ignore captive portal"
    fi
}

# ── AP Interface ────────────────────────────────────────────
check_ap_interface() {
    section "WiFi AP Interface (wlx90de8018370a)"

    if ip link show wlx90de8018370a &>/dev/null; then
        local state
        state=$(ip link show wlx90de8018370a | grep -oP '(?<=state )\w+')
        _ok "Interface found — state: $state"
    else
        _bad "AP interface not found — USB WiFi adapter?"
        return
    fi

    local ap_ip
    ap_ip=$(ip addr show wlx90de8018370a 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
    if [ -n "$ap_ip" ]; then
        _ok "AP IP: $ap_ip"
    else
        _bad "AP interface has NO IP — DHCP won't work"
        _info "Fix: sudo ip addr add 192.168.4.1/24 dev wlx90de8018370a && sudo ip link set wlx90de8018370a up"
    fi

    # systemd-networkd
    if [ -f "/etc/systemd/network/10-rallyos-wlx90de8018370a.network" ]; then
        _ok "systemd-networkd config present"
    else
        _warn "No systemd-networkd config — IP may not survive reboot"
    fi
}

# ── Kiosk (HDMI) ────────────────────────────────────────────
check_kiosk() {
    section "HDMI Kiosk"

    # Service status
    if systemctl is-active rallyos-kiosk --quiet 2>/dev/null; then
        _ok "rallyos-kiosk service is running"
    else
        _bad "rallyos-kiosk service is NOT running"
        journalctl -u rallyos-kiosk --no-pager -n 3 2>/dev/null | while IFS= read -r line; do
            echo "    $line"
        done
    fi

    # Chromium running
    if pgrep -x chromium >/dev/null 2>&1; then
        local chrom_mem
        chrom_mem=$(ps -o rss= -p "$(pgrep -x chromium | head -1)" 2>/dev/null | awk '{printf "%.0fM", $1/1024}')
        _ok "Chromium is running (~$chrom_mem)"
    else
        _bad "Chromium is NOT running"
    fi

    # Xorg
    if pgrep -x Xorg >/dev/null 2>&1; then
        _ok "X server is running"
    else
        _bad "X server is NOT running — no display possible"
    fi

    # HDMI connected
    if [ -d /sys/class/drm ]; then
        for card in /sys/class/drm/card*-*/status; do
            local name status
            name=$(basename "$(dirname "$card")")
            status=$(cat "$card" 2>/dev/null || echo "unknown")
            if [ "$status" = "connected" ]; then
                _ok "$name → connected"
            else
                _info "$name → $status"
            fi
        done
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

# ── Docker Hub ──────────────────────────────────────────────
check_hub() {
    section "Docker Hub"

    if ! command -v docker &>/dev/null; then
        _bad "Docker not installed"
        return
    fi

    if docker info &>/dev/null; then
        _ok "Docker daemon running"
    else
        _bad "Docker daemon stopped"
        return
    fi

    # Running containers
    local running
    running=$(docker ps --format '{{.Names}}' 2>/dev/null)
    if echo "$running" | grep -q "rallyo-hub"; then
        local health
        health=$(docker inspect rallyo-hub --format '{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
        _ok "Container rallyo-hub: $health"
    else
        _bad "Container rallyo-hub NOT running"
        _info "Run: sudo ./scripts/start-orange-pi.sh"
    fi

    # Old conflicting container
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "rallyos-hub"; then
        _warn "Old container 'rallyos-hub' exists — may conflict. Remove: docker rm -f rallyos-hub"
    fi

    # Health endpoint
    if curl -sk https://localhost:3000/health >/dev/null 2>&1; then
        _ok "Health endpoint responds"
    else
        _warn "Health endpoint not reachable — hub may be starting up"
    fi
}

# ── Memory ──────────────────────────────────────────────────
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

    # Swap
    if swapon --show 2>/dev/null | grep -q .; then
        _ok "Swap active"
    else
        _warn "No swap — OOM killer may strike under load"
    fi
}

# ── Boot ────────────────────────────────────────────────────
check_boot() {
    section "Boot Performance"

    # Wait-online timeout
    if [ -f /etc/systemd/system/systemd-networkd-wait-online.service.d/timeout.conf ]; then
        _ok "wait-online timeout capped"
    else
        _warn "wait-online not capped — boot may hang 2 min"
    fi

    # Failed units
    local failed_units
    failed_units=$(systemctl --failed --no-legend 2>/dev/null | awk '{print $1}')
    if [ -n "$failed_units" ]; then
        _warn "Failed systemd units: $failed_units"
    else
        _ok "No failed systemd units"
    fi
}

# ── Summary ─────────────────────────────────────────────────
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
    echo ""
}

main() {
    header
    check_dns
    check_dnsmasq
    check_iptables
    check_ap_interface
    check_kiosk
    check_hub
    check_memory
    check_boot
    print_summary
}

main "$@"
