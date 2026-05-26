# padel-scoring Specification

## Purpose

Padel scoring: hierarchical 15-30-40-AD system with games, sets, tiebreaks, deuce/advantage, and sport-specific side-swap and serve-rotation rules.

## Requirements

### Requirement: 15-30-40-Deuce-Advantage State Machine

The system MUST implement padel point progression: 0, 15, 30, 40. When both sides reach 40, state becomes Deuce. From deuce, next point winner gets Advantage. From advantage, winning next point wins game; losing returns to Deuce.

#### Scenario: Normal progression to deuce

- GIVEN score is 30-30
- WHEN player A scores then player B scores
- THEN state is Deuce (40-40)

#### Scenario: Advantage state cycle

- GIVEN Deuce
- WHEN A scores (Adv-A) then B scores
- THEN state returns to Deuce; game continues

#### Scenario: Game won from advantage

- GIVEN Advantage-A
- WHEN A scores again
- THEN game is won by A; next game starts at 0-0

### Requirement: Game and Set Win Conditions

| Level | Win Condition |
|-------|---------------|
| Game | 40 + 2pt lead, or 2 consecutive from Deuce |
| Tiebreak game | 7pts (or 10 for super tiebreak) + 2pt lead |
| Set | 6 games + 2-game lead; or 7-5; or 7-6 (tiebreak) |
| Match | Best of 3 sets (2 sets won) |

#### Scenario: Game win requires 2-point lead

- GIVEN 40-30
- WHEN trailing player scores
- THEN score becomes Deuce (40-40); no game won

#### Scenario: Set triggers tiebreak at 6-6

- GIVEN games are 6-6
- WHEN set continues
- THEN a 7-point tiebreak game is played to decide the set

#### Scenario: Super tiebreak in 3rd set

- GIVEN sets are 1-1 and config specifies 10pt super tiebreak
- WHEN 3rd set reaches 6-6 games
- THEN tiebreak is played to 10pts with 2pt lead

#### Scenario: Match won 2-0

- GIVEN player A won set 1
- WHEN player A wins set 2
- THEN match is FINISHED; winner is A

### Requirement: Serve Rotation and Side Swap

Serve SHALL rotate after every game. Sides SHALL swap every odd-numbered total of games (after 1, 3, 5...). During tiebreaks, sides swap every 6 points.

#### Scenario: Serve per game, swap on odd games

- GIVEN A serves game 1
- WHEN game 1 ends
- THEN B serves game 2; sides swap since total games are odd

#### Scenario: No swap after even games

- GIVEN total games is 2
- WHEN game ends
- THEN sides remain unchanged

### Requirement: Undo in Hierarchical Scoring

Undo SHALL restore the previous complete state snapshot. Subtract SHALL decrement current point within the active state.

| Current State | Subtract Result |
|---------------|-----------------|
| 40 | 30 |
| Advantage-A | Deuce |
| Deuce | 40-30 or 30-40 (restore pre-deuce) |
| 15 | 0 |

#### Scenario: Subtract Advantage back to Deuce

- GIVEN Advantage-A
- WHEN subtractPoint('A')
- THEN state returns to Deuce

#### Scenario: Undo from 1-0 games to 0-0

- GIVEN game just won by A, games are 1-0
- WHEN undoLast
- THEN games return to 0-0; previous game score restored at advantage state

### Requirement: Socket Events for Padel

The system MUST emit new server events for hierarchical scoring milestones. RECORD_POINT SHALL remain functional.

| Event | Direction | Trigger |
|-------|-----------|---------|
| GAME_WON | Server→Client | Game concludes |
| TIEBREAK_START | Server→Client | Tiebreak begins |
| DEUCE | Server→Client | State becomes Deuce |

### Requirement: Handicap Disabled for Padel

Handicap scoring SHALL be disabled for padel (`needsHandicap()` returns false). MatchConfigModal MUST hide handicap fields when sport is padel. Table tennis handicap behavior remains unchanged.

#### Scenario: Padel hides handicap fields

- GIVEN MatchConfigModal with sport padel
- WHEN component renders
- THEN no handicap fields are visible

### Requirement: i18n Keys

New i18n keys SHALL cover game counter, deuce, advantage, tiebreak, and sport name labels.
