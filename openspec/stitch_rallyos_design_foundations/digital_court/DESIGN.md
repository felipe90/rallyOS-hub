# Design System Strategy: The Digital Court

## 1. Overview & Creative North Star
The Creative North Star for this system is **"The Kinetic Clubhouse."** 

This isn't a static dashboard; it is a high-performance environment that balances the prestige of a private club with the precision of a professional court. We break the "SaaS template" look by utilizing **intentional asymmetry** and **tonal depth**. Instead of rigid, boxed-in grids, the layout should feel like a series of interconnected zones. We use expansive white space (the "Out of Bounds" area) to frame high-density "Action Zones," creating a sophisticated editorial rhythm that guides the eye toward live interactions and key data.

## 2. Colors & Surface Architecture
Our palette transitions from the crisp clarity of a morning match to the high-energy teal of the brand’s core.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid hex-colored borders to define sections. Traditional borders create visual noise that "boxes in" the user. Instead, boundaries must be defined through:
- **Background Shifts:** Use `surface-container-low` (#f2f4f6) sections against a `background` (#f7f9fb) base.
- **Tonal Transitions:** Define edges by the meeting of two different surface tokens.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of premium materials.
- **Base Layer:** `background` (#f7f9fb) – The "Court" floor.
- **Secondary Layer:** `surface-container-low` (#f2f4f6) – Large grouping areas.
- **Action Layer:** `surface-container-lowest` (#ffffff) – Primary cards and interactive modules.
- **Nesting Logic:** When placing a card inside a sidebar, the sidebar should be `surface-container-low` and the card should be `surface-container-lowest`. This creates a "lift" effect that feels architectural rather than graphical.

### The "Glass & Gradient" Rule
To inject "soul" into the high-tech aesthetic:
- **Hero Elements:** Use a subtle linear gradient for primary CTAs, transitioning from `primary` (#006b5f) to `primary_container` (#14b8a6) at a 135° angle.
- **Glassmorphism:** For floating overlays (modals, dropdowns), use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. This ensures the "Digital Court" feels airy and translucent.

## 3. Typography: Editorial Authority
We use a high-contrast typographic scale to differentiate between "Atmosphere" and "Action."

*   **Display & Headlines (Space Grotesk):** This is our "Stadium Signage." Space Grotesk’s geometric quirks provide a high-tech, slightly futuristic edge. Use `display-lg` for hero numbers and `headline-md` for section titles. Ensure tight letter-spacing (-0.02em) for a more "designed" feel.
*   **Body & Labels (Manrope):** This is our "Scorecard." Manrope provides exceptional legibility. Use `body-lg` for primary content and `label-sm` for metadata.
*   **The Identity Gap:** Maintain a significant size gap between headlines and body text. This "Editorial Tension" is what separates a high-end experience from a generic one.

## 4. Elevation & Depth: Tonal Layering
We move away from the "Material 2" shadow-heavy look toward a more modern, ambient depth.

### The Layering Principle
Depth is achieved by stacking. A `surface-container-highest` (#e0e3e5) element should only be used for the most recessed or "pressed" states, while `surface-container-lowest` (#ffffff) represents the highest, most reachable surface.

### Ambient Shadows
Shadows are used sparingly, only for floating elements (cards, menus).
- **The Spec:** `0px 20px 40px rgba(25, 28, 30, 0.06)`. 
- **The Tint:** Never use pure black for shadows. The shadow must be a tinted version of `on-surface` (#191c1e) to simulate natural light hitting a matte surface.

### The "Ghost Border" Fallback
If contrast is required for accessibility (e.g., input fields), use a **Ghost Border**: `outline-variant` (#bbcac6) at **15% opacity**. It should be felt, not seen.

## 5. Components & UI Primitives

### Buttons
- **Primary:** Gradient fill (`primary` to `primary_container`), `rounded-full`, `title-sm` (Manrope Bold).
- **Secondary:** `surface-container-low` background with `primary` text. No border.
- **Tertiary (Live):** `tertiary_container` (#e49200) background. Used exclusively for "Live" or "Urgent" states to draw immediate attention.

### Cards & Lists
- **The "No-Divider" Mandate:** Forbid horizontal lines between list items. Use `spacing-4` (1.4rem) of vertical white space to separate content, or alternating background tints (`surface` to `surface-container-low`).
- **Rounding:** All cards must use `rounded-2xl` (1.5rem) to maintain the "Clubhouse" softness.

### Input Fields
- **Aesthetic:** `surface-container-lowest` background with a 1px "Ghost Border" (15% opacity).
- **Focus State:** Transition the Ghost Border to 100% `primary` (#006b5f) and add a subtle `primary_fixed` glow.

### Signature Component: The "Match Tracker"
A horizontal glassmorphic bar using `surface_container_lowest` (80% opacity) with a `tertiary` (#855300) pulse indicator for live highlights. This should float at the top of the viewport with a heavy backdrop blur.

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical margins (e.g., wider left margin than right) to create an editorial, magazine-like feel.
*   **Do** lean into the `rounded-2xl` and `rounded-xl` tokens. Sharp corners are forbidden in the Clubhouse.
*   **Do** use the `tertiary_container` (Amber) sparingly—only for things that are happening *now*.

### Don’t:
*   **Don’t** use 1px solid borders for layout sectioning.
*   **Don’t** use pure black (#000000) for text. Always use `on-surface` (#191c1e).
*   **Don’t** clutter the "Court." If a piece of information isn't vital, move it to a `surface-container-low` secondary panel or hide it behind a progressive disclosure interaction.