# 🚀 RallyOS Hub - Orange Pi Quick Start

**Para ejecutar en Orange Pi en 2 minutos.**

## TL;DR - Comando Único

```bash
cd ~/rallyOS-hub && bash setup-orange-pi.sh
```

Eso es. El script hace TODO automáticamente.

---

## Paso a Paso (Si Prefieres Manual)

### 1️⃣ **Primera Vez: Setup Inicial**

```bash
cd ~/rallyOS-hub
bash setup-orange-pi.sh
```

Esto:
- ✓ Instala Docker (si no está)
- ✓ Configura docker-compose
- ✓ Genera archivo .env
- ✓ Descarga imágenes base
- ✓ Construye la aplicación
- ✓ Inicia el servicio

### 2️⃣ **Siguientes Veces: Solo Iniciar**

```bash
cd ~/rallyOS-hub
bash start-orange-pi.sh
```

O:
```bash
docker-compose up -d
```

### 3️⃣ **Acceder a la Aplicación**

```
Local:         https://localhost:3000
Desde otra PC:  https://192.168.x.x:3000  (reemplazar IP)
Por DNS:        https://orangepi.local:3000
```

⚠️ **Aceptar advertencia SSL** (certificado auto-firmado)

---

## 🔍 Comandos Útiles

```bash
# Ver logs
docker-compose logs -f hub

# Diagnóstico completo
bash diagnose.sh

# Ver recursos (CPU, memoria)
docker stats

# Detener
docker-compose down

# Reiniciar
docker-compose restart hub

# Entrar al contenedor
docker exec -it rallyo-hub bash
```

---

## ⚙️ Configuración

Editar `.env`:

```bash
nano .env
```

**Importante cambiar:**
- `REFEREE_PIN=12345` → Tu PIN real
- `PORT=3000` → Otro puerto si conflicto

Luego:
```bash
docker-compose restart hub
```

---

## 🛠️ Troubleshooting

### ❌ "Docker not found"
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### ❌ "Port 3000 in use"
```bash
# Cambiar en .env: PORT=8080
# Luego: docker-compose restart hub
```

### ❌ "Service failed to start"
```bash
docker-compose logs --tail=100 hub
# O correr
bash diagnose.sh
```

### ❌ "Low memory"
- Editar `.env`: `NODE_OPTIONS=--max-old-space-size=128`
- Orange Pi Zero con 512MB → usar 128
- Orange Pi Zero 3 con 2GB → usar 512

---

## 📋 Estructura

```
rallyOS-hub/
├── setup-orange-pi.sh     ← Ejecutar SOLO primera vez
├── start-orange-pi.sh     ← Ejecutar para iniciar cada vez
├── diagnose.sh            ← Ejecutar si hay problemas
├── docker-compose.yml     ← Configuración (no tocar usualmente)
├── Dockerfile             ← Build (no tocar)
├── .env                   ← Tu configuración (EDITAR para PIN, puerto, etc)
└── ...
```

---

## 🌍 Acceder Desde Otra Máquina

### En la Red Local
```
https://192.168.1.100:3000    (reemplazar con IP de Orange Pi)
```

Para encontrar IP:
```bash
hostname -I
```

### Por DNS (Requiere mDNS)
```
https://orangepi.local:3000
```

### Firefox/Chrome
⚠️ Acepta la advertencia de SSL (certificado auto-firmado)

---

## 🚨 Emergencia

```bash
# Parar todo
docker-compose down

# Ver qué está corriendo
docker ps -a

# Limpiar (CUIDADO - borra datos)
docker system prune -a
```

---

## 📞 Soporte

1. Revisar logs: `docker-compose logs -f hub`
2. Ejecutar diagnóstico: `bash diagnose.sh`
3. Ver [DEPLOYMENT.md](DEPLOYMENT.md) para guía completa
4. Ver [README.md](README.md) para función

---

**¿Listo? Ejecuta:** `bash setup-orange-pi.sh`
