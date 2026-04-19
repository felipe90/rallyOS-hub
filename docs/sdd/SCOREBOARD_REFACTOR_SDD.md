# SDD - Refactor Estructural de ScoreboardMain

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/SCOREBOARD_REFACTOR_PRD.md`
- Objetivos cubiertos: Reducción del monolito UI, abstracción de `MatchConfigPanel`, limpieza del layout y Screaming Architecture del componente.

## 2) Arquitectura actual (AS-IS)
- `ScoreboardMain.tsx` contiene `BackgroundDecor`, `VSDivider`, `MatchConfigPanelInternal`, el Layout Principal, la Barra Lateral, y el layout Referee/Viewer masivamente repetido en más de 600 líneas de código.
- La complejidad cognitiva es altísima y es frágil ante cambios.

## 3) Arquitectura propuesta (TO-BE)
- `src/components/organisms/MatchConfigPanel/MatchConfigPanel.tsx` pasa a ser su propio Organismo totalmente independiente, idealizado para la previa del match.
- `src/components/organisms/ScoreboardMain/` tendrá una nueva carpeta `components/` blindada y privada:
  - `ScoreboardSidebar.tsx`: Extrae la barra lateral Portrait.
  - `ScoreboardHeader.tsx`: Extrae el topbar de Landscape.
  - `PlayerScoreArea.tsx`: Reutilizable; colapsa el layout de Jugador A / B en uno dinámico guiando por la prop `side` y `isReferee`.
  - `ScoreDecorations.tsx`: Componentes estáticos visuales puros.
- `ScoreboardMain.tsx` actúa como Root Container. Cero JSX complejo.

## 4) Diseño de datos y contratos
### 4.1 Modelos/Tipos
- La prop `ScoreboardMainProps` se mantiene idéntica para retrocompatibilidad total con su parent (`MatchEngine` u observador).
- Se crearán nuevas interfaces locales livianas (e.g. `PlayerScoreAreaProps`).

## 5) Reglas de negocio
- El diseño y la usabilidad no deben modificarse (No-Line Rule, Atomic Design, colores primarios intactos, animaciones framer-motion estables).

## 6) Seguridad y validaciones
- N/A para este cambio puramente visual y de refactorización de frontend.

## 7) Observabilidad
- N/A para UI directa.

## 8) Plan de implementación técnica
- Fase 1: Creación del Organismo `MatchConfigPanel` y testeo de importación aislada.
- Fase 2: Creación de la carpeta local de `components` y extracción iterativa (Decorations -> Sidebar -> Header).
- Fase 3: La parte más pesada: Abstraer el `PlayerScoreArea` consolidando JSX duplicado A/B.
- Fase 4: Limpieza final del `ScoreboardMain` y wiring de los imports.

## 9) Plan de migración/compatibilidad
- 100% compatible. El `App.tsx` o componente padre ni siquiera sabrá que refactorizamos esta clase. Se expondrán las mismas interfaces externas.

## 10) Plan de pruebas
- Unit tests: Verificación de tipos de prop drill (`tsc`).
- Smoke: Render manual en el local server y chequeo visual de las interacciones Referee y Viewer.

## 11) Riesgos técnicos y trade-offs
- Riesgo de Props hell si no se envían los datos organizados.
  - Mitigación: Uso limpio de hooks locales (ej. `useMatchDisplay` que ya existe en el archivo y devuelve los datos planos de A/B).

## 12) Criterios de aceptación técnicos
- [ ] No existen dependencias circulares.
- [ ] Componentes locales encapsulados correctamente dentro de organismo padre en arquitectura atómica.
- [ ] Las líneas en `ScoreboardMain.tsx` bajan contundentemente y no duplican estructuras DOM/Tailwind.

## 13) Archivos impactados
- `client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx`
- `client/src/components/organisms/ScoreboardMain/components/*` (NUEVOS)
- `client/src/components/organisms/MatchConfigPanel/*` (NUEVOS)
- `client/src/components/organisms/index.ts`

---

**Estado:** Draft  
**Owner técnico:** Antigravity  
**Fecha:** 2026-04-09  
**Versión:** v1.0
