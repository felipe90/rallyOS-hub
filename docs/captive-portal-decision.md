# Decisión: Captive Portal iOS/Android — Red Local sin Internet

## Contexto

rallyOS se deploya en un Orange Pi Zero 3 que funciona como Access Point WiFi sin uplink a internet. Los dispositivos se conectan a la red `RallyOS` para usar la app, pero no tienen salida a internet a través de esta red.

## Problema

Cuando un iPhone/Android se conecta al AP:

1. **iOS captive portal detection**: iOS envía un probe a `captive.apple.com` (`/hotspot-detect.html`) para determinar si la red tiene internet.
2. **Android connectivity check**: Android envía un probe a `connectivitycheck.gstatic.com` (`/generate_204`).
3. **Sin portal cautivo**: Si la red no intercepta esos probes, el dispositivo detecta "sin internet" y requiere que el usuario abra el navegador manualmente a `https://rallyos-hub.local:3000`, aceptando además el certificado auto-firmado. Es fricción excesiva para un evento en vivo.

## Diagnóstico Técnico

### Arquitectura de Red

```
iPhone/Android ── WiFi (abierta) ── Orange Pi (AP)
                                   ├── hostapd (AP abierta, wpa=0)
                                   ├── dnsmasq (DNS catch-all + DHCP)
                                   ├── Docker → rallyOS-hub
                                   │     ├── HTTPS :3000 (Express SPA + API + Socket.IO)
                                   │     └── HTTP  :80   (captive portal nativo, http.createServer)
                                   └── Iptables: NAT/forward (sin DNAT :80→:3000)
```

- El server principal es **HTTPS-only** (`https.createServer`) en el puerto 3000 — Express, SPA, API y Socket.IO. No se modifica.
- El captive portal es un **segundo listener HTTP nativo** (`http.createServer`) en el puerto 80, sin Express, sin helmet, sin middleware de Host. Vive en `server/src/captivePortal.ts`.
- Certificado SSL auto-firmado con SAN para `localhost`, `127.0.0.1`, `rallyos-hub.local`.
- La app usa **Service Workers** (PWA con `vite-plugin-pwa`) — requieren HTTPS, por eso el portal redirige al HTTPS :3000 y no sirve la app sobre HTTP.
- dnsmasq resuelve **todos** los dominios a `192.168.4.1` (`address=/#/192.168.4.1`) para que cualquier probe o navegación HTTP aterrice en el portal.

### Flujo de Conexión (con captive portal)

```
1. Usuario conecta a "RallyOS" (abierta, sin contraseña)
2. iOS/Android envía su probe de detección (captive.apple.com / connectivitycheck.gstatic.com)
3. dnsmasq resuelve el dominio del probe a 192.168.4.1 (catch-all)
4. El probe llega al HTTP :80 → el portal responde 200 + HTML (no "Success", no 204)
5. El OS detecta captive portal y abre automáticamente la hoja del portal
6. Usuario ve "Bienvenido a RallyOS" + términos → toca "Aceptar y Continuar"
7. POST /accept → 302 a https://rallyos-hub.local:3000
8. Certificado auto-firmado → advertencia "This connection is not private" (una vez)
9. Usuario acepta el cert → la app carga
10. Conexiones siguientes: el OS recuerda la red y la preferencia del cert
```

## Decisión

**SÍ usar catch-all DNS** (`address=/#/` en dnsmasq) **+ portal cautivo HTTP nativo en el puerto 80 + WiFi abierta (hostapd `wpa=0`)**. Esto reemplaza la decisión anterior de NO usar catch-all.

### Configuración Final

#### hostapd — red abierta (`/etc/hostapd/hostapd.conf`)

```
interface=${AP_INTERFACE}
driver=nl80211
ssid=RallyOS
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=0
```

Sin `wpa_passphrase`, sin `wpa_key_mgmt`, sin `rsn_pairwise=CCMP`. El dispositivo se conecta sin prompt de contraseña.

