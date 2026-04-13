# SDD - Table PIN Authentication & QR Display

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/TABLE_PIN_AUTH_PRD.md`
- Objetivos cubiertos:
  - [x] Owner ve PIN de cada mesa
  - [x] Owner ve QR de cada mesa  
  - [x] Solo Owner crea mesas
  - [x] Click en mesa → pide PIN

## 2) Arquitectura actual (AS-IS)

### Componentes involucrados hoy
- **Server:**
  - `socketHandler.ts`: Maneja eventos socket, excluye PIN explícitamente en `toPublicTableInfo()`
  - `tableManager.ts`: Gestiona tablas, genera PIN, solo el creador es referee inicial
  - `matchEngine.ts`: Lógica del partido

- **Client:**
  - `DashboardPage.tsx`: Muestra grid de mesas, `handleTableClick` navega directamente
  - `DashboardGrid.tsx`: Renderiza TableStatusChip por mesa
  - `SocketContext`: Proveedor de socket, `createTable()`, `tables[]`
  - `useAuth`: Hook de autenticación, devuelve `isOwner | isReferee | isViewer`

### Flujo actual resumido
1. Owner o Referee hacen login en AuthPage
2. Van al Dashboard
3. Ven las mesas (sin PIN / sin QR)
4. Click en mesa → `navigate(/scoreboard/{tableId})` directo
5. Scoreboard intenta auth con PIN de localStorage o URL param

### Limitaciones actuales
- `TableInfo` no incluye `pin` (línea 470-472 socketHandler.ts: `const { pin: _pin, ...publicTable } = table`)
- No hay endpoint para que Owner obtenga los PINs
- Cualquiera puede entrar a cualquier mesa sin auth
- Referee también puede crear mesas (`canCreateTable = isOwner || isReferee`)

## 3) Arquitectura propuesta (TO-BE)

### Componentes nuevos/modificados
| Componente | Tipo | Descripción |
|-----------|------|-----------|
| `GET_TABLES_WITH_PINS` | Socket Event | Retorna tablas con PIN para Owner |
| `TableInfoWithPin` | Tipo | TableInfo + pin?: string |
| `PinModal` | Componente UI | Modal para pedir PIN al hacer click |
| `DashboardGrid` | Modificado | Muestra PIN+QR para Owner |
| `DashboardPage` | Modificado | Carga datos con pines si isOwner |

### Contratos entre módulos

```
[Owner]
   │
   ▼ GET_TABLES_WITH_PINS
[Server] ──────────────► { tables: TableInfoWithPin[] }
   │                             │
   ▼                            ▼
[DashboardPage] ◄── Context ─ [DashboardGrid]
   │                             │
   │                    Muestra PIN + QR
   │
Click mesa
   │
   ▼
[PinModal] ── SET_REF ──► [Server]
   │                       │
   │◄────── OK/ERROR ─────┘
   │
   ▼ navigate scoreboard
```

## 4) Diseño de datos y contratos

### 4.1 Modelos/Tipos

```typescript
// Nuevo tipo - solo para Owner
interface TableInfoWithPin extends TableInfo {
  pin?: string;  // Solo presente si request es Owner
}

