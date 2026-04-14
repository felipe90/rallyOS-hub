# SDD - Scoreboard Routes Refactor

## 1. Architecture Overview

### Current State
- Single route `/scoreboard/:id` renders ScoreboardPage
- Role detection via `useAuth()` and conditional rendering
- Complex `canReferee` logic with multiple conditions

### Target State
- Three routes: `/scoreboard/:id`, `/scoreboard/:id/referee`, `/scoreboard/:id/view`
- Each route renders specific view with clear responsibilities
- No conditional rendering based on role flags

### Architecture Pattern
**Container-Presentational** - Separate container logic from display

```
/pages/ScoreboardPage/
  ├── ScoreboardPage.tsx      (container - routing logic)
  ├── RefereeView.tsx      (presentational - full controls)
  ├── SpectatorView.tsx     (presentational - display only)
  └── useScoreboardAuth.ts  (hook - auth logic)
```

---

## 2. UI/UX Specification

### Routes Structure

| Route | Auth | Controls | Description |
|-------|------|---------|------------|
| `/scoreboard/:id` | None | None | Redirect → /view |
| `/scoreboard/:id/referee` | PIN | All | Full scoreboard with controls |
| `/scoreboard/:id/view` | None | None | Display only |

### Components

#### RefereeView
- Contains all: ScoreDisplay, ScoreboardActions, ScoreboardSidebar, ScoreDecorations
- Shows: QR code, Table name, Player names, Set scores, History, Undo button
- Actions: +1, +2, +3, Undo, Reset

#### SpectatorView
- Display only: ScoreDisplay, Table name, Player names, Set scores
- No controls: No buttons, no undo, no history
- Has: Back button to return to dashboard

---

## 3. Data Flow

### Routing Flow
```
/scoreboard/:id
    ↓
    redirect(/scoreboard/:id/view)

/scoreboard/:id/referee
    ↓
    ScoreboardPage(props: mode="referee")
    ↓
    ¿Authenticated?
      ├─ Yes → Show RefereeView
      └─ No → Show PIN Input → Authenticate → Show RefereeView

/scoreboard/:id/view
    ↓
    ScoreboardPage(props: mode="view")
    ↓
    Show SpectatorView
```

### Authentication Flow (Referee)
```
1. User visits /scoreboard/:id/referee
2. Check localStorage.tablePin
3. If exists → emit SET_REF with PIN
4. If success → show RefereeView
5. If fail → show PIN input → wait for input → repeat step 3
```

---

## 4. Interface Contracts

### ScoreboardPage Props

```typescript
export interface ScoreboardPageProps {
  mode: 'referee' | 'view';
  tableId: string;
}

// From URL params
<Route path="/scoreboard/:id/referee" 
  element={<ScoreboardPage mode="referee" tableId={id} />} />
```

### RefereeView Props

```typescript
export interface RefereeViewProps {
  tableId: string;
  currentMatch: MatchState;
  table: TableInfo;
  isConnected: boolean;
  onAddScore: (side: 'a' | 'b', points: number) => void;
  onUndo: () => void;
  onReset: () => void;
  onBack: () => void;
}
```

### SpectatorView Props

```typescript
export interface SpectatorViewProps {
  tableId: string;
  currentMatch: MatchState;
  table: TableInfo;
  isConnected: boolean;
  onBack: () => void;
}
```

---

## 5. Implementation Detail

### File Changes

| File | Action | Changes |
|------|--------|---------|
| `App.tsx` | MODIFY | Add routes |
| `components/ScoreboardPage/ScoreboardPage.tsx` | MODIFY | Accept mode prop |
| `components/ScoreboardPage/useScoreboardAuth.ts` | NEW | Auth logic hook |
| `components/ScoreboardPage/RefereeView.tsx` | NEW | Referee UI |
| `components/ScoreboardPage/SpectatorView.tsx` | NEW | Spectator UI |
| `components/molecules/QRCodeImage/QRCodeImage.tsx` | MODIFY | /referee URL |
| `pages/DashboardPage/DashboardPage.tsx` | MODIFY | navigate ref |

### Component Extraction

**Current (in ScoreboardPage.tsx):**
- Lines with ScoreDisplay, actions, sidebar → RefereeView
- Lines with display only → SpectatorView

### Backward Compatibility

- QR code existing scans → `/referee/:id` (better experience)
- Old /scoreboard/:id links → redirect to /view (safe fallback)

---

## 6. Acceptance Criteria

### Routes
- [ ] `/scoreboard/123` redirects to `/scoreboard/123/view`
- [ ] `/scoreboard/123/referee` shows full controls
- [ ] `/scoreboard/123/view` shows display only

### Auth Flow
- [ ] Visiting /referee without PIN shows PIN input
- [ ] Entering correct PIN shows RefereeView
- [ ] Invalid PIN shows error

### UI
- [ ] RefereeView has all buttons (+1, +2, +3, undo)
- [ ] SpectatorView has no controls
- [ ] Both show score correctly

### Dashboard
- [ ] Click on table navigates to /referee/:id
- [ ] QR code links to /referee/:id

---

## 7. Dependencies & Risks

### Dependencies
- Existing `SET_REF` socket event (already exists)
- Existing ScoreDisplay component
- Existing auth flow in useSocket

### Risks
- **Breaking QR codes**: Old scans go to /referee (acceptable - better UX)
- **Migration**: Users with saved role may see different view

### Migration Path
1. Deploy new routes
2. Old /scoreboard/:id continues working (redirects)
3. QR codes regenerate with new /referee route
4. No breaking changes

---

## Parte 2: Dashboard Routes (Owner vs Referee)

### Architecture

```
/pages/DashboardPage/
  DashboardPage.tsx       (container - routing)
  OwnerDashboard.tsx       (presentational - admin)
  RefereeDashboard.tsx      (presentational - join only)
  
/organisms/
  TableCard/              (reusable - extracted)
  TableList/             (reusable - extracted)
  
/molecules/
  MetricCard/            (reusable - already exists?)
```

### Reusable Components Analysis

| Component | Current Location | Target Location | Reused In |
|-----------|--------------|-------------|----------|
| TableCard | DashboardPage inline? | organisms/TableCard | Owner + Referee |
| TableList | DashboardGrid | organisms/TableList | Owner + Referee |
| MetricCard | StatCard.molecule | molecules/StatCard | Both dashboards |
| PinModal | DashboardPage inline? | molecules/PinModal | Owner dashboard |
| CreateTableModal | Not exists | molecules/CreateTableModal | Owner dashboard |

### Component Extraction Goals

1. **TableCard** - Card que muestra info de una mesa (nombre, estado, players, PIN si owner)
2. **TableList** - Lista de TableCards con grid/list view toggle
3. **MetricCard** - Ya existe como StatCard, verificar si reusable

### DRY Principles

- **Same data, different display**: TableCard se muestra diferente en Owner vs Referee
- **Prop**: `showMeta?: boolean` (PINs, admin controls) para controlar qué mostrar
- **One component, multiple uses**: No duplicar lógica de display

---

**Owner:** raikenwolf  
**Created:** 2026-04-15  
**Status:** READY FOR IMPLEMENTATION (PART 1: Scoreboard, PART 2: Dashboard)