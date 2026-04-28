FROM node:22-alpine AS builder

# The build context is the project root (.. from server/)
WORKDIR /app
COPY . .

# Move to the server directory where tsconfig.json lives
WORKDIR /app/server

# CRITICAL: Remove node_modules copied from host (Mac) to avoid architecture conflicts
RUN rm -rf node_modules

# Copy package files and install dependencies (including devDependencies like typescript)
COPY package*.json ./
RUN npm ci

# Compile TypeScript using the local binary (not npx, to avoid fake 'tsc' package)
# tsconfig.json has rootDir: ".." (points to /app)
# Output will be in /app/server/dist
RUN ./node_modules/.bin/tsc

# Production stage
FROM node:22-alpine

# We need to be in /app/server for the CMD to work
WORKDIR /app/server

# CRITICAL: Remove node_modules copied from host
RUN rm -rf node_modules

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
CMD ["node", "dist/server/src/index.js"]
