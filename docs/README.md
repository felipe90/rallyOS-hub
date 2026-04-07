# 🚀 rallyOS-hub

**El cerebro local de tus torneos.**  
Un servidor de sincronización offline-first diseñado para correr en SBCs (como Orange Pi o Raspberry Pi), permitiendo arbitraje en tiempo real y visualización masiva para espectadores sin necesidad de internet.

---

## ✨ Características Principales

- **🏓 Multi-Table System**: Soporta múltiples mesas de juego concurrentes con waiting rooms individuales.
- **🔄 Undo System**: Sistema de historial para deshacer puntos marcados erróneamente.
- **📱 Waiting Room**: Sala de espera con QR codes para que jugadores se unan.
- **🔒 Seguridad Empotrada**: Comunicación vía HTTPS con certificados SSL y sistema de autorización por PIN para árbitros.
- **📱 Massive Spectator UI**: Interfaz optimizada para modo horizontal (Landscape) con números gigantes, diseñada para reemplazar tableros físicos.
- **⚖️ Handicap Flexible**: Soporta ventajas de puntos positivas y negativas configurables antes de cada partido.
- **🏓 Scoring Genérico**: Motor de puntaje agnóstico al deporte, configurable para partidos al mejor de 1, 3, 5 o 7 sets.
- **🐳 Docker Ready**: Despliegue en un solo comando con cleanup automático de puertos.

---

## 🛠️ Requisitos Rápidos

- **Docker** & **Docker Compose**.
- (Opcional) **Node.js 20+** si querés correrlo sin contenedores.

---

## 🚀 Inicio Rápido (con Docker)

### Opción 1: Script Automático (Recomendado)

```bash
# En tu máquina o en el Orange Pi
cd rallyOS-hub

# Deploy automático (construye, inicia, muestra info)
bash start.sh
```

### Opción 2: Orange Pi (Setup Completo)

Para primera vez en Orange Pi:

```bash
# Setup inicial (instala Docker, descarga imágenes, configura todo)
bash setup-orange-pi.sh

# Después, solo ejecutar:
bash start-orange-pi.sh
```

### Opción 3: Manual

```bash
cd rallyOS-hub

# Construir imagen
docker build -t rallyos-hub:latest .

# O usando docker-compose
docker-compose build
docker-compose up -d

# Acceder
curl -k https://localhost:3000/health
# Browser: https://localhost:3000
```

### Verificar Estado

```bash
# Ver logs en vivo
docker-compose logs -f hub

# Diagnosticar problemas
bash diagnose.sh

# Ver recursos
docker stats
```

---

## 🏠 Acceso Local vs Red

| Ubicación | URL |
|-----------|-----|
| **Localhost** | `https://localhost:3000` |
| **Misma red** | `https://192.168.x.x:3000` (reemplazar IP) |
| **DNS** | `https://orangepi.local:3000` |
| **Móvil/QR** | Escanear código QR en UI |

---

## 🔧 Configuración Rápida

Editar `.env`:

```bash
# Cambiar puerto
PORT=8080

# Cambiar PIN de árbitro
REFEREE_PIN=99999

# Ajustar memoria (Orange Pi Zero con 512MB)
NODE_OPTIONS=--max-old-space-size=128
```

Luego:
```bash
docker-compose restart hub
```

---

## 📊 Monitoreo y Troubleshooting

### Ver Logs
```bash
# Últimas 50 líneas
docker-compose logs --tail=50 hub

# Seguir en vivo
docker-compose logs -f hub
```

### Diagnóstico Completo
```bash
bash diagnose.sh
```

### Problemas Comunes

| Problema | Solución |
|----------|----------|
| **Puerto 3000 en uso** | Cambiar puerto en `.env` o `docker-compose down` |
| **Contenedor no inicia** | `docker-compose logs hub` o `bash diagnose.sh` |
| **Memoria insuficiente** | Reducir `NODE_OPTIONS` en `.env` |
| **No se ve desde otra máquina** | Usar IP real, no localhost; acepta cert SSL |

---

## 🔐 Certificados SSL

Los certificados se generan automáticamente (auto-firmados).

Para usar certificados reales (Let's Encrypt, etc.):
- Modificar el Dockerfile (sección donde se generan)
- O montar volumen con certificados externos

```bash
# Extraer certificados actuales
docker exec rallyo-hub cat /app/cert.pem > cert.pem
docker exec rallyo-hub cat /app/key.pem > key.pem
```

---

## 📖 Documentación Completa

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Guía de despliegue en Orange Pi
- **[setup-orange-pi.sh](setup-orange-pi.sh)** - Script de setup automatizado

---

## ⚙️ Configuración (Environment Variables)

Podés ajustar el comportamiento del Hub editando el archivo `docker-compose.yml`:

| Variable | Descripción | Default |
|----------|-------------|---------|
| `REFEREE_PIN` | El PIN de 4-5 dígitos para habilitar controles. | `12345` |
| `NODE_ENV` | Entorno de ejecución (`production` o `development`). | `production` |

---

## 📡 Socket API (Eventos)

### Emitir (Referee Only)
- `RECORD_POINT`: `(player: 'A' | 'B')` -> Suma un punto.
- `SUBTRACT_POINT`: `(player: 'A' | 'B')` -> Resta un punto.
- `SET_SERVER`: `(player: 'A' | 'B')` -> Cambia el servicio manualmente.
- `RESET_MATCH`: `(config: MatchConfig)` -> Reinicia el partido con nueva configuración.

### Escuchar (All)
- `MATCH_UPDATE`: Recibe el estado completo del partido (`MatchState`).
- `ERROR`: Recibe mensajes de autorización fallida o errores de lógica.

---

## 📐 Estructura del Proyecto

```text
rallyOS-hub/
├── docs/               # Documentación técnica y especificaciones.
└── server/             # Código fuente del Servidor Node.js + Socket.io.
    ├── src/            # Lógica en TypeScript.
    ├── public/         # UI (HTML/CSS/JS) para el Live Board.
    └── Dockerfile      # Configuración de contenedor.
```

---

## 🤝 Créditos
Desarrollado para el ecosistema **RallyOS**.  
*Arquitectura diseñada para baja latencia en redes locales (LAN).*
