# rallyOS-hub Dockerfile - Server only (client builds locally)
FROM node:22-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache openssl bash

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies  
WORKDIR /app/server
RUN npm ci

# Copy all source
WORKDIR /app
COPY server/ ./server/
COPY shared/ ./shared/
COPY start.sh ./
RUN chmod +x start.sh

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start
CMD ["./start.sh"]