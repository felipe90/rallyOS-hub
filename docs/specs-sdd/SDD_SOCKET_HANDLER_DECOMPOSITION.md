# SDD - Descomposición de SocketHandler en 4 Handlers

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- Objetivos cubiertos:
  - **Meta 4:** `socketHandler.ts` descompuesto en al menos 4 handlers con tests unitarios por handler
  - RF-04 (cada handler tiene tests con mocks de socket y tableManager)
  - Criterio DoD: cada handler ≤200 líneas, cobertura ≥70%

## 2) Arquitectura actual (AS-IS)
### Componente: `server/src/socketHandler.ts` — 639 líneas, God Class

**Responsabilidades actuales (18+ eventos):**
1. **Lifecycle:** connection, disconnect, error
2. **Tables:** CREATE_TABLE, LIST_TABLES, GET_TABLES_WITH_PINS, JOIN_TABLE, LEAVE_TABLE, DELETE_TABLE
3. **Auth:** SET_REF, VERIFY_OWNER, REF_ROLE_CHECK
4. **Match:** CONFIGURE_MATCH, START_MATCH, RECORD_POINT, SUBTRACT_POINT, UNDO_LAST, SET_SERVER, RESET_TABLE
5. **Admin:** REGENERATE_PIN, REQUEST_TABLE_STATE, GET_RATE_LIMIT_STATUS
6. **Cross-cutting:** rate limiting (Map en memoria), toPublicTableInfo, getPublicTableList

### Estructura actual
```typescript
class SocketHandler {
  private io: Server;
  private tableManager: TableManager;
  private ownerPin: string;
  private rateLimitAttempts: Map<string, number[]>;

  constructor(io, tableManager, ownerPin) { ... }
  private setupListeners() { /* 18+ socket.on() aqui */ }
  private isRateLimited(key) { ... }
  private toPublicTableInfo(table) { ... }
  private getPublicTableList() { ... }
}
```

### Limitaciones actuales
- **639 líneas** en un solo archivo
- **0 tests unitarios** — imposible testear sin mockear toda la clase
- **Single Responsibility Violation** — sabe de tables, auth, match, admin, rate limiting
- **Mantenimiento difícil** — cada cambio afecta un archivo enorme con muchas responsabilidades

## 3) Arquitectura propuesta (TO-BE)
### 4 handlers especializados

```
server/src/
  handlers/
    TableEventHandler.ts     ← CREATE_TABLE, LIST_TABLES, GET_TABLES_WITH_PINS, JOIN_TABLE, LEAVE_TABLE, DELETE_TABLE
    MatchEventHandler.ts     ← CONFIGURE_MATCH, START_MATCH, RECORD_POINT, SUBTRACT_POINT, UNDO_LAST, SET_SERVER, RESET_TABLE
    AuthHandler.ts           ← SET_REF, VERIFY_OWNER
    AdminHandler.ts          ← REGENERATE_PIN, REQUEST_TABLE_STATE, GET_RATE_LIMIT_STATUS
  shared/
    SocketHandlerBase.ts     ← clase base con io, tableManager, rate limiting, helpers
  socketHandler.ts           ← orchestrador que instancia los 4 handlers
```

### Jerarquía
```
                    SocketHandlerBase (abstract)
                    /    |    |    \
              /       /     |     \          \
   TableEventHandler  MatchEventHandler  AuthHandler  AdminHandler
```

### SocketHandlerBase (compartido)
```typescript
abstract class SocketHandlerBase {
  protected io: Server;
  protected tableManager: TableManager;
  protected ownerPin: string;
  private rateLimitAttempts: Map<string, number[]>;
  protected readonly rateLimitWindowMs = 60_000;
  protected readonly rateLimitMaxAttempts = 5;

  constructor(io: Server, tableManager: TableManager, ownerPin: string) { ... }

  protected isRateLimited(key: string): boolean { ... }
  protected toPublicTableInfo(table: any): TableInfo { ... }
  protected getPublicTableList(): TableInfo[] { ... }
}
```

