#!/bin/bash

# RallyOS Hub - Orange Pi One-Command Startup
# Este script construye y ejecuta toda la aplicación en un contenedor

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
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

# Check dependencies
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please install Docker first."
        exit 1
    fi
    print_success "Docker found: $(docker --version)"
}

check_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose not found. Please install it first."
        exit 1
    fi
    print_success "docker-compose found: $(docker-compose --version)"
}

check_docker_daemon() {
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running."
        print_step "Starting Docker daemon..."
        # Try to start it
        dockerd &
        sleep 5
        if ! docker info &> /dev/null; then
            print_error "Failed to start Docker daemon"
            exit 1
        fi
    fi
    print_success "Docker daemon is running"
}

# Main execution
main() {
    print_header
    
    print_step "Checking dependencies..."
    check_docker
    check_compose
    check_docker_daemon
    
    print_step "Pre-building client locally..."
    if [ -f "client/package.json" ]; then
        cd "$SCRIPT_DIR/client"
        if ! npm ci --force 2>&1 | tail -2; then
            print_error "npm ci failed for client!"
            exit 1
        fi
        if ! npm run build 2>&1 | tee /tmp/client-build.log | grep -E "built|error" | tail -3; then
            print_error "Client build failed!"
            echo -e "${YELLOW}📋 Error log:${NC}"
            cat /tmp/client-build.log | grep -E "error|Error|ERROR" | head -20
            exit 1
        fi
        cd "$SCRIPT_DIR"
        print_success "Client pre-build complete"
    else
        print_error "client/package.json not found"
        exit 1
    fi
    
    print_step "Pre-building server locally..."
    if [ -f "server/package.json" ]; then
        cd "$SCRIPT_DIR/server"
        if ! npm ci --force 2>&1 | tail -2; then
            print_error "npm ci failed for server!"
            exit 1
        fi
        if ! npm run build 2>&1 | tee /tmp/server-build.log | grep -E "tsc|error" | tail -3; then
            print_error "Server build failed!"
            echo -e "${YELLOW}📋 Error log:${NC}"
            cat /tmp/server-build.log | grep -E "error|Error|ERROR" | head -20
            exit 1
        fi
        cd "$SCRIPT_DIR"
        print_success "Server pre-build complete"
    else
        print_error "server/package.json not found"
        exit 1
    fi
    
    print_step "Building Docker image..."
    print_step "This may take 2-5 minutes on Orange Pi Zero..."
    if ! docker-compose build --no-cache 2>&1; then
        print_error "Docker build failed!"
        echo -e "${YELLOW}📋 Build logs:${NC}"
        docker-compose build --no-cache 2>&1 | tail -50 || true
        exit 1
    fi
    
    print_step "Stopping any existing containers..."
    docker-compose down 2>/dev/null || true
    
    print_step "Starting application..."
    if ! docker-compose up -d 2>&1; then
        print_error "Failed to start containers!"
        echo -e "${YELLOW}📋 Container logs:${NC}"
        docker-compose logs --tail=30 hub 2>&1 || true
        exit 1
    fi
    
    # Wait for service to be ready
    print_step "Waiting for service to start (up to 30 seconds)..."
    READY=0
    for i in {1..30}; do
        if curl -s -k -f https://localhost:3000/health &> /dev/null; then
            READY=1
            break
        fi
        sleep 1
        echo -n "."
    done
    
    echo ""
    
    if [ $READY -eq 1 ]; then
        # Get Orange Pi IP
        PI_IP=$(hostname -I | awk '{print $1}')
        
        print_success "Service is running!"
        echo ""
        echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}✓ RallyOS Hub is ready!${NC}"
        echo ""
        echo -e "Access from:"
        echo -e "  Local:   ${BLUE}https://localhost:3000${NC}"
        echo -e "  Network: ${BLUE}https://${PI_IP}:3000${NC}"
        echo -e "  DNS:     ${BLUE}https://$(hostname).local:3000${NC}"
        echo ""
        echo -e "Useful commands:"
        echo -e "  View logs:           ${YELLOW}docker-compose logs -f hub${NC}"
        echo -e "  Stop:                ${YELLOW}docker-compose down${NC}"
        echo -e "  Check status:        ${YELLOW}docker ps${NC}"
        echo -e "  Monitor resources:   ${YELLOW}docker stats${NC}"
        echo -e "  SSH to hub:          ${YELLOW}docker exec -it rallyo-hub bash${NC}"
        echo ""
        echo -e "⚠️  Note: Accept the SSL certificate warning in your browser."
        echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    else
        print_error "Service failed to start"
        print_step "Container logs:"
        docker-compose logs --tail=50 2>&1 || true
        print_step "Container status:"
        docker ps -a --filter "name=rally" 2>&1 || true
        print_error "Try running: docker-compose logs -f hub"
        exit 1
    fi
}

# Run main
main "$@"