// QR Code - ya existe pero no se usa en dashboard
interface QRData {
  hubSsid: string;
  hubIp: string;
  hubPort: number;
  tableId: string;
  tableName: string;
  pin: string;
  url: string;
}
```

### 4.2 Socket Events

| Evento | Dirección | Input | Output | Errores |
|--------|----------|-------|-------|--------|--------|
| `GET_TABLES_WITH_PINS` | C→S | `{}` | `{ tables: TableInfoWithPin[] }` | `NOT_OWNER` |
| `SET_REF` | C→S | `{ tableId, pin }` | `{ success: true }` | `INVALID_PIN`, `REF_ALREADY_ACTIVE` |

## 5) Reglas de negocio

- **RN-01**: Solo Owner puede solicitar mesas con PINs
- **RN-02**: El PIN se muestra siempre visible en UI para Owner
- **RN-03**: El QR se genera/calcula en frontend (no esperar del server para no agregar carga)
- **RN-04**: Solo Owner puede crear mesas (cambiar `canCreateTable = isOwner`)
- **RN-05**: Al hacer click en mesa, siempre abre PinModal ( Owner también)
- **RN-06**: Modal permite reintento ilimitado hasta PIN correcto o Cancelar

## 6) Seguridad y validaciones

- **Autorización**: `GET_TABLES_WITH_PINS` debe verificar `socket.data.role === 'owner'`
- **Validación de payloads**: `tableId` debe existir, `pin` debe ser exactamente 4 dígitos
- **Manejo de secretos/logs**: NO loguear el PIN, no incluir en URLs visibles sin encriptar

## 7) Observabilidad

- **Logs esperados**:
  - `[Socket] Owner requested tables with pins`
  - `[Socket] PIN validation for table {id}: success/failed`
- **Métricas recomendadas**: 
  - `pin_validation_attempts_total`
  - `pin_validation_failures_total`

## 8) Plan de implementación técnica

### Fase 1: Backend
1. Agregar tipo `TableInfoWithPin` en `shared/types.ts`
2. Agregar socket `GET_TABLES_WITH_PINS` en `socketHandler.ts`
3. Agregar método `getAllTablesWithPins()` en `tableManager.ts`

### Fase 2: Frontend Owner Dashboard
1. Modificar `useSocketContext` para cargar diferentes datos según rol
2. Crear componente QR code (usar librería o canvas simple)
3. Modificar `TableStatusChip` para mostrar PIN+QR si es Owner
4. Modificar `canCreateTable = isOwner` en DashboardPage

### Fase 3: PIN Modal
1. Crear componente `PinModal` en `components/molecules/`
2. Modificar `handleTableClick` en DashboardPage para abrir modal
3. Validar PIN con `SET_REF` antes de navegar

### Fase 4: Scoreboard Integration
1. Guardar PIN en localStorage tras validación exitosa
2. Mantener flujo actual de auth en ScoreboardPage

## 9) Plan de migración/compatibilidad

- **Compatibilidad hacia atrás**: Usuarios viewers no observan cambios
- **Feature flags**: No es necesario, es un nuevo flujo
- **Estrategia de rollback**: Revertir cambios de Fase 2 y 3, funcionalidad vuelve a like-AS-IS

## 10) Plan de pruebas

- **Unit tests**:
  - `PinModal` rendering y validación
  - `canCreateTable` con diferentes roles
- **Integración**:
  - `GET_TABLES_WITH_PINS` retorna pines solo para Owner
  - `SET_REF` acepta/rechaza correctamente
- **E2E/smoke**:
  - Owner ve PIN+QR en dashboard
  - Click mesa → modal → PIN correcto → scoreboard
  - Click mesa → modal → PIN incorrecto → error
- **Casos borde**:
  - Owner sin mesas
  - PIN con leading zeros (ej: 0012)
  - Cancelar modal no navega

## 11) Riesgos técnicos y trade-offs

- **Riesgo:** PIN visible en memoria → **Mitigación:** Solo para Owner, no es persistente en disco
- **Trade-off:** Nueva query socket vs复用 **Justificación:** Más limpio crear endpoint específico para no contaminar el existente

## 12) Criterios de aceptación técnicos

- [ ] `GET_TABLES_WITH_PINS` retorna tablas con `pin` solo si es Owner
- [ ] Owner ve PIN de 4 dígitos en cada card de mesa
- [ ] Owner ve código QR escaneable en cada card de mesa
- [ ] Solo Owner tiene botón "Nueva Mesa"
- [ ] Click en mesa abre PinModal
- [ ] PIN correcto + Enter navega al scoreboard
- [ ] PIN incorrecto muestra error
- [ ] Botón Cancelar cierra modal sin navegar
- [ ] Scoreboard se autentica automáticamente con PIN

## 13) Archivos impactados

- `server/src/socketHandler.ts` - nuevo evento
- `server/src/tableManager.ts` - nuevo método
- `shared/types.ts` - nuevo tipo
- `client/src/pages/DashboardPage.tsx` - cambio flujo
- `client/src/components/organisms/DashboardGrid.tsx` - PIN+QR display
- `client/src/components/molecules/PinModal.tsx` - nuevo componente
- `client/src/hooks/useAuth.ts` - canCreateTable

---

**Estado:** Draft  
**Owner técnico:** Raiken  
**Fecha:** 2026-04-10  
**Version:** v0.1