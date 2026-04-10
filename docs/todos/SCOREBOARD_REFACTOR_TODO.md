# TODO - Refactor del Organismo ScoreboardMain

## Referencias
- PRD: `docs/prd-plans/SCOREBOARD_REFACTOR_PRD.md`
- SDD: `docs/specs-sdd/SCOREBOARD_REFACTOR_SDD.md`

## Convenciones
- Prioridad: P0 (crítico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea debe tener criterio de finalización verificable.

## Backlog por fases

### Fase 1 - P0 (Extracción de Configuración)
- [x] (P0) Extraer `MatchConfigPanel` a un organismo independiente.
  - Archivo(s): `client/src/components/organisms/MatchConfigPanel/MatchConfigPanel.tsx`, `client/src/components/organisms/index.ts`
  - Criterio: El panel es su propia jerarquía de carpetas y puede ser importado aisladamente en ScoreboardMain o fuera de él.
  - Estado: DONE

### Fase 2 - P0 (Andamiaje de subcomponentes puros)
- [x] (P0) Extraer subcomponentes visuales puros y estáticos (Decorations).
  - Archivo(s): `client/src/components/organisms/ScoreboardMain/components/ScoreDecorations.tsx`
  - Criterio: `VSDivider`, `ServingIndicator`, `BackgroundDecor` viven ahí.
  - Estado: DONE

- [x] (P0) Extraer Landscape Header.
  - Archivo(s): `client/src/components/organisms/ScoreboardMain/components/ScoreboardHeader.tsx`
  - Criterio: Header mapeado limpiamente.
  - Estado: DONE

- [x] (P0) Extraer Portrait Sidebar.
  - Archivo(s): `client/src/components/organisms/ScoreboardMain/components/ScoreboardSidebar.tsx`
  - Criterio: Sidebar mapeado limpiamente.
  - Estado: DONE

### Fase 3 - P0 (Reutilización de lógica core)
- [x] (P0) Crear `PlayerScoreArea` y consolidar JSX de A/B vs Referee/Viewer.
  - Archivo(s): `client/src/components/organisms/ScoreboardMain/components/PlayerScoreArea.tsx`
  - Criterio: Las largas listas de divs sonre el player A y el player B con clases repetidas se unifican bajo una abstracción con un prop `side` y `isReferee`.
  - Estado: DONE

### Fase 4 - P0 (Limpieza Final)
- [x] (P0) Ensamblar el rompecabezas en `ScoreboardMain.tsx`.
  - Archivo(s): `client/src/components/organisms/ScoreboardMain/ScoreboardMain.tsx`
  - Criterio: Queda un orquestador menor a 200 líneas que no usa primitivas HTML directas sino los subcomponentes de la carpeta `components/` interna.
  - Estado: DONE

## Casos de prueba mínimos
- [ ] Caso feliz: Carga del ScoreboardMain en Landscape mode Referee, A y B renderizados con variables dinámicas con cero pérdida de props.
- [ ] Caso de error esperado: N/A (puramente funcional UI).
- [ ] Caso borde relevante: Renderizado correcto del handicap (+/-) cuando está configurado desde MatchConfigPanel.

## Checklist de release
- [ ] Cambios implementados
- [ ] Typings revisados (TypeScript feliz)
- [ ] Sin variables/warnings huérfanas
- [ ] Estructura limpia (Screaming architecture UI)
- [ ] Validación visual mediante `npm run dev`

## Registro de avances
- 2026-04-09 - Creación inicial del TODO - Antigravity

---

**Owner:** Antigravity  
**Fecha inicio:** 2026-04-09  
**Estado general:** TODO
