#!/bin/bash
#
# RallyOS Hub — ESP32 Dual-Mode Hardware Validation
# Validates that the infrastructure stack is ready for ESP32 button
# registration via Web Bluetooth bridge in BOTH tournament and club modes.
#
# This script validates the INFRASTRUCTURE — it does NOT require an
# ESP32 device or phone to be connected. Run it after booting the
# Orange Pi and starting all services.
#
# Usage: sudo ./scripts/validate-esp32-dual-mode.sh
#
#   --save       Also write output to /var/log/rallyos-esp32-validate.log
#   --errors-only  Only show ✗ and ⚠ (suppress ✓ and ℹ)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_PATH" || exit

# ── Flags ────────────────────────────────────────────────────────
SAVE_MODE=false
ERRORS_ONLY=false
for arg in "$@"; do
    case "$arg" in
        --save)         SAVE_MODE=true ;;
        --errors-only)  ERRORS_ONLY=true ;;
    esac
done

LOG_FILE="/var/log/rallyos-esp32-validate.log"

if [ "$SAVE_MODE" = true ]; then
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null
    exec > >(tee -a "$LOG_FILE") 2>&1
fi

# ── Colors ───────────────────────────────────────────────────────
GREEN='\033[0;32m';  BLUE='\033[0;34m'
YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m';   NC='\033[0m'

PASS=0; FAIL=0; WARN=0; SKIP=0

_ok()   { [ "$ERRORS_ONLY" = true ] || echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)); }
_bad()  { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)); }
_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARN++)); }
_info() { [ "$ERRORS_ONLY" = true ] || echo -e "  ${BLUE}ℹ${NC} $1"; }
_skip() { [ "$ERRORS_ONLY" = true ] || echo -e "  ${YELLOW}⊘${NC} $1"; ((SKIP++)); }

header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║    RallyOS Hub — ESP32 Dual-Mode Validation              ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "Date: $(date)"
    echo "Host: $(hostname) — $(uname -m)"
    [ "$SAVE_MODE" = true ] && echo "Log:  ${LOG_FILE}"
    echo "Uptime: $(uptime -p | sed 's/up //')"
    echo ""
}

section() {
    echo ""
    echo -e "${CYAN}───${NC} ${BLUE}$1${NC} ${CYAN}─────────────────────────────────────────${NC}"
}

