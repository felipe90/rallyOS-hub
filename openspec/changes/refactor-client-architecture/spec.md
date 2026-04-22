# Spec: Refactor Client Architecture

## Overview

This is a **pure refactor** — no behavioral changes. All existing functionality is preserved. The goal is to move business logic out of hooks/components and into pure `services/` functions.

## Requirements

### R1: Services are Pure Functions
- Services live in `services/<domain>/`
- Zero React dependencies
- Deterministic: same input → same output
- Each service has a `.test.ts` file

### R2: Hooks are Thin Wrappers
- Max 80 lines per hook
- Single responsibility
- Delegate logic to services
- No inline business logic

### R3: Components are Presentation-Only
- No calculations, validations, or URL building
- No socket event handling
- Receive data via props (atoms/molecules) or hooks (organisms)

### R4: Contexts Store State Only
- No business logic
- No direct localStorage/sessionStorage access
- No derived state computation

### R5: DRY Violations Eliminated
- PIN submission logic extracted to reusable hook
- Dashboard stats extracted to service
- Error messages centralized

## Scenarios

### Scenario 1: Service Extraction
**Given** a calculation currently inline in a component  
**When** the refactor is complete  
**Then** the calculation lives in `services/` and the component imports it via a hook

### Scenario 2: Hook Splitting
**Given** `useSocket.ts` with 256 lines  
**When** the refactor is complete  
**Then** it is split into `useSocketConnection`, `useSocketState`, `useSocketActions`

### Scenario 3: Auth Context Cleanup
**Given** `AuthContext` touching localStorage directly  
**When** the refactor is complete  
**Then** it uses `services/storage/authStorage.ts`

### Scenario 4: Component Cleanup
**Given** `QRCodeImage.tsx` doing encryption  
**When** the refactor is complete  
**Then** it receives `joinUrl` as a prop

## Acceptance Criteria

- All existing tests pass
- New services have unit tests (90%+ coverage)
- Build compiles without errors
- No `any` types introduced
- No behavioral regressions
