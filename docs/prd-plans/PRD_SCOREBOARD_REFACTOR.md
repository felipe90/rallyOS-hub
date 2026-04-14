# PRD - Scoreboard Routes Refactor

## Overview

- **Proyecto**: rallyOS-hub
- **Feature**: Separar rutas de árbitro y espectador para el scoreboard
- **Prioridad**: P0 (high)
- **RFC**: N/A

## Problema actual

El scoreboard actual tiene lógica conflenciada para mostrar controles de árbitro vs espectador:

```typescript
// ScoreboardPage.tsx - lógica confusa
const { isReferee } = useAuth()  // Depende de localStorage 'role'
const canReferee = isReferee || (isOwner && hasTablePin)  // Condicional compleja

<ScoreboardActions isReferee={canReferee} />
<Sidebar isReferee={canReferee} />
```

Problemas:
1. **Role ambiguo**: 'owner' entra con PIN de mesa → ¿es árbitro o espectador?
2. **URL no refleja**: /scoreboard/123 se ve igual que /scoreboard/123 como espectador
3. **Debugging difícil**: No sabés qué rol tiene el usuario por la URL
4. **Testing complejo**: Múltiples casos de borde

## Solución propuesta

Separar rutas claramente:

| Ruta | Vista | Descripción |
|------|-------|-----------|
| `/scoreboard/:id` | Redirect | Redirect a /view/:id (default) |
| `/scoreboard/:id/referee` | Árbitro | Full controles |
| `/scoreboard/:id/view` | Espectador | Solo spectator |

### Beneficios
1. **URL clara**: /referee = controls, /view = no controls
2. **Sin lógica condicional**: cada ruta.renderiza su vista
3. **Fácil permisos**: router decide qué mostrar
4. **Testing simple**: 3 casos de ruta, no condicionales

---

## Requisitos funcionales

### RF-01: Ruta principal redirect
- `/scoreboard/:id` redirige a `/scoreboard/:id/view`
- Mantiene backwards compatibility

### RF-02: Ruta árbitro
- `/scoreboard/:id/referee` muestra controles completos
- Requiere autenticación con PIN de mesa (existing)
- Botones: +1, +2, +3, undo, reset, etc.

### RF-03: Ruta espectador
- `/scoreboard/:id/view` muestra solo score
- No requiere PIN (úblico)
- Solo display de score y tiempo
- Botón volver al dashboard

### RF-04: Autenticación
- Referee se autentica con PIN de mesa (existing flow)
- URL /referee muestra PIN input si no autenticado
- View es siempre accessible (público)

---

## User stories

| ID | Story | Criterio de aceptación |
|----|-------|----------------------|
| US-01 | Como Owner, quiero clickear en mesa e ir a /referee/:id | Entra directo a vista árbitro con controles |
| US-02 | Como espectador, quiero acceder a /view/:id | Ve solo score, sin controles |
| US-03 | Como usuario, quiero /scoreboard/:id redirect a view | Redirect automático a vista pública |
| US-04 | Como Owner, quiero PIN input si accedo a /referee sin PIN | Pide PIN antes de mostrar controles |

---

## Scope

### In scope
- [ ] Crear nuevo componente RefereePage (o reuse ScoreboardPage con prop)
- [ ] Crear nuevo componente SpectatorPage (o reuse ScoreboardPage con prop)
- [ ] Agregar rutas en App.tsx
- [ ] Actualizar Dashboard click → /referee/:id para Owner
- [ ] Actualizar QR code → /referee/:id (para que scannen y vayan directo a arbitrator)
- [ ] Cleanup ScoreboardPage (simplificar o eliminar lógica condicional)
- [ ] Actualizar links/wiring en otros lugares

### Out of scope
- Cambios en backend (socket events ya existen)
- Nuevas features de scoreboard
- Tests (se pueden agregar después)

---

## Arquitectura propuesta

### Rutas (App.tsx)

```typescript
// Routes
<Route path="/scoreboard/:id" redirectTo="/scoreboard/:id/view" />
<Route path="/scoreboard/:id/referee" element={<ScoreboardPage mode="referee" />} />
<Route path="/scoreboard/:id/view" element={<ScoreboardPage mode="view" />} />
```

### Componentes

```
/pages/ScoreboardPage/
  ScoreboardPage.tsx    (acepta prop mode: 'referee' | 'view')
  RefereeView.tsx       (nuevo - para modo referee)
  SpectatorView.tsx     (nuevo - para modo view)
```

### Flow

```
Dashboard click → navigate(/scoreboard/:id/referee) 
                  → ScoreboardPage mode="referee"
                  → Muestra RefereeView
                  → Si no autenticado → PIN input → SET_REF
                  → Listo!

QR scan → /scoreboard/:id/referee?ePin=encrypted
                  → ScoreboardPage mode="referee"  
                  → Auto-authenticate con ePin
                  → Listo!
```

---

## Cambios por archivo

### App.tsx / Router
- Agregar ruta `/scoreboard/:id/referee`
- Agregar ruta `/scoreboard/:id/view`
- Actualizar redirect de `/scoreboard/:id`

### DashboardPage (o DashboardGrid)
-Cambiar navigate a `/scoreboard/:id/referee`

### QRCodeImage
- Actualizar URL a `/scoreboard/:id/referee`

### ScoreboardPage (refactor)
- Aceptar prop `mode: 'referee' | 'view'`
- Renderizar según mode

### Links existentes
- Buscar otros lugares que linkeen a /scoreboard/:id y actualizar

