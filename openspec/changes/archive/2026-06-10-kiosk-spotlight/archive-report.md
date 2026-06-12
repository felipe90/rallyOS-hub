# Archive Report — kiosk-spotlight

**Archived**: 2026-06-10
**Previous location**: `openspec/changes/kiosk-spotlight/`
**Archive location**: `openspec/changes/archive/2026-06-10-kiosk-spotlight/`

## SDD Cycle

| Phase | Status |
|-------|--------|
| Proposal | ✅ Complete |
| Spec (Delta) | ✅ Complete |
| Design | ✅ Complete |
| Tasks | ✅ Complete |
| Apply | ✅ Complete (PR #1 + PR #2) |
| Verify | ✅ PASS — 11/11 spec scenarios, no critical issues |
| Archive | ✅ Complete |

## Implementation Delivery

- **PR #1** (`→main`): Shared types/events + server handlers (SpotlightHandler, CourtFormatter, auto-clear)
  - 12/12 tasks complete, 377 server tests passing
- **PR #2** (`→main`): Client kiosk fullscreen UI + owner dashboard toggle
  - 5 client tasks complete (Phases 3, 4, client tests), 861 client tests passing
- **Table→Court refactor** (on top): Complete terminology migration across server, client, i18n, and docs

## Specs Synced to Main

| Domain | Action | Details |
|--------|--------|---------|
| shared/featured | Created | 4 requirements, 7 scenarios — CourtInfo.featured, SET_FEATURED, SUBSCRIBE_MATCH, UNSUBSCRIBE_MATCH |
| server/featured-control | Created | 2 requirements, 3 scenarios — single-featured invariant, auto-clear on FINISHED |
| owner-dashboard | Created | 1 requirement, 5 scenarios — Destacar/Quitar Destacado toggle |
| kiosk-display | Updated | Modified "Public Kiosk Route" (+4 new scenarios), added "Kiosk Featured Transition" (+2 scenarios) |

## Archive Contents

- `proposal.md` ✅ — Intent, scope, approach, rollback plan
- `spec.md` ✅ — Delta spec with 4 domain sections
- `design.md` ✅ — Architecture decisions, sequence diagrams, UI layout
- `tasks.md` ✅ — 5 phases, 19 tasks (14 client+server, 5 test), 2 PRs delivered
- `verify-report.md` ✅ — PASS verdict, 11/11 scenarios compliant
- `archive-report.md` ✅ — This file
