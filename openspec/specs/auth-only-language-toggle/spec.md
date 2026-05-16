# auth-only-language-toggle Specification

## Purpose

The language toggle SHALL render exclusively on the `/auth` route. After the user selects a language, that choice persists app-wide and the toggle is removed from all other pages.

## Requirements

### Requirement: Toggle Visible Only on /auth

The language switcher component MUST render when the current route is `/auth`. On all other routes (`/scoreboard`, `/owner`, `/admin`, etc.), the toggle SHALL NOT render in the DOM.

#### Scenario: Toggle visible on auth page

- GIVEN user navigates to `/auth`
- THEN language toggle is rendered and interactive

#### Scenario: Toggle hidden on scoreboard page

- GIVEN user navigates to `/scoreboard/{tableId}`
- THEN language toggle is NOT rendered in the DOM

#### Scenario: Toggle hidden on owner dashboard

- GIVEN user navigates to `/owner`
- THEN language toggle is NOT rendered in the DOM

### Requirement: Language Choice Persists App-Wide

When the user selects a language on `/auth`, the choice MUST be persisted (via context or localStorage) and applied to all subsequent page renders — including routes where the toggle itself is not shown.

#### Scenario: Language choice survives navigation

- GIVEN user is on `/auth` and selects English
- WHEN user navigates to `/scoreboard/{tableId}`
- THEN scoreboard page renders in English
- AND language toggle remains hidden

#### Scenario: Language choice survives page refresh

- GIVEN user selected Spanish on `/auth`
- WHEN user refreshes the browser on any page
- THEN the app loads with Spanish locale
- AND the language toggle is shown ONLY if current route is `/auth`

### Requirement: Existing i18n Infrastructure Unchanged

The toggle MUST operate through the existing `i18next` instance. Changing locale SHALL call `i18next.changeLanguage()` — no fork of the i18n initialization.

#### Scenario: Toggle uses changeLanguage API

- GIVEN language toggle shows current language "ES"
- WHEN user clicks to switch to "EN"
- THEN `i18next.changeLanguage('en-US')` is called
- AND all rendered pages update to English without page reload
