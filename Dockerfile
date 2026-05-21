# rallyOS-hub Dockerfile - Optimized for Orange Pi and ARM devices
# Complete standalone build: no external dependencies needed

ARG NODE_VERSION=22-alpine

# Stage 1: Build client
FROM node:${NODE_VERSION} AS client-builder
LABEL stage=client-builder

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/ ./shared/
COPY client/ ./client/

RUN pnpm install --frozen-lockfile --filter client...

RUN pnpm --filter client run build

# Verify build output exists
RUN test -d client/dist && echo "✓ Client build successful" || (echo "✗ Client build failed" && exit 1)

# Stage 2: Build and compile server TypeScript
FROM node:${NODE_VERSION} AS server-builder
LABEL stage=server-builder

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/ ./shared/
COPY server/ ./server/

# --ignore-scripts: skip postinstall (esbuild binary, Playwright browsers, etc.)
RUN pnpm install --frozen-lockfile --filter server... --ignore-scripts

RUN pnpm --filter server run build

# Verify build output exists
RUN test -d server/dist && echo "✓ Server build successful" || (echo "✗ Server build failed" && exit 1)

# pnpm deploy: creates standalone production deployment with real packages (no symlinks)
# --prod excludes devDependencies (jest, playwright, tsx, etc.) from the output
RUN pnpm --filter server deploy /prod --prod

# Stage 3: Production runtime - lightweight final image
FROM node:${NODE_VERSION}
LABEL maintainer="RallyOS"
LABEL description="RallyOS Hub - Complete application with client and server"

WORKDIR /app

# Install minimal runtime dependencies
RUN apk add --no-cache openssl wget curl bash ca-certificates

# Copy deploy output: package.json, node_modules (real files, no symlinks), dist/, shared/
COPY --from=server-builder --chown=node:node /prod ./

# Copy production client (static files)
COPY --from=client-builder --chown=node:node /build/client/dist ./public/dist

# Generate self-signed SSL certificates
RUN openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 \
    -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Prod/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,DNS:${HUB_DOMAIN:-rallyos-hub.local}" 2>/dev/null || true && \
    chmod 644 key.pem cert.pem

# Create logs directory and set ownership for node user
RUN mkdir -p /app/logs && chown node:node /app/logs

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=256"

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check - Using curl with -k to ignore self-signed cert warning
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -k -f https://localhost:3000/health || exit 1

# Run application
CMD ["node", "dist/server/src/index.js"]