### SocketHandler (orchestrador)
```typescript
class SocketHandler {
  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    // Set up global listeners
    tableManager.onTableUpdate = (tableInfo) => {
      io.emit(TABLE_UPDATE, toPublicTableInfo(tableInfo));
      io.emit(TABLE_LIST, getPublicTableList());
    };
    tableManager.onMatchEvent = (tableId, event) => { ... };

    // Instanciar handlers
    new TableEventHandler(io, tableManager, ownerPin);
    new MatchEventHandler(io, tableManager, ownerPin);
    new AuthHandler(io, tableManager, ownerPin);
    new AdminHandler(io, tableManager, ownerPin);
  }
}
```

## 4) Diseño de datos y contratos
### 4.1 Contratos entre handlers y dependencies
Todos los handlers reciben las mismas 3 dependencias:
- `io: Server` — Socket.IO server instance
- `tableManager: TableManager` — gestión de mesas
- `ownerPin: string` — PIN del organizador

### 4.2 Eventos por handler

**TableEventHandler (6 eventos):**
| Evento | Input | Output | Error |
|--------|-------|--------|-------|
| CREATE_TABLE | `{ name? }` | TABLE_CREATED, REF_SET, QR_DATA, MATCH_UPDATE | - |
| LIST_TABLES | void | TABLE_LIST | - |
| GET_TABLES_WITH_PINS | `{ ownerPin? }` | TABLE_LIST_WITH_PINS | NOT_OWNER |
| JOIN_TABLE | `{ tableId, pin?, name?, role? }` | TABLE_JOINED, TABLE_UPDATE, MATCH_UPDATE | INVALID_PIN, TABLE_NOT_FOUND |
| LEAVE_TABLE | `{ tableId }` | PLAYER_LEFT | - |
| DELETE_TABLE | `{ tableId, pin }` | TABLE_DELETED, TABLE_LIST | INVALID_PIN, TABLE_NOT_FOUND, RATE_LIMITED |

**MatchEventHandler (7 eventos):**
| Evento | Input | Output | Error |
|--------|-------|--------|-------|
| CONFIGURE_MATCH | `{ tableId, playerNames?, format?, ptsPerSet?, handicap? }` | TABLE_UPDATE, MATCH_UPDATE | UNAUTHORIZED |
| START_MATCH | `{ tableId, pointsPerSet?, bestOf?, handicapA?, handicapB?, playerNameA?, playerNameB? }` | TABLE_UPDATE, MATCH_UPDATE | UNAUTHORIZED |
| RECORD_POINT | `{ tableId, player }` | MATCH_UPDATE | UNAUTHORIZED |
| SUBTRACT_POINT | `{ tableId, player }` | MATCH_UPDATE | UNAUTHORIZED |
| UNDO_LAST | `{ tableId }` | MATCH_UPDATE | UNAUTHORIZED |
| SET_SERVER | `{ tableId, player }` | MATCH_UPDATE | UNAUTHORIZED |
| RESET_TABLE | `{ tableId, config? }` | MATCH_UPDATE | UNAUTHORIZED |

**AuthHandler (2 eventos):**
| Evento | Input | Output | Error |
|--------|-------|--------|-------|
| SET_REF | `{ tableId, pin }` | REF_SET, TABLE_UPDATE | INVALID_PIN, REF_ALREADY_ACTIVE, RATE_LIMITED |
| VERIFY_OWNER | `{ pin }` | OWNER_VERIFIED | INVALID_OWNER_PIN |

**AdminHandler (3 eventos):**
| Evento | Input | Output | Error |
|--------|-------|--------|-------|
| REGENERATE_PIN | `{ tableId, pin? }` | PIN_REGENERATED, QR_DATA, REF_REVOKED | UNAUTHORIZED, TABLE_NOT_FOUND |
| REQUEST_TABLE_STATE | `{ tableId }` | MATCH_UPDATE | TABLE_NOT_FOUND |
| GET_RATE_LIMIT_STATUS | `{ tableId? }` | RATE_LIMIT_STATUS | - |

## 5) Reglas de negocio
- **RB-01:** Cada handler es testeable independientemente con mocks de `io` y `tableManager`.
- **RB-02:** Rate limiting se comparte via la clase base — no se duplica lógica.
- **RB-03:** Los helpers `toPublicTableInfo` y `getPublicTableList` se comparten via la clase base.
- **RB-04:** El constructor de `SocketHandler` solo orquesta — la lógica de cada evento vive en su handler específico.
- **RB-05:** Cada handler registra sus propios `socket.on()` listeners en su constructor.

