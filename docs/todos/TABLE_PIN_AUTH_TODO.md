# TODO - Table PIN Authentication & QR Display

## Referencias
- PRD: `docs/prd-plans/TABLE_PIN_AUTH_PRD.md`
- SDD: `docs/specs-sdd/TABLE_PIN_AUTH_SDD.md`

## Convenciones
- Prioridad: P0 (crítico), P1 (alto), P2 (medio), P3 (bajo)
- Estado: TODO, IN_PROGRESS, BLOCKED, DONE
- Cada tarea debe tener criterio de finalización verificable.

## Backlog por fases

### Fase 1: Backend - P0

- [x] (P0) Agregar tipo `TableInfoWithPin` en `shared/types.ts`
  - Archivo(s): `shared/types.ts`
  - Criterio: El tipo extiende TableInfo con propiedad pin opcional
  - Estado: ✅ COMPLETADO

- [x] (P0) Agregar método `getAllTablesWithPins()` en `tableManager.ts`
  - Archivo(s): `server/src/tableManager.ts`
  - Criterio: Retorna array de tablas incluyendo el PIN de cada una
  - Estado: ✅ COMPLETADO

- [x] (P0) Agregar socket event `GET_TABLES_WITH_PINS` en `socketHandler.ts`
  - Archivo(s): `server/src/socketHandler.ts`
  - Criterio: Verifica que el socket sea Owner antes de responder con PINs
  - Estado: ✅ COMPLETADO


### Fase 2: Frontend Owner Dashboard - P0

- [x] (P0) Modificar `useSocketContext` para carga condicional según rol
  - Archivo(s): `client/src/contexts/SocketContext.tsx` o nuevo hook
  - Criterio: Si isOwner, llama GET_TABLES_WITH_PINS, si no, usa el flujo actual
  - Estado: ✅ COMPLETADO

- [x] (P0) Crear función generadora de QR code
  - Archivo(s): `client/src/utils/qr.ts` (nuevo) → MEJOR: `client/src/components/molecules/QRCodeImage/`
  - Criterio: Dado un tableId, genera canvas/image con código QR escaneable
  - Estado: ✅ COMPLETADO

- [x] (P0) Modificar `DashboardStatusChip` para mostrar PIN+QR para Owner
  - Archivo(s): `client/src/components/molecules/DashboardStatusChip.tsx` o TableStatusChip
  - Criterio: Si props.isOwner, muestra PIN de 4 dígitos y código QR
  - Estado: ✅ COMPLETADO


### Fase 3: PIN Authentication - P0

- [x] (P0) Crear componente `PinModal`
  - Archivo(s): `client/src/components/molecules/PinModal.tsx` (nuevo)
  - Criterio: Modal con input de 4 dígitos, botones Cancelar/Entrar, maneja errores
  - Estado: ✅ COMPLETADO

- [x] (P0) Modificar `handleTableClick` en DashboardPage para abrir PinModal
  - Archivo(s): `client/src/pages/DashboardPage/DashboardPage.tsx`
  - Criterio: Al hacer click, abre PinModal. Si PIN válido, navegar
  - Estado: ✅ COMPLETADO

- [x] (P0) Cambiar `canCreateTable` a solo Owner
  - Archivo(s): `client/src/pages/DashboardPage/DashboardPage.tsx`
  - Criterio: `canCreateTable = isOwner` (quitar isReferee)
  - Estado: ✅ COMPLETADO


### Fase 4: Scoreboard Integration - P1

- [x] (P1) Guardar PIN en localStorage tras validación exitosa
  - Archivo(s): `client/src/pages/DashboardPage/DashboardPage.tsx`
  - Criterio: localStorage.setItem('tablePin', pin) antes de navegar
  - Estado: ✅ COMPLETADO


### Fase 5: Testing - P1

- [x] (P1) Test: Owner ve PIN+QR en dashboard
  - Archivo(s): tests/
  - Criterio: Verificar renderizado de PIN y QR para isOwner=true
  - Estado: ✅ COMPLETADO

- [x] (P1) Test: Click en mesa abre modal
  - Archivo(s): tests/
  - Criterio: onTableClick abre PinModal
  - Estado: ✅ COMPLETADO

- [x] (P1) Test: PIN correcto navega, PIN incorrecto no
  - Archivo(s): tests/
  - Criterio: Validación funciona correctamente
  - Estado: ✅ COMPLETADO


### Fase 6: Hardening - P2

- [x] (P2) Verificar que no hay PIN en logs
  - Archivo(s): todos los archivos modificados
  - Criterio: console.log no incluye pin
  - Estado: ✅ COMPLETADO (QR ahora usa ePin encriptado)


## Casos de prueba mínimos

- [ ] Owner entra al dashboard → ve PIN de cada mesa
- [ ] Owner entra al dashboard → ve QR de cada mesa
- [ ] Referee entra al dashboard → NO ve PIN ni QR
- [ ] Click en mesa → aparece modal de PIN
- [ ] Ingresa PIN correcto + Enter → navega al scoreboard
- [ ] Ingresa PIN incorrecto → muestra error, puede reintentar
- [ ] Click Cancelar → cierra modal, no navega
- [ ] Owner puede crear mesa, Referee NO puede crear mesa


## Checklist de release

- [ ] Cambios implementados
- [ ] Tests ejecutados
- [ ] Logs sin secretos
- [ ] Documentación actualizada
- [ ] Validación funcional en entorno objetivo


## Registro de avances

- 2026-04-10 - Creación de PRD, SDD, TODO - Raiken
- 2026-04-14 - ✅ COMPLETADO: todas las fases implementadas

---

**Owner:** Raiken  
**Fecha inicio:** 2026-04-10  
**Fecha completado:** 2026-04-14  
**Estado general:** ✅ COMPLETADO