#### dnsmasq — catch-all DNS (`/etc/dnsmasq.conf`)

```
interface=${AP_INTERFACE}
bind-dynamic
listen-address=${AP_IP}
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h
domain=local
address=/rallyos.local/${AP_IP}
address=/rallyos-hub.local/${AP_IP}
address=/#/${AP_IP}
```

`address=/#/${AP_IP}` resuelve **cualquier** dominio a `192.168.4.1`, de modo que todo probe del OS y toda navegación HTTP aterrice en el captive portal (:80).

#### Docker — puerto 80 (`docker-compose.yml`)

```yaml
ports:
  - "3000:3000"
  - "80:80"
```

El contenedor es dueño del puerto 80 directamente vía port mapping de Docker.

#### Captive portal — HTTP nativo (`server/src/captivePortal.ts`)

Un único `http.createServer` (sin Express) que escucha en `0.0.0.0:80` y rutea por **Host + Path** (determinista, nunca por User-Agent):

| Ruta | Método | Host | Respuesta |
|------|--------|------|-----------|
| `/hotspot-detect.html` | GET | `captive.apple.com` | 200 + HTML del portal (NO "Success") → iOS abre la hoja |
| `/generate_204` | GET | `connectivitycheck.gstatic.com` | 200 + HTML (NO 204) → Android detecta portal |
| cualquier otro path | GET | cualquiera | 200 + HTML del portal (fail-safe para OEMs con dominios variantes) |
| `/accept` | POST | cualquiera | 302 → `https://${HUB_DOMAIN}:${PORT}` |
| `/fonts/*.woff2` | GET | cualquiera | 200 + `application/font-woff` (fuentes same-origin) |

El HTML del portal inlinea las CSS custom properties del design system del cliente (`@theme` de `client/src/index.css`): paleta teal (`#006b5f`), gradientes, radios, sombras y fuentes Space Grotesk + Manrope servidas same-origin desde `/fonts/*.woff2`.

### Archivos afectados

- `scripts/setup-orangepi-ap.sh` — hostapd → abierta (`wpa=0`, removidas líneas WPA2-PSK), dnsmasq → catch-all (`address=/#/${AP_IP}`), iptables → removida la regla DNAT muerta `--dport 80 → :3000`.
- `docker-compose.yml` — agregado `"80:80"`.
- `server/src/captivePortal.ts` — nuevo, portal HTTP nativo.
- `server/src/index.ts` — importa y llama `startCaptivePortal(hubConfig)` después de `httpsServer.listen(...)`.
- `server/public/fonts/*.woff2` — fuentes copiadas desde `client/public/fonts/` para servir same-origin.

### Por qué SÍ catch-all ahora

La decisión anterior (NO catch-all) priorizaba que iOS/Android cayeran a datos celulares para apps no-rallyOS (Instagram, WhatsApp). En la práctica eso requería que el usuario abriera el navegador manualmente y aceptara el certificado, lo cual genera fricción y soporte en cada evento. El captive portal elimina esa fricción: el OS abre la hoja del portal automáticamente.

| Con catch-all `/#/` + portal | Sin catch-all (anterior) |
|---|---|
| DNS resuelve todo a 192.168.4.1 | DNS falla para dominios externos |
| El OS abre la hoja del portal automáticamente | El usuario debe abrir Safari manualmente |
| El usuario toca "Aceptar y Continuar" → redirige al app | El usuario debe tipear `https://rallyos-hub.local:3000` |
| Apps no-rallyOS no cargan por WiFi (aceptable para MVP) | Apps no-rallyOS caen a datos celulares |

**Trade-off aceptado para MVP**: el catch-all impide que apps no-rallyOS usen datos celulares por WiFi mientras el dispositivo está en la red `RallyOS`. Para un torneo en vivo esto es aceptable — el objetivo es que los participantes lleguen al tablero con mínima fricción. Una iteración futura puede mencionar esto en el HTML del portal.

### Por qué NO dar internet al Orange Pi