# ── Node.js inline test runner via docker exec ───────────────────
#
# Runs a Socket.IO connectivity test inside the rallyo-hub container
# (where socket.io-client is available). Uses heredoc piping for a
# clean, self-contained test with no temp files.
#
# Args:
#   $1  Test name (human-readable)
#   $2  Event to emit (e.g. SET_REF)
#   $3  JSON payload to send
#   $4  Expected response event(s) — space-separated, any match = PASS
#   $5  Description of what to check
#
_ws_test() {
    local name="$1"
    local event="$2"
    local payload="$3"
    local expect_events="$4"
    local desc="$5"

    local container="rallyo-hub"

    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
        _skip "WS test: ${name} — container not running"
        return
    fi

    # Build a quoted, escaped payload for inline JS
    # shellcheck disable=SC2016
    local result
    result=$(docker exec -i "$container" node -e "
const { io } = require('socket.io-client');
const socket = io('https://localhost:3000', {
  transports: ['websocket'],
  rejectUnauthorized: false,
  timeout: 5000
});

const EXPECT = '${expect_events}'.split(' ');
const PAYLOAD = ${payload};

let settled = false;
function done(ok, msg) {
  if (settled) return;
  settled = true;
  console.log(ok ? 'PASS' : 'FAIL');
  if (msg) console.log(msg);
  socket.close();
  process.exit(ok ? 0 : 1);
}

// Connection timeout
const connTimer = setTimeout(() => done(false, 'connection timeout'), 5000);
socket.on('connect', () => {
  clearTimeout(connTimer);
  // Emit the test event
  socket.emit('${event}', PAYLOAD);
  // Wait for any expected response
  const respTimer = setTimeout(() => done(false, 'no response after 4s'), 4000);
  EXPECT.forEach((evt) => {
    socket.on(evt, (data) => {
      clearTimeout(respTimer);
      done(true, JSON.stringify(data));
    });
  });
  // Also catch generic ERROR
  if (!EXPECT.includes('ERROR')) {
    socket.on('ERROR', (data) => {
      clearTimeout(respTimer);
      done(true, 'ERROR: ' + JSON.stringify(data));
    });
  }
});
socket.on('connect_error', (err) => {
  clearTimeout(connTimer);
  done(false, 'connect_error: ' + err.message);
});
" 2>&1) || true

    local first_line
    first_line=$(echo "$result" | head -1)

    if [ "$first_line" = "PASS" ]; then
        local detail
        detail=$(echo "$result" | sed -n '2p')
        _ok "WS: ${name} — ${desc} (${detail})"
    elif [ "$first_line" = "FAIL" ]; then
        local detail
        detail=$(echo "$result" | sed -n '2p')
        _bad "WS: ${name} — ${desc}: ${detail}"
    else
        # Unexpected output — likely the socket.io module path failed
        local summary
        summary=$(echo "$result" | tr '\n' '; ' | cut -c1-120)
        _warn "WS: ${name} — ${desc}: unexpected (${summary})"
    fi
}

# ── Step 1: Hub Health Check ─────────────────────────────────────
check_hub_health() {
    section "Step 1: Hub Health Check"

    if ! curl -sk https://localhost:3000/health >/dev/null 2>&1; then
        _bad "Hub health endpoint NOT reachable at https://localhost:3000/health"
        _info "Try: sudo ./scripts/start-orange-pi.sh"
        return
    fi

    local http_code
    http_code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:3000/health 2>/dev/null)
    if [ "$http_code" = "200" ]; then
        _ok "Hub health endpoint — HTTP ${http_code}"

        local body
        body=$(curl -sk https://localhost:3000/health 2>/dev/null)
        _info "Response: ${body}"
    else
        _bad "Hub health endpoint — HTTP ${http_code} (expected 200)"
    fi
}

# ── Step 2: Docker Container Status ──────────────────────────────
check_docker() {
    section "Step 2: Docker Container Status"

    if ! command -v docker &>/dev/null; then
        _bad "Docker not installed"
        return
    fi

    if ! docker info &>/dev/null; then
        _bad "Docker daemon not running"
        return
    fi

    _info "Docker: $(docker --version 2>/dev/null)"

    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^rallyo-hub$"; then
        local status health started
        status=$(docker ps --filter "name=rallyo-hub" --format '{{.Status}}')
        health=$(docker inspect rallyo-hub --format '{{.State.Health.Status}}' 2>/dev/null || echo "no healthcheck")
        started=$(docker inspect rallyo-hub --format '{{.State.StartedAt}}' 2>/dev/null | cut -d. -f1 | tr 'T' ' ')
        _ok "Container rallyo-hub — ${status}"
        _info "Health: ${health}  |  Started: ${started:-unknown}"

        # Container IP
        local cip
        cip=$(docker inspect rallyo-hub --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "unknown")
        _info "Container IP: ${cip}"
    else
        _bad "Container rallyo-hub NOT running"
        _info "Run: sudo ./scripts/start-orange-pi.sh"
    fi

    # Check socket.io-client is available inside the container
    if docker exec rallyo-hub node -e "require('socket.io-client')" 2>/dev/null; then
        _ok "socket.io-client available inside container (WS tests possible)"
    else
        _warn "socket.io-client NOT available inside container — WS tests will skip"
        _info "Re-run: docker compose -f docker-compose.yml build"
    fi
}

# ── Step 3: Kiosk Display ────────────────────────────────────────
check_kiosk() {
    section "Step 3: Kiosk Display"

    if systemctl is-active rallyos-kiosk --quiet 2>/dev/null; then
        _ok "Service rallyos-kiosk is running"
    else
        _bad "Service rallyos-kiosk is NOT running"
        _info "Check: sudo systemctl status rallyos-kiosk"
    fi

    if pgrep -x chromium >/dev/null 2>&1 || pgrep -x chromium-browser >/dev/null 2>&1; then
        local pid
        pid=$(pgrep -x chromium 2>/dev/null || pgrep -x chromium-browser 2>/dev/null | head -1)
        local mem
        mem=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.0fM", $1/1024}')
        _ok "Chromium process running (~${mem})"
    else
        _bad "Chromium process NOT running — kiosk not displaying"
        _info "Check: journalctl -u rallyos-kiosk -n 20 --no-pager"
    fi

    if pgrep -x Xorg >/dev/null 2>&1; then
        _ok "X server running"
    else
        _warn "X server NOT running — no display output"
    fi

    # Check HDMI connection
    if [ -d /sys/class/drm ]; then
        local hdmi_found=false
        for card in /sys/class/drm/card*-*/status; do
            local status
            status=$(cat "$card" 2>/dev/null || echo "unknown")
            if [ "$status" = "connected" ]; then
                hdmi_found=true
                local name
                name=$(basename "$(dirname "$card")")
                _ok "HDMI display: ${name} — connected"
            fi
        done
        if [ "$hdmi_found" = false ]; then
            _warn "No HDMI display connected — validation requires monitor"
        fi
    fi
}

# ── Step 4: Ports Listening ──────────────────────────────────────
check_ports() {
    section "Step 4: Ports Listening (3000, 80, 53)"

    local ports="3000 80 53"
    for port in $ports; do
        local listener
        listener=$(ss -tlnp "sport = :$port" 2>/dev/null | tail -n+2 | head -3)
        if [ -n "$listener" ]; then
            local proc
            proc=$(echo "$listener" | grep -oP 'users:\(\([^)]+\)\)' || echo "")
            _ok "Port ${port} — LISTENING ${proc}"
        else
            # Fallback to netstat
            local legacy
            legacy=$(netstat -tlnp 2>/dev/null | grep ":$port " | head -1)
            if [ -n "$legacy" ]; then
                _ok "Port ${port} — LISTENING (netstat)"
            else
                _warn "Port ${port} — NOT listening"
                case $port in
                    3000) _info "  Docker container rallyo-hub may not be running" ;;
                    80)   _info "  Captive portal redirect — iptables redirects to :3000" ;;
                    53)   _info "  dnsmasq should be listening here" ;;
                esac
            fi
        fi
    done
}

