FROM node:22-alpine AS builder

# The build context is the project root (.. from server/)
# So we copy everything into /app
WORKDIR /app
COPY . .

# Now move to the server directory where tsconfig.json lives
WORKDIR /app/server

# Install dependencies
COPY package*.json ./
RUN npm ci

# Compile TypeScript
# tsconfig.json has rootDir: ".." (points to /app)
# Output will be in /app/server/dist
RUN npx tsc

# Production stage
FROM node:22-alpine

# We need to be in /app/server for the CMD to work
WORKDIR /app/server

# Install production dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder
# The build output is at /app/server/dist in the builder
COPY --from=builder /app/server/dist ./dist

# Generate SSL certs
RUN apk add --no-cache openssl && \
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost"

# Expose HTTPS port
EXPOSE 3000

# Run compiled code
# Based on tsconfig: rootDir is "..", so source server/src/index.ts -> dist/server/src/index.js
CMD ["node", "dist/server/src/index.js"]
