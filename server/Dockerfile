FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Compile TypeScript
RUN npx tsc

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Generate SSL certs
RUN apk add --no-cache openssl && \
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost"

# Expose HTTPS port
EXPOSE 3000

# Run compiled code
CMD ["node", "dist/server/src/index.js"]