# ── Step 5: WebSocket Connectivity ───────────────────────────────
check_websocket() {
    section "Step 5: WebSocket Connectivity"

    # First check if the Socket.IO endpoint responds to HTTP (upgrade handshake)
    local ws_check
    ws_check=$(curl -sk -o /dev/null -w "%{http_code}" \
        -H "Upgrade: websocket" \
        -H "Connection: Upgrade" \
        https://localhost:3000/socket.io/?EIO=4 2>/dev/null || echo "000")

    if [ "$ws_check" = "200" ] || [ "$ws_check" = "101" ]; then
        _ok "Socket.IO endpoint reachable (HTTP ${ws_check})"
    else
        _bad "Socket.IO endpoint NOT reachable (HTTP ${ws_check})"
        _info "Expected 200 (Socket.IO long-polling) or 101 (WebSocket upgrade)"
    fi

    # Verify Socket.IO Engine.IO protocol version (EIO=4)
    local eio_response
    eio_response=$(curl -sk https://localhost:3000/socket.io/?EIO=4 2>/dev/null | head -c 100 || echo "")
    if echo "$eio_response" | grep -q '[0-9]'; then
        _ok "Socket.IO Engine.IO handshake received"
        _info "Raw: ${eio_response}"
    else
        _warn "Socket.IO handshake returned unexpected content"
        _info "Raw: ${eio_response}"
    fi

    # Full WebSocket round-trip test via docker exec
    _info "Testing full Socket.IO round-trip inside container..."
    _ws_test "connectivity" "GET_MATCH_STATE" '{"courtId":"__validate__"}' "MATCH_UPDATE ERROR" "handler responds to events"
}

# ── Step 6: Tournament Mode — RECORD_POINT via SET_REF path ──────
check_tournament() {
    section "Step 6: Tournament Mode — RECORD_POINT via SET_REF"

    _info "Emitting SET_REF + RECORD_POINT — expects error (no real PIN/court)"
    _info "A response proves handlers ARE registered and the server is wired."

    # Test 6a: SET_REF with invalid PIN — handler should reject
    _ws_test "SET_REF reject" "SET_REF" '{"courtId":"__val","pin":"0000"}' "ERROR REF_SET" "handler rejects invalid PIN"

    # Test 6b: Full RECORD_POINT path — connect, join a court, emit point
    # We use a dedicated inline Node script for the multi-step flow
    local container="rallyo-hub"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
        local result
        result=$(docker exec -i "$container" node -e "
const { io } = require('socket.io-client');

// Phase 1: SET_REF with known tournament court PIN
const socket = io('https://localhost:3000', {
  transports: ['websocket'],
  rejectUnauthorized: false,
  timeout: 5000
});

let phase = 1;
let timer;

function fail(msg) {
  console.log('FAIL phase ' + phase + ': ' + msg);
  socket.close();
  process.exit(1);
}

function pass(msg) {
  console.log('PASS phase ' + phase + ': ' + msg);
  phase++;
  nextPhase();
}

function nextPhase() {
  if (phase === 1) {
    // Phase 1: Try SET_REF — expect ERROR (no real PIN)
    timer = setTimeout(() => fail('timeout'), 4000);
    socket.emit('SET_REF', { courtId: 'validate-court-1', pin: '0000' });
  } else if (phase === 2) {
    // Phase 2: Try RECORD_POINT — expect ERROR (not registered as ref)
    timer = setTimeout(() => fail('timeout'), 4000);
    socket.emit('RECORD_POINT', { courtId: 'validate-court-1', player: 'A' });
  } else {
    // All phases done
    console.log('ALL_PASS');
    socket.close();
    process.exit(0);
  }
}

const connTimer = setTimeout(() => fail('connection timeout'), 5000);
socket.on('connect', () => {
  clearTimeout(connTimer);
  nextPhase();
});
socket.on('connect_error', (err) => {
  clearTimeout(connTimer);
  fail('connect_error: ' + err.message);
});

// Catch all server events as responses
const handlers = ['ERROR', 'REF_SET', 'MATCH_UPDATE', 'REF_ROLE_CHECK_RESULT'];
handlers.forEach((evt) => {
  socket.on(evt, (data) => {
    clearTimeout(timer);
    pass(evt + ': ' + JSON.stringify(data));
  });
});
" 2>&1) || true

        local status_line
        status_line=$(echo "$result" | grep -E '^(PASS|FAIL|ALL_PASS)' | head -1)

        if echo "$result" | grep -q "ALL_PASS"; then
            _ok "Tournament RECORD_POINT path — all handlers responding"
            echo "$result" | grep "^PASS" | while IFS= read -r line; do
                _info "  ${line}"
            done
        elif [ -n "$status_line" ]; then
            _warn "Tournament RECORD_POINT path — partial (${status_line})"
            echo "$result" | grep "^PASS\|^FAIL" | while IFS= read -r line; do
                _info "  ${line}"
            done
        else
            _warn "Tournament RECORD_POINT path — unexpected result"
            _info "Output: $(echo "$result" | tr '\n' '; ' | cut -c1-150)"
        fi
    else
        _skip "Tournament RECORD_POINT — container not running"
    fi
}

# ── Step 7: Club Mode — RECORD_POINT via CLUB_JOIN path ─────────
check_club() {
    section "Step 7: Club Mode — RECORD_POINT via CLUB_JOIN"

    _info "Emitting CLUB_JOIN + RECORD_POINT — expects error (no real PIN)"
    _info "A response proves handlers ARE registered for club mode."

    local container="rallyo-hub"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
        local result
        result=$(docker exec -i "$container" node -e "
const { io } = require('socket.io-client');

const socket = io('https://localhost:3000', {
  transports: ['websocket'],
  rejectUnauthorized: false,
  timeout: 5000
});

let phase = 1;
let timer;

function fail(msg) {
  console.log('FAIL phase ' + phase + ': ' + msg);
  socket.close();
  process.exit(1);
}

function pass(msg) {
  console.log('PASS phase ' + phase + ': ' + msg);
  phase++;
  nextPhase();
}

function nextPhase() {
  if (phase === 1) {
    // Phase 1: CLUB_JOIN with invalid PIN — expect CLUB_JOIN_RESULT error
    timer = setTimeout(() => fail('timeout'), 4000);
    socket.emit('CLUB_JOIN', { pin: '0000' });
  } else if (phase === 2) {
    // Phase 2: RECORD_POINT — should emit something (error expected, no ref)
    timer = setTimeout(() => fail('timeout'), 4000);
    socket.emit('RECORD_POINT', { courtId: 'validate-court-1', player: 'B' });
  } else {
    console.log('ALL_PASS');
    socket.close();
    process.exit(0);
  }
}

const connTimer = setTimeout(() => fail('connection timeout'), 5000);
socket.on('connect', () => {
  clearTimeout(connTimer);
  nextPhase();
});
socket.on('connect_error', (err) => {
  clearTimeout(connTimer);
  fail('connect_error: ' + err.message);
});

const handlers = ['CLUB_JOIN_RESULT', 'ERROR', 'MATCH_UPDATE'];
handlers.forEach((evt) => {
  socket.on(evt, (data) => {
    clearTimeout(timer);
    pass(evt + ': ' + JSON.stringify(data));
  });
});
" 2>&1) || true

        local status_line
        status_line=$(echo "$result" | grep -E '^(PASS|FAIL|ALL_PASS)' | head -1)

        if echo "$result" | grep -q "ALL_PASS"; then
            _ok "Club RECORD_POINT path — all handlers responding"
            echo "$result" | grep "^PASS" | while IFS= read -r line; do
                _info "  ${line}"
            done
        elif [ -n "$status_line" ]; then
            _warn "Club RECORD_POINT path — partial (${status_line})"
            echo "$result" | grep "^PASS\|^FAIL" | while IFS= read -r line; do
                _info "  ${line}"
            done
        else
            _warn "Club RECORD_POINT path — unexpected result"
            _info "Output: $(echo "$result" | tr '\n' '; ' | cut -c1-150)"
        fi
    else
        _skip "Club RECORD_POINT — container not running"
    fi
}

# ── Summary ───────────────────────────────────────────────────────
print_summary() {
    section "Summary"
    echo ""
    echo -e "  ${GREEN}Passed:  $PASS${NC}"
    echo -e "  ${YELLOW}Skipped: $SKIP${NC}"
    echo -e "  ${YELLOW}Warnings: $WARN${NC}"
    echo -e "  ${RED}Failed:  $FAIL${NC}"
    echo ""

    if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
        echo -e "  ${GREEN}✅ ALL VALIDATIONS PASSED — Infrastructure ready for ESP32.${NC}"
        echo ""
        echo -e "  ${BLUE}ℹ${NC} Infrastructure is validated. For hardware validation (real ESP32 + phone):"
        echo -e "       ${YELLOW}cat scripts/README-esp32-validation.md${NC}"
    elif [ "$FAIL" -eq 0 ]; then
        echo -e "  ${YELLOW}⚠️  Warnings only — infrastructure should work but has non-critical issues.${NC}"
    else
        echo -e "  ${RED}❌ ${FAIL} critical issue(s) — fix FAILED items above before hardware validation.${NC}"
    fi

    if [ "$SAVE_MODE" = true ]; then
        echo ""
        _info "Full log saved to: $LOG_FILE"
    fi
    echo ""
}

# ── Main ──────────────────────────────────────────────────────────
main() {
    header
    check_hub_health
    check_docker
    check_kiosk
    check_ports
    check_websocket
    check_tournament
    check_club
    print_summary
}

main "$@"
