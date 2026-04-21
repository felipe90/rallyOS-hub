# Specification: UX Refactor (ux-refactor)

## Feature 1: Zero-Latency Tap Targets (`PlayerScoreArea`)

**Scenario 1.1: Scoring a point natively**
```gherkin
Given the referee is viewing a LIVE match on the scoreboard
When the referee taps ANYWHERE on the left designated Player Area (not just a specific circle button)
Then one point is added to the left player's score
And a subtle "tap" haptic/visual feedback is triggered
```

**Scenario 1.2: Undoing a point natively**
```gherkin
Given the referee is viewing a LIVE match on the scoreboard
When the referee taps the small "Undo" button located at the bottom corner of the Player Area
Then one point is subtracted from that player's score
```

## Feature 2: Immersive Connection Status (`ConnectionStatus`)

**Scenario 2.1: Auto-hiding the connected state**
```gherkin
Given the client successfully connects to the server
When the 'Connected' status banner is displayed
Then wait 3 seconds
And animate the banner out of view (fade out or slide up)
To maximize vertical real estate for the "High-Tech Clubhouse" immersion
```

**Scenario 2.2: Reappearing on connection loss**
```gherkin
Given the 'Connected' banner has been auto-hidden
When the socket connection is lost ('connecting' or 'error')
Then animate the banner back into view immediately
And persist it until connection is restored (+3s delay)
```

## Feature 3: Tactical Friction for Deletion (`HoldToConfirm`)

**Scenario 3.1: Deleting an active table**
```gherkin
Given the tournament owner is in the Dashboard Grid
When the owner presses and holds the "Delete Table" button for 2 seconds
Then visual feedback shows a completion ring/fill
And after 2 seconds, the `onDelete` action is triggered (bypassing generic confirm dialogs)
```

## Feature 4: Broadcast Match Ticker (`MatchHistoryTicker`)

**Scenario 4.1: Displaying match history horizontally**
```gherkin
Given a live match with completed events (points scored)
When the spectator or referee views the ScoreboardMain
Then a horizontal "Ticker" overlay is visible at the bottom or top margin
And it displays the past sets and the last N points scored sequentially
```
