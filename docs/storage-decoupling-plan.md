# Plan: Desacoplar Storage del Dominio

> **Problema:** `courtManager.ts` (dominio) importa `StateStore` directamente desde infraestructura.
> Viola Dependency Inversion y tocarías 9 archivos de producción si cambias de JSON a SQLite.

## Estado Actual

```
domain/courtManager.ts
  → import { StateStore, PersistedCourt } from '../services/store/types'
  → autoSave() llama a stateStore.save() directamente
  → loadTournament() llama a stateStore.load() directamente

handlers/SocketHandler.ts
  → import { ClubConfigStore } from '../services/store/...'
  → clubConfigStore.load() en cada broadcast

routes/tournament.ts
  → import { StateStore } from '../services/store/...'
```

## Objetivo

```
domain/courtManager.ts         → solo depende de interfaces en domain/
services/store/StateStore.ts   → implementa esas interfaces
handlers/ y routes/            → reciben store por inyección, no por import directo
```

---

## Fase 1 — Extraer interfaces al dominio

**Qué:** Crear interfaces de puerto en `domain/ports/` para que el dominio defina el contrato.

```
server/src/domain/ports/
├── CourtRepository.ts      → save(courts), load(), clear(), archive()
├── ClubConfigRepository.ts → load(), save(config)
└── index.ts
```

**Archivos a crear:** 3
**Archivos a modificar:**

| Archivo | Cambio |
|---|---|
| `domain/courtManager.ts` | Cambiar `import StateStore` por `import CourtRepository`. `constructor` recibe `CourtRepository` en vez de `StateStore` |
| `domain/types.ts` | Agregar `CourtRepository` y `ClubConfigRepository` a re-exports si se necesita |
| `handlers/SocketHandler.ts` | Recibir `ClubConfigRepository` por constructor. Cambiar `clubConfigStore.load()` por `clubConfigRepo.load()` |
| `handlers/ClubAdminHandler.ts` | Ídem |
| `handlers/ClubPlayerHandler.ts` | Ídem |
| `routes/tournament.ts` | Recibir `CourtRepository` por parámetro de ruta/factory |
| `routes/export.ts` | Ídem |
| `services/store/StateStore.ts` | Implementar `CourtRepository` |
| `services/store/ClubConfigStore.ts` | Implementar `ClubConfigRepository` |
| `index.ts` | Wiring: instanciar stores, pasarlos como interfaces |

**Riesgo:** Bajo. Solo se mueven tipos, no lógica.

---

## Fase 2 — Extraer `autoSave()` de courtManager

**Qué:** `autoSave()` es lógica de infraestructura (persistencia) disfrazada de método de dominio. Se mueve a un adaptador.

**Estrategia:** Event-driven en vez de llamada directa.

```
En courtManager:
  - Cada cambio emite un evento 'court.changed'
  - Ya no llama a autoSave()

Nuevo archivo: services/store/PersistenceSubscriber.ts
  - Escucha 'court.changed'
  - Hace debounce (300ms) para evitar escribir en cada punto
  - Llama a CourtRepository.save() con el estado actualizado
```

**Archivos a crear:**

| Archivo | Propósito |
|---|---|
| `services/store/PersistenceSubscriber.ts` | Adaptador que escucha cambios del dominio y persiste con debounce |
| `services/store/PersistenceSubscriber.test.ts` | Tests |

**Archivos a modificar:**

| Archivo | Cambio |
|---|---|
| `domain/courtManager.ts` | Eliminar `autoSave()`, eliminar dependencia de `StateStore`. Emitir eventos via EventEmitter o callback |
| `index.ts` | Instanciar `PersistenceSubscriber`, suscribirlo al `courtManager` |
| `handlers/SocketHandler.ts` | Confirmar que no depende de `PersistenceSubscriber` (solo del repositorio) |

**Riesgo:** Medio. Cambia el momento en que se persiste. Con debounce se reduce I/O.

---

## Fase 3 — Inyección de dependencias explícita

**Qué:** Eliminar todos los `new StateStore()` o imports directos a stores. Todo entra por constructor o factory.

**Patrón actual:**
```typescript
// courtManager.ts
const store = new StateStore(fs); // ❌ NO: dominio creando infra
```

**Patrón deseado:**
```typescript
// index.ts (composition root)
const courtRepo: CourtRepository = new StateStore(realFs);
const cm = new CourtManager(courtRepo, ...);
```

**Archivos a revisar:**

| Archivo | Riesgo |
|---|---|
| `index.ts` | Composition root — se vuelve más denso pero es el punto único de wiring |
| `handlers/*.ts` | Bajo — ya reciben dependencias externas |
| `routes/tournament.ts` | Medio — necesita factory function que reciba repos |
| `routes/export.ts` | Medio |

---

## Orden de implementación

```
Fase 1 → Fase 2 → Fase 3
   1         2         3
```

Cada fase es desplegable independientemente. No se rompe nada intermedio.

---

## Lo que NO cambia

- `matchEngine.ts` — ya está limpio, ni tocarlo
- `shared/types.ts` — el wire format es independiente del storage
- Tests existentes — las interfaces son las mismas, solo se mueven

## Lo que ganamos

| Antes | Después |
|---|---|
| `courtManager` sabe que existe JSON | `courtManager` solo sabe que existe un `CourtRepository` |
| Cambiar storage = tocar 9 archivos | Cambiar storage = 1 archivo nuevo + wiring |
| `autoSave()` bloquea el event loop | `PersistenceSubscriber` con debounce |
| Dependencias ocultas en imports | Dependencias explícitas en constructores |
