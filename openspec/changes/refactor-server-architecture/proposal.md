# Proposal: Refactor Server Architecture

## Intent

The server codebase has a single God Class (`TableManager`, 449 lines) that violates the Single Responsibility Principle. It handles table CRUD, player management, match orchestration, PIN generation, QR data generation, and table formatting. This makes the code hard to test, maintain, and reason about.

This refactor extracts focused services from TableManager while preserving all existing behavior.

## Scope

### In Scope
- Extract `services/table/` (TableRepository, PlayerService, MatchOrchestrator, TableFormatter)
- Extract `services/security/` (RateLimiter, PinService)
- Extract `services/qr/` (QRService)
- Split `TableManager` into composition of focused services
- Add unit tests for all new services
- Update `SocketHandlerBase` to use extracted RateLimiter

### Out of Scope
- No changes to Socket.IO event protocol
- No changes to MatchEngine (already well-structured)
- No changes to Express app or HTTPS server
- No changes to client-side code
- No database migration (still in-memory)

## Capabilities

### New Capabilities
None — pure refactor, no behavioral changes.

### Modified Capabilities
None — no spec-level requirement changes.

## Approach

Phase 1: Extract pure services (no Socket.IO dependencies)
Phase 2: Refactor TableManager to compose services
Phase 3: Extract RateLimiter from SocketHandlerBase
Phase 4: Update tests and verify all pass

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/` | New | table/, security/, qr/ |
| `server/src/tableManager.ts` | Modified | Split into composition |
| `server/src/handlers/SocketHandlerBase.ts` | Modified | Use RateLimiter service |
| `server/tests/` | New | Unit tests for services |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| State management regression | Medium | Keep Table as shared state, services read/write it |
| Event emission changes | Low | Keep callback pattern (onTableUpdate, onMatchEvent) |
| Handler breakage | Low | TableManager interface stays the same |

## Rollback Plan

Each phase is a separate commit. Revert last commit if issues found.

## Success Criteria

- [ ] All existing tests pass (29 server tests)
- [ ] New services have unit tests
- [ ] TableManager < 200 lines
- [ ] No behavioral changes (same socket events, same responses)
- [ ] Build compiles without errors
