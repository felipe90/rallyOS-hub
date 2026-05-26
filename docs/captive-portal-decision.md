# Decisión: Captive Portal iOS/Android — Red Local sin Internet

## Contexto

rallyOS se deploya en un Orange Pi Zero 3 que funciona como Access Point WiFi sin uplink a internet. Los dispositivos se conectan a la red `RallyOS-Table1` para usar la app, pero no tienen salida a internet a través de esta red.

## Problema

Cuando un iPhone/Android se conecta al AP:

1. **iOS captive portal detection**: iOS envía un probe a `captive.apple.com` (y otras URLs) para determinar si la red tiene internet.
2. **Routing por WiFi**: Mientras el WiFi está conectado, iOS enruta TODO el tráfico por WiFi, incluyendo apps como Instagram, WhatsApp, etc.
3. **Sin internet**: Como el Orange Pi no tiene uplink, el tráfico a internet falla. iOS no cambia automáticamente a datos celulares para apps no-rallyOS.

## Diagnóstico Técnico

### Arquitectura de Red

```
iPhone ── WiFi ── Orange Pi (AP)
                   ├── dnsmasq (DNS + DHCP)
                   ├── hostapd (AP)
                   ├── Docker → rallyOS-hub (HTTPS-only, puerto 3000)
                   └── Iptables: puerto 80 → 3000 (DNAT)
```

- El server es **HTTPS-only** (`https.createServer`) — no hay servidor HTTP.
- Certificado SSL auto-firmado generado con SAN para `localhost`, `127.0.0.1`, `rallyos-hub.local`.
- La app usa **Service Workers** (PWA con `vite-plugin-pwa`) — requieren HTTPS.
- CORS configurado para orígenes HTTP y HTTPS.

### Flujo de Conexión (con DNS fix aplicado)

```
1. Usuario conecta a RallyOS-Table1
2. DNS para captive.apple.com → falla (NXDOMAIN, no hay catch-all)
3. iOS detecta "sin internet" → muestra prompt "Use Without Internet"
4. Usuario toca "Use Without Internet" → red pasa a ser default route
5. Usuario abre Safari → https://rallyos-hub.local:3000
6. Certificado auto-firmado → advertencia "This connection is not private"
7. Usuario acepta manualmente → app funciona
8. Conexiones siguientes: iOS recuerda la red, no hay prompt ni advertencia SSL
```

## Decisión

**NO usar catch-all DNS** (`address=/#/` en dnsmasq). Solo resolver dominios locales de rallyOS.

### Configuración Final (dnsmasq.conf)

```
interface=${AP_INTERFACE}
bind-dynamic
listen-address=${AP_IP}
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h
domain=local
address=/rallyos.local/${AP_IP}
address=/rallyos-hub.local/${AP_IP}
# NO address=/#/ — catch-all impide que iOS/Android detecten "sin internet"
# y caigan a datos celulares para tráfico no-rallyOS.
```

### Archivo afectado

`scripts/setup-orangepi-ap.sh` — linea del catch-all eliminada y reemplazada por comentario.

### Por qué NO catch-all

| Con catch-all `/#/` | Sin catch-all |
|---|---|
| DNS resuelve todo a 192.168.4.1 | DNS falla para dominios externos |
| iOS ve que "DNS funciona" pero apps no cargan | iOS detecta "sin internet" rápido |
| WiFi Assist no se activa (señal fuerte) | WiFi Assist/fallback a cellular funciona |
| Instagram intenta usar WiFi y falla | Instagram cae a datos celulares |
| Comportamiento inconsistente entre iOS versión | Comportamiento predecible |

### Por qué NO dar internet al Orange Pi

Opción evaluada y descartada porque:
- Usa ancho de banda del venue WiFi
- Crea dependencia de la red del evento
- Convierte rallyOS en el ISP de los asistentes
- Requiere credenciales de la red del venue

### Por qué NO HTTP puro

La app usa Service Workers (PWA con `vite-plugin-pwa`), que requieren un contexto seguro (HTTPS o localhost). Como los dispositivos acceden por `rallyos-hub.local` (no localhost), HTTP no es viable sin perder funcionalidad PWA.

## Soluciones Evaluadas y No Implementadas

| Solución | Motivo de descarte |
|---|---|
| Dar internet al Orange Pi (wlan0 cliente WiFi) | Usa ancho de banda del venue, dependencia externa |
| HTTP puro (sin SSL) | Service Workers requieren HTTPS |
| Captive Portal RFC 8910 (DHCP option 114) | Requiere HTTPS con cert válido, mismo problema de SSL |
| Instalar CA en cada dispositivo | Fricción mayor que aceptar el cert una vez |

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

## Troubleshooting: Primer Conexión iOS

Si al conectar la app no carga:

1. Esperar 3-5 segundos — iOS está evaluando la red
2. Aparece el prompt "No Internet Connection"
3. Tocar **"Use Without Internet"** — NO "Disconnect" ni "Forget"
4. Abrir Safari → `https://rallyos-hub.local:3000`
5. Tocar "Show Details" → "Visit Website" (una vez por certificado)
6. La app carga y funciona

Importante: **NO** olvidar la red ni desconectarse. Eso resetea la preferencia de iOS y hay que repetir todo.

## Notas Técnicas

- `setup-orangepi-ap.sh` es idempotente — re-ejecutarlo actualiza dnsmasq y reinicia servicios
- Para parche manual en Orange Pi: `sudo sed -i '/^address=\/#\//d' /etc/dnsmasq.conf && sudo systemctl restart dnsmasq`
- El server sigue siendo HTTPS-only — los cambios de red no afectan al puerto 3000
- Service Workers se registran normalmente sobre HTTPS
