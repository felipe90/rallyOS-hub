# RallyOS Client Architecture Rules

This directory contains the architectural rules and conventions for the RallyOS client application.

**Last Updated:** April 2026  
**Applies to:** All new and refactored code in `client/src/`

---

## Quick Navigation

| Document | What It Covers | Read This If... |
|----------|---------------|-----------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layer definitions, data flow, responsibilities of each layer | You need to understand the big picture |
| [SERVICES.md](SERVICES.md) | What belongs in `/services`, pure function rules, examples | You're writing business logic |
| [HOOKS.md](HOOKS.md) | Hook creation rules, anti-patterns, separation of concerns | You're writing a custom hook |
| [COMPONENTS.md](COMPONENTS.md) | Atomic Design rules, presentation-only components | You're creating or modifying components |
| [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) | Contexts vs hooks vs services, when to use each | You're managing state or data flow |
| [TESTING.md](TESTING.md) | Testing rules, mocks, coverage, what to test where | You're writing or reviewing tests |
| [FUNCTIONAL.md](FUNCTIONAL.md) | Functional programming principles, immutability, composition | You want to write more predictable code |

---

## Core Principles

### The Golden Rule

> **If the logic doesn't need `useState`, `useEffect`, or JSX to work, it does NOT belong in a hook or component. It belongs in `services/`.**

This is the single most important principle. Follow it ruthlessly.

### Single Source of Truth for API Types

> **All types that cross the wire (client ↔ server) MUST be imported from `shared/types.ts`. Never redefine them.**

The `shared/` directory is the contract between client and server. Both sides import from it. This prevents silent runtime breakage when one side changes a field name or type.

See [ARCHITECTURE.md](ARCHITECTURE.md#single-source-of-truth-for-api-types) for details.

### DRY — Don't Repeat Yourself

> **Every piece of knowledge must have a single, unambiguous, authoritative representation in the system.**

If you find yourself writing the same logic twice, extract it.

**Good:**
```typescript
// services/validation/pin.ts
export function validateTablePin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

// Used everywhere: AuthPage, usePinSubmission, TableStatusChip
```

**Bad:**
```typescript
// AuthPage.tsx
if (!/^\d{4}$/.test(pin)) { ... }

// OwnerDashboardPage.tsx
if (!/^\d{4}$/.test(pin)) { ... }

// RefereeDashboardPage.tsx
if (!/^\d{4}$/.test(pin)) { ... }
```

**This codebase currently violates DRY in:**
- PIN submission logic (duplicated in `OwnerDashboardPage` and `RefereeDashboardPage`)
- Dashboard stats calculation (duplicated across dashboard pages)
- Error message handling (scattered across `useSocket.ts` and pages)

### KISS — Keep It Simple, Stupid

> **Most systems work best if they are kept simple rather than made complicated.**

Simplicity is the ultimate sophistication. Avoid premature abstraction. Avoid over-engineering.

**Good:**
```typescript
// Simple, obvious, easy to understand
export function canEditScoreboard(role: UserRole, mode: ScoreboardMode): boolean {
  if (!role) return false
  return (role === 'owner' || role === 'referee') && mode === 'referee'
}
```

**Bad:**
```typescript
// Over-engineered for a simple permission check
export class PermissionStrategyFactory {
  private strategies: Map<string, PermissionStrategy>
  constructor() { ... }
  getStrategy(role: string): PermissionStrategy { ... }
  evaluate(context: EvaluationContext): boolean { ... }
}
```

**KISS violations in this codebase:**
- `useSocket.ts` (256 lines) — a simple socket wrapper became a God Object because it wasn't kept simple
- `OwnerDashboardPage.tsx` (240 lines) — handles modals, tables, PINs, stats, QR codes, cleanups, deletions

**Rule of thumb:** If you need more than 5 minutes to explain how a piece of code works, it's not simple enough.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                      │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  Atoms   │  │ Molecules  │  │      Organisms         │  │
│  │ (Button) │  │(PageHeader)│  │  (ScoreboardMain)      │  │
│  └──────────┘  └────────────┘  └────────────────────────┘  │
│                                                              │
│  Rules: NO business logic. NO socket calls. NO state.        │
│  Only props, events, and rendering.                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       HOOK LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │useMatchDisplay│  │usePermissions │  │  usePinSubmission │  │
│  │  (97 lines)  │  │  (45 lines)  │  │    (60 lines)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  Rules: ONE responsibility. MAX 80 lines. Compose from      │
│  services. Bridge between React lifecycle and pure logic.    │
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
│  Rules: Pure functions. Zero React dependencies.             │
│  Testable without mounting a component.                      │
│  The source of truth for business logic.                     │
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
│  Rules: ONLY global state that 3+ components need.          │
│  NO business logic. NO side effects in render.              │
└─────────────────────────────────────────────────────────────┘
```

---

## Status of Current Codebase

| Area | Status | Notes |
|------|--------|-------|
| `services/permissions/` | **Model** | Perfect separation. Use as reference. |
| `useMatchDisplay` | **Model** | 97 lines. Pure calculation wrapped in `useMemo`. |
| `usePermissions` + `useCan` | **Model** | Thin wrappers over pure service functions. |
| `services/match/` | **Missing** | Needs creation. Score logic lives in `ScoreboardMain`. |
| `services/dashboard/` | **Missing** | Stats calculation is inline in pages. |
| `services/validation/` | **Missing** | PIN validation lives in `useSocket.ts`. |
| `useSocket.ts` | **Anti-pattern** | 256-line God Object. Needs refactoring priority #1. |
| `AuthPage.tsx` | **Needs work** | Socket events handled directly in page. |
| `QRCodeImage.tsx` | **Anti-pattern** | Encryption logic in a presentational component. |

---

## How to Use These Docs

### For New Features
1. Start with `SERVICES.md` — write your business logic as pure functions
2. Move to `HOOKS.md` — create thin hooks that compose services
3. Check `COMPONENTS.md` — build your UI with Atomic Design
4. Verify with `STATE_MANAGEMENT.md` — decide where state lives

### For Refactoring
1. Check the status table above
2. Read the specific doc for the layer you're touching
3. Follow the "From → To" examples in each doc

### For Code Review
Use the checklists at the end of each document. If a PR violates a rule, reference the specific doc and section.

---

## Decision Log

Key architectural decisions are documented here for future reference:

| Decision | Why | Doc |
|----------|-----|-----|
| Context over Redux/Zustand | App is small-medium. Context + hooks is sufficient. No boilerplate overhead. | `STATE_MANAGEMENT.md` |
| Atomic Design for components | Clear hierarchy. Scalable. Industry standard for design systems. | `COMPONENTS.md` |
| Services as pure functions | Testable without React. Reusable across hooks. No framework lock-in. | `SERVICES.md` |
| Spanish error messages in code | Single-language app. i18n library is overkill for now. | `SERVICES.md` |

---

## Enforcement

These rules are enforced by:

1. **Code review** — PRs should reference the relevant rule
2. **Lint rules** — Max function length, no `any` types
3. **Tests** — Service functions must have unit tests (no React needed)

**If a rule doesn't make sense for your specific case, document the exception in the PR description.** Don't silently break the rule.
