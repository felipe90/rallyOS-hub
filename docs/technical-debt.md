# Technical Debt — rallyOS-hub

> Living register of consciously accepted technical debt.
> Add an entry when a decision defers work to a future cycle. Include the
> decision context, why it was deferred, and the trigger that should resolve it.

## Register

<!-- Template
### YYYY-MM-DD — Short title
- **Context**: what was decided and why
- **Deferred**: what is not being done now
- **Trigger**: what should make us pay this debt down
-->

### 2026-08-04 — Tournament sport source after selector removal

- **Context**: The tournament sport selector in AuthPage is removed; club config
  (`ClubConfigStore.sport`) becomes the single source of truth for the sport
  across the app. A tournament started on a hub with **no club configured**
  (`sport: null`) resolves to the default `tableTennis`.
- **Deferred**: Requiring club configuration before tournament play, or a
  separate tournament-level sport override. For now a bare tournament silently
  behaves as table tennis.
- **Trigger**: If a real deployment runs tournament mode on a hub without club
  setup, or if the product needs per-tournament sport selection, revisit this
  decision. Acceptable only because table tennis is the app's original sport.
