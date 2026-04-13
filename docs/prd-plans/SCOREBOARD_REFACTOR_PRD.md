# PRD - Refactor del Organismo ScoreboardMain

## 1) Contexto
- Problema operativo de mantenibilidad y legibilidad del código.
- Actualmente, el componente `ScoreboardMain.tsx` en el cliente ocupa toda la lógica visual, de orquestación, y el panel lateral, resultando en un archivo masivo de más de 600 líneas que viola los principios de responsabilidad unida y Atomic Design avanzado.
- El alcance es puramente de refactorización Frontend en la plataforma web (cliente local).

## 2) Problema
- **Qué duele hoy:** Es un archivo muy largo ("silo monolítico"), el código de renderizado es repetitivo (Jugador A vs Jugador B, Referee vs Viewer).
- **Quién lo sufre:** Nosotros, como desarrolladores intentando mantener o escalar funcionalidades del frontend.
- **Evidencia:** Repetición masiva de JSX, mezcla del estado de configuración (`MatchConfigPanel`) con la vista en vivo de puntuación.

## 3) Objetivo del producto
- Subdividir `ScoreboardMain` en componentes más pequeños, altamente cohesivos y focalizados, siguiendo fielmente los principios de Atomic Design de la arquitectura "The Kinetic Clubhouse".

## 4) Metas
- Reducir `ScoreboardMain.tsx` a menos de 200 líneas (idealmente actúa sólo como contenedor layout).
- Extraer `MatchConfigPanel` a su propio ecosistema.
- Eliminar la repetición de código JSX entre el layout del Jugador A y Jugador B (DRY).

## 5) No metas
- No se agregará nueva funcionalidad al partido.
- No se harán cambios en la lógica del backend (Server/MatchEngine) ni en los types del Shared.

## 6) Alcance
### En alcance
- Extracción de subcomponentes (`PlayerScoreArea`, `Sidebar`, `Header`, `Decorations`) dentro de `/ScoreboardMain/components/`.
- Refactorización de `ScoreboardMain`.
- Creación del organismo independiente `MatchConfigPanel`.

### Fuera de alcance
- Rediseñar el UI completo; los estilos actuales se conservarán.
- Integrar nuevos tests si la infraestructura (jest/cypress) no está ya montada y corriendo para este hook.

## 7) Requisitos funcionales
- RF-01: El panel de configuración de partido pre-inicio debe funcionar exactamente igual que antes, en pantalla completa, pero importado externamente.
- RF-02: La funcionalidad de sumar/restar puntos y visualizar el historial no puede perderse, el prop drilling debe ser meticuloso.
- RF-03: Ambos layouts (Landscape / Referee y Portrait / Viewer) deben mantenerse consistentes.

## 8) Requisitos no funcionales
- RNF-01: Cumplimiento de Screaming Architecture (Atomic Design limpio, evitar contaminar átomos globales con cosas hiper específicas).

## 9) Trade-offs
- Se sacrifica un poco la inmediatez de "tener todo en un solo archivo" a cambio de navegar múltiples archivos, pero ganamos masivamente en testeabilidad y aislamiento de bugs.

## 10) Riesgos y mitigaciones
- Riesgo: Romper la reactividad entre subcomponentes o perder propiedades del estado `MatchStateExtended`. -> Mitigación: Tipado fuerte en los props de las interfaces hijas y TypeScript en modo estricto.

## 11) Criterios de aceptación (DoD)
- [ ] `MatchConfigPanel` está correctamente extraído y funcionando.
- [ ] `ScoreboardMain.tsx` no maneja lógica UI granular, solo orquesta layouts y renderiza hijos.
- [ ] Ausencia de errores TypeScript en la refactorización.

## 12) Plan de rollout
- Implementar los cambios en una rama local, verificar interactuando con local_development server.

## 13) Dependencias
- Dependencia puramente en la UI (Tailwind V4/Framer Motion). Ningún tercero.

## 14) Backlog posterior
- Agregar pruebas de componentes con React Testing Library en el futuro ahora que están testeables.

---

**Estado:** Draft  
**Owner:** Antigravity  
**Fecha:** 2026-04-09  
**Versión:** v1.0
