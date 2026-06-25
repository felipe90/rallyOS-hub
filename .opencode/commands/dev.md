---
description: Levanta client + server en local sin Docker (scripts/dev.sh)
agent: build
---

Lanzá el entorno de desarrollo local sin Docker ejecutando `scripts/dev.sh`.

1. Ejecutá `bash scripts/dev.sh > /tmp/rallyos-dev.log 2>&1 &` para correrlo en background.
2. Hacé polling de puertos con `lsof` hasta que `localhost:5173` y `localhost:3000` estén escuchando (timeout 90s).
3. Si alguno de los dos no responde a los 90s, reportá error con el contenido de `/tmp/rallyos-dev.log`.
4. Informá al usuario:
   - Frontend: http://localhost:5173
   - Backend (Express + Socket.io): https://localhost:3000
   - Logs: `tail -f /tmp/rallyos-dev.log`
