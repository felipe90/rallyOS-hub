#!/bin/bash
# RallyOS Hub — ensure the hub Docker container is running at boot.
# Fixes the "Created but never started" failure: after a power cut mid-compose,
# Docker leaves the container in `Created` state and never auto-starts it
# (restart:always only applies to containers that have run at least once).
# This script is idempotent: if the container is already Up, compose up -d is a no-op.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_PATH"

# Wait for the Docker daemon to be ready (up to 60s)
for _ in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

if ! docker info >/dev/null 2>&1; then
    echo "[hub] ERROR: Docker daemon not ready after 60s" >&2
    exit 1
fi

echo "[hub] Running: docker compose up -d"
docker compose up -d

# Wait for the health endpoint (up to 60s)
for _ in $(seq 1 30); do
    if curl -sk https://localhost:3000/health >/dev/null 2>&1; then
        echo "[hub] Hub is healthy."
        exit 0
    fi
    sleep 2
done

echo "[hub] WARNING: hub started but health check timed out." >&2
exit 0
