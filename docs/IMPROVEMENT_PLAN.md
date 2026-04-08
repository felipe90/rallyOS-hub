# 🚀 PLAN DE ACTUALIZACIÓN Y MEJORA
## rallyOS-hub | Q2 2026

**Última actualización**: 7 de Abril de 2026  
**Responsable**: Desarrollo Frontend  
**Estado**: ✅ COMPLETADO - Todas las prioridades implementadas

---

> ⚠️ **NOTA**: Este plan ha sido completado en su totalidad. Las 6 prioridades (P1-P6) fueron implementadas exitosamente. Ver [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) para detalles.

---

## 📋 TABLA DE CONTENIDOS
1. [Prioridades Críticas](#prioridades-críticas)
2. [Roadmap Fase 1 (MVP)](#roadmap-fase-1-mvp)
3. [Roadmap Fase 2 (MVP+)](#roadmap-fase-2-mvp)
4. [Roadmap Fase 3 (Producción)](#roadmap-fase-3-producción)
5. [Tareas Detalladas](#tareas-detalladas)
6. [Criterios de Aceptación](#criterios-de-aceptación)

---

## 🚨 PRIORIDADES CRÍTICAS

### BLOQUEADORES DE PRODUCCIÓN

| # | Tarea | Impacto | Esfuerzo | Predecesor |
|---|-------|--------|---------|-----------|
| **P1** | Routing (React Router) | CRÍTICO | 4d | - |
| **P2** | Real Data Integration | CRÍTICO | 5d | P1 |
| **P3** | Auth/PIN Flow | ALTO | 3d | P1 |
| **P4** | Waiting Room | ALTO | 5d | P1 |
| **P5** | Tests (Vitest) | ALTO | 6d | - |
| **P6** | Landscape Responsive | ALTO | 3d | P1 |

---

## 🎯 ROADMAP FASE 1 (MVP)
**Objetivo**: App funcional con flujo básico  
**Duración**: 2 semanas  
**Salida**: Usuarios pueden arbitrar un partido

### Sprint 1.1: Routing & Navigation (4-5 días)

#### Task P1.1: Implementar React Router
```typescript
// Install
npm install react-router-dom

// Structure
src/
├── routes/
│   ├── Dashboard.tsx
│   ├── Scoreboard.tsx
│   ├── HistoryView.tsx
│   ├── WaitingRoom.tsx
│   └── RefereePanel.tsx
├── App.tsx (router provider)
└── main.tsx (root)
```

**Criterios**:
- [ ] Router <BrowserRouter> en main.tsx
- [ ] 5 rutas definidas
- [ ] Link/navigate funciona en componentes
- [ ] URL refleja vista actual

#### Task P1.2: Dashboard → Scoreboard Navigation
```typescript
// DashboardGrid.tsx
export function DashboardGrid() {
  const navigate = useNavigate()
  
  const handleTableClick = (tableId: string) => {
    navigate(`/scoreboard/${tableId}`)  // ✅ Nuevo
  }
  // ...
}
```

**Criterios**:
- [ ] Click en mesa navega a /scoreboard/:tableId
- [ ] Scoreboard recibe tableId como parámetro
- [ ] Back button regresa a dashboard

#### Task P1.3: Route Guards para Auth
```typescript
// Crear PrivateRoute
function PrivateRoute() {
  const isReferee = useAuth().role === 'referee'
  return isReferee ? <Outlet /> : <LoginPage />
}
```

**Criterios**:
- [ ] Rutas protegidas requieren auth
- [ ] Redirige a login si no autenticado

---

### Sprint 1.2: Real Data Integration (5-6 días)

#### Task P2.1: Conectar useSocket a componentes
```typescript
// Use en App nivel superior
export function App() {
  const socket = useSocket({ autoConnect: true })
  
  return (
    <SocketProvider value={socket}>
      <Routes>...</Routes>
    </SocketProvider>
  )
}

// Consumir en componentes
function ScoreboardView() {
  const { tables, currentTable, emit } = useSocket()
  // ...
}
```

**Criterios**:
- [ ] SocketContext creado
- [ ] useSocket disponible en todos componentes
- [ ] Datos reales llegan a componentes

#### Task P2.2: Conectar ScoreboardMain a datos
```typescript
// Scoreboard.tsx (nueva ruta)
export function Scoreboard() {
  const { tableId } = useParams()
  const { currentTable, currentMatch } = useSocket()
  
  return (
    <ScoreboardMain
      match={currentMatch!}
      onScorePoint={(player) => emit('SCORE_POINT', { player, tableId })}
      onUndo={() => emit('UNDO_LAST', { tableId })}
    />
  )
}
```

**Criterios**:
- [ ] Datos reales en ScoreboardMain
- [ ] Click botones emiten eventos
- [ ] Score actualiza en tiempo real

#### Task P2.3: HistoryDrawer Integration
```typescript
// En ScoreboardMain
export function ScoreboardMain() {
  const [historyOpen, setHistoryOpen] = useState(false)
  const { currentMatch } = useSocket()
  
  return (
    <>
      <HistoryDrawer
        isOpen={historyOpen}
        events={currentMatch?.history || []}
        onUndo={(id) => emit('UNDO_LAST', { tableId })}
      />
    </>
  )
}
```

**Criterios**:
- [ ] HistoryDrawer abre/cierra
- [ ] Muestra eventos reales
- [ ] Botón undo emite evento

---

### Sprint 1.3: Auth & Input (3-4 días)

#### Task P3.1: PIN Auth Component
```typescript
// AuthPage.tsx
export function AuthPage() {
  const [pin, setPin] = useState('')
  const { connected } = useSocket()
  
  const handleSubmit = () => {
    // Validar PIN localmente o con server
    if (pin === '12345') {
      localStorage.setItem('role', 'referee')
      navigate('/dashboard')
    }
  }
  
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <Input
        type="password"
        maxLength={5}
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
      />
      <Button onClick={handleSubmit}>Ingresar</Button>
    </div>
  )
}
```

**Criterios**:
- [ ] Input PIN funciona
- [ ] Valida 5 dígitos
- [ ] Guarda rol en localStorage
- [ ] Navega a dashboard

#### Task P3.2: Role-based UI
```typescript
// useAuth hook
export function useAuth() {
  const role = localStorage.getItem('role')
  return { role, isReferee: role === 'referee' }
}

// En componentes
function ScoreboardMain() {
  const { isReferee } = useAuth()
  
  return (
    <>
      {/* Score display (visible a todos) */}
      {isReferee && (
        <button onClick={() => emit('SCORE_POINT', {...})}>
          +1 A
        </button>
      )}
    </>
  )
}
```

**Criterios**:
- [ ] Solo árbitro ve botones
- [ ] Viewers solo ven score
- [ ] Logout limpia localStorage

---

## 🎯 ROADMAP FASE 2 (MVP+)
**Objetivo**: Espectadores pueden unirse  
**Duración**: 1-2 semanas  
**Salida**: Waiting Room funcional

### Sprint 2.1: Waiting Room (5 días)

#### Task P4.1: Componente WaitingRoom
```typescript
// WaitingRoom.tsx (nuevo)
export function WaitingRoom() {
  const { tables } = useSocket()
  const tables_available = tables.filter(t => t.status === 'WAITING')
  
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {tables_available.map(table => (
        <div key={table.id} className="p-4 bg-surface rounded-lg cursor-pointer">
          <h3>{table.name}</h3>
          <p>PIN: {table.pin}</p>
          <QRCode value={`http://localhost:3000/join/${table.id}`} />
          <Button onClick={() => joinTable(table.id, pin)}>
            Unirse
          </Button>
        </div>
      ))}
    </div>
  )
}
```

**Criterios**:
- [ ] Lista mesas disponibles
- [ ] Genera QR code
- [ ] Botón "Unirse" funciona
- [ ] Emite JOIN_TABLE

#### Task P4.2: Join Flow
```typescript
// Agregar a socketHandler.ts (server)
socket.on('JOIN_TABLE', ({ tableId, pin, role }) => {
  // Validar PIN
  if (validPin(pin)) {
    socket.join(`table:${tableId}`)
    socket.emit('JOINED', { tableId, role })
  } else {
    socket.emit('ERROR', 'PIN inválido')
  }
})

// Cliente
function joinTable(tableId: string, pin: string) {
  emit('JOIN_TABLE', { tableId, pin, role: 'viewer' })
  navigate(`/scoreboard/${tableId}`)
}
```

**Criterios**:
- [ ] Socket.join() funciona
- [ ] PIN validación
- [ ] Error handling si PIN inválido
- [ ] Redirige a scoreboard

---

## 🎯 ROADMAP FASE 3 (Producción)
**Objetivo**: Ready for deployment  
**Duración**: 2-3 semanas  
**Salida**: Tests + Landscape + Polish

### Sprint 3.1: Testing (4-6 días)

#### Task P5.1: Vitest Setup
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
})
```

**Criterios**:
- [ ] vitest.config.ts existe
- [ ] npm test funciona
- [ ] TypeScript reconoce describe, it, expect

#### Task P5.2: Unit Tests (Atoms)
```typescript
// Typography.test.tsx
import { render, screen } from '@testing-library/react'
import { Typography, Headline, Title, Body } from './Typography'

describe('Typography', () => {
  it('renders headline with correct styles', () => {
    render(<Headline>Test</Headline>)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('font-heading', 'text-[56px]')
  })
  
  it('renders title as h2', () => {
    render(<Title>Test</Title>)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toBeInTheDocument()
  })
  
  it('renders body as paragraph', () => {
    render(<Body>Test</Body>)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

**Criterios**:
- [ ] 5+ test files
- [ ] 30+ test cases
- [ ] >80% component coverage
- [ ] Green tests before merge

#### Task P5.3: E2E Tests (Playwright)
```typescript
// tests/scoreboard.spec.ts
import { test, expect } from '@playwright/test'

test('Referee can score points', async ({ page }) => {
  await page.goto('http://localhost:5173/auth')
  
  // Login
  await page.fill('input[type="password"]', '12345')
  await page.click('button:has-text("Ingresar")')
  
  // Wait for dashboard
  await expect(page).toHaveURL(/\/dashboard/)
  
  // Click table
  await page.click('text=Mesa Alpha')
  await expect(page).toHaveURL(/\/scoreboard\/1/)
  
  // Score point
  await page.click('button:has-text("+1")')
  const score = await page.textContent('.text-\\[80px\\]')
  expect(score).toBe('1')
})
```

**Criterios**:
- [ ] tests/e2e/ carpeta creada
- [ ] 5+ user flow tests
- [ ] Todos los flujos cubiertas
- [ ] Pasan sin flakiness

---

### Sprint 3.2: Responsive & UX (3-4 días)

#### Task P6.1: Landscape Media Queries
```typescript
// ScoreboardMain.tsx
export function ScoreboardMain() {
  return (
    <div className="
      flex flex-col  // portrait
      landscape:flex-row  // landscape
      landscape:h-screen landscape:gap-0
    ">
      {/* Scores */}
      <div className="
        flex-1 flex items-center justify-center
        text-[80px]  // fallback
        sm:text-[100px] md:text-[120px]
        h-screen  // landscape
        landscape:h-full landscape:w-1/2
      ">
        {score.a}
      </div>
      
      {/* Header - hide in landscape */}
      <div className="
        landscape:hidden  // ✅ Desaparece en landscape
      ">
        <DashboardHeader />
      </div>
    </div>
  )
}
```

**Criterios**:
- [ ] `landscape:` utilities funcionar
- [ ] Numbers escalado con vh/vmin
- [ ] Header desaparece en landscape
- [ ] Legible desde 10 metros

#### Task P6.2: Error & Loading States
```typescript
// ConnectionStatus.tsx
export function ConnectionStatus() {
  const { connected, connecting, error } = useSocket()
  
  if (error) {
    return (
      <div className="fixed top-0 left-0 right-0 p-4 bg-red-500/10">
        ⚠️ {error} - usando datos locales
      </div>
    )
  }
  
  if (connecting) {
    return (
      <div className="fixed top-0 left-0 right-0 p-4 bg-amber-500/10">
        🔄 Conectando...
      </div>
    )
  }
  
  return (
    <div className="fixed top-0 left-0 right-0 p-4 bg-primary/10">
      ✅ Conectado
    </div>
  )
}
```

**Criterios**:
- [ ] Loading spinner visible
- [ ] Error messages claros
- [ ] Success indicators
- [ ] UX no bloqueada

---

## 📋 TAREAS DETALLADAS

### Fase 1 - Sprint Breakdown

```
WEEK 1:
├── P1.1: React Router setup (Mon-Tue | 2d)
├── P1.2: Dashboard navigation (Wed | 1d)
├── P1.3: Route guards (Thu-Fri | 1.5d)
└── P2.1: useSocket integration (Fri | 1.5d)

WEEK 2:
├── P2.2: ScoreboardMain connection (Mon-Tue | 2d)
├── P2.3: HistoryDrawer integration (Wed | 1d)
├── P3.1: PIN Auth component (Thu | 1d)
└── P3.2: Role-based UI (Fri | 1d)

WEEK 3:
├── P4.1: WaitingRoom component (Mon-Wed | 2.5d)
├── P4.2: Join table flow (Wed-Thu | 1.5d)
└── P6.1: Landscape responsive (Fri | 1d)

WEEK 4:
├── P5.1: Vitest setup (Mon-Tue | 1.5d)
├── P5.2: Unit tests (Tue-Thu | 2d)
├── P5.3: E2E tests (Thu-Fri | 1.5d)
└── P6.2: Error states & polish (Fri | 1d)
```

---

## ✅ CRITERIOS DE ACEPTACIÓN

### MVP Acceptance
- [ ] **Routing**: 5 rutas funcionales (Dashboard, Scoreboard, Auth, Waiting, History)
- [ ] **Data**: Datos reales del servidor en todas las vistas
- [ ] **Interacción**: Clicks emiten eventos a servidor
- [ ] **Auth**: PIN requiere para referees
- [ ] **Undo**: Historial y botón undo funciona
- [ ] **Responsive**: Works en mobile y landscape
- [ ] **Performance**: <3s inicial load, <100ms interactions

### Testing Acceptance
- [ ] **Coverage**: >80% componentes
- [ ] **Unit Tests**: >30 test cases
- [ ] **E2E**: 5+ user flow tests
- [ ] **CI/CD**: Tests en pre-commit

### Documentation
- [ ] API docs (Socket events)
- [ ] Component storybook
- [ ] Deployment guide
- [ ] Testing guide

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Actual | Target |
|---------|--------|--------|
| Rutas | 1 | 5+ |
| Componentes integrados | 8 | 15 |
| Tests | 0 | 30+ |
| Code coverage | 0% | >80% |
| Bundle size | 319 KB | <400 KB |
| Lighthouse score | N/A | >85 |
| Time to interact | N/A | <2s |

---

## 🔄 DEPENDENCIES

```
P1 (Routing) → required by→ P2, P3, P4
P2 (Data) → required by→ P5 (tests)
P3 (Auth) → required by→ P4 (joining)
P5 (Tests) → dep on→ P1-P4 (features)
P6 (Responsive) → independent
```

---

## 🚀 GO-LIVE CHECKLIST

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Performance optimized
- [ ] Accessibility (WCAG AA)
- [ ] Browser tested (Chrome, Safari, Firefox)
- [ ] Mobile tested (iOS, Android)
- [ ] Landscape tested (tablet mode)
- [ ] Docs updated
- [ ] Changelog written
- [ ] Tag release v1.0.0
- [ ] Deploy to production

---

## 📞 CONTACT

**Última revisión**: 7 de Abril de 2026  
**Próxima revisión**: Cuando Phase 1 esté done  
**Preguntas**: Ver DEVELOPMENT_JOURNEY.md
