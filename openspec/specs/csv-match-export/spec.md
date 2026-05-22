# csv-match-export Specification

## Purpose

CSV export of finished matches from the owner dashboard. First adapter implementation of the export interface.

## Requirements

### Requirement: CSV Export Endpoint

The server MUST expose `GET /api/export/matches.csv` that returns finished matches as CSV. The endpoint SHALL filter to FINISHED tables only and respond with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="rallyos-matches.csv"`.

#### Scenario: Export finished matches

- GIVEN 2 FINISHED tables and 1 LIVE table
- WHEN owner requests GET /api/export/matches.csv
- THEN response contains 2 rows (one per FINISHED table)
- AND LIVE table is excluded

#### Scenario: No finished matches

- GIVEN 0 FINISHED tables
- WHEN owner requests GET /api/export/matches.csv
- THEN response is a CSV with header row only

### Requirement: CSV Column Format

Each CSV row MUST contain: table_number, table_name, player_a, player_b, sets_won_a, sets_won_b, set_scores (single column, "/" separator between set scores), winner.

#### Scenario: CSV row structure

- GIVEN finished table "Mesa 1" with players Jorge (won 3 sets) and Carlos (won 1 set), set scores 11-9, 8-11, 11-5, 11-7
- WHEN CSV is generated
- THEN row is: `1,Mesa 1,Jorge,Carlos,3,1,11-9/8-11/11-5/11-7,Jorge`

#### Scenario: Empty player names

- GIVEN finished table has empty playerNameA
- WHEN CSV is generated
- THEN player_a column is empty string

### Requirement: Owner-Only Access

The export endpoint SHALL only be accessible to authenticated owners. Non-owner requests MUST receive HTTP 401.

#### Scenario: Owner authenticated

- GIVEN owner session is active
- WHEN GET /api/export/matches.csv is requested
- THEN CSV is returned with HTTP 200

#### Scenario: Unauthenticated request

- GIVEN no owner session
- WHEN GET /api/export/matches.csv is requested
- THEN HTTP 401 is returned

### Requirement: Export Button in OwnerDashboard

The OwnerDashboardPage header MUST display a Download icon button that, when clicked, opens GET /api/export/matches.csv. The button SHALL only render for authenticated owners.

#### Scenario: Button visible to owner

- GIVEN owner views OwnerDashboardPage
- THEN Download button is visible in header
- AND clicking it triggers CSV download

#### Scenario: Button hidden from non-owners

- GIVEN non-owner views OwnerDashboardPage
- THEN Download button is NOT visible

### Requirement: CSV Export at Tournament Finish

When finishing a tournament, the confirmation dialog SHOULD include an "Exportar CSV" checkbox. If checked, GET /api/export/matches.csv SHALL download immediately before StateStore.clear() removes the data.

#### Scenario: CSV downloaded before tournament clear

- GIVEN owner confirms tournament finish with "Exportar CSV" checked
- WHEN POST /api/tournament/finish is pending
- THEN CSV downloads while data still exists
- AND tournament is archived and cleared after download
