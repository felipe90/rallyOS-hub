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

## Checklist de implementación

- [ ] (P0) Crear rutas en App.tsx (referee, view)
- [ ] (P0) Actualizar Dashboard.navigate to /referee/:id
- [ ] (P0) Actualizar QRCodeURL a /referee/:id
- [ ] (P1) ScoreboardPage acepte prop mode
- [ ] (P1) Split UI en RefereeView / SpectatorView
- [ ] (P2) Cleanup código condicional
- [ ] (P2) Buscar y actualizar otros links

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-15  
**Estado:** TODO