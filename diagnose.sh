#!/bin/bash

# RallyOS Hub - Diagnostics Script
# Helps troubleshoot and verify the setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         RallyOS Hub - Diagnostic Report                   ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "Generated: $(date)"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((CHECKS_WARNING++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# System Information
check_system() {
    print_section "System Information"
    
    echo "OS: $(uname -s)"
    echo "Kernel: $(uname -r)"
    echo "Architecture: $(uname -m)"
    
    if [ -f /proc/device-tree/model ]; then
        echo "Hardware: $(cat /proc/device-tree/model)"
        check_pass "Orange Pi detected"
    else
        check_warn "Could not detect Orange Pi model"
    fi
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "OS Release: $PRETTY_NAME"
    fi
}

# Environment Files
check_env_files() {
    print_section "Environment Files"
    
    if [ -f "docker-compose.yml" ]; then
        check_pass "docker-compose.yml found"
    else
        check_fail "docker-compose.yml not found"
    fi
    
    if [ -f "Dockerfile" ]; then
        check_pass "Dockerfile found"
    else
        check_fail "Dockerfile not found"
    fi
    
    if [ -f ".env" ]; then
        check_pass ".env file exists"
        echo "  REFEREE_PIN: $(grep REFEREE_PIN .env 2>/dev/null | cut -d= -f2 || echo 'not set')"
        echo "  PORT: $(grep '^PORT=' .env 2>/dev/null | cut -d= -f2 || echo '3000')"
    else
        check_warn ".env not found (using defaults)"
    fi
}

# Docker Check
check_docker() {
    print_section "Docker Installation"
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version 2>/dev/null)
        check_pass "Docker installed: $DOCKER_VERSION"
    else
        check_fail "Docker not found"
        return 1
    fi
    
    if docker info &> /dev/null; then
        check_pass "Docker daemon is running"
    else
        check_fail "Docker daemon is NOT running"
        return 1
    fi
    
    # Check for compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version 2>/dev/null)
        check_pass "Docker Compose: $COMPOSE_VERSION"
    elif docker compose version &> /dev/null; then
        check_pass "Docker Compose v2 via 'docker compose'"
    else
        check_fail "Docker Compose not found"
        return 1
    fi
}

# Disk Space
check_disk() {
    print_section "Storage"
    
    DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
    DISK_FREE=$(df -h / | tail -1 | awk '{print $4}')
    
    echo "Root partition: $DISK_FREE free ($DISK_USAGE used)"
    
    if [ "${DISK_USAGE%\%}" -gt 80 ]; then
        check_fail "Disk usage is critical (>80%)"
    elif [ "${DISK_USAGE%\%}" -gt 70 ]; then
        check_warn "Disk usage is high (>70%)"
    else
        check_pass "Disk usage is good (<70%)"
    fi
    
    # Docker system usage
    if command -v docker &> /dev/null; then
        DOCKER_SIZE=$(docker system df 2>/dev/null | tail -1 | awk '{print $2}' || echo "N/A")
        echo "Docker images: $DOCKER_SIZE"
    fi
}

# Memory
check_memory() {
    print_section "Memory"
    
    TOTAL_MEM=$(free -h | grep Mem | awk '{print $2}')
    USED_MEM=$(free -h | grep Mem | awk '{print $3}')
    AVAILABLE_MEM=$(free -h | grep Mem | awk '{print $7}')
    
    echo "Total: $TOTAL_MEM"
    echo "Used: $USED_MEM"
    echo "Available: $AVAILABLE_MEM"
    
    FREE_PCT=$(($(free | grep Mem | awk '{print $7}') * 100 / $(free | grep Mem | awk '{print $2}')))
    
    if [ "$FREE_PCT" -lt 20 ]; then
        check_fail "Low memory (< 20% free)"
    elif [ "$FREE_PCT" -lt 30 ]; then
        check_warn "Memory is getting tight (< 30% free)"
    else
        check_pass "Memory usage is good (> 30% free)"
    fi
}

