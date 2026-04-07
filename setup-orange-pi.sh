#!/bin/bash

# RallyOS Hub - Orange Pi One-Time Setup
# Prepara completamente una Orange Pi para ejecutar rallyOS-hub
# Ejecutar SOLO la primera vez

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

# Helper functions
print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   RallyOS Hub - Orange Pi Initial Setup Wizard             ║"
    echo "║   This script will install and configure everything        ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

ask_yes_no() {
    local prompt="$1"
    local response
    read -p "$(echo -e ${YELLOW}?${NC} $prompt) (y/n): " response
    [[ "$response" =~ ^[Yy]$ ]]
}

# Check if running on Orange Pi
check_orange_pi() {
    print_section "Detecting Orange Pi Model"
    
    if [ -f /proc/device-tree/model ]; then
        MODEL=$(cat /proc/device-tree/model)
        print_success "Detected: $MODEL"
    else
        print_info "Could not detect model (might not be Orange Pi)"
        print_info "Continuing anyway..."
        MODEL="Unknown ARM Device"
    fi
}

# Update system
update_system() {
    print_section "Updating System"
    
    print_info "Running: sudo apt-get update && upgrade..."
    if sudo apt-get update -qq && sudo apt-get upgrade -qq -y; then
        print_success "System updated"
    else
        print_error "Failed to update system"
        print_info "Continuing anyway..."
    fi
}

# Install Docker
install_docker() {
    print_section "Setting up Docker"
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker already installed: $DOCKER_VERSION"
        return 0
    fi
    
    print_info "Docker not found. Installing..."
    
    if ask_yes_no "Install Docker from get.docker.com?"; then
        print_info "Downloading Docker installation script..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        
        print_info "Running installer..."
        sudo sh get-docker.sh || {
            print_error "Docker installation failed"
            print_info "Please install manually: https://docs.docker.com/install/"
            exit 1
        }
        
        print_success "Docker installed: $(docker --version)"
        
        # Add user to docker group
        if ask_yes_no "Add current user to docker group (avoids sudo)?"; then
            sudo usermod -aG docker $USER
            print_success "User added to docker group"
            print_info "You may need to logout and login again for changes to take effect"
        fi
    else
        print_error "Docker is required. Aborting."
        exit 1
    fi
}

# Install Docker Compose
install_docker_compose() {
    print_section "Setting up Docker Compose"
    
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_success "Docker Compose already installed: $COMPOSE_VERSION"
        return 0
    fi
    
    # Try 'docker compose' (v2, built-in)
    if docker compose version &> /dev/null; then
        print_success "Docker Compose v2 available (docker compose)"
        return 0
    fi
    
    print_info "Docker Compose not found. Installing..."
    
    if ask_yes_no "Install Docker Compose?"; then
        # Get latest version
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
        
        print_info "Installing Docker Compose $COMPOSE_VERSION for ARM..."
        
        # Determine architecture
        ARCH=$(uname -m)
        case "$ARCH" in
            aarch64) COMPOSE_ARCH="aarch64" ;;
            armv7l)  COMPOSE_ARCH="armv7" ;;
            *)       print_error "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        
        COMPOSE_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}"
        
        sudo curl -L "$COMPOSE_URL" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        
        if docker-compose --version &> /dev/null; then
            print_success "Docker Compose installed: $(docker-compose --version)"
        else
            print_error "Failed to install Docker Compose"
            exit 1
        fi
    else
        print_error "Docker Compose is required. Aborting."
        exit 1
    fi
}

# Enable Docker daemon
enable_docker() {
    print_section "Configuring Docker Service"
    
    print_info "Enabling Docker to start on boot..."
    sudo systemctl enable docker
    
    if sudo systemctl is-active --quiet docker; then
        print_success "Docker is running"
    else
        print_info "Starting Docker daemon..."
        sudo systemctl start docker
        sleep 2
        
        if sudo systemctl is-active --quiet docker; then
            print_success "Docker started successfully"
        else
            print_error "Failed to start Docker"
            exit 1
        fi
    fi
}

# Configure environment file
setup_env_file() {
    print_section "Configuration"
    
    if [ -f .env ]; then
        print_info ".env already exists"
        if ask_yes_no "Overwrite .env with defaults?"; then
            cp .env.example .env
            print_success "Created .env from defaults"
        fi
    else
        print_info "Creating .env file..."
        cp .env.example .env
        print_success "Created .env"
    fi
    
    print_info ""
    print_info "Edit your configuration (optional):"
    print_info "  nano .env"
    print_info ""
    
    if ask_yes_no "Edit .env now?"; then
        nano .env || print_info "Edit skipped"
    fi
}

# Pre-pull base images (saves build time)
preload_images() {
    print_section "Preloading Docker Images"
    
    print_info "This will download base images (might take a few minutes)..."
    print_info "You can skip this, but first build will be slower"
    
    if ask_yes_no "Preload images now?"; then
        print_info "Pulling node:22-alpine image..."
        docker pull node:22-alpine
        print_success "Images preloaded"
    else
        print_info "Skipped. First build will download images automatically."
    fi
}

# Show next steps
show_next_steps() {
    print_section "Setup Complete! ✓"
    
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Your Orange Pi ($MODEL) is now ready!"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo ""
    echo -e "  1. Start RallyOS Hub:"
    echo -e "     ${CYAN}./start-orange-pi.sh${NC}"
    echo ""
    echo -e "  2. Access from browser:"
    echo -e "     ${CYAN}https://localhost:3000${NC} (on Orange Pi)"
    echo -e "     ${CYAN}https://orangepi.local:3000${NC} (from other machine)"
    echo ""
    echo -e "  3. Monitor:"
    echo -e "     ${CYAN}docker-compose logs -f hub${NC}"
    echo ""
    echo -e "  4. Run diagnostics anytime:"
    echo -e "     ${CYAN}./diagnose.sh${NC}"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    
    if ask_yes_no "Start RallyOS Hub now?"; then
        echo ""
        ./start-orange-pi.sh
    fi
}

# Main execution
main() {
    print_header
    
    check_orange_pi
    
    if ask_yes_no "Continue with setup?"; then
        update_system
        install_docker
        install_docker_compose
        enable_docker
        setup_env_file
        preload_images
        show_next_steps
    else
        print_info "Setup cancelled."
        exit 0
    fi
}

# Run main
main "$@"
