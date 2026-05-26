# Proposal: Multi-Sport Support — Padel as Second Sport

## Intent

The codebase is 100% coupled to table tennis flat point-based scoring. Adding padel (15-30-40-AD hierarchical scoring) requires a
pluggable architecture. Additionally, "table" terminology must become "court" to be sport-agnostic.

## Scope

### In Scope
- `SportRules` interface + strategy pattern in `server/src/domain/sports/`
- `TableTennisRules`: extract existing logic; `PadelRules`: 15-30-40-AD, games, sets, tiebreaks, deuce/advantage
- `MatchEngine` refactored to delegate scoring to `SportRules`
- `MatchState`, `MatchConfig`, `Score`, `MatchEvent`, `ScoreChange` extended for hierarchical scoring
- Sport-specific display: TT numbers, padel game+point (15-30-40-AD) rendering
- `MatchConfigModal`: sport selector, conditional handicap, tiebreak options (7pt/10pt)
- Socket events: add `GAME_WON`, `TIEBREAK_START`, `DEUCE`; keep `RECORD_POINT` backward-compatible
- Persistence: auto-migrate legacy state (`sport` missing → `tableTennis`), version v1→v2
- Table→Court rename across codebase (~30 files): types, events, UI, server, file names
- Subtract/undo for hierarchical scoring (deuce→40, advantage→deuce)
- All existing tests pass; padel-specific tests added

### Out of Scope
- Tennis, badminton, squash, pickleball implementation
- Kiosk view sport-specific rendering
- Structured 4-player name model (single string per side: "Felipe/Rodri")

## Capabilities

### New Capabilities
- `multi-sport-architecture`: SportRules interface, strategy pattern, sport registry, MatchEngine delegation
- `padel-scoring`: 15-30-40-AD scoring, game/set/match hierarchy, tiebreaks, deuce/advantage, padel side-swap

### Modified Capabilities
- `match-persistence`: Add `sport` field, version migration v1→v2, auto-detect legacy state

## Approach

**Strategy Pattern**: `SportRules` interface encapsulates sport-specific behavior. `MatchEngine` becomes a thin orchestrator
delegating to the active strategy. `MatchState` uses discriminated unions by `sport`. Frontend selects display component
by sport type. Table→Court rename is interleaved with the refactor (not a separate phase).

## Affected Areas

| Area | Impact | Files |
|------|--------|-------|
| `server/src/domain/sports/` | New | SportsRules interface, TT/padel rules, registry |
| `server/src/domain/matchEngine.ts` | Refactor | Delegate scoring to SportRules |
| `shared/types.ts` | Modified | Score, MatchConfig, MatchState, MatchEvent |
| `shared/events.ts` | Modified | GAME_WON, TIEBREAK_START, DEUCE events |
| `server/src/services/store/` | Modified | Sport field, migration v1→v2 |
| `client/` — ScoreboardMain, useMatchDisplay, services/match | Modified | Sport-aware display and computation |
| `client/` — MatchConfigModal, MatchContext | Modified | Sport selector, adaptive labels |
| Entire codebase | Rename | table → court (~30 files) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Score type propagation across ~25 files | High | Phased: add `detailScore` alongside flat score first |
| Table→Court rename (~30 files) | High | Interleaved with refactor; regex-assisted find/replace |
| Test regression during MatchEngine extraction | Med | Extract TT rules first, verify, then refactor |
| Deuce/advantage: no existing patterns | Med | Explicit state machine: 40-40→AD→Game or back to 40 |
| Undo in hierarchical scoring | Med | Store full score snapshot per action |

## Rollback Plan

1. Remove padel from sport registry → reverts to TT-only without changing MatchEngine.
2. Persistence migration is one-way; rollback script strips `sport` field from saved state.
3. Table→Court rename: keep legacy type aliases (`Table` = `Court`) if rename is blocked.
4. Each phase committed as reversible work unit.

## Dependencies

None external. Exploration complete at `openspec/changes/multi-sport-padel/exploration.md`.

## Success Criteria

- [ ] Existing TT tests pass; TT functionality unchanged
- [ ] Padel match: create, score (15-30-40-AD), complete to match end
- [ ] Deuce/advantage transitions correct; undo works from all states
- [ ] "Court" replaces "table" everywhere; no legacy references
- [ ] Persistence auto-migrates legacy state; restored matches retain correct sport
- [ ] Adding a future sport requires only SportRules implementation + display component
