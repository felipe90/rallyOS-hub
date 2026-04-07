# Local Development Guide

**Modo de desarrollo sin Docker - Correr cliente y servidor localmente**

## Quick Start

Para empezar a desarrollar en local sin Docker:

```bash
cd /Users/raikenwolf/Documents/repos/rallyOS-hub
./dev.sh
```

El script automáticamente:
1. ✅ Genera certificados SSL si no existen
2. ✅ Instala dependencias (si hacen falta)
3. ✅ Compila el servidor
4. ✅ Inicia el servidor en puerto 3000
5. ✅ Inicia el cliente Vite en puerto 5173
6. ✅ Configura WebSocket entre cliente y servidor

## Acceso

- **Frontend:** http://localhost:5173
- **Backend API:** https://localhost:3000
- **WebSocket:** wss://localhost:3000 (Socket.io)

## Características

### Client-side (Vite)
- ✅ **Hot Module Reload (HMR):** Los cambios se reflejan instantáneamente
- ✅ **TypeScript:** Compilación automática
- ✅ **Fast Refresh:** React Fast Refresh para estado preservado
- Auto-compila en cambios

### Server-side (Express + TypeScript)
- ✅ **Source Maps:** Debugging con líneas correctas
- ❌ **NO tiene hot reload:** Requiere reinicio manual
- Compilado con TypeScript

## Flujo de Desarrollo

### Cambios en Cliente
```bash
# 1. Edita archivos en client/src/
# 2. Guarda los cambios
# 3. Verás cambios automáticamente en http://localhost:5173
# No necesitas reiniciar nada
```

### Cambios en Servidor
```bash
# 1. Edita archivos en server/src/
# 2. Presiona CTRL+C para parar el servidor
# 3. Corre ./dev.sh de nuevo (o usa un script con nodemon)
# 4. Verás cambios en https://localhost:3000
```

## Comunicación WebSocket

El cliente se conecta al servidor automáticamente:

```typescript
// En client/src/hooks/useSocket.ts
const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
const socket = io(serverUrl, { transports: ['websocket'] })
```

**Variable de entorno:**
- `VITE_SERVER_URL` - URL del servidor (default: https://localhost:3000)

El script `dev.sh` automáticamente configura:
```bash
VITE_SERVER_URL="https://localhost:3000"
```

## Troubleshooting

### Cliente no se conecta al servidor

**Síntomas:**
- WebSocket error en console
- "Connection refused"
- ServerUrl incorrecto

**Solución:**
```bash
# Verifica que el servidor está escuchando
lsof -i :3000

# Verifica la URL en browser console
window.location.href
# Debe estar en http://localhost:5173

# Abre DevTools → Network → WS
# Verifica que intenta conectar a wss://localhost:3000
```

### Puerto 3000 ya está en uso

**Solución:**
```bash
# Kill el proceso usando puerto 3000
lsof -ti:3000 | xargs kill -9

# O usa otro puerto
SERVER_PORT=3001 ./dev.sh
```

### Certificados SSL faltan

**Síntomas:**
- Error al iniciar servidor sobre SSL

**Solución automática:**
- `dev.sh` genera certificados automáticamente
- Se crean en `server/key.pem` y `server/cert.pem`

**Manual:**
```bash
cd server
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 \
  -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost"
```

## Variables de Entorno

### Cliente
```bash
VITE_SERVER_URL=https://localhost:3000
```

### Servidor
```bash
NODE_ENV=development    # Mostrar logs detallados
SERVER_PORT=3000        # Puerto HTTP(S)
```

## Parar todo

```bash
# Presiona CTRL+C en la terminal
# El script limpia automáticamente ambos procesos
```

## Comparación: Docker vs Dev Local

| Aspecto | Docker (./start.sh) | Local (./dev.sh) |
|---------|-----------------|---------|
| **Setup** | ~2-3 min | ~30 seg |
| **HMR Client** | ❌ No | ✅ Sí |
| **Auto-reload server** | ❌ No | ❌ No (igual) |
| **Aislamiento** | ✅ Sí | ❌ No (usa host) |
| **Proche a producción** | ✅ Sí | ❌ No |
| **Performance** | 🟡 ARM optimizado | ⚡ Native |
| **Mejor para** | Testing final, Orange Pi | Desarrollo rápido |

## Desarrollo Avanzado

### Con nodemon para auto-restart del servidor

Para auto-reiniciar el servidor cuando cambias código:

```bash
# Instala nodemon (opcional)
cd server
npm install --save-dev nodemon

# Usa en dev.sh o manualmente
nodemon --exec 'npm run build && node dist/index.js'
```

### Debug con inspector

```bash
# En una terminal, inicia el servidor con inspector
cd server
node --inspect dist/index.js

# Abre DevTools en chrome://inspect
```

### Logs del servidor

El servidor muestra logs automáticamente:
```
✓ Using built client (dist)
✓ Server listening on https://localhost:3000
Socket.io listening...
```

## Flow Completo de Desarrollo

```
./dev.sh
  ↓
[Instalación de dependencias]
  ↓
[Compilación de servidor]
  ↓
[Inicio de servidor HTTPS en :3000]
  ↓
[Inicio de cliente Vite en :5173]
  ↓
[Cliente se conecta al servidor vía WebSocket]
  ↓
[Frontend + Backend listos]
  ↓
[Editar cliente → Cambios en tiempo real (HMR)]
[Editar servidor → Requiere CTRL+C + reiniciar]
```

## Next Steps

1. **Rápido:** Usa `./dev.sh` durante desarrollo
2. **Testing:** Usa `./start.sh` (Docker) antes de push a main
3. **Deploy:** Orange Pi usa `./start-orange-pi.sh`
