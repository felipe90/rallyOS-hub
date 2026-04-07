#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         RallyOS Hub - Docker Setup         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"

# Check if .env exists, if not copy from .env.example
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}ℹ️  Creating .env file from .env.example${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} .env created. You can edit it to customize settings."
    else
        echo -e "${YELLOW}⚠️  .env.example not found. Using defaults.${NC}"
    fi
fi

# Kill any process listening on port 3000
echo -e "${YELLOW}🔍 Checking port 3000...${NC}"
if lsof -i :3000 &>/dev/null; then
    echo -e "${YELLOW}⚠️  Port 3000 is in use. Cleaning up...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Check if Docker is running
if ! docker info &>/dev/null; then
    echo -e "${YELLOW}🐳 Starting Docker daemon...${NC}"
    open -a Docker 2>/dev/null || true
    sleep 5
fi

# Pre-build: Ensure client and server are built locally first
echo -e "${YELLOW}📦 Pre-building client...${NC}"
if [ -f "client/package.json" ]; then
    cd "$PROJECT_DIR/client"
    npm ci --force 2>&1 | tail -3
    npm run build 2>&1 | grep -E "built|errors|✓|✗" | tail -5
    cd "$PROJECT_DIR"
    echo -e "${GREEN}✓${NC} Client pre-build complete"
else
    echo -e "${RED}✗ Client directory not found${NC}"
    exit 1
fi

# Pre-build: Ensure server is built locally first
echo -e "${YELLOW}📦 Pre-building server...${NC}"
if [ -f "server/package.json" ]; then
    cd "$PROJECT_DIR/server"
    npm ci --force 2>&1 | tail -3
    npm run build 2>&1 | grep -E "tsc|errors|✓|✗" | tail -5
    cd "$PROJECT_DIR"
    echo -e "${GREEN}✓${NC} Server pre-build complete"
else
    echo -e "${RED}✗ Server directory not found${NC}"
    exit 1
fi

# Build and start containers
echo -e "${YELLOW}🔨 Building Docker image (this may take a few minutes)...${NC}"
if ! docker-compose build --no-cache; then
    echo -e "${RED}✗ Docker build failed!${NC}"
    exit 1
fi

echo -e "${YELLOW}🚀 Starting containers...${NC}"
if ! docker-compose up -d; then
    echo -e "${RED}✗ Failed to start containers!${NC}"
    docker-compose logs
    exit 1
fi

# Wait for service to be ready
echo -e "${YELLOW}⏳ Waiting for service to be ready (up to 30 seconds)...${NC}"
for i in {1..30}; do
    if curl -s -k -f https://localhost:3000/health &>/dev/null; then
        echo -e "${GREEN}✅ Service is healthy!${NC}"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "\n${RED}⚠️  Service did not become healthy in time. Check logs:${NC}"
        docker-compose logs --tail=50 hub
        exit 1
    fi
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✅ RallyOS Hub is Running!          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "🌐 Access the Hub:"
echo -e "   Local:   ${BLUE}https://localhost:3000${NC}"
echo -e "   Network: ${BLUE}https://\$(hostname -I | awk '{print \$1}'):3000${NC}"
echo ""
echo -e "📋 Useful commands:"
echo -e "   View logs:     ${YELLOW}docker-compose logs -f hub${NC}"
echo -e "   Stop:          ${YELLOW}docker-compose down${NC}"
echo -e "   Restart:       ${YELLOW}docker-compose restart hub${NC}"
echo ""
echo -e "${GREEN}   Local: https://localhost:3000/${NC}"
echo ""
echo "Run 'docker-compose logs -f' to see container logs"
echo "Run 'docker-compose down' to stop containers"