Opción evaluada y descartada porque:
- Usa ancho de banda del venue WiFi
- Crea dependencia de la red del evento
- Convierte rallyOS en el ISP de los asistentes
- Requiere credenciales de la red del venue

### Por qué NO HTTP puro para el app

La app usa Service Workers (PWA con `vite-plugin-pwa`), que requieren un contexto seguro (HTTPS o localhost). Como los dispositivos acceden por `rallyos-hub.local` (no localhost), el app debe servirse sobre HTTPS en el puerto 3000. El captive portal usa HTTP :80 **solo** para la página de términos y la redirección; nunca sirve el app本身 sobre HTTP.

## Soluciones Evaluadas y No Implementadas

| Solución | Motivo de descarte |
|---|---|
| Dar internet al Orange Pi (wlan0 cliente WiFi) | Usa ancho de banda del venue, dependencia externa |
| HTTP puro (sin SSL) para el app | Service Workers requieren HTTPS |
| Captive Portal RFC 8910 (DHCP option 114) | Requiere HTTPS con cert válido, mismo problema de SSL |
| Instalar CA en cada dispositivo | Fricción mayor que aceptar el cert una vez |
| Express app separada para el portal | Over-engineering; un `http.createServer` nativo bypassa todo el middleware de Express (incluido el validador de Host que rechaza `captive.apple.com`) con ~50 líneas |

## Solución Futura Recomendada

**Certificado real con Let's Encrypt + dominio propio**

Pasos:
1. Comprar dominio (ej: `rallyos.app`)
2. Configurar DNS challenge para Let's Encrypt (certbot o acme.sh)
3. dnsmasq resuelve el dominio a `192.168.4.1`
4. SAN del cert incluye el dominio
5. Cero advertencias SSL en cualquier dispositivo
6. Auto-renovación cada 90 días via cron

Costo estimado: ~$10/año (dominio). Tiempo de implementación: ~1 hora.

Con un cert real, el paso 8 del flujo (advertencia de cert auto-firmado) desaparece, dejando el flujo completamente sin fricción.

## Troubleshooting: Primer Conexión iOS/Android

Con el captive portal activo, el flujo es mayormente automático, pero el cert auto-firmado sigue requiriendo aceptación manual la primera vez:

1. Conectar a "RallyOS" (sin contraseña)
2. El OS abre automáticamente la hoja del portal (si no aparece, abrir Safari a cualquier URL HTTP — el catch-all DNS la redirige al portal)
3. Tocar "Aceptar y Continuar" → redirige a `https://rallyos-hub.local:3000`
4. Aparece "This connection is not private" → "Show Details" → "Visit Website" (una vez por certificado)
5. La app carga y funciona

Importante: **NO** olvidar la red ni desconectarse. Eso resetea la preferencia de iOS y hay que repetir la aceptación del cert.

Si la hoja del portal no aparece en iOS: forzarla abriendo Safari y navegando a `http://captive.apple.com/hotspot-detect.html` (el catch-all DNS lo resuelve al portal). En Android: `http://connectivitycheck.gstatic.com/generate_204`.

## Notas Técnicas

- `setup-orangepi-ap.sh` es idempotente — re-ejecutarlo regenera hostapd (abierta), dnsmasq (catch-all) y reinicia servicios.
- Para parche manual en Orange Pi (re-habilitar catch-all si se removió): `echo 'address=/#/192.168.4.1' >> /etc/dnsmasq.conf && sudo systemctl restart dnsmasq`
- El server principal sigue siendo HTTPS-only en el puerto 3000 — los cambios de red y el captive portal no afectan al app.
- El captive portal es **stateless** (MVP): no trackea aceptaciones con cookies ni IP sets. POST /accept → 302 inmediato.
- Service Workers se registran normalmente sobre HTTPS en :3000; el portal :80 no registra Service Workers.
- El daemon DNS de Docker se configura con `8.8.8.8`/`1.1.1.1` (`/etc/docker/daemon.json`) para que el catch-all de dnsmasq no rompa los `docker pull` del host.
