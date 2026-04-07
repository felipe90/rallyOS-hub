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

# Copy client dist to server public
WORKDIR /app
RUN rm -rf server/public && mkdir server/public
RUN cp -r client/dist/* server/public/

# Compile server TypeScript
WORKDIR /app/server
RUN npx tsc

# Create start script
WORKDIR /app
RUN openssl req -x509 -newkey rsa:4096 -keyout server/key.pem -out server/cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Dev/CN=localhost" 2>/dev/null || true

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run
CMD ["node", "server/src/index.js"]