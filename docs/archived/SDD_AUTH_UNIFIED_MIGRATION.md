# SDD - Auth Unificado: Migrar de useAuth() a AuthContext

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/PRD_TECHNICAL_DEBT_RESOLUTION.md`
- Objetivos cubiertos:
  - **Meta 3:** Sistema de auth unificado — `useAuth()` eliminado, `AuthContext` como única fuente de verdad
  - RF-03 (AuthProvider en App.tsx, páginas usan contexto reactivo)
  - Criterio DoD: App.tsx incluye AuthProvider, ningún archivo usa useAuth()

## 2) Arquitectura actual (AS-IS)
### Dos sistemas de auth coexistentes

**Sistema A — `useAuth()` (hook de localStorage, NO reactivo):**
- `client/src/hooks/useAuth.ts` — lee `localStorage` directamente en cada llamada
- Funciones: `login(role, tableId)`, `logout()`, `setOwner(ownerPin)`
- Retorna: `{ role, tableId, ownerPin, isReferee, isViewer, isOwner, isAuthenticated }`
- **Problema:** No es reactivo. Si un componente llama `login()`, otros componentes NO se re-renderizan.

**Sistema B — `AuthContext` (contexto de React, reactivo):**
- `client/src/contexts/AuthContext/` — AuthProvider con `useState`, useAuthContext hook
- Define `UserRole = 'referee' | 'viewer' | null`
- **Problema:** No está en el árbol de App.tsx. Orphaned — nadie lo usa.

### Quién usa qué
- **TODAS las páginas** usan `useAuth()` (Sistema A, no reactivo)
- **NINGUNA página** usa `AuthContext` (Sistema B, reactivo pero huérfano)
- `App.tsx` envuelve con `SocketProvider` pero **NO** con `AuthProvider`

### Limitaciones actuales
- **Estado no sincronizado:** Dos componentes pueden tener valores diferentes de `role` si uno llama `login()` y el otro no re-renderiza.
- **Tipos inconsistentes:** `useAuth()` soporta role `'owner'`, `AuthContext` solo `'referee' | 'viewer' | null`.
- **localStorage como fuente primaria:** No hay estado en memoria. Cada lectura es un `localStorage.getItem()`.
- `localStorage` persiste `role`, `tableId`, `ownerPin`, `tablePin` sin encriptación.

## 3) Arquitectura propuesta (TO-BE)
### Un solo sistema: AuthContext reactivo

```
client/src/
  App.tsx                    <-- ENVUELVE con AuthProvider + SocketProvider
  contexts/
    AuthContext/
      AuthContext.tsx        <-- MODIFICADO: agrega role 'owner', ownerPin
      AuthContext.types.ts   <-- MODIFICADO: agrega 'owner' a UserRole
  hooks/
    useAuth.ts               <-- ELIMINAR (o deprecar con warning)
  pages/
    AuthPage.tsx             <-- MODIFICADO: usa useAuthContext()
    DashboardPage.tsx        <-- MODIFICADO: usa useAuthContext()
    ScoreboardPage.tsx       <-- MODIFICADO: usa useAuthContext()
    WaitingRoomPage.tsx      <-- MODIFICADO: usa useAuthContext()
    HistoryViewPage.tsx      <-- MODIFICADO: usa useAuthContext()
```

### AuthContext como SSOT
- `AuthProvider` inicializa estado desde `localStorage` al montar (hidratación)
- `login()`, `logout()`, `setOwner()` actualizan estado con `useState` (reactivo) + persisten en `localStorage` (backup)
- `useAuthContext()` retorna el estado reactivo
- Todos los componentes usan `useAuthContext()`

### Flujo de autenticación
```
┌─────────────────────────────────────────────┐
│                 App.tsx                      │
│  <AuthProvider>                              │
│    <SocketProvider>                          │
│      <AppRoutes />                           │
│    </SocketProvider>                         │
│  </AuthProvider>                             │
└─────────────────────────────────────────────┘
        │
        ├── AuthPage: login() → actualiza estado → re-renderiza TODOS los componentes
        ├── DashboardPage: isOwner, isReferee → re-renderiza reactivamente
        ├── ScoreboardPage: role, tableId → re-renderiza reactivamente
        └── WaitingRoomPage: role, tableId → re-renderiza reactivamente
```

## 4) Diseño de datos y contratos
### 4.1 AuthContext actualizado
```typescript
// AuthContext.types.ts
export type UserRole = 'owner' | 'referee' | 'viewer' | null;