## 6) Seguridad y validaciones
- **Sin cambios en validación:** Cada handler sigue usando `validateSocketPayload` igual que antes.
- **Rate limiting:** Se mantiene en la clase base — compartido pero no duplicado.
- **PINs:** No se exponen en payloads públicos — `toPublicTableInfo` sigue en la clase base.
- **Autorización:** MatchEventHandler verifica `isReferee` en cada evento. AuthHandler verifica owner PIN. AdminHandler verifica owner autorización.

## 7) Observabilidad
### Logs esperados
- Los logs existentes se mantienen — solo cambian de archivo.
- Cada handler puede tener su propio logger contextual: `logger.child({ handler: 'TableEventHandler' })`.

### Métricas
- Sin métricas nuevas.
- Si se desea: contar eventos por handler para identificar hot paths.

## 8) Plan de implementacion tecnica
### Fase 1: Crear base y estructura
1. Crear `server/src/handlers/SocketHandlerBase.ts`
2. Extraer `isRateLimited`, `toPublicTableInfo`, `getPublicTableList` a la base
3. Crear directorio `server/src/handlers/`

### Fase 2: Extraer TableEventHandler
1. Crear `server/src/handlers/TableEventHandler.ts`
2. Mover 6 eventos de `socketHandler.ts` al nuevo handler
3. El handler extiende `SocketHandlerBase`
4. Escribir tests unitarios para TableEventHandler (mock socket, mock tableManager)

### Fase 3: Extraer MatchEventHandler
1. Crear `server/src/handlers/MatchEventHandler.ts`
2. Mover 7 eventos de `socketHandler.ts` al nuevo handler
3. Escribir tests unitarios

### Fase 4: Extraer AuthHandler
1. Crear `server/src/handlers/AuthHandler.ts`
2. Mover 2 eventos de `socketHandler.ts` al nuevo handler
3. Escribir tests unitarios

### Fase 5: Extraer AdminHandler
1. Crear `server/src/handlers/AdminHandler.ts`
2. Mover 3 eventos de `socketHandler.ts` al nuevo handler
3. Escribir tests unitarios

### Fase 6: Refactorizar SocketHandler como orchestrador
1. Reemplazar `socketHandler.ts` con versión que solo instancia los 4 handlers
2. Mantener `onTableUpdate` y `onMatchEvent` listeners globales en el constructor
3. Verificar que `npm run build` pasa
4. Verificar que `npm run test` pasa (tests de humo existentes)

## 9) Plan de migracion/compatibilidad
- **Sin breaking changes:** Los eventos de socket, inputs, outputs y errores son idénticos.
- **Sin feature flags:** Son refactor interno.
- **Rollback:** Revertir los commits. El `socketHandler.ts` original se mantiene en git history.
- **Compatibilidad:** El cliente no cambia — los eventos de socket son los mismos.

## 10) Plan de pruebas
### Tests de humo (pre-descomposición)
1. Escribir tests básicos que conecten socket, emitan eventos, y verifiquen respuestas
2. Estos tests se ejecutan contra el `socketHandler.ts` actual ANTES de descomponer
3. Si pasan antes y fallan después, la descomposición rompió algo

### Unit tests por handler (post-descomposición)
#### TableEventHandler.spec.ts
- CREATE_TABLE crea mesa, emite TABLE_CREATED, une al creador como referee
- LIST_TABLES emite lista pública
- GET_TABLES_WITH_PINS con owner PIN correcto → devuelve con PINs
- GET_TABLES_WITH_PINS sin owner PIN → error NOT_OWNER
- JOIN_TABLE con PIN correcto → TABLE_JOINED
- JOIN_TABLE con PIN incorrecto → INVALID_PIN
- LEAVE_TABLE → PLAYER_LEFT
- DELETE_TABLE con PIN correcto → TABLE_DELETED
- DELETE_TABLE rate limited → RATE_LIMITED

