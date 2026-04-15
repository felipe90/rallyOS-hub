# TODO - Routes Refactor (Scoreboard + Dashboard)

## Prioridad
- **P0** (high) - Refactor crítico de rutas

## Referencias
- PRD: `docs/prd-plans/PRD_SCOREBOARD_REFACTOR.md`

## Backlog por fases

### Fase 1 - Scoreboard Rutas (P0)
- [x] (P0) Agregar ruta `/scoreboard/:id/referee` en App.tsx
- [x] (P0) Agregar ruta `/scoreboard/:id/view` en App.tsx
- [x] (P0) Actualizar redirect `/scoreboard/:id` → `/scoreboard/:id/view`

### Fase 2 - Scoreboard Wiring (P0)
- [x] (P0) Actualizar Dashboard navigate a `/scoreboard/:id/referee`
- [x] (P0) Actualizar QRCodeURL a `/scoreboard/:id/referee`

### Fase 3 - Scoreboard Componentes (P1)
- [x] (P1) ScoreboardPage acepte prop `mode: 'referee' | 'view'`
- [ ] (P1) Crear RefereeView con controles completos (usado lógica condicional existente)
- [ ] (P1) Crear SpectatorView sin controles (usado lógica condicional existente)

### Fase 4 - Scoreboard Cleanup (P2)
- [x] (P2) Remover lógica `canReferee` condicional (ahora usa mode prop)

### Fase 5 - Dashboard Rutas (P1)
- [x] (P1) Agregar ruta `/dashboard/owner` en App.tsx
- [x] (P1) Agregar ruta `/dashboard/referee` en App.tsx
- [x] (P1) Actualizar `/dashboard` redirect a /owner

### Fase 6 - Dashboard Componentes (P1)
- [x] (P1) DashboardPage soporta mode prop (owner vs referee)
- [ ] (P1) Extraer TableCard a organisms (no crítico)
- [ ] (P1) Extraer TableList a organisms (no crítico)

### Fase 7 - Testing (REQUIRED para cada change)
- [ ] (P0) Tests para Scoreboard routes
  - test('/scoreboard/:id redirects to /view')
  - test('/scoreboard/:id/referee shows referee')
  - test('/scoreboard/:id/view shows spectator')

- [ ] (P0) Tests para ScoreboardPage refactored
  - test ScoreboardPage receives mode prop correctly
  - test renders RefereeView when mode=referee
  - test renders SpectatorView when mode=view

- [ ] (P1) Tests para RefereeView
  - test shows +1,+2,+3 buttons
  - test calls onAddScore correctly
  - test undo functionality
  - test reset functionality

- [ ] (P1) Tests para SpectatorView
  - test hides all control buttons
  - test displays score correctly
  - test shows back button

- [ ] (P1) Tests para useScoreboardAuth hook
  - test checks localStorage for tablePin
  - test authenticates with PIN
  - test shows PIN input when needed

- [ ] (P2) Tests para Dashboard routes
  - test('/dashboard redirects to /owner')
  - test('/dashboard/owner shows owner')
  - test('/dashboard/referee shows referee')

- [ ] (P2) Tests para OwnerDashboard
  - test shows create table
  - test shows PINs
  - test clean table

- [ ] (P2) Tests para RefereeDashboard
  - test hides create table
  - test hides PINs
  - test join flow

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