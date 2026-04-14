# TODO - Scoreboard Routes Refactor

## Prioridad
- **P0** (high) - Refactor crítico de rutas

## Referencias
- PRD: `docs/prd-plans/PRD_SCOREBOARD_REFACTOR.md`

## Backlog por fases

### Fase 1 - Rutas (P0)
- [ ] (P0) Agregar ruta `/scoreboard/:id/referee` en App.tsx
  - Estado: TODO
  
- [ ] (P0) Agregar ruta `/scoreboard/:id/view` en App.tsx
  - Estado: TODO
  
- [ ] (P0) Actualizar redirect de `/scoreboard/:id` → `/scoreboard/:id/view`
  - Estado: TODO

### Fase 2 - Wiring (P0)
- [ ] (P0) Actualizar Dashboard navigate a `/scoreboard/:id/referee`
  - Estado: TODO
  
- [ ] (P0) Actualizar QRCodeURL a `/scoreboard/:id/referee`
  - Estado: TODO

### Fase 3 - Componentes (P1)
- [ ] (P1) ScoreboardPage acepte prop `mode: 'referee' | 'view'`
  - Estado: TODO
  
- [ ] (P1) Crear RefereeView con controles completos
  - Estado: TODO
  
- [ ] (P1) Crear SpectatorView sin controles
  - Estado: TODO

### Fase 4 - Cleanup (P2)
- [ ] (P2) Remover lógica `canReferee` condicional
  - Estado: TODO
  
- [ ] (P2) Buscar otros links a /scoreboard que actualizar
  - Estado: TODO

---

## Estado del backlog

| Fase | Estado |
|------|--------|
| Rutas (P0) | TODO |
| Wiring (P0) | TODO |
| Componentes (P1) | TODO |
| Cleanup (P2) | TODO |

---

## Registro de avances

- 2026-04-15 - PRD creado - raikenwolf

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-15  
**Estado:** TODO