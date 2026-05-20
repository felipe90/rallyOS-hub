# kiosk-display — Delta Spec: kiosk-set-scores

## ADDED Requirements

### Requirement: Set Scores Visible on Kiosk Cards

Each kiosk table card MUST display current set scores below point scores when available. The display SHALL follow the existing `TableStatusChip` set-score pattern (label + `{a} - {b}`). Set scores MUST be hidden when `currentSets` is absent or both values are zero.

#### Scenario: Set scores display when present

- GIVEN a LIVE table with `currentSets` = `{ a: 2, b: 1 }`
- WHEN the kiosk renders the table card
- THEN "Sets:" label, "2", and "1" are visible below the point scores

#### Scenario: Set scores hidden when absent

- GIVEN a LIVE table without `currentSets`
- WHEN the kiosk renders the table card
- THEN no "Sets:" text or set score numerals appear

#### Scenario: Set scores hidden when both zero

- GIVEN a LIVE table with `currentSets` = `{ a: 0, b: 0 }`
- WHEN the kiosk renders the table card
- THEN no "Sets:" text or set score numerals appear

#### Scenario: Condensed sizing

- GIVEN a LIVE table with `currentSets` in condensed mode
- WHEN the kiosk renders the card
- THEN set scores use condensed font sizes matching the condensed point-score sizing
