#!/bin/sh
set -e

cd /app

# Generate SSL certificates if needed
if [ ! -f server/key.pem ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -newkey rsa:4096 \
        -keyout server/key.pem -out server/cert.pem \
        -days 365 -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Dev/CN=localhost"
fi

# Build client if dist doesn't exist
if [ ! -d client/dist ]; then
    echo "📦 Building client..."
    cd client && npm run build
fi

# Copy client dist to server public
if [ -d client/dist ]; then
    echo "📦 Copying client to server..."
    rm -rf server/public/*
    cp -r client/dist/* server/public/
fi

# Start Express server with tsx (from server dir, with full path)
echo "🖥️ Starting Express server..."
cd /app/server && exec npx tsx src/index.js