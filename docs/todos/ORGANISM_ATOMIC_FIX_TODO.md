# TODO - Atomic Fix: DashboardGrid & HistoryDrawer

## Referencias
- PRD: `docs/prd-plans/ORGANISM_ATOMIC_FIX_PRD.md`
- SDD: `docs/specs-sdd/ORGANISM_ATOMIC_FIX_SDD.md`

## Backlog por fases

### Fase 1 - P0 (Refactor DashboardGrid)
- [x] (P0) Inyectar `<StatCard />` en el `DashboardHeader`.
  - Archivo(s): `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx`
  - Criterio: Los 3 divs que representaban las tarjetas de estadísticas ("Mesas", "Partidos", "Jugadores") ya no existen; son 3 etiquetas `<StatCard />`.
  - Estado: DONE

### Fase 2 - P0 (Refactor HistoryDrawer)
- [x] (P0) Inyectar `<HistoryList />` en `HistoryDrawer`.
  - Archivo(s): `client/src/components/organisms/HistoryDrawer/HistoryDrawer.tsx`
  - Criterio: Se remueve el `events.map()` inline y se utiliza la molécula existente para listar eventos pasados.
  - Estado: CANCELLED (Trade-off: HistoryList rompe la UX de Undo dinámico)

---

**Owner:** Antigravity  
**Fecha inicio:** 2026-04-09  
**Estado general:** TODO
