# design-token-consolidation Specification

## Purpose

Single-source Tailwind v4 `@theme` tokens, PWA manifest theme alignment, and font self-hosting to eliminate FOUT and duplicate design values.

## Requirements

### Requirement: Border Radius Scope

The universal rule `*:not([style*="border"]) { border-radius: var(--radius-md); }` in `index.css` MUST be removed. A `.card` utility class SHALL provide border-radius explicitly to components that need it (cards, modals, buttons).

#### Scenario: Card receives radius via class

- GIVEN a `<div class="card">`
- WHEN rendered
- THEN the element has `var(--radius-md)` border-radius

#### Scenario: Non-card elements have no forced radius

- GIVEN a `<span>` or `<input>` with no `.card` class
- WHEN rendered
- THEN the element has no applied border-radius

### Requirement: Token Single Source

Tailwind v4 `@theme` block MUST be the single source of truth for design tokens. Duplicate `:root` CSS custom property declarations SHALL be removed. All token consumers SHALL reference `@theme` variables.

#### Scenario: @theme block contains all tokens

- GIVEN `@theme` defines `--color-primary`, `--radius-md`, `--font-sans`
- WHEN `index.css` is parsed
- THEN `:root` block contains zero duplicate declarations of those tokens

#### Scenario: Components consume theme tokens

- GIVEN a component uses `text-primary`
- WHEN rendered
- THEN the color resolves from `@theme --color-primary`, not a `:root` override

### Requirement: PWA Manifest Theme Alignment

The `manifest.webmanifest` MUST set `theme_color: '#006b5f'` and `background_color: '#f7f9fb'`. The `<meta name="theme-color">` in `index.html` SHALL match `theme_color`.

#### Scenario: Cold launch splash matches app

- GIVEN the PWA is launched from the home screen while offline
- WHEN the splash screen renders
- THEN the status bar and background colors match the app's actual theme

#### Scenario: Browser tab bar matches

- GIVEN the app is loaded in a supporting mobile browser
- WHEN the page renders
- THEN the browser chrome tint matches `theme_color`

### Requirement: Font Self-Hosting

Space Grotesk and Manrope woff2 files MUST be stored in `/public/fonts/`. `@font-face` declarations in `index.css` SHALL reference local paths (not Google Fonts CDN). Service worker SHALL cache font files via Workbox.

#### Scenario: Fonts load from local paths

- GIVEN the app loads
- WHEN `@font-face` rules activate
- THEN font requests resolve to `/public/fonts/{font-file}.woff2`

#### Scenario: Fonts render offline

- GIVEN the device is offline AND service worker has cached fonts
- WHEN the app loads
- THEN Space Grotesk and Manrope render without FOUT

#### Scenario: Fonts support Spanish

- GIVEN content includes accented Spanish characters (á, é, í, ó, ú, ü, ñ, ¿, ¡)
- WHEN the font renders
- THEN all glyphs are available (Latin Extended subset)
