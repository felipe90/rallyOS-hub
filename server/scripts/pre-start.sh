#!/bin/bash
# pre-start.sh - Libera el puerto 3000 antes de iniciar el contenedor

set -e

PORT=3000

echo "[pre-start] Verificando puerto $PORT..."

# Buscar procesos usando el puerto
PID=$(lsof -ti :$PORT 2>/dev/null || true)

if [ -n "$PID" ]; then
    echo "[pre-start] Matando proceso(s) usando puerto $PORT: $PID"
    kill -9 $PID 2>/dev/null || true
    sleep 1
    echo "[pre-start] Puerto $PORT liberado"
else
    echo "[pre-start] Puerto $PORT libre"
fi
