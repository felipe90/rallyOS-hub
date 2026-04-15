# TODO - Auth Unificado: Migrar a AuthContext

## Referencias
- PRD: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- SDD: `docs/specs-sdd/SDD_AUTH_UNIFIED_MIGRATION.md`

## Convenciones
- Prioridad: P0 (critico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea debe tener criterio de finalizacion verificable.

## Backlog por fases

### Fase 1 - P0: AuthContext updates
- [x] (P0) Actualizar `AuthContext.types.ts` — agregar 'owner' a UserRole, ownerPin, tablePin
  - Estado: DONE

- [x] (P0) Actualizar `AuthContext.tsx` — hidratación desde localStorage, persistencia, setOwner, setTablePin
  - Estado: DONE

- [x] (P0) Agregar `AuthProvider` a `App.tsx` envuelve toda la app
  - Estado: DONE (2026-04-15)

- [x] (P0) Actualizar tests de `AuthContext` — incluir role 'owner', hidratación, reactividad
  - Estado: DONE

### Fase 2 - P0: Migrar páginas (una por una, commit independiente)
- [x] (P0) Migrar `AuthPage.tsx` de useAuth a useAuthContext
  - Estado: DONE (2026-04-15)

- [x] (P0) Migrar `DashboardPage.tsx` de useAuth a useAuthContext
  - Estado: DONE (2026-04-15)

- [x] (P0) Migrar `ScoreboardPage.tsx` de useAuth a useAuthContext
  - Estado: DONE (2026-04-15)

- [x] (P0) Migrar `WaitingRoomPage.tsx` de useAuth a useAuthContext
  - Estado: DONE (2026-04-15)

- [x] (P0) Migrar `PrivateRoute.tsx` de useAuth a useAuthContext
  - Estado: DONE (2026-04-15)

- [x] (P0) Migrar tests: AuthPage, DashboardPage, ScoreboardPage, WaitingRoomPage, PrivateRoute
  - Estado: DONE (2026-04-15)

- [ ] (P0) Migrar `HistoryViewPage.tsx` de useAuth a useAuthContext (si usa auth)
  - Estado: TODO (no se encontró uso de useAuth)

### Fase 3 - P1: Eliminar useAuth hook
- [ ] (P1) Marcar `useAuth.ts` como deprecado con warning
  - Estado: TODO

- [ ] (P1) Eliminar `useAuth.ts` después de verificar que nadie lo usa
  - Estado: TODO

- [ ] (P1) Actualizar barrel exports si `useAuth` estaba exportado desde algún index
  - Estado: TODO

## Casos de prueba minimos
- [ ] Hidratación: localStorage con role='referee' → AuthContext inicializa con ese role
- [ ] Reactividad: Componente A llama login('owner') → Componente B re-renderiza con isOwner=true
- [ ] Logout: logout() → estado vuelve a null, localStorage se limpia
- [ ] Recarga: recargar página → estado se restaura desde localStorage
- [ ] Flujo completo: AuthPage login → DashboardPage muestra role correcto → ScoreboardPage funciona

## Checklist de release
- [ ] Cambios implementados (todas las páginas migradas, useAuth eliminado)
- [ ] Tests ejecutados (`npm run test` — 0 fallos)
- [ ] Logs sin secretos (sin console.log de auth en producción)
- [ ] Documentacion actualizada (SDD y PRD marcados como completados)
- [ ] Validacion funcional en entorno objetivo (npm run dev, flujo auth completo funciona)

## Registro de avances
- 2026-04-14 - PRD, SDD y TODO creados - Asistente

---

**Owner:** Por definir
**Fecha inicio:** 2026-04-14
**Estado general:** TODO
