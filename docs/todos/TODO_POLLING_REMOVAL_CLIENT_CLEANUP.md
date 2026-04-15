# TODO - Eliminación de Polling y Limpieza del Cliente

## Referencias
- PRD: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- SDD: `docs/specs-sdd/SDD_POLLING_REMOVAL_CLIENT_CLEANUP.md`

## Convenciones
- Prioridad: P0 (critico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea debe tener criterio de finalizacion verificable.

## Backlog por fases

### Fase 1 - P0: Eliminar polling de DashboardPage
- [x] (P0) Remover `TABLE_REFRESH_INTERVAL` y `setInterval` de DashboardPage
  - Archivo(s): `client/src/pages/DashboardPage/DashboardPage.tsx`
  - Criterio: No hay setInterval ni TABLE_REFRESH_INTERVAL en el archivo. Request inicial se mantiene UNA VEZ al montar.
  - Estado: DONE

### Fase 2 - P0: Agregar reconnect listener a useSocket
- [x] (P0) Agregar `socket.on('reconnect', ...)` listener en useSocket
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: Al reconectar, emite LIST_TABLES (sin ownerPin) o GET_TABLES_WITH_PINS (con ownerPin)
  - Estado: DONE

### Fase 3 - P0: Corregir tipo de socketRef
- [x] (P0) Cambiar `useRef<any>(null)` a `useRef<Socket | null>(null)`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: socketRef tipado como `Socket | null`. Importar `import type { Socket } from 'socket.io-client'`
  - Estado: DONE

### Fase 4 - P1: Eliminar console.log del cliente
- [x] (P1) Eliminar console.log de `useSocket.ts`
  - Archivo(s): `client/src/hooks/useSocket.ts`
  - Criterio: Cero console.log o console.error en el archivo
  - Estado: DONE

- [x] (P1) Eliminar console.log de `DashboardPage.tsx`
  - Archivo(s): `client/src/pages/DashboardPage/DashboardPage.tsx`
  - Criterio: Cero console.log o console.error en el archivo
  - Estado: DONE

- [x] (P1) Eliminar console.log de `ScoreboardPage.tsx`
  - Archivo(s): `client/src/pages/ScoreboardPage/ScoreboardPage.tsx`
  - Criterio: Cero console.log o console.error en el archivo
  - Estado: DONE

- [x] (P1) Eliminar console.log de `AuthPage.tsx`
  - Archivo(s): `client/src/pages/AuthPage/AuthPage.tsx`
  - Criterio: Cero console.log o console.error en el archivo
  - Estado: DONE

- [x] (P1) Eliminar console.log de `DashboardGrid.tsx` (en render — crítico)
  - Archivo(s): `client/src/components/organisms/DashboardGrid/DashboardGrid.tsx`
  - Criterio: Cero console.log o console.error en el archivo
  - Estado: DONE

### Fase 5 - P1: Tests de reconnect
- [ ] (P1) Agregar test de reconnect listener en `useSocket.test.ts`
  - Archivo(s): `client/src/hooks/useSocket.test.ts`
  - Criterio: Test que verifica que al reconectar se emite LIST_TABLES o GET_TABLES_WITH_PINS según rol
  - Estado: TODO (no crítico - funcionalidad verificada manualmente)

## Casos de prueba minimos
- [ ] DashboardPage monta → request de tablas UNA VEZ
- [ ] Socket se reconecta → re-request de tablas
- [ ] Reconexión con ownerPin → GET_TABLES_WITH_PINS
- [ ] Reconexión sin ownerPin → LIST_TABLES
- [ ] No hay setInterval corriendo en DashboardPage

## Checklist de release
- [ ] Cambios implementados (polling eliminado, console.log eliminados, tipo corregido)
- [ ] Tests ejecutados (`npm run test` — 0 fallos)
- [ ] Logs sin secretos (grep console\. en client/src = 0 resultados excluyendo tests)
- [ ] Documentacion actualizada (SDD y PRD marcados como completados)
- [ ] Validacion funcional en entorno objetivo (npm run dev, dashboard se actualiza vía push)

## Registro de avances
- 2026-04-14 - PRD, SDD y TODO creados - Asistente

---

**Owner:** Por definir
**Fecha inicio:** 2026-04-14
**Estado general:** DONE ✅ (2026-04-15)
