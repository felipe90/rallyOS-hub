# scoreboard-default-spanish Specification

## Purpose

The TV scoreboard page MUST default to Spanish (`es-AR`) regardless of the browser or operating system locale. Other pages retain the existing locale detection behavior.

## Requirements

### Requirement: Scoreboard Locale Override on Mount

When the scoreboard page mounts, the system MUST set the active locale to `es-AR`, ignoring `navigator.language` and any `i18next-browser-languagedetector` result. This override applies ONLY to the scoreboard route and SHALL NOT affect other pages.

#### Scenario: Scoreboard shows Spanish with English browser

- GIVEN browser language is `en-US`
- WHEN scoreboard page loads
- THEN all UI text renders in Spanish (`es-AR`)
- AND "Sets" displays as "Sets" (per es-AR locale)

#### Scenario: Scoreboard shows Spanish with any browser language

- GIVEN browser language is `pt-BR` or `fr-FR`
- WHEN scoreboard page loads
- THEN all UI text renders in Spanish (`es-AR`)

### Requirement: Other Pages Unaffected

The owner dashboard, referee app, auth page, and admin pages MUST continue using the existing locale detection (browser language or previously chosen language). Only the scoreboard page applies the hardcoded `es-AR` default.

#### Scenario: Owner page respects browser language

- GIVEN browser language is `en-US`
- WHEN owner dashboard loads (not the scoreboard)
- THEN UI text may render in English (per existing detection)

### Requirement: User-Chosen Language Overrides Default

If the user has explicitly chosen a language via the auth page language toggle (per `auth-only-language-toggle`), the scoreboard MUST respect that choice over the `es-AR` default.

#### Scenario: User chose English on auth, scoreboard respects it

- GIVEN user previously chose English on `/auth`
- WHEN scoreboard page loads
- THEN UI text renders in English
- AND the `es-AR` default is NOT applied

#### Scenario: No user choice, scoreboard uses Spanish default

- GIVEN user has NOT made any language choice
- WHEN scoreboard page loads
- THEN locale defaults to `es-AR`
