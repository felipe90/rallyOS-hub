# RallyOS Hub - Despliegue en Orange Pi

## 📋 Requisitos

### Hardware Mínimo
- **Orange Pi Zero 3** (2GB RAM, 8GB almacenamiento) - Recomendado
- Orange Pi Zero 2 (512MB-1GB RAM)
- Orange Pi One (1GB RAM)
- Cualquier SBC con ARM64 y 512MB+ RAM

### Software
- **Linux** (Debian/Ubuntu-based, e.g., Armbian)
- **Docker** (instalación: ver sección de setup)
- **Docker Compose** v2.0+
- ~2-3GB de espacio libre en disco

## 🚀 Instalación Rápida (TODO-EN-UNO)

Si ya tienes Docker instalado:

```bash
# SSH a tu Orange Pi
ssh remote@orangepi.local

# Clone o descarga rallyOS-hub
cd ~/rallyOS-hub

# Ejecutar setup (recomendado)
chmod +x setup-orange-pi.sh
./setup-orange-pi.sh

# O directamente iniciar
chmod +x start-orange-pi.sh
./start-orange-pi.sh
```

## 🔧 Setup Inicial (Primera Vez)

### Opción 1: Script Automático (Recomendado)

```bash
chmod +x setup-orange-pi.sh
./setup-orange-pi.sh
```

Este script:
- ✓ Verifica Docker (instala si falta)
- ✓ Valida docker-compose
- ✓ Genera archivo .env
- ✓ Construye la imagen Docker
- ✓ Inicia el servicio
- ✓ Muestra información de acceso

### Opción 2: Manual Step-by-Step

#### 1. Instalar Docker (si no lo tienes)

```bash
# En Orange Pi with Armbian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar tu usuario a grupo docker (opcional, evita usar sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verificar instalación
docker --version
docker-compose --version
```

#### 2. Copiar proyecto a Orange Pi

**Desde tu MacBook:**
```bash
scp -r ~/Documents/repos/rallyOS-hub remote@orangepi.local:~/
```

**O montar tarjeta SD en tu Mac:**
```bash
# Copiar todo el directorio a la tarjeta SD
cp -r ~/Documents/repos/rallyOS-hub /Volumes/BOOT/
```

#### 3. Conectar y Configurar

```bash
ssh remote@orangepi.local
cd ~/rallyOS-hub

# Crear archivo .env (opcional, usa defaults si no)
cp .env.example .env
nano .env  # Editar si necesitas cambios
```

#### 4. Construir e Iniciar

```bash
# Opción A: Script automático
./start-orange-pi.sh

# Opción B: Manual
docker-compose build
docker-compose up -d
```

#### 5. Verificar

```bash
# Ver estado
docker ps

# Ver logs
docker-compose logs -f hub

# Verificar salud
curl -k https://localhost:3000/health

# Acceder
firefox https://orangepi.local:3000
# O desde otra máquina:
firefox https://192.168.1.100:3000  # Reemplazar con IP de Orange Pi
```

## ⚙️ Configuración Avanzada

### Variables de Entorno

Editar `.env`:
```bash
NODE_ENV=production          # o development
PORT=3000                    # Puerto (cambiar si conflicto)
REFEREE_PIN=12345           # PIN de árbitro (cambiar!)
HUB_SSID=RallyOS            # SSID Wi-Fi (opcional)
HUB_IP=192.168.4.1          # IP del hub (opcional)
NODE_OPTIONS=--max-old-space-size=256  # Memoria (ajustar para tu Pi)
```

### Cambiar Puerto si 3000 está en uso

Editar `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Ahora acceso por :8080
```

Luego:
```bash
docker-compose down
docker-compose up -d
```

### Memoria para diferentes Orange Pi

```yaml
# Orange Pi Zero 3 (2GB RAM)
NODE_OPTIONS=--max-old-space-size=512

# Orange Pi Zero 2 (1GB RAM)  
NODE_OPTIONS=--max-old-space-size=256

# Orange Pi Zero (512MB RAM)
NODE_OPTIONS=--max-old-space-size=128
```

## 📊 Monitoreo

### Ver Logs en Tiempo Real

```bash
# Últimas 50 líneas
docker-compose logs --tail=50 hub

# Seguir en vivo
docker-compose logs -f hub

# Con timestamps
docker-compose logs -f --timestamps hub
```

