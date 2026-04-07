# rallyOS-hub Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache openssl bash

# Copy all package files first
COPY client/package*.json ./client/
COPY server/package*.json ./
COPY shared/ ./shared/

# Install client deps
WORKDIR /app/client
RUN npm ci

# Install server deps
WORKDIR /app/server
RUN npm ci && npm install -D typescript

# Copy all source code
WORKDIR /app
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/

# Build client
WORKDIR /app/client
RUN npm run build

# Ensure server/src exists
WORKDIR /app/server
RUN ls -la src/

# Compile server TypeScript 
RUN pwd && ls src/ && npx tsc --version && npx tsc

# Verify compiled output
RUN ls -la dist/

# Copy client dist to server public
WORKDIR /app/server
RUN rm -rf public && mkdir public
RUN cp -r ../client/dist/* public/

# Generate SSL
RUN openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Dev/CN=localhost" 2>/dev/null || true

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run from server/dist
CMD ["node", "dist/index.js"]