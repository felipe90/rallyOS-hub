# owner-dashboard Specification

## Purpose

Owner dashboard controls for the "Destacado" (kiosk spotlight) feature, allowing the venue owner to toggle featured status on individual courts.

## Requirements

### Requirement: Destacar Toggle in CourtStatusChip

Each LIVE or WAITING court card in `OwnerDashboardPage` MUST display a "Destacar" / "Quitar Destacado" toggle button (i18n labels mapped to `featured` field). The button SHALL emit `SET_FEATURED` on click. FINISHED courts SHALL NOT show the button.

#### Scenario: LIVE court shows Destacar

- GIVEN owner views dashboard with LIVE courts
- WHEN each court card renders
- THEN each LIVE card displays a "Destacar" button

#### Scenario: FINISHED court hides button

- GIVEN a FINISHED court card on the dashboard
- THEN no Destacar button is rendered

#### Scenario: Currently featured shows Quitar

- GIVEN court-A is currently `featured=true`
- WHEN the dashboard renders
- THEN court-A's button reads "Quitar Destacado" (active state)

#### Scenario: Click Destacar emits SET_FEATURED

- GIVEN owner sees a LIVE court with "Destacar" button
- WHEN owner clicks it
- THEN `SET_FEATURED` is emitted with `{ targetCourtId: courtId }`

#### Scenario: Click Quitar Destacado clears

- GIVEN owner sees the featured court with "Quitar Destacado"
- WHEN owner clicks it
- THEN `SET_FEATURED` is emitted with `{ targetCourtId: null }`
