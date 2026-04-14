# PRD - Display OLED para Owner PIN

## 1) Contexto
- El servidor de rallyOS-hub genera un PIN de owner aleatorio (8 dígitos) al iniciar
- Este PIN es necesario para que el organizador acceda al Dashboard y gestione las mesas
- En producción (Orange Pi headless), el PIN se muestra únicamente en los logs del contenedor Docker
- El organizador necesita acceder al PIN sin necesidad de una pantallaHDMI ni acceso a terminal

## 2) Problema
- El PIN actual solo es visible via `docker-compose logs -f hub` o en la terminal al iniciar con `dev.sh`
- En un escenario de tournament real con la Orange Pi "headless" (sin monitor), el organizador no puede ver el PIN
- No hay forma de mostrar el PIN de forma visible en el lugar físico donde está la Orange Pi

## 3) Objetivo del producto
Proveer un display OLED (SSD1306 128x64 I2C) conectado a la Orange Pi que muestre el PIN de owner al iniciar el servidor y cuando sea regenerado.

## 4) Metas
- Meta 1: El PIN se muestra en el OLED dentro de los 5 segundos de iniciado el servidor
- Meta 2: El display muestra el PIN actual en formato legible (8 dígitos, tamaño visible)
- Meta 3: Al regenerar el PIN desde el Dashboard, el display se actualiza automáticamente

## 5) No metas
- No se incluye integración con score en tiempo real
- No se incluye display de más de 128x64 pixeles
- No se incluye conectividad WiFi/Red en el display
- No se incluye audio/alertas sonoras

## 6) Alcance

### En alcance
- Script Python que corre en la Orange Pi (fuera de Docker) y lee el PIN del servidor
- Comunicación entre el servidor (Docker) y el script Python (host) vía archivo compartido o variable de entorno
- Driver para display SSD1306 128x64 via I2C
- Actualización del display cuando el PIN se regenera

### Fuera de alcance
- Integración con sistema de scoring en tiempo real
- Displays de mayor resolución o tecnología (TFT, e-ink)
- Múltiples displays simultáneos

## 7) Requisitos funcionales
- RF-01: Al iniciar el servidor, el script detecta el PIN generado y lo muestra en el OLED
- RF-02: El PIN se muestra con formato legible: "OWNER PIN: 12345678"
- RF-03: Cuando el organizador regenera el PIN desde el Dashboard, el display se actualiza en tiempo real (< 2 segundos)
- RF-04: El script inicia automáticamente al boot de la Orange Pi (systemd service)
- RF-05: El script es resiliente a fallos del display (no crashea el server si el OLED no responde)
- RF-06: El script muestra un mensaje de "waiting for server..." si el PIN no está disponible aún

## 8) Requisitos no funcionales
- RNF-01: El script usa menos de 50MB de RAM
- RNF-02: El script se conecta al OLED via I2C a 100kHz o 400kHz
- RNF-03: Compatibilidad con Orange Pi Zero / Zero 2 (ARMbian o Ubuntu)
- RNF-04: El script corre como servicio del sistema operativo (no dentro de Docker)

## 9) Trade-offs
- Decisión 1: Usar Python con libreria adafruit-circuitpython-ssd1306 vs Node.js con libreria i2c-bus
  - Beneficio Python: Librería estable y bien documentada, comunidad grande
  - Costo Python: Requiere Python 3.x y dependencias del sistema
  - Decision: Python (más madura la librería para SSD1306)
  
- Decisión 2: Sincronización via archivo compartido vs WebSocket
  - Beneficio archivo: Simple, no requiere cambios en el servidor
  - Costo archivo: Polling (cada 1-2 segundos)
  - Decision: Archivo compartido + polling (más simple, no intrusivo)

## 10) Riesgos y mitigaciones
- Riesgo: El display no enciende -> Mitigacion: Script detecta error I2C y usa modo "fallback" (logs)
- Riesgo: Pines I2C diferentes segun modelo de Orange Pi -> Mitigacion: Parametrizar pines en config
- Riesgo: Docker no tiene acceso al archivo compartido -> Mitigacion: Usar volumen de Docker mapeado a host
- Riesgo: El PIN se regenera frecuentemente en prod -> Mitigacion: Cachear ultimo PIN conocido

## 11) Criterios de aceptacion (DoD)
- [ ] Al iniciar `./start.sh`, el OLED muestra "OWNER PIN: XXXXXXXX" en max 10 segundos
- [ ] Al regenerar el PIN desde el Dashboard, el OLED se actualiza en max 3 segundos
- [ ] El script corre como servicio systemd y reinicia automaticamente si falla
- [ ] El OLED muestra mensaje "Conectando..." al inicio antes de tener el PIN
- [ ] El script no crashea si el display se desconecta (graceful failure)
- [ ] Documentacion de conexion electrica (diagrama de pines) incluida

## 12) Plan de rollout
- Etapa 1: Prototipo en laboratorio (script Python funcionando con OLED conectado a Orange Pi)
- Etapa 2: Integracion con server (escribir PIN a archivo compartido)
- Etapa 3: Testing de regeneracion de PIN (Dashboad -> server -> OLED)
- Etapa 4: Service systemd y deploy a Orange Pi de tournament

## 13) Dependencias
- Dependencia técnica: Display OLED SSD1306 128x64 (ya comprado: 4 pines, I2C)
- Dependencia técnica: Librería Python adafruit-circuitpython-ssd1306
- Dependencia operativa: Acceso SSH a Orange Pi para instalar dependencias y wiring
- Dependencia física: Cableado I2C (4 cables) entre OLED y Orange Pi

## 14) Backlog posterior
- Mostrar stats de mesas en el OLED (numero de mesas activas, partidos en curso)
- Soporte para display de mayor resolucion (SSD1322 o similar)
- Integrar botones fisicos al OLED para acciones rapidas (reset PIN, reboot)

---

**Estado:** Draft  
**Owner:** raikenwolf  
**Fecha:** 2026-04-13  
**Version:** v0.1