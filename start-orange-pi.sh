#!/bin/bash

# RallyOS Hub - Orange Pi One-Command Startup (Optimized)
# Builds the server image using the server/Dockerfile and runs it.
# Assumes: Docker and Docker Compose v2 are installed.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           RallyOS Hub - Orange Pi Deployment               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
}

print_step() {
    echo -e "\n${YELLOW}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# --- CHECKS ---
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please run setup-orange-pi.sh first."
        exit 1
    fi
    print_success "Docker found: $(docker --version)"
}

check_compose() {
    # Prefer v2 (docker compose) over v1 (docker-compose)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        print_success "Docker Compose v2 found"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        print_success "Docker Compose v1 found"
    else
        print_error "Docker Compose not found."
        exit 1
    fi
}

check_docker_daemon() {
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running."
        exit 1
    fi
    print_success "Docker daemon is running"
}

# --- MAIN EXECUTION ---
main() {
    print_header

    print_step "Checking dependencies..."
    check_docker
    check_compose
    check_docker_daemon

    # Move to server directory where the Dockerfile is
    cd "$SCRIPT_DIR/server"

    # Check for .env file
    if [ ! -f ".env" ]; then
        print_error ".env file not found in server/ directory."
        print_step "Creating .env from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success ".env created. EDIT IT NOW with: nano .env"
            exit 1
        else
            print_error ".env.example not found either. Cannot proceed."
            exit 1
        fi
    fi

    print_step "Building Docker image (Node 22 Alpine)..."
    print_step "This may take a few minutes on Orange Pi Zero 3..."
    
    # Use the server/docker-compose.yml or build directly
    # We use 'docker compose' pointing to the server context
    $COMPOSE_CMD -f docker-compose.yml up -d --build

    # Wait for service to be ready
    print_step "Waiting for RallyOS Hub to start (up to 60 seconds)..."
    READY=0
    for i in {1..60}; do
        # Check if container is running first
        if docker ps --filter "name=rallyos-hub" --filter "status=running" | grep -q rallyos-hub; then
            # Then check health endpoint
            if docker exec rallyos-hub wget -q --no-check-certificate --spider https://localhost:3000/health 2>/dev/null; then
                READY=1
                break
            fi
        fi
        sleep 1
        echo -n "."
    done

    echo ""

    if [ $READY -eq 1 ]; then
        PI_IP=$(hostname -I | awk '{print $1}')
        
        print_success "Service is running!"
        echo ""
        echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}✓ RallyOS Hub is ready!${NC}"
        echo ""
        echo -e "Access from:"
        echo -e "  Local:   ${BLUE}https://localhost:3000${NC}"
        echo -e "  Network: ${BLUE}https://${PI_IP}:3000${NC}"
        echo -e "  AP Net:  ${BLUE}https://192.168.4.1:3000${NC}"
        echo ""
        echo -e "Useful commands:"
        echo -e "  View logs:           ${YELLOW}docker compose -f server/docker-compose.yml logs -f${NC}"
        echo -e "  Stop:                ${YELLOW}docker compose -f server/docker-compose.yml down${NC}"
        echo -e "  Restart:             ${YELLOW}docker compose -f server/docker-compose.yml restart${NC}"
        echo ""
        echo -e "⚠️  Note: Accept the SSL certificate warning in your browser."
        echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    else
        print_error "Service failed to start or health check timed out."
        print_step "Container logs (last 50 lines):"
        $COMPOSE_CMD -f docker-compose.yml logs --tail=50 hub 2>&1 || true
        print_error "Try checking logs with: docker compose -f server/docker-compose.yml logs -f"
        exit 1
    fi
}

main "$@"
