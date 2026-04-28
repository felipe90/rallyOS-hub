FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files from server folder
COPY server/package*.json ./

# Install dependencies
RUN npm ci

# Copy shared folder to /shared (Required by ../../../shared imports)
COPY shared/ /shared/

# Copy server source code
COPY server/ .

# Compile TypeScript
RUN npx tsc

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files for production deps
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Generate SSL certs
RUN apk add --no-cache openssl && \
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost"

# Expose HTTPS port
EXPOSE 3000

# Run compiled code
CMD ["node", "dist/server/src/index.js"]
