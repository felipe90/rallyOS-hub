#!/bin/bash

# RallyOS Hub - Local Development Mode (No Docker)
# Runs client and server locally with live reload and WebSocket communication

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"
SERVER_PORT="${SERVER_PORT:-3000}"
CLIENT_PORT="${CLIENT_PORT:-5173}"
SERVER_URL="https://localhost:$SERVER_PORT"

# Track process IDs for cleanup
SERVER_PID=""
CLIENT_PID=""
SERVER_LOG_PID=""
CLIENT_LOG_PID=""
SERVER_LOG=""
CLIENT_LOG=""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down...${NC}"
    
    # Kill log streaming processes
    [ -n "$SERVER_LOG_PID" ] && kill "$SERVER_LOG_PID" 2>/dev/null || true
    [ -n "$CLIENT_LOG_PID" ] && kill "$CLIENT_LOG_PID" 2>/dev/null || true
    
    # Kill server and client
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo -e "${YELLOW}  Stopping server (PID: $SERVER_PID)...${NC}"
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    
    if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" 2>/dev/null; then
        echo -e "${YELLOW}  Stopping client (PID: $CLIENT_PID)...${NC}"
        kill "$CLIENT_PID" 2>/dev/null || true
        wait "$CLIENT_PID" 2>/dev/null || true
    fi
    
    # Clean up named pipes
    rm -f "$SERVER_LOG" "$CLIENT_LOG"
    
    echo -e "${GREEN}✓ Shutdown complete${NC}"
    exit 0
}

# Set up trap for CTRL+C and EXIT
trap cleanup SIGINT SIGTERM EXIT

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   RallyOS Hub - Local Development Mode         ║${NC}"
    echo -e "${BLUE}║   (Client + Server, No Docker)                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""
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