export interface AuthContextType {
  role: UserRole;
  tableId: string | null;
  ownerPin: string | null;
  tablePin: string | null;
  login: (role: UserRole, tableId?: string) => void;
  logout: () => void;
  setOwner: (pin: string) => void;
  setTablePin: (pin: string) => void;
  isReferee: boolean;
  isViewer: boolean;
  isOwner: boolean;
  isAuthenticated: boolean;
}
```

### 4.2 AuthProvider con hidratación
```typescript
// AuthContext.tsx
function AuthProvider({ children }: { children: React.ReactNode }) {
  // Hidratar desde localStorage al montar
  const [state, setState] = useState<AuthState>(() => ({
    role: (localStorage.getItem('role') as UserRole) || null,
    tableId: localStorage.getItem('tableId') || null,
    ownerPin: localStorage.getItem('ownerPin') || null,
    tablePin: localStorage.getItem('tablePin') || null,
  }));

  // login, logout, setOwner actualizan estado Y persisten
  const login = useCallback((role: UserRole, tableId?: string) => {
    setState(prev => ({ ...prev, role, tableId: tableId || prev.tableId }));
    localStorage.setItem('role', role);
    if (tableId) localStorage.setItem('tableId', tableId);
  }, []);

  // ... similar para logout, setOwner, setTablePin
}
```

### 4.3 Sin cambios en API/eventos de servidor
Este SDD es puramente cliente. No modifica ningún endpoint, evento de socket, o contrato con el server.

## 5) Reglas de negocio
- **RB-01:** El estado de auth es reactivo. Cambios en un componente se reflejan en todos los demás.
- **RB-02:** `localStorage` se usa como persistencia (backup para recargas de página), NO como fuente de estado runtime.
- **RB-03:** Roles soportados: `'owner'`, `'referee'`, `'viewer'`. `null` = no autenticado.
- **RB-04:** `PrivateRoute` verifica `isAuthenticated` del contexto reactivo.
- **RB-05:** `logout()` limpia estado en memoria Y en localStorage.

## 6) Seguridad y validaciones
- **localStorage:** Se mantiene como persistencia. No se encripta (fuera de scope de este SDD). El riesgo es aceptable para una app LAN.
- **Owner PIN:** Se almacena en `localStorage` como antes. Sin cambio en seguridad.
- **Sin nuevos vectores:** No se agregan endpoints ni se modifica la superficie de ataque.
- **Validación:** Las funciones `login()`, `setOwner()` pueden validar inputs antes de actualizar estado (fuera de scope, pero recomendado).

## 7) Observabilidad
### Sin logs nuevos
Los cambios son internos al cliente. No se agregan logs de servidor.

### Debug en desarrollo
- `useAuthContext()` puede loguear en desarrollo cuando el estado cambia (solo dev mode):
```typescript
useEffect(() => {
  if (import.meta.env.DEV) {
    console.log('[AuthContext] State updated:', state);
  }
}, [state]);
```

## 8) Plan de implementacion tecnica
### Fase 1: AuthContext updates
1. Actualizar `AuthContext.types.ts` — agregar `'owner'` a UserRole, agregar `ownerPin`, `tablePin` al tipo
2. Actualizar `AuthContext.tsx` — agregar hidratación desde localStorage, agregar `ownerPin` y `tablePin` al estado, agregar `setOwner` y `setTablePin`
3. Agregar `AuthProvider` a `App.tsx` envuelve toda la app
4. Exportar `useAuthContext` desde `contexts/AuthContext/index.ts`

### Fase 2: Migrar páginas
1. `AuthPage.tsx` — reemplazar `import { useAuth } from '@/hooks/useAuth'` por `import { useAuthContext } from '@/contexts/AuthContext'`
2. `DashboardPage.tsx` — mismo reemplazo
3. `ScoreboardPage.tsx` — mismo reemplazo
4. `WaitingRoomPage.tsx` — mismo reemplazo
5. `HistoryViewPage.tsx` — mismo reemplazo
6. Verificar que `PrivateRoute` ya usa `useAuthContext` (si no, migrar)

### Fase 3: Eliminar useAuth hook
1. Marcar `useAuth.ts` como deprecado (agregar warning si alguien lo importa)
2. Eliminar `useAuth.ts` después de verificar que nadie lo usa
3. Actualizar barrel exports si `useAuth` estaba exportado desde algún index

### Fase 4: Verificación
1. `npm run build` del cliente pasa
2. `npm run test` del cliente pasa
3. Verificar flujo completo: login → dashboard → scoreboard → logout → login

## 9) Plan de migracion/compatibilidad
- **Compatibilidad hacia atrás:** Durante la transición, `useAuth` puede coexistir con `useAuthContext` hasta que todas las páginas estén migradas.
- **Sin feature flags:** No se necesitan toggles.
- **Rollback:** Revertir los commits. `useAuth` sigue funcionando como antes.
- **Migración incremental:** Migrar página por página. Cada página migrada es un commit independiente.

## 10) Plan de pruebas
### Unit tests
- `AuthContext.test.tsx` (actualizar existente):
  - Hidratación desde localStorage al montar
  - `login()` actualiza estado Y persiste en localStorage
  - `logout()` limpia estado Y localStorage
  - `setOwner()` actualiza ownerPin
  - Role `'owner'` funciona correctamente
  - `isReferee`, `isViewer`, `isOwner`, `isAuthenticated` se calculan correctamente
  - **Test de reactividad:** Componente A llama `login()`, Componente B se re-renderiza con el nuevo estado

### Tests de páginas (actualizar existentes)
- `AuthPage.test.tsx` — verifica que usa `useAuthContext` en vez de `useAuth`
- `DashboardPage.test.tsx` — verifica que usa `useAuthContext`
- `ScoreboardPage.test.tsx` — verifica que usa `useAuthContext`
- `WaitingRoomPage.test.tsx` — verifica que usa `useAuthContext`
- `HistoryViewPage.test.tsx` — verifica que usa `useAuthContext`

### E2E/smoke
- `npm run test` del cliente pasa con 0 fallos
- Flujo manual: login como owner → crear mesa → login como referee → scoreboard → logout

### Casos borde
- localStorage vacío al cargar → estado inicial con `role: null`
- localStorage con datos corruptos → estado fallback seguro
- Recarga de página → estado se hidrata correctamente desde localStorage

## 11) Riesgos tecnicos y trade-offs
- **Riesgo 1:** Al migrar páginas, algún comportamiento sutil puede cambiar porque ahora el estado es reactivo (antes no lo era) -> **Mitigación:** Los tests existentes deben pasar después de la migración. Si un test falla, investigar si el test estaba pasando por suerte (sin reactividad) o si hay un bug real.
- **Riesgo 2:** `ownerPin` y `tablePin` no estaban en `AuthContext` antes -> **Mitigación:** Agregarlos al tipo y al estado. Los tests de páginas que dependen de estos valores deben actualizarse.
- **Trade-off:** Mantener `useAuth` como deprecado temporalmente agrega código muerto -> **Justificación:** Permite migración incremental. Una vez migradas todas las páginas, se elimina inmediatamente.

## 12) Criterios de aceptacion tecnicos
- [ ] `AuthContext.types.ts` tiene `UserRole = 'owner' | 'referee' | 'viewer' | null`
- [ ] `AuthContext.tsx` hidrata desde localStorage, persiste en localStorage, es reactivo
- [ ] `App.tsx` envuelve con `<AuthProvider>` (orden: AuthProvider > SocketProvider > AppRoutes)
- [ ] Todas las páginas usan `useAuthContext()` — grep `from '@/hooks/useAuth'` devuelve 0 resultados
- [ ] `useAuth.ts` eliminado o deprecado con warning
- [ ] `AuthContext.test.tsx` tiene test de reactividad (Componente A llama login, Componente B re-renderiza)
- [ ] `npm run build` del cliente pasa sin errores
- [ ] `npm run test` del cliente pasa con 0 fallos

## 13) Archivos impactados
### Nuevos
- Ninguno (AuthContext ya existe)

### Modificados
- `client/src/contexts/AuthContext/AuthContext.types.ts` — agregar 'owner', ownerPin, tablePin
- `client/src/contexts/AuthContext/AuthContext.tsx` — hidratación, ownerPin, tablePin, setOwner, setTablePin
- `client/src/App.tsx` — agregar AuthProvider al árbol
- `client/src/pages/AuthPage/AuthPage.tsx` — usar useAuthContext
- `client/src/pages/DashboardPage/DashboardPage.tsx` — usar useAuthContext
- `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` — usar useAuthContext
- `client/src/pages/WaitingRoomPage/WaitingRoomPage.tsx` — usar useAuthContext
- `client/src/pages/HistoryViewPage/HistoryViewPage.tsx` — usar useAuthContext
- `client/src/components/utilities/PrivateRoute/PrivateRoute.tsx` — usar useAuthContext (si no lo usa ya)

### Eliminados
- `client/src/hooks/useAuth.ts` — después de migrar todas las páginas

---

**Estado:** Draft
**Owner tecnico:** Por definir
**Fecha:** 2026-04-14
**Version:** v0.1
