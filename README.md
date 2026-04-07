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

1. **Clonar el repo**:
   ```bash
   git clone [URL_REPOS_HUB]
   cd rallyOS-hub/server
   ```

2. **Levantar el Hub** (automáticamente libera el puerto si está ocupado):
   ```bash
   ./start.sh
   ```

   O manualmente:
   ```bash
   docker-compose up --build
   ```

3. **Acceder**:
   - Abrí `https://localhost:3000` en tu MacBook.
   - O entrá desde tu celular usando `https://[TU_IP_LOCAL]:3000`.

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
