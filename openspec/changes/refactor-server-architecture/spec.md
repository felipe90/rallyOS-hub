# Spec: Refactor Server Architecture

## Overview

Pure refactor — no behavioral changes. Extract services from TableManager to improve testability and maintainability.

## Requirements

### R1: Services are Focused
- Each service has ONE responsibility
- Max 150 lines per service
- No Socket.IO dependencies in services

### R2: TableManager Composes Services
- TableManager orchestrates services
- Delegates operations to services
- Maintains same public interface for backward compatibility

### R3: Domain Logic Stays in Domain
- MatchEngine is not touched
- Game rules remain in domain layer

### R4: Rate Limiting is Extracted
- RateLimiter is a standalone service
- SocketHandlerBase uses RateLimiter

## Scenarios

### Scenario 1: Service Extraction
**Given** a table operation currently in TableManager  
**When** the refactor is complete  
**Then** the operation lives in a focused service

### Scenario 2: TableManager Orchestration
**Given** TableManager with 449 lines  
**When** the refactor is complete  
**Then** TableManager is < 200 lines and composes services

## Acceptance Criteria

- All existing tests pass
- New services have unit tests
- No behavioral regressions
- Build compiles without errors
