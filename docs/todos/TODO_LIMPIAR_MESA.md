# TODO - Limpiar Mesa (Reset Table)

## Contexto
El Owner necesita poder resetear una mesa para reuse without tener que delete y recreate. Esto incluye: limpiar nombres de jugadores, resetear score, y generar nuevo PIN.

## Estado actual
- ✅ Botón "Limpiar Mesa" visible solo para Owner
- ✅ Modal de confirmación antes de ejecutar
- ✅ MatchEngine.reset() limpia scores y currentSets
- ✅ tableManager.regeneratePin() genera nuevo PIN de 4 dígitos
- ✅ Player names se limpian
- ✅ Table status cambia a WAITING
- ✅ QR se actualiza con nuevo PIN

## Tareas

- [x] (P0) Agregar método `reset()` en MatchEngine
  - Archivo(s): `server/src/matchEngine.ts`
  - Criterio: Limpia scores, currentSets, servidor, history. Status sigue igual.
  - Estado: ✅ COMPLETADO

- [x] (P0) Modificar `regeneratePin()` en tableManager
  - Archivo(s): `server/src/tableManager.ts`
  - Criterio: Genera nuevo PIN, limpia playerNames, setea status a WAITING
  - Estado: ✅ COMPLETADO

- [x] (P0) Agregar botón en TableStatusChip
  - Archivo(s): `client/src/components/molecules/TableStatusChip/TableStatusChip.tsx`
  - Criterio: Visible solo para Owner, con stopPropagation
  - Estado: ✅ COMPLETADO

- [x] (P0) Agregar modal de confirmación
  - Archivo(s): `client/src/components/molecules/TableStatusChip/TableStatusChip.tsx`
  - Criterio: Modal inline con botones Cancelar/Limpiar
  - Estado: ✅ COMPLETADO

- [x] (P0) Wire up socket event
  - Archivo(s): `server/src/socketHandler.ts`
  - Criterio: Llama resetTable() y regeneratePin()
  - Estado: ✅ COMPLETADO

- [x] (P0) Dashboard wireup
  - Archivo(s): `client/src/pages/DashboardPage/DashboardPage.tsx`
  - Criterio: Pasa props onCleanTable, onCleanConfirm, onCleanCancel
  - Estado: ✅ COMPLETADO

- [x] (P1) Testing end-to-end
  - Criterio: Verificar flujo completo de limpieza
  - Estado: ✅ COMPLETADO

## Comportamiento esperado

1. Owner hace click en "Limpiar Mesa"
2. Aparece modal: "¿Estás seguro de resetear esta mesa? Se borrarán los nombres, el score y se generará un nuevo PIN."
3. Click "Cancelar" → cierra modal, no pasa nada
4. Click "Limpiar" →
   - Scores.clear()
   - Player names.clear()
   - PIN = nuevo aleatorio
   - Status = WAITING
   - QR se actualiza
   - Socket emite a clientes

## Registro de avances

- 2026-04-14 - Feature implementada y funcionando - raikenwolf

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-14  
**Estado:** ✅ COMPLETADO