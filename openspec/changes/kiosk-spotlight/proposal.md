# Proposal: Cancha Destacada (Kiosk Spotlight)

## Intent

Owner needs to focus the venue TV on a single match during critical moments. Kiosk currently alternates between all tables — no way to "destacar" (spotlight) one court.

## Scope

### In Scope
- Add `featured?: boolean` field to `CourtInfo` in shared types
- New `SET_FEATURED` socket event (owner-only, client→server)
- Single-featured invariant (setting one clears the previous)
- Kiosk fullscreen mode when a court is featured and LIVE/WAITING
- Auto-clear featured when the match ends (status=FINISHED)
- Owner dashboard controls: toggle button per court
- CSS transitions between grid mode and fullscreen mode
- `SUBSCRIBE_MATCH` / `UNSUBSCRIBE_MATCH` events (kiosk subscribes to real-time MATCH_UPDATE)

### Out of Scope
- No new kiosk route (same URL, conditional rendering)
- No kiosk feature interactivity (read-only)
- No persistence across restart (ephemeral in-memory)
- No multi-featured (invariant enforced server-side)

## Capabilities

### New Capabilities
- `featured-control`: Owner sets/clears featured via socket event. Server enforces single-featured, auto-clears on FINISHED.

### Modified Capabilities
- `kiosk-display`: Kiosk detects featured from `CourtInfo.featured` via TABLE_LIST/TABLE_UPDATE. Renders fullscreen scoreboard layout instead of grid when a LIVE/WAITING court is featured. Subscribes to real-time MATCH_UPDATE via SUBSCRIBE_MATCH. Returns to grid when featured clears or match ends.

## Approach

1. **shared**: Add `featured?: boolean` to `CourtInfo`. Register `SET_FEATURED`, `SUBSCRIBE_MATCH`, `UNSUBSCRIBE_MATCH` events
2. **Server**: Validate owner on SET_FEATURED, enforce single-featured invariant, broadcast both TABLE_UPDATEs. Auto-clear on FINISHED. SUBSCRIBE_MATCH validates court.featured===true, joins room, emits MATCH_UPDATE
3. **Kiosk**: If a LIVE/WAITING court has featured=true, render fullscreen ScoreboardMain; else grid. Subscribe via SUBSCRIBE_MATCH for real-time updates. CSS `transition-all duration-500`
4. **Owner dashboard**: "Destacar" (i18n) toggle per court, disabled for FINISHED

## Affected Areas

| Area | Impact | Files |
|------|--------|-------|
| shared/types.ts | Modified | Add `featured` to `CourtInfo` |
| shared/events.ts | Modified | Add `SET_FEATURED`, `SUBSCRIBE_MATCH`, `UNSUBSCRIBE_MATCH` |
| server/src/handlers/ | Modified | New `SET_FEATURED` handler + auto-clear in match-end path + SUBSCRIBE_MATCH handler |
| client/src/pages/KioskAllTablesPage/ | Modified | Conditional fullscreen rendering + subscription logic |
| client/src/pages/OwnerDashboardPage/ | Modified | Feature toggle per court |

## Dependencies

- Auto-clear hook into match-end path (MATCH_WON / status→FINISHED)
- Owner auth via existing VERIFY_OWNER flow

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition on toggle | Low | Server atomic check + broadcast both updates (TABLE_UPDATEs ordenados) |
| Flash between modes | Low | CSS transition; server ignores redundant events |

## Rollback Plan

All additive — no existing behavior changes. Revert commit. If spotlight never set, kiosk is identical.

## Success Criteria

- [ ] Owner sets featured on a LIVE/WAITING court → kiosk shows fullscreen
- [ ] Setting court B as featured clears court A's featured
- [ ] Featured match ends → auto-clears → kiosk back to grid
- [ ] No court featured → kiosk grid unchanged (zero regression)
- [ ] All existing tests pass