# Main execution
main() {
    print_header
    
    # Check if directories exist
    print_step "Checking project structure..."
    if [ ! -d "$SERVER_DIR" ] || [ ! -d "$CLIENT_DIR" ]; then
        print_error "Server or client directory not found"
        exit 1
    fi
    print_success "Project structure OK"
    
    # Check for SSL certificates
    print_step "Checking SSL certificates..."
    KEY_FILE="$SERVER_DIR/key.pem"
    CERT_FILE="$SERVER_DIR/cert.pem"
    
    if [ ! -f "$KEY_FILE" ] || [ ! -f "$CERT_FILE" ]; then
        echo -e "${YELLOW}  Generating self-signed SSL certificates...${NC}"
        openssl req -x509 -newkey rsa:2048 -keyout "$KEY_FILE" -out "$CERT_FILE" -days 365 \
            -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Dev/CN=localhost" \
            -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null || true
        chmod 600 "$KEY_FILE" "$CERT_FILE"
        print_success "SSL certificates generated"
    else
        print_success "SSL certificates found"
    fi
    
    # Kill any existing process on the ports
    print_step "Freeing ports..."
    if lsof -i ":$SERVER_PORT" &>/dev/null; then
        echo -e "${YELLOW}  Port $SERVER_PORT is in use, killing process...${NC}"
        lsof -ti ":$SERVER_PORT" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # Install dependencies if needed
    print_step "Checking dependencies..."
    
    if [ ! -d "$SERVER_DIR/node_modules" ]; then
        echo -e "${YELLOW}  Installing server dependencies...${NC}"
        cd "$SERVER_DIR"
        npm ci 2>&1 | tail -3
        cd "$SCRIPT_DIR"
        print_success "Server dependencies installed"
    else
        print_success "Server dependencies OK"
    fi
    
    if [ ! -d "$CLIENT_DIR/node_modules" ]; then
        echo -e "${YELLOW}  Installing client dependencies...${NC}"
        cd "$CLIENT_DIR"
        npm ci 2>&1 | tail -3
        cd "$SCRIPT_DIR"
        print_success "Client dependencies installed"
    else
        print_success "Client dependencies OK"
    fi
    
    # Compile server
    print_step "Compiling server..."
    cd "$SERVER_DIR"
    npm run build > /dev/null 2>&1
    print_success "Server compilation complete"
    cd "$SCRIPT_DIR"
    
    # Build client for development (served by server on port 3000)
    print_step "Building client..."
    cd "$CLIENT_DIR"
    npm run build > /dev/null 2>&1
    print_success "Client build complete"
    cd "$SCRIPT_DIR"
    
    # Create pipes for real-time log streaming
    SERVER_LOG=$(mktemp -u)
    CLIENT_LOG=$(mktemp -u)
    mkfifo "$SERVER_LOG" "$CLIENT_LOG"
    
    # Colors for log output
    SERVER_COLOR='\033[0;34m'  # Blue
    CLIENT_COLOR='\033[0;32m'  # Green
    ERROR_COLOR='\033[0;31m'   # Red
    NC='\033[0m'
    
    # Function to log output with prefix
    log_with_prefix() {
        local prefix="$1"
        local color="$2"
        while IFS= read -r line; do
            echo -e "${color}${prefix}${NC} $line"
        done
    }
    
    # Start server
    print_step "Starting server on port $SERVER_PORT..."
    cd "$SERVER_DIR"
    NODE_ENV=development node --enable-source-maps dist/server/src/index.js > "$SERVER_LOG" 2>&1 &
    SERVER_PID=$!
    print_success "Server started (PID: $SERVER_PID)"
    
    # Start log streaming for server
    log_with_prefix "🔌 SERVER" "$SERVER_COLOR" < "$SERVER_LOG" &
    SERVER_LOG_PID=$!
    
    # Wait for server to start
    echo -e "${YELLOW}  Waiting for server to be ready...${NC}"
    for i in {1..30}; do
        if lsof -i ":$SERVER_PORT" &>/dev/null; then
            print_success "Server is ready (listening on port $SERVER_PORT)"
            break
        fi
        sleep 0.5
        if [ $i -eq 30 ]; then
            print_error "Server failed to start"
            kill $SERVER_PID 2>/dev/null || true
            rm -f "$SERVER_LOG" "$CLIENT_LOG"
            exit 1
        fi
    done
    
    # Give server a moment to initialize
    sleep 1
    
    # Start client
    print_step "Starting client development server on port $CLIENT_PORT..."
    cd "$CLIENT_DIR"
    VITE_SERVER_URL="$SERVER_URL" npm run dev > "$CLIENT_LOG" 2>&1 &
    CLIENT_PID=$!
    print_success "Client started (PID: $CLIENT_PID)"
    
    # Start log streaming for client
    log_with_prefix "🌐 CLIENT" "$CLIENT_COLOR" < "$CLIENT_LOG" &
    CLIENT_LOG_PID=$!
    
    # Display connection info
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Development Environment Ready!             ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "🔑 ${YELLOW}Owner PIN: Check server console output${NC}"
    echo -e "   (or set TOURNAMENT_OWNER_PIN env var for fixed PIN)"
    echo ""
    echo -e "🌐 ${YELLOW}Frontend (Vite)${NC}"
    echo -e "   Local:   http://localhost:$CLIENT_PORT"
    echo -e "   HMR:     WebSocket to Vite dev server"
    echo ""
    echo -e "🔌 ${YELLOW}Backend (Express + Socket.io)${NC}"
    echo -e "   URL:     $SERVER_URL"
    echo -e "   WebSocket: $SERVER_URL"
    echo ""
    echo -e "📝 ${YELLOW}Configuration${NC}"
    echo -e "   Server Port:    $SERVER_PORT"
    echo -e "   Client Port:    $CLIENT_PORT"
    echo -e "   Server URL:     $SERVER_URL"
    echo ""
    echo -e "📋 ${YELLOW}Useful Tips${NC}"
    echo -e "   • Client auto-reloads on code changes (HMR)"
    echo -e "   • Server requires manual restart after code changes"
    echo -e "   • Press CTRL+C to stop both server and client"
    echo -e "   • Watch logs above for any errors!"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW} Monitoring logs... (Ctrl+C to stop)${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Monitor processes - exit if either dies
    while true; do
        # Check if server is still running
        if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
            echo ""
            echo -e "${ERROR_COLOR}╔════════════════════════════════════════════════╗${NC}"
            echo -e "${ERROR_COLOR}║  🔌 SERVER DIED! Check logs above for error   ║${NC}"
            echo -e "${ERROR_COLOR}╚════════════════════════════════════════════════╝${NC}"
            wait "$CLIENT_PID" 2>/dev/null || true
            exit 1
        fi
        
        # Check if client is still running
        if [ -n "$CLIENT_PID" ] && ! kill -0 "$CLIENT_PID" 2>/dev/null; then
            echo ""
            echo -e "${ERROR_COLOR}╔════════════════════════════════════════════════╗${NC}"
            echo -e "${ERROR_COLOR}║  🌐 CLIENT DIED! Check logs above for error  ║${NC}"
            echo -e "${ERROR_COLOR}╚════════════════════════════════════════════════╝${NC}"
            kill "$SERVER_PID" 2>/dev/null || true
            exit 1
        fi
        
        sleep 1
    done
}

# Run main
main "$@"
