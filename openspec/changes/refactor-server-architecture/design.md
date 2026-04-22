# Design: Refactor Server Architecture

## Phase 1: Extract Services

### 1.1 `services/table/TableRepository.ts`

**Responsibility:** Table CRUD operations.

```typescript
export class TableRepository {
  private tables: Map<string, Table> = new Map();

  create(table: Table): Table
  get(tableId: string): Table | undefined
  delete(tableId: string): boolean
  getAll(): Table[]
  getNextTableNumber(): number
}
```

### 1.2 `services/table/PlayerService.ts`

**Responsibility:** Player join/leave/referee management.

```typescript
export class PlayerService {
  joinTable(table: Table, socketId: string, name: string, pin?: string): boolean
  leaveTable(table: Table, socketId: string): void
  setReferee(table: Table, socketId: string, pin: string): boolean
  isReferee(table: Table, socketId: string): boolean
  getRefereeSocketId(table: Table): string | null
}
```

### 1.3 `services/table/MatchOrchestrator.ts`

**Responsibility:** Match start/configure/reset.

```typescript
export class MatchOrchestrator {
  configureMatch(table: Table, config: MatchConfig): void
  startMatch(table: Table, config?: Partial<MatchConfig>): MatchStateExtended | null
  recordPoint(table: Table, player: Player): MatchStateExtended | null
  subtractPoint(table: Table, player: Player): MatchStateExtended | null
  undoLast(table: Table): MatchStateExtended | null
  setServer(table: Table, player: Player): MatchStateExtended | null
  swapSides(table: Table): MatchStateExtended | null
  resetTable(table: Table, config?: MatchConfig): void
}
```

### 1.4 `services/table/TableFormatter.ts`

**Responsibility:** Transform Table to TableInfo.

```typescript
export class TableFormatter {
  toPublicInfo(table: Table): TableInfo
  toInfoWithPin(table: Table): TableInfo & { pin: string }
  toPublicList(tables: Table[]): TableInfo[]
  toListWithPins(tables: Table[]): (TableInfo & { pin: string })[]
}
```

### 1.5 `services/security/PinService.ts`

**Responsibility:** PIN generation and validation.

```typescript
export class PinService {
  generatePin(): string
  validatePin(table: Table, pin: string): boolean
}
```

### 1.6 `services/security/RateLimiter.ts`

**Responsibility:** Rate limiting for socket events.

```typescript
export class RateLimiter {
  isRateLimited(key: string): boolean
  getAttempts(key: string): number
}
```

### 1.7 `services/qr/QRService.ts`

**Responsibility:** QR data generation.

```typescript
export class QRService {
  generateQRData(table: Table, hubConfig: HubConfig): QRData
}
```

---

## Phase 2: Refactor TableManager

**Before:** 449 lines, does everything
**After:** ~150 lines, composes services

```typescript
export class TableManager {
  private repository: TableRepository
  private playerService: PlayerService
  private matchOrchestrator: MatchOrchestrator
  private formatter: TableFormatter
  private pinService: PinService
  private qrService: QRService

  // Same public interface, delegates to services
}
```

---

## Phase 3: Update SocketHandlerBase

**Before:** Rate limiting inline
**After:** Uses RateLimiter service

```typescript
export abstract class SocketHandlerBase {
  protected rateLimiter: RateLimiter
  // ...
}
```

---

## Testing Strategy

| Layer | Tests |
|-------|-------|
| Services | Unit tests (Jest) |
| TableManager | Integration tests with services |
| Handlers | Existing tests should still pass |

---

## File Changes

### New Files (~10)
- `services/table/TableRepository.ts`
- `services/table/PlayerService.ts`
- `services/table/MatchOrchestrator.ts`
- `services/table/TableFormatter.ts`
- `services/security/PinService.ts`
- `services/security/RateLimiter.ts`
- `services/qr/QRService.ts`
- Tests for all services

### Modified Files (~3)
- `tableManager.ts` — Refactored to compose services
- `handlers/SocketHandlerBase.ts` — Use RateLimiter
- `handlers/index.ts` — Export services if needed
