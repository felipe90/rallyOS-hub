# Client Architecture

**Applies to:** All code in `client/src/`  
**Last Updated:** April 2026

---

## Philosophy

The RallyOS client follows a **layered architecture** where each layer has a single, well-defined responsibility. Business logic lives in pure functions (`services/`), React lifecycle management lives in hooks (`hooks/`), and UI rendering lives in components (`components/`).

### The Golden Rule

> **If the logic doesn't need `useState`, `useEffect`, or JSX to work, it does NOT belong in a hook or component. It belongs in `services/`.**

### Single Source of Truth for API Types

**All types that cross the wire (client ↔ server) MUST be imported from `shared/types.ts`.**

Never redefine a server type in the client, and never duplicate a shared type in `server/src/types.ts`.

```typescript
// ✅ Correct — import from shared
import type { TableInfo, MatchStateExtended } from '@shared/types';

// ❌ Wrong — never define your own TableInfo in client/src/
// ❌ Wrong — never redefine types that exist in shared/types.ts
```

This is enforced by `server/src/types.ts` re-exporting from `shared/types.ts`. See [server/docs/rules/ARCHITECTURE.md](../server/docs/rules/ARCHITECTURE.md#shared-types--single-source-of-truth) for server-side rules.

This separation makes the code:
- **Testable** — Business logic tested without React (milliseconds)
- **Reusable** — Services can be called from any hook or component
- **Maintainable** — Changing UI doesn't break business logic, and vice versa
- **Portable** — Services could be reused in a different framework (React, Vue, CLI, etc.)

### DRY — Don't Repeat Yourself

Every piece of knowledge must have a single, unambiguous, authoritative representation. When you find duplication, extract it to a service or hook.

**Current violations:**
- PIN submission logic duplicated in `OwnerDashboardPage` and `RefereeDashboardPage`
- Dashboard stats calculated inline in multiple pages
- Error message handling scattered across files

### KISS — Keep It Simple, Stupid

Most systems work best if they are kept simple. Avoid over-engineering. A function that does one thing well is better than a framework that does everything poorly.

**Current violations:**
- `useSocket.ts` (256 lines) — should be 3-4 focused hooks
- `OwnerDashboardPage.tsx` (240 lines) — handles too many concerns

**Rule of thumb:** If it takes more than 5 minutes to explain, it's not simple enough.

---

## Layer Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                      │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  Atoms   │  │ Molecules  │  │      Organisms         │  │
│  │ (Button) │  │(PageHeader)│  │  (ScoreboardMain)      │  │
│  └──────────┘  └────────────┘  └────────────────────────┘  │
│                                                              │
│  Responsibility: Render UI. No business logic.               │
│  Dependencies: Props, hooks (organisms only).                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       HOOK LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │useMatchDisplay│  │usePermissions│  │  usePinSubmission │  │
│  │  (97 lines)  │  │  (45 lines)  │  │    (60 lines)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  Responsibility: Bridge React lifecycle with pure logic.     │
│  Dependencies: Contexts, services.                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVICES LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │permissions/  │  │   match/     │  │    dashboard/    │  │
│  │  rules/      │  │ calculate.ts │  │  calculateStats  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  Responsibility: Pure business logic. Zero React.            │
│  Dependencies: Types, utilities. No React, no DOM.           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CONTEXTS LAYER                           │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ AuthContext  │  │ SocketContext│                        │
│  │ (role, pin)  │  │  (socket)    │                        │
│  └──────────────┘  └──────────────┘                        │
│                                                              │
│  Responsibility: Provide global state to consumers.          │
│  Dependencies: Hooks (for initialization).                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### 1. Presentation Layer (Components)

**What it does:**
- Renders UI based on props
- Handles user interactions (forwards events to parent callbacks)
- Manages local UI state (modals, toggles, form inputs)

**What it does NOT do:**
- Calculate scores, sets, or winners
- Validate PINs or form data
- Build URLs or encrypt data
- Call socket.emit directly (organisms use hooks that do this)
- Access localStorage/sessionStorage

**Folder structure:**
```
components/
  atoms/         — Single elements (Button, Badge, Input)
  molecules/     — Atom compositions (PageHeader, ConfirmDialog)
  organisms/     — Complex sections (ScoreboardMain, DashboardGrid)
  utilities/     — Non-visual (PrivateRoute)
```

**See [COMPONENTS.md](COMPONENTS.md) for detailed rules.**

---

### 2. Hook Layer

**What it does:**
- Gathers data from contexts
- Calls service functions to transform data
- Manages side effects (socket listeners, browser events)
- Returns state and handlers for components

**What it does NOT do:**
- Pure business logic (calculations, validations)
- Error message definitions
- URL construction
- Direct socket event handling logic (should delegate to services)

**Folder structure:**
```
hooks/
  useMatchDisplay.ts      — Display calculations from match state
  usePermissions.ts       — Permission resolution from auth
  useSocket.ts            — Socket connection (needs refactoring)
  useOrientation.ts       — Browser orientation tracking
  useAutoUpdate.ts        — Service worker update handling
  useScoreboardMode.ts    — Scoreboard mode detection
  usePinSubmission.ts     — PIN submission flow (proposed)
```

**Key rule:** One hook = one responsibility. Max 80 lines.

**See [HOOKS.md](HOOKS.md) for detailed rules.**

---

### 3. Services Layer

**What it does:**
- Pure functions for business logic
- Deterministic: same input → same output
- Completely independent of React
- Testable with simple assertions (no `render()`, no `mount()`)

**What it does NOT do:**
- Use React hooks or JSX
- Access browser APIs (localStorage, window.location)
- Make network requests
- Have side effects of any kind

**Folder structure:**
```
services/
  permissions/
    rules/
      scoreboard.ts    — Scoreboard authorization rules
      dashboard.ts     — Dashboard authorization rules
      url.ts           — URL parsing for encrypted PINs
  match/               — Match logic (to be created)
    calculateSets.ts
    determineWinner.ts
    formatEvent.ts
    applySideSwap.ts
  dashboard/           — Dashboard statistics (to be created)
    calculateStats.ts
  validation/          — Input validation (to be created)
    pin.ts
    auth.ts
    match.ts
  url/                 — URL building (to be created)
    buildTableUrl.ts
    buildScoreboardUrl.ts
```

**See [SERVICES.md](SERVICES.md) for detailed rules.**

---

### 4. Contexts Layer

**What it does:**
- Stores global state needed by 3+ components
- Provides state and basic setters to consumers
- Initializes from external sources (localStorage, socket)

**What it does NOT do:**
- Business logic or calculations
- Side effects (calls to services that access storage)
- Derived state computation (use hooks for that)

**Folder structure:**
```
contexts/
  AuthContext/
    AuthContext.tsx       — Role, tableId, login/logout
    AuthContext.types.ts  — Type definitions
  SocketContext/
    SocketContext.tsx     — Socket instance, tables, currentMatch
    SocketContext.types.ts
```

**See [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) for detailed rules.**

---

## Data Flow

### Downward Flow (Data)

```
Server
  │
  ▼
SocketContext ──► Pages ──► Hooks ──► Organisms ──► Molecules ──► Atoms
  │
  └── Tables, currentMatch, connection status

AuthContext ─────► Pages ──► Hooks ──► Components
  │
  └── Role, tableId, PINs
```

### Upward Flow (Events)

```
Atoms ──► Molecules ──► Organisms ──► Pages ──► Hooks ──► Socket
  │
  └── onClick, onSubmit, onChange
```

### Service Calls

```
Hooks call Services ──► Pure logic ──► Return result to Hook ──► Component
  │
  └── No React. No side effects. Deterministic.
```

**Critical rule:** Components never call services directly. They call hooks, which call services.

---

## Current Codebase Status

| Area | Status | Example | Action Needed |
|------|--------|---------|---------------|
| `services/permissions/` | **Model** | `canEditScoreboard()` | None — use as reference |
| `useMatchDisplay` | **Model** | 97 lines, pure calc | None |
| `usePermissions` | **Model** | Thin wrapper over rules | None |
| `services/match/` | **Missing** | Score logic in `ScoreboardMain` | Create services |
| `services/dashboard/` | **Missing** | Stats inline in pages | Create services |
| `services/validation/` | **Missing** | PIN validation in `useSocket` | Create services |
| `useSocket.ts` | **Anti-pattern** | 256-line God Object | Refactor priority #1 |
| `AuthContext` | **Needs work** | localStorage access inline | Extract storage service |
| `QRCodeImage.tsx` | **Anti-pattern** | Encryption in component | Move to service |
| `MatchHistoryTicker` | **Needs work** | Formatting inline | Move to service |
| `HistoryDrawer.tsx` | **Needs work** | Time formatting inline | Move to service |
| `OwnerDashboardPage` | **Needs work** | Stats inline in JSX | Move to hook + service |
| `useScoreboardAuth` | **Deprecated** | Still used in ScoreboardPage | Replace with `useCan` |

---

## Architectural Decisions

### Why Context over Redux/Zustand?

The app is small-medium sized. Context + hooks provides:
- Less boilerplate
- No additional bundle size
- Sufficient for current complexity
- Easy to migrate to Zustand later if needed

**Revisit if:** App grows beyond 15-20 global state pieces.

### Why Atomic Design?

- Clear hierarchy and naming
- Scalable for design systems
- Industry standard
- Matches how designers think

**Levels used:** Atoms, Molecules, Organisms (no Templates/Pages — pages live in `pages/`)

### Why Services as Pure Functions?

- Testable without React (fast, reliable)
- Reusable across hooks
- No framework lock-in
- Easy to reason about (deterministic)

### Why Custom Hooks over HOCs/Render Props?

- Cleaner composition
- TypeScript-friendly
- Standard React pattern
- Easier to test

### Why No `any` Types?

`any` defeats TypeScript's purpose. If you can't type it, you don't understand it. Use `unknown` + type guards instead.

---

## Adding a New Feature

When adding a new feature, follow this order:

1. **Services first** — Write pure functions for business logic
   ```typescript
   // services/match/newFeature.ts
   export function calculateNewThing(data: Input): Output { ... }
   ```

2. **Tests for services** — Prove logic is correct without React
   ```typescript
   // services/match/newFeature.test.ts
   describe('calculateNewThing', () => { ... })
   ```

3. **Hook** — Bridge service with React lifecycle
   ```typescript
   // hooks/useNewFeature.ts
   export function useNewFeature(data: Input) {
     return useMemo(() => calculateNewThing(data), [data])
   }
   ```

4. **Component** — Build UI using hook data
   ```typescript
   // components/organisms/NewFeaturePanel.tsx
   export function NewFeaturePanel({ data }: Props) {
     const result = useNewFeature(data)
     return <div>{result}</div>
   }
   ```

5. **Page** — Compose components
   ```typescript
   // pages/NewFeaturePage.tsx
   export function NewFeaturePage() {
     return <NewFeaturePanel data={...} />
   }
   ```

---

## Migration Strategy

For existing code that violates these rules:

### Phase 1: Extract Services (Highest Impact)
- Identify pure logic in hooks/components
- Extract to `services/<domain>/`
- Write unit tests
- Update hooks to call new services

### Phase 2: Split God Hooks
- Identify hooks > 80 lines
- Split into focused hooks
- Extract socket listeners, state, actions

### Phase 3: Thin Contexts
- Move storage access from contexts to services
- Move derived state from contexts to hooks
- Context should only store raw state + setters

### Phase 4: Component Cleanup
- Remove inline calculations from components
- Remove inline formatting from components
- Pass raw data + callbacks via props

---

## Related Documents

- [COMPONENTS.md](COMPONENTS.md) — Atomic Design rules, component patterns
- [HOOKS.md](HOOKS.md) — Hook creation rules, anti-patterns
- [SERVICES.md](SERVICES.md) — Pure function rules, what belongs in services
- [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) — Contexts vs hooks vs local state

---

## Glossary

| Term | Definition |
|------|------------|
| **Atom** | Smallest UI component, no composition |
| **Molecule** | Composition of atoms, simple logic OK |
| **Organism** | Complex section, composes molecules + atoms |
| **Service** | Pure function, zero React dependencies |
| **Hook** | React function that uses React features |
| **Context** | React mechanism for global state |
| **God Object** | Hook/component that does too many things |
| **Barrel Export** | `index.ts` that re-exports from a folder |
| **Deterministic** | Same input always produces same output |