---

## Alternativas consideradas

### Opción A: Rutas separadas (elegida)
- `/referee/:id` y `/view/:id`
- Pros: URLs claras, fácil testing
- Contras: Más archivos

### Opción B: Query param
- `/scoreboard/:id?mode=referee`
- Cons: URL fea, no shareable

### Opción C: Sub-rutas
- `/scoreboard/:id/control` y `/scoreboard/:id/spectator`
- Similar a A pero más largo

---

## Timeline estimado

- Setup rutas: **30 min**
- Actualizar Dashboard click: **15 min**
- Actualizar QR code: **15 min**
- Refactor ScoreboardPage: **1-2 horas**
- Cleanup y testing: **30 min**

**Total estimado**: **3-4 horas**

---

## Testing Strategy

### Unit Tests (REQUIRED)

Todos los cambios de código deben incluir tests unitarios:

| Area | Tests | Coverage Target |
|------|-------|---------------|
| Routes | Tests de routing (cada ruta) | 100% |
| ScoreboardPage | Props parsing, mode selection | 100% |
| RefereeView | Acciones de referee | 100% |
| SpectatorView | Display rendering | 100% |
| OwnerDashboard | Crear/limpiar mesa | 100% |
| RefereeDashboard | Join flow | 100% |
| useScoreboardAuth | Auth hook | 100% |

### Test Files Structure

```
/client/src/
  /pages/ScoreboardPage/
    ScoreboardPage.test.tsx    (ya existe - actualizar)
    RefereeView.test.tsx       (NUEVO)
    SpectatorView.test.tsx      (NUEVO)
  /hooks/
    useScoreboardAuth.test.ts (NUEVO)
  /pages/DashboardPage/
    OwnerDashboard.test.tsx  (NUEVO)
    RefereeDashboard.test.tsx  (NUEVO)
```

### Test Cases

#### Routes Tests
```typescript
// scoreboard routes
test('/scoreboard/:id redirects to /view')
test('/scoreboard/:id/referee shows referee view')
test('/scoreboard/:id/view shows spectator view')

// dashboard routes  
test('/dashboard redirects to /owner')
test('/dashboard/owner shows owner view')
test('/dashboard/referee shows referee view')
```

#### Scoreboard Tests
```typescript
// RefereeView
test('shows +1 +2 +3 buttons when mode=referee')
test('calls onAddScore with correct params')
test('shows undo button')
test('calls onUndo')

// SpectatorView
test('hides all control buttons')
test('displays score correctly')
test('shows no PIN input')
```

#### Dashboard Tests
```typescript
// OwnerDashboard
test('shows create table button')
test('shows PIN for each table')
test('shows clean table button')

// RefereeDashboard  
test('hides create table button')
test('hides PIN display')
test('shows join with PIN modal')
```

---

## Parte 2: Dashboard Routes (Owner vs Referee)

### Problema similar

El Dashboard actual mezcla responsabilidades de Owner y Referee:
- Owner ve PINs, puede crear/limpiar mesas
- Referee también ve todo, debería solo unirse

### Solución propuesta

Igual patrón que scoreboard:

| Ruta | Vista | Funcionalidad |
|------|-------|-------------|
| `/dashboard` | → redirect a /owner (default) |
| `/dashboard/owner` | Owner | Full admin: crear, limpiar, ver PINs |
| `/dashboard/referee` | Referee | Join only: unirse con PIN |

### RF-05: Dashboard Owner
- Ver todas las mesas con PINs
- Crear nueva mesa
- Limpiar mesa (reset)
- Unirse a mesa como árbitro

### RF-06: Dashboard Referee
- Ver lista de mesas (sin PINs)
- Unirse a mesa con PIN
- No visible: crear mesa, limpiar mesa

### Reusable Components (DRY)

**Importante**: Al crear estas vistas, debemos identificar componentes reutilizables:

| Componente | Ubicación | Reusable en |
|-----------|----------|------------|
| TableCard | organisms | Owner + Referee dashboard |
| TableList | organisms | Owner + Referee dashboard |
| MetricCard | molecules | Owner + Referee dashboard |
| PinModal | molecules | Owner dashboard |
| CreateTableModal | molecules | Owner dashboard |

**Objetivo**: Extraer componentes existentes de DashboardPage a atoms/molecules/organisms para DRY.

---

## Checklist de implementación

- [ ] (P0) Crear rutas en App.tsx (referee, view)
- [ ] (P0) Actualizar Dashboard.navigate to /referee/:id
- [ ] (P0) Actualizar QRCodeURL a /referee/:id
- [ ] (P1) ScoreboardPage acepte prop mode
- [ ] (P1) Split UI en RefereeView / SpectatorView
- [ ] (P2) Cleanup código condicional
- [ ] (P2) Buscar y actualizar otros links

### Dashboard Routes

- [ ] (P1) Agregar ruta `/dashboard/owner` en App.tsx
- [ ] (P1) Agregar ruta `/dashboard/referee` en App.tsx
- [ ] (P1) Actualizar `/dashboard` redirect a /owner
- [ ] (P1) Crear OwnerDashboard component (extraer de existente)
- [ ] (P1) Crear RefereeDashboard component
- [ ] (P2) Identificar componentes reutilizables
- [ ] (P2) Mover TableCard a organisms (si no existe)
- [ ] (P2) Mover TableList a organisms (si no existe)

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-15  
**Estado:** TODO (PART 1: Scoreboard, PART 2: Dashboard)