#!/bin/bash
# start.sh - Wrapper para iniciar el Hub limpiando el puerto automáticamente

set -e

PORT=3000

echo "🔍 Verificando puerto $PORT..."

# Matar procesos usando el puerto (funciona en macOS y Linux)
if command -v lsof &> /dev/null; then
    PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "⚠️  Matando proceso(s) en puerto $PORT: $PIDS"
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        sleep 1
        echo "✅ Puerto liberado"
    else
        echo "✅ Puerto libre"
    fi
else
    echo "⚠️  lsof no disponible, saltando cleanup de puerto"
fi

# Verificar que Docker esté corriendo, si no, arrancarlo automáticamente
if ! docker info > /dev/null 2>&1; then
    echo "🐳 Docker no está corriendo. Iniciando Docker Desktop..."
    open -a Docker
    echo "⏳ Esperando que el daemon esté listo (puede tardar ~20 segundos)..."
    until docker info > /dev/null 2>&1; do
        sleep 2
        echo "   ... esperando"
    done
    echo "✅ Docker listo!"
fi

# Iniciar el contenedor
echo "🚀 Iniciando rallyOS-hub..."
docker-compose up --build -d

echo "✅ Listo!"
echo "   Local:   https://localhost:$PORT"