# Network
check_network() {
    print_section "Network"
    
    # Check internet
    if ping -c 1 8.8.8.8 &> /dev/null; then
        check_pass "Internet connectivity OK"
    else
        check_warn "No internet connectivity (may be offline or firewalled)"
    fi
    
    # Local IP
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    if [ -n "$LOCAL_IP" ]; then
        check_pass "Local IP: $LOCAL_IP"
    else
        check_fail "Could not determine local IP"
    fi
    
    # Hostname
    HOSTNAME=$(hostname)
    check_pass "Hostname: $HOSTNAME"
    
    # Port availability
    if ! nc -z localhost 3000 2>/dev/null; then
        check_pass "Port 3000 is available"
    else
        check_warn "Port 3000 is already in use by another service"
    fi
}

# Container Status
check_container() {
    print_section "Container Status"
    
    if ! command -v docker &> /dev/null; then
        check_warn "Docker not available"
        return 1
    fi
    
    # Check if image exists
    if docker images | grep -q "rallyos-hub"; then
        check_pass "Docker image found (rallyos-hub)"
        IMAGE_ID=$(docker images | grep rallyos-hub | head -1 | awk '{print $3}')
        IMAGE_SIZE=$(docker images | grep rallyos-hub | head -1 | awk '{print $6}')
        echo "  ID: $IMAGE_ID"
        echo "  Size: $IMAGE_SIZE"
    else
        check_warn "Docker image not found (run './start-orange-pi.sh' to build)"
    fi
    
    # Check if container is running
    if docker ps | grep -q "rallyo-hub"; then
        check_pass "Container is RUNNING"
        CONTAINER_ID=$(docker ps | grep rallyo-hub | awk '{print $1}')
        UPTIME=$(docker ps | grep rallyo-hub | awk '{print $10" "$11" "$12}')
        echo "  ID: $CONTAINER_ID"
        echo "  Uptime: $UPTIME"
    elif docker ps -a | grep -q "rallyo-hub"; then
        check_warn "Container exists but is STOPPED"
        echo "  Run: docker-compose up -d"
    else
        check_warn "Container not found"
    fi
    
    # Check health
    if docker ps | grep -q "rallyo-hub"; then
        if curl -s -k -f https://localhost:3000/health &> /dev/null; then
            check_pass "Health check: OK"
        else
            check_fail "Health check: FAILED"
        fi
    fi
}

# Container Resources
check_container_resources() {
    print_section "Container Resources"
    
    if ! docker ps | grep -q "rallyo-hub"; then
        info "Container not running"
        return 0
    fi
    
    # Get container stats
    docker stats --no-stream rallyo-hub 2>/dev/null || {
        check_warn "Could not get container stats"
        return 1
    }
}

# Logs
check_logs() {
    print_section "Recent Container Logs"
    
    if ! command -v docker &> /dev/null; then
        return 1
    fi
    
    echo "Last 20 log lines:"
    echo "────────────────────────────────────────"
    docker-compose logs --tail=20 hub 2>/dev/null || {
        check_warn "Could not retrieve logs"
        return 1
    }
    echo "────────────────────────────────────────"
}

# Summary
print_summary() {
    print_section "Summary"
    
    echo ""
    echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
    echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
    echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
    echo ""
    
    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "${GREEN}No critical issues found!${NC}"
    else
        echo -e "${RED}There are critical issues that need attention.${NC}"
    fi
    
    echo ""
    echo -e "For more help, visit:"
    echo -e "  ${BLUE}DEPLOYMENT.md${NC} - Full deployment guide"
    echo -e "  ${BLUE}README.md${NC} - Project documentation"
    echo ""
}

# Main execution
main() {
    print_header
    
    check_system
    check_env_files
    check_docker || {
        check_fail "Docker is required but not properly installed"
        echo ""
        echo "To install Docker:"
        echo "  1. Run the setup script: ./setup-orange-pi.sh"
        echo "  2. Or follow: https://docs.docker.com/install/"
        exit 1
    }
    
    check_disk
    check_memory
    check_network
    check_container
    check_container_resources
    check_logs
    print_summary
}

# Run main
main "$@"
