# rallyOS-hub Dockerfile - Optimized for Orange Pi and ARM devices
# Complete standalone build: no external dependencies needed

ARG NODE_VERSION=22-alpine

# Stage 1: Build client
FROM node:${NODE_VERSION} AS client-builder
LABEL stage=client-builder

WORKDIR /build

# Copy shared modules (client may depend on it for types)
COPY shared/ ./shared/

# Copy client directory
COPY client/ ./client/

WORKDIR /build/client

# Clear npm cache to ensure fresh dependencies
RUN npm cache clean --force

# Install dependencies (including dev deps needed for build)
RUN npm ci --force

# Build for production (fresh build, no cache)
RUN npm run build

# Verify build output exists
RUN test -d dist && echo "✓ Client build successful" || (echo "✗ Client build failed" && exit 1)

# Stage 2: Build and compile server TypeScript
FROM node:${NODE_VERSION} AS server-builder
LABEL stage=server-builder

WORKDIR /build

# Copy shared modules FIRST (as server might depend on it)
COPY shared/ ./shared/

# Copy server files
COPY server/ ./server/

WORKDIR /build/server

# Copy and install dependencies (including dev for TypeScript compilation)
COPY server/package*.json ./

# Clear npm cache to ensure fresh dependencies
RUN npm cache clean --force

# Install dependencies (including dev for TypeScript compilation)
RUN npm ci --force

# Compile TypeScript to JavaScript (fresh compilation)
RUN npm run build

# Verify build output exists
RUN test -d dist && echo "✓ Server build successful" || (echo "✗ Server build failed" && exit 1)

# Stage 3: Production runtime - lightweight final image
FROM node:${NODE_VERSION}
LABEL maintainer="RallyOS"
LABEL description="RallyOS Hub - Complete application with client and server"

WORKDIR /app

# Install minimal runtime dependencies
RUN apk add --no-cache openssl wget curl bash ca-certificates

# Create application structure
RUN mkdir -p public dist shared ssl

# Copy compiled server
COPY --from=server-builder /build/server/dist ./dist
COPY --from=server-builder /build/server/package*.json ./
COPY --from=server-builder /build/server/node_modules ./node_modules

# Copy production client (static files) - Check if dist/index.html exists
COPY --from=client-builder /build/client/dist ./public/dist

# Note: shared/ will be copied from build context (copied in Stage 3 from host)

# Generate self-signed SSL certificates
RUN openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 \
    -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Prod/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null || true && \
    chmod 600 key.pem cert.pem

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=256"

# Expose port
EXPOSE 3000

# Health check - Using curl with -k to ignore self-signed cert warning
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -k -f https://localhost:3000/health || exit 1

# Run application
CMD ["node", "dist/index.js"]