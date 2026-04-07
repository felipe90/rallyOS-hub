# 📜 Stability Spec: RallyOS Hub "Golden Features"

Este documento define las funcionalidades críticas que **NUNCA** deben degradarse o perderse durante refactors o actualizaciones. 

## 1. 📱 Massive Spectator UI (Landscape)
- **Criterio**: El marcador DEBE ser legible desde una distancia de 10 metros.
- **Regla UI**: En orientación horizontal (Landscape), el layout debe pasar de vertical a lado-a-lado (side-by-side).
- **Escala**: Los números de puntaje deben usar unidades `vh` o `vmin` para ocupar al menos el 70% del alto de la pantalla disponible.
- **Header**: En modo landscape, el header debe ocultarse para maximizar el área de puntaje.

## 2. 🏓 ITTF Side-Swap Logic (Regla 2.15.03)
- **Criterio**: El cambio de lado es obligatorio en sets decisivos.
- **Regla Engine**: Al llegar a los 5 puntos en el set final (ej. 3ero en Bo3, 5to en Bo5), la propiedad `swappedSides` debe invertirse.
- **Regla UI**: La UI debe reflejar este cambio invirtiendo el orden de los jugadores (`flex-direction: row-reverse` o `column-reverse`).
- **Snapshot**: El sistema de `undo` debe ser capaz de revertir el cambio de lado si se deshace el punto que lo disparó.

## 3. ⚖️ Flexible Handicap & Generic Scoring
- **Criterio**: Soporte para disparidad de niveles y diversos formatos de torneo.
- **Handicap**: El sistema debe aceptar puntajes iniciales negativos y positivos (ej. -5 a 5).
- **Formatos**: El motor debe soportar partidos al mejor de 1, 3, 5 y 7 sets sin hardcoding.

## 4. 🛡️ Data Isolation (Multi-Table)
- **Criterio**: Ninguna acción en una mesa debe afectar visual o lógicamente a otra.
- **Sockets**: El servidor DEBE usar habitaciones (Rooms) de Socket.io por `tableId`.
- **Broadcast**: Los eventos de puntaje (`MATCH_UPDATE`) solo deben emitirse a la habitación específica de la mesa.

---

> [!IMPORTANT]
> **Definición de Terminado (DoD)**: Un cambio solo puede ser aprobado si pasa las pruebas de regresión contra esta matriz en modo Portrait y Landscape.