### Recursos (CPU, Memoria)

```bash
# Ver uso del contenedor
docker stats

# Información detallada
docker inspect rallyo-hub
```

### Diagnóstico

```bash
# Ejecutar diagnóstico completo
chmod +x diagnose.sh
./diagnose.sh

# O manualmente:
echo "=== Docker Info ==="
docker --version
docker-compose --version
docker ps

echo "=== Hub Status ==="
docker exec rallyo-hub curl -k https://localhost:3000/health

echo "=== System Resources ==="
free -h
df -h
```

## 🔄 Actualizaciones y Mantenimiento

### Actualizar Código

```bash
cd ~/rallyOS-hub
git pull origin main

# Reconstruir imagen
docker-compose build --no-cache

# Reiniciar
docker-compose restart hub
```

### Limpieza de Almacenamiento

```bash
# Ver uso de Docker
docker system df

# Limpiar imágenes no usadas
docker image prune -a

# Limpiar contenedores detenidos
docker container prune

# Limpieza completa
docker system prune -a --volumes
```

## 🔐 Certificados SSL

El contenedor genera automáticamente certificados auto-firmados.

```bash
# Ver certificados dentro del contenedor
docker exec rallyo-hub ls -la /app/*.pem

# Exportar certificados a host
docker exec rallyo-hub cat /app/cert.pem > cert.pem
docker exec rallyo-hub cat /app/key.pem > key.pem

# Si necesitas certificados reales (Let's Encrypt)
# Ver /app en el contenedor, modificar la generación
```

## 🚨 Troubleshooting

### Puerto 3000 en uso

```bash
# Encontrar qué lo usa
lsof -i :3000
sudo kill -9 <PID>

# O simplemente detener Orange Pi
docker-compose down
```

### Contenedor no inicia

```bash
# Ver logs completos
docker-compose logs --no-paging hub

# Reiniciar
docker-compose restart hub

# O reconstruir
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Memoria insuficiente

```bash
# Reducir NODE_OPTIONS en .env
NODE_OPTIONS=--max-old-space-size=128

# Limpiar almacenamiento
docker system prune -a

# Frenar otros servicios en Orange Pi
sudo systemctl stop <servicio>
```

### Problema de Red

```bash
# Dentro del contenedor
docker exec -it rallyo-hub bash

# Dentro: ver IP
hostname -I

# Dentro: test de conectividad
ping 8.8.8.8
curl https://example.com
```

### Reinicio Automático

El contenedor reinicia automáticamente tras reboot de Orange Pi (configurado en docker-compose.yml con `restart: always`).

Verificar:
```bash
docker-compose logs hub | grep "rallyOS-hub is live"
```

## 🔌 Entrada/Salida de Orange Pi en Torneo

### Inicio de Sesión

1. SSH a Orange Pi: `ssh remote@orangepi.local`
2. Ver logs: `docker-compose logs -f hub`
3. Acceder UI: `https://orangepi.local:3000`

### Escanear QR en móviles

```bash
# Obtener IP de Orange Pi
hostname -I

# Usar: https://192.168.X.X:3000
```

### Parada de Emergencia

```bash
# Parar contenedor (mantiene datos)
docker-compose stop hub

# Detener completamente
docker-compose down

# Reiniciar
docker-compose up -d
```

## 📞 Soporte y Debug

```bash
# Obtener info del sistema
uname -a
lsb_release -a

# Info de Orange Pi específica
cat /proc/device-tree/model

# Logs del sistema
journalctl -n 50

# Diagnóstico completo
./diagnose.sh
```

---

**Última actualización:** Abril 2026  
**Versión:** 2.0  
**Tested on:** Orange Pi Zero 3, Orange Pi One

## Eliminación completa

```bash
docker-compose down -v  # -v elimina volúmenes también
docker rmi rallyo-hub:latest  # Eliminar imagen
```

---

**Nota:** Este despliegue es completamente autónomo. La imagen Docker contiene:
- ✅ Cliente React compilado
- ✅ Servidor Node.js compilado
- ✅ Certificados SSL auto-generados
- ✅ Todas las dependencias necesarias
- ✅ Configuración de producción

No se necesita nada adicional que no esté en el Docker.
