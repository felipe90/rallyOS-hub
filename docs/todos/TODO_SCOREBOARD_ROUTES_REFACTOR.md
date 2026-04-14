# TODO - Routes Refactor (Scoreboard + Dashboard)

## Prioridad
- **P0** (high) - Refactor crítico de rutas

## Referencias
- PRD: `docs/prd-plans/PRD_SCOREBOARD_REFACTOR.md`

## Backlog por fases

### Fase 1 - Scoreboard Rutas (P0)
- [ ] (P0) Agregar ruta `/scoreboard/:id/referee` en App.tsx
- [ ] (P0) Agregar ruta `/scoreboard/:id/view` en App.tsx
- [ ] (P0) Actualizar redirect `/scoreboard/:id` → `/scoreboard/:id/view`

### Fase 2 - Scoreboard Wiring (P0)
- [ ] (P0) Actualizar Dashboard navigate a `/scoreboard/:id/referee`
- [ ] (P0) Actualizar QRCodeURL a `/scoreboard/:id/referee`

### Fase 3 - Scoreboard Componentes (P1)
- [ ] (P1) ScoreboardPage acepte prop `mode: 'referee' | 'view'`
- [ ] (P1) Crear RefereeView con controles completos
- [ ] (P1) Crear SpectatorView sin controles

### Fase 4 - Scoreboard Cleanup (P2)
- [ ] (P2) Remover lógica `canReferee` condicional

### Fase 5 - Dashboard Rutas (P1)
- [ ] (P1) Agregar ruta `/dashboard/owner` en App.tsx
- [ ] (P1) Agregar ruta `/dashboard/referee` en App.tsx
- [ ] (P1) Actualizar `/dashboard` redirect a /owner

### Fase 6 - Dashboard Componentes (P1)
- [ ] (P1) Crear OwnerDashboard component (extraer de existente)
- [ ] (P1) Crear RefereeDashboard component
- [ ] (P1) Verificar/crear TableCard en organisms
- [ ] (P1) Verificar/crear TableList en organisms

---

## Estado del backlog

| Fase | Estado |
|------|--------|
| Scoreboard Rutas (P0) | TODO |
| Scoreboard Wiring (P0) | TODO |
| Scoreboard Componentes (P1) | TODO |
| Scoreboard Cleanup (P2) | TODO |
| Dashboard Rutas (P1) | TODO |
| Dashboard Componentes (P1) | TODO |

---

## Registro de avances

- 2026-04-15 - PRD y SDD creados (incluye Dashboard routes) - raikenwolf

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-15  
**STATUS:** TODO (PART 1: Scoreboard, PART 2: Dashboard)