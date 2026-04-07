#!/bin/sh
set -e

echo "🚀 Starting rallyOS-hub..."

# Ensure we are in /app
cd /app

# Generate SSL certificates if needed
if [ ! -f server/key.pem ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -newkey rsa:4096 \
        -keyout server/key.pem -out server/cert.pem \
        -days 365 -nodes -subj "/C=AR/ST=BA/L=Buenos Aires/O=RallyOS/OU=Dev/CN=localhost"
fi

echo "✅ RallyOS-hub is running!"
echo "   - Client: http://localhost:5173"
echo "   - Server: https://localhost:3001"
echo ""

# Keep container running - just ping
exec tail -f /dev/null