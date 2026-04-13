# SDD - Atomic Fix: DashboardGrid & HistoryDrawer

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/ORGANISM_ATOMIC_FIX_PRD.md`

## 2) Arquitectura actual (AS-IS)
- `DashboardGrid.tsx` -> `DashboardHeader` -> mapea divs inline con `bg-white` e items estáticos.
- `HistoryDrawer.tsx` -> hace un `events.map()` inyectando divs de framer-motion simulando listas.

## 3) Arquitectura propuesta (TO-BE)
- Reemplazo estricto de los JSX inflados por sus correspondientes moléculas.
- Importar `client/src/components/molecules/StatCard` y mapear los tres stats (`Mesas`, `Partidos`, `Jugadores`).
- Importar `client/src/components/molecules/HistoryList` e inyectarle los `events` en el Drawer.

## 8) Plan de implementación técnica
- Fase 1: Refactor de `DashboardHeader` hacia `StatCard`.
- Fase 2: Refactor de `HistoryDrawer` hacia `HistoryList`.

## 13) Archivos impactados
- `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx`
- `client/src/components/organisms/HistoryDrawer/HistoryDrawer.tsx`

---

**Estado:** Draft  
**Owner técnico:** Antigravity  
**Fecha:** 2026-04-09  
**Versión:** v1.0
