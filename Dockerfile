# rallyOS-hub Dockerfile - Multi-stage build for React + Node.js
# Stage 1: Base
FROM node:22-alpine AS base
RUN apk add --no-cache openssl

# Stage 2: Client build  
FROM base AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 3: Server
FROM base AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./

# Stage 4: Development runtime
FROM base AS development
WORKDIR /app

# Copy shared
COPY shared/ ./shared/

# Copy server
COPY --from=server /app/server ./server

# Copy client for dev (Vite serves from client/)
COPY client/ ./client

# Expose ports
EXPOSE 3001 5173

# Generate SSL certificates if needed
RUN if [ ! -f server/key.pem ]; then \
    openssl req -x509 -newkey rsa:4096 -keyout server/key.pem -out server/cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Dev/CN=localhost"; \
    fi

# Start both services
CMD npm run dev --prefix client & \
    node server/src/index.js & \
    wait