#### MatchEventHandler.spec.ts
- CONFIGURE_MATCH como referee → configura, emite TABLE_UPDATE
- CONFIGURE_MATCH como no-referee → UNAUTHORIZED
- START_MATCH como referee → inicia, emite MATCH_UPDATE
- RECORD_POINT como referee → punto, emite MATCH_UPDATE
- RECORD_POINT como no-referee → UNAUTHORIZED
- UNDO_LAST → undo, emite MATCH_UPDATE
- SET_SERVER → servidor actualizado
- RESET_TABLE → reset, emite MATCH_UPDATE

#### AuthHandler.spec.ts
- SET_REF con PIN correcto → REF_SET
- SET_REF con PIN incorrecto → INVALID_PIN
- SET_REF con ref existente → REF_ALREADY_ACTIVE
- SET_REF con owner PIN → fuerza takeover
- VERIFY_OWNER con PIN correcto → OWNER_VERIFIED
- VERIFY_OWNER con PIN incorrecto → INVALID_OWNER_PIN

#### AdminHandler.spec.ts
- REGENERATE_PIN como owner → nuevo PIN, REF_REVOKED
- REGENERATE_PIN sin auth → UNAUTHORIZED
- REQUEST_TABLE_STATE → MATCH_UPDATE
- GET_RATE_LIMIT_STATUS → status

### E2E/smoke
- Tests E2E existentes (`security.spec.ts`, `match-logic.spec.ts`) deben seguir pasando
- `npm run test` del server pasa con 0 fallos

## 11) Riesgos tecnicos y trade-offs
- **Riesgo 1:** Extraer eventos puede romper referencias a métodos privados del SocketHandler original -> **Mitigación:** Los tests de humo pre-descomposición detectan esto. Cualquier referencia rota se repara durante la extracción.
- **Riesgo 2:** La clase base puede volverse un "god class pequeño" -> **Mitigación:** Solo métodos verdaderamente compartidos van en la base (rate limiting, helpers de conversión). Si un método solo lo usa un handler, se queda en ese handler.
- **Trade-off:** 5 archivos nuevos vs 1 archivo gigante -> **Justificación:** 5 archivos de ~80-150 líneas cada uno es más mantenible que 1 de 639. Cada uno es testeable independientemente. El costo de navegar entre archivos es marginal vs el beneficio de tests granulares.

## 12) Criterios de aceptacion tecnicos
- [ ] `server/src/handlers/SocketHandlerBase.ts` existe con rate limiting y helpers
- [ ] `server/src/handlers/TableEventHandler.ts` existe con 6 eventos, ≤200 líneas
- [ ] `server/src/handlers/MatchEventHandler.ts` existe con 7 eventos, ≤200 líneas
- [ ] `server/src/handlers/AuthHandler.ts` existe con 2 eventos, ≤200 líneas
- [ ] `server/src/handlers/AdminHandler.ts` existe con 3 eventos, ≤200 líneas
- [ ] `server/src/socketHandler.ts` es solo un orchestrador que instancia los 4 handlers
- [ ] Tests unitarios: TableEventHandler ≥70% cobertura
- [ ] Tests unitarios: MatchEventHandler ≥70% cobertura
- [ ] Tests unitarios: AuthHandler ≥70% cobertura
- [ ] Tests unitarios: AdminHandler ≥70% cobertura
- [ ] `npm run test` del server pasa con 0 fallos
- [ ] Tests E2E existentes pasan sin modificaciones

## 13) Archivos impactados
### Nuevos
- `server/src/handlers/SocketHandlerBase.ts`
- `server/src/handlers/TableEventHandler.ts`
- `server/src/handlers/MatchEventHandler.ts`
- `server/src/handlers/AuthHandler.ts`
- `server/src/handlers/AdminHandler.ts`
- `server/tests/TableEventHandler.spec.ts`
- `server/tests/MatchEventHandler.spec.ts`
- `server/tests/AuthHandler.spec.ts`
- `server/tests/AdminHandler.spec.ts`

### Modificados
- `server/src/socketHandler.ts` — reducido a orchestrador (~50 líneas)

### Eliminados
- Ninguno (el archivo original se refactoriza, no se elimina)

---

**Estado:** Draft
**Owner tecnico:** Por definir
**Fecha:** 2026-04-14
**Version:** v0.1
