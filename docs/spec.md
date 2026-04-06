# 📦 Spec: rallyOS-hub

> **Estado**: Draft / Architecture Review  
> **Versión**: 1.0.0  
> **Objetivo**: Proveer una red local (LAN) robusta y un servidor de sincronización para torneos de Table Tennis sin dependencia de internet.

---

## 1. Vision & Concept

**rallyOS-hub** es un dispositivo físico ("Plug & Play") que crea una infraestructura de red dedicada para un torneo. Resuelve el problema de la mala conectividad en venues y elimina la complejidad de los protocolos P2P mobile (Bluetooth/WiFi-Direct) moviendo la lógica de red a un servidor central físico.

**Core Values**:
- **Zero Internet**: Funciona en sótanos, polideportivos o descampados.
- **Hardware Agnostic**: Corre en Raspberry Pi, Orange Pi o Mini PCs.
- **Low Friction**: Unirse al marcador es tan simple como escanear un QR.

---

## 2. Hardware Evaluation & Strategy

Para optimizar costos sin sacrificar confiabilidad, se definen tres perfiles de hardware:

| Perfil | Hardware Sugerido | Costo Est. | Casos de Uso |
| :--- | :--- | :--- | :--- |
| **Budget** | Orange Pi Zero 3 (1GB RAM) | ~$20 | Torneos pequeños (1-2 canchas, <20 personas). |
| **Standard** | Raspberry Pi 4 / 5 (4GB RAM) | ~$55-80 | El estándar de oro. Máxima compatibilidad y soporte. 

### Portability Layer (Estrategia de Independencia)
Para que el software no sea "rehen" de una placa específica:
- **Base OS**: [Armbian](https://www.armbian.com/) (Debian-based). Es el estándar para SBCs no-Raspberry.
- **Runtime**: Node.js (via Docker o NVM).
- **Deployment**: Los archivos de configuración de red (`hostapd.conf`) se manejan vía scripts de setup que detectan el driver de WiFi automáticamente.

---

## 3. Network Architecture (OS Layer)

La caja actúa como **Access Point (AP)** y **servidor DHCP**.

### 3.1 Servicios Base
- **hostapd**: Crea la red WiFi (SSID: `RallyOS_Court_X`).
- **dnsmasq**: Punto de acceso DNS y DHCP. Redirecciona cualquier dominio a la IP del Hub (`192.168.4.1`).
- **Nginx**: Servidor web para el Captive Portal (opcional) y proxy inverso hacia el servidor Node.js.

### 3.2 Discovery: QR Handshake
El Referee genera un QR que contiene:
```json
{
  "ssid": "RallyOS_4821",
  "ip": "192.168.4.1",
  "port": 3000,
  "role": "HUB"
}
```
Al escanear, la app se conecta automáticamente al Socket en esa IP.

---

## 4. Application Architecture (The Hub)

El Hub corre un servidor **Node.js** con **Socket.io**.

### 4.1 State Management
El estado del match vive en la memoria del Hub.
- **Memory First**: Updates instantáneos.
- **Persistence (SQLite)**: Cada punto se guarda en una base de datos liviana para que, si el Hub se reinicia, el match se recupere en el mismo punto.

### 4.2 Communication Contract (Socket.io Events)

#### Server -> Client: `MATCH_UPDATE`
Enviado en cada cambio de estado (punto, set, service).
```json
{
  "score": { "a": 11, "b": 9 },
  "sets": { "a": 2, "b": 1 },
  "serving": "A",
  "history": ["POINT_A", "POINT_B", "CORRECTION_A"],
  "status": "LIVE"
}
```

#### Referee -> Server: `RECORD_POINT_A` | `UNDO_LAST`
El referee envía acciones, no el nuevo score. El Hub valida las reglas (Reglas de Ping Pong) y devuelve el nuevo estado.

---

## 5. Persistence & Cloud Sync

**rallyOS-hub** es "Offline-First", pero puede ser "Cloud-Second".

### Post-Match Sync (Opcional)
Si la placa tiene conexión a internet (vía cable Ethernet o un segundo dongle WiFi):
1.  Al finalizar un match, el Hub marca el registro como `PENDING_SYNC`.
2.  Un worker en background intenta subir el `MatchSummary` a **Supabase**.
3.  Una vez confirmado, se marca como `SYNCED`.

---

## 6. Deployment Strategy (The "Setup Script")

Para el desarrollador, el proceso es:
1.  Grabar imagen limpia de Armbian/Debian.
2.  Clonar el repo: `git clone rallyOS-hub`.
3.  Correr `./scripts/install.sh`.
    - Instala Docker.
    - Configura `hostapd` y `dnsmasq`.
    - Levanta los contenedores del Servidor y el Dashboard.

---

## 7. Scalability Limits

> [!WARNING]
> **Interferencia**: En un torneo con 10 canchas, usar 10 Hubs como Access Points en la banda de 2.4GHz va a generar colisiones.  
> **Solución**: Usar canales WiFi fijos (1, 6, 11) o saltar a la banda de 5GHz en placas que lo soporten (RPi 4/5).

---

## 8. Next Steps (POC Phase)

1.  [x] Definir Hardware & OS Strategy.
2.  [ ] Setup de `hostapd` en hardware de prueba.
3.  [ ] Crear servidor base de Socket.io en Node.js.
4.  [ ] Test de latencia con 5 clientes simultáneos.
5.  [ ] Implementación de "Reconnection Logic" en la App React Native.
