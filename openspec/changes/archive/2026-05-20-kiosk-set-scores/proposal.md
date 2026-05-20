# Proposal: kiosk-set-scores

## Intent

Display set scores on kiosk table cards alongside point scores.

## Motivation

The data (`currentSets`) already flows end-to-end: server sends it via WebSocket, `TableInfo` type includes it, `KioskTableCard` receives it — but never renders it. The sibling `TableStatusChip` component already renders set scores with the same pattern.

## Scope

- **Modified capability**: `kiosk-display`
- **Files**: `KioskTableCard.tsx` (~15 lines added), `KioskTableCard.test.tsx` (new test cases)
- **No server changes**, no type changes, no new dependencies

## Approach

Add `Sets: {a} - {b}` below point scores, conditional on `currentSets` existing and either value > 0. Follow existing condensed vs normal sizing pattern from point scores. Match `TableStatusChip` pattern exactly.

## Rollback

Remove the 15-line block from `KioskTableCard.tsx`. No data or API changes to unwind.
