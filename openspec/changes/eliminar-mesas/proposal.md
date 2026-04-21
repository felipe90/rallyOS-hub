# Proposal: eliminar-mesas

## Intent

Agregar la funcionalidad de eliminar mesas al cliente web, resolviendo la necesidad de los owners de remover mesas obsoletas. Además, crear un componente reutilizable de confirmación que pueda usarse en toda la aplicación.

## Scope

### In Scope
- Agregar botón "Eliminar Mesa" en el cliente con PIN de la mesa (no owner PIN)
- Crear componente `ConfirmDialog` reutilizable con niveles de gravedad (info, warning, success, error)
- Handler en `OwnerDashboardPage` que emita `DELETE_TABLE` con `{ tableId, pin: tablePin }`

### Out of Scope
- Modificaciones al servidor (ya existe DELETE_TABLE)
- Cambios en el comportamiento de "Limpiar Mesa" (regenerate PIN)

## Capabilities

### New Capabilities
- `mesa-deletion`: Botón de eliminar mesa en TableStatusChip con confirmación
- `confirm-dialog`: Componente reutilizable con severity levels

### Modified Capabilities
- Ninguno a nivel de spec

## Approach

1. **ConfirmDialog reusable**: Crear en `src/components/ConfirmDialog.tsx` con props `isOpen`, `onConfirm`, `onCancel`, `title`, `message`, `severity` (info|warning|success|error). Cada severity define colores e iconos distintos.

2. **Delete Mesa**: En `TableStatusChip`, agregar botón de eliminar que abra el ConfirmDialog. En confirmación, emitir `DELETE_TABLE` con el PIN guardado de esa mesa (no owner PIN).

3. **Risks**: El server YA requiere table's own PIN (no owner PIN). Documentar claramente en UI que se necesita "el PIN de la mesa" no el PIN de owner.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/ConfirmDialog.tsx` | New | Componente reusable de confirmación |
| `src/components/TableStatusChip.tsx` | Modified | Agregar botón eliminar |
| `src/pages/OwnerDashboardPage.tsx` | Modified | Handler DELETE_TABLE |
| `shared/events.ts` | Existing | DELETE_TABLE client event |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Confusión PIN mesa vs PIN owner | Med | UI clara: "PIN de esta mesa" no "PIN de owner" |
| ConfirmDialog genérico usado incorrectamente | Low | Documentar props requeridas |

## Rollback Plan

- Revertir cambios en `TableStatusChip.tsx` y `OwnerDashboardPage.tsx`
- Eliminar `ConfirmDialog.tsx` si no hay otros usuarios
- Mantener eventos en `shared/events.ts` (otros cambios pueden usarlos)

## Dependencies

- Servidor ya implementa DELETE_TABLE (sin cambios needed)
- TableStatusChip ya existe
- PIN de mesa ya se guarda localmente

## Success Criteria

- [ ] Owner puede eliminar una mesa con su PIN
- [ ] ConfirmDialog muestra iconos/colores según severity
- [ ] UI indica claramente "PIN de la mesa"
- [ ] ConfirmDialog reutilizable en otros contexts