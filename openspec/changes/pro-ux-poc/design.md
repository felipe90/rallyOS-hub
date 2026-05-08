# Design: Kiosk Multi-Table Display

## Technical Approach

New public page `KioskAllTablesPage` at `/scoreboard/all/kiosk` — no auth, no PrivateRoute wrapper. Consumes SocketContext's reactive `tables` array (already populated via `TABLE_LIST` events). Filters to LIVE/WAITING, renders each as a TV-optimized card in a responsive CSS grid. Zero new server endpoints — `TABLE_LIST` is already broadcast globally on every state change.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| New page vs modify ScoreboardPage | New `KioskAllTablesPage` | Mode-prop on ScoreboardPage | Clean separation: kiosk has different UX (grid vs single, no controls, no auth). No risk of accidentally exposing auth-bypass on existing route |
| Data source | SocketContext `tables` array | Custom socket listener | `tables` already receives full list via global `TABLE_LIST` broadcasts. Zero extra wiring. Same pattern as OwnerDashboard |
| Card component | New `KioskTableCard` organism | Reuse `TableStatusChip` | Different UX: TV-sized text, read-only, no PIN/QR/buttons. `TableStatusChip` is 202 lines with owner action logic |
| Grid responsiveness | Tailwind `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` | JS-based masonry | CSS-only, zero runtime cost. 1 col mobile, 2 on 720p, 3 on 1080p matches all TV targets |
| Event names in code | `TABLE_LIST` / `TABLE_UPDATE` (actual SocketEvents) | `score:update` / `table:statusUpdate` (spec aliases) | Code must use real event names. Spec aliases are conceptual |

## Data Flow

```
Server (any state change)
  │
  ├─ onTableUpdate → TABLE_UPDATE (room-only)
  └─ onTableUpdate → TABLE_LIST (global broadcast)
                        │
                        ▼
              useSocketState (tables state)
                        │
                        ▼
              SocketContext.Provider (tables array)
                        │
                        ▼
              KioskAllTablesPage
                │  filter(LIVE|WAITING)
                ▼
              <div grid>
                ├─ KioskTableCard (TableInfo)
                ├─ KioskTableCard (TableInfo)
                └─ KioskTableCard (TableInfo)
```

- **Mount**: Page reads `tables` from `useSocketContext()`, filters active, renders grid
- **Update**: `TABLE_LIST` re-emits on every point/status change → React re-renders
- **Empty**: No LIVE/WAITING tables → "No active matches" fallback with proper typography
- **Transition**: Framer Motion `AnimatePresence` for card add/remove (existing pattern from `ConnectionStatus`)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/App.tsx` | Modify | Add `<Route path="/scoreboard/all/kiosk" element={<KioskAllTablesPage />} />` outside `<PrivateRoute>` |
| `client/src/routes.ts` | Modify | Add `SCOREBOARD_KIOSK: '/scoreboard/all/kiosk'` constant |
| `client/src/pages/KioskAllTablesPage/index.ts` | Create | Barrel export |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.tsx` | Create | Public page: reads `tables` from SocketContext, filters active, renders grid |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.types.ts` | Create | Empty props interface (follows existing pattern) |
| `client/src/pages/KioskAllTablesPage/KioskAllTablesPage.test.tsx` | Create | Unit tests: grid rendering, empty state, filtered statuses, auth bypass |
| `client/src/components/organisms/KioskTableCard/index.ts` | Create | Barrel export |
| `client/src/components/organisms/KioskTableCard/KioskTableCard.tsx` | Create | TV-optimized card: table name, players, scores, status badge |
| `client/src/components/organisms/KioskTableCard/KioskTableCard.types.ts` | Create | Props: `TableInfo` + optional className |
| `client/src/components/organisms/KioskTableCard/KioskTableCard.test.tsx` | Create | Unit tests: render with data, score display, status badge variants |
| `client/src/components/organisms/index.ts` | Modify | Export `KioskTableCard` |
| `client/src/i18n/locales/en-US.json` | Modify | Add keys: `kiosk.title`, `kiosk.waiting`, `kiosk.live`, `kiosk.noActiveMatches` |
| `client/src/i18n/locales/es.json` | Modify | Add Spanish translations for kiosk keys |

## Component Specs

### KioskAllTablesPage
```tsx
// No props — self-contained public page
function KioskAllTablesPage() {
  const { tables, connected } = useSocketContext()  // from SocketProvider
  const active = tables.filter(t => t.status === 'LIVE' || t.status === 'WAITING')
  
  if (active.length === 0) return <EmptyState />
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 min-h-dvh">
    {active.map(t => <KioskTableCard key={t.id} table={t} />)}
  </div>
}
```

### KioskTableCard
```tsx
interface KioskTableCardProps {
  table: TableInfo   // has id, number, name, status, playerNames?, currentScore?, currentSets?
}
// Renders: table name (large), players, score (giant), sets row, status badge (LiveBadge/WaitingBadge)
// TV-optimized: text-4xl scores, text-xl labels, p-8, rounded-3xl, shadow-lg
// No onClick, no buttons — pure read-only
```

## TV Optimization Guidelines

| Element | Size | Rationale |
|---------|------|-----------|
| Table name | `text-2xl md:text-3xl` | Readable from 3-5 meters |
| Score numbers | `text-5xl md:text-6xl` | Dominant focal point |
| Player labels | `text-xl md:text-2xl` | Secondary info |
| Set scores | `text-lg` | Compact row below main score |
| Card padding | `p-6 md:p-8` | Breathing room for grid |
| Border radius | `rounded-3xl` | Matches `--radius-xl` token |
| Background | `bg-surface` + `shadow-lg` | Matches existing card pattern |
| Grid gap | `gap-6` | Clear separation between tables |
| Full viewport | `min-h-dvh` | No scrollbars on TV |
| Status badge | Existing `LiveBadge` / `WaitingBadge` | Reuses atoms |

## Reuse Strategy

| Component | Source | Reused as-is? |
|-----------|--------|---------------|
| `LiveBadge`, `WaitingBadge` | atoms/Badge | Yes — status display |
| `ConnectionStatus` | atoms | Yes — live/offline indicator |
| `Typography` (Headline, Body) | atoms | Yes — consistent typography |
| `SetScore` | molecules/MatchContext | Yes — set score row in card |
| `LanguageSwitcher` | atoms | Yes — but positioned bottom-right, semi-transparent |
| `useI18n()` | i18n | Yes — all text via i18n |
| `useSocketContext()` | contexts | Yes — reactive tables array |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | KioskTableCard renders with TableInfo | Vitest + RTL, mock TableInfo prop. Verify score display, player names, status badge |
| Unit | KioskAllTablesPage grid/filter/empty | Mock SocketContext, assert grid layout, filter to LIVE/WAITING, empty state |
| Unit | Auth bypass | Render page without AuthProvider, verify no redirect to `/auth` |
| Integration | Route accessibility | Navigate to `/scoreboard/all/kiosk` without auth token, verify page renders. Navigate with auth, verify same result |
| Integration | Score updates | Emit TABLE_LIST via mock socket, verify card re-renders with new scores |

## Migration / Rollout

No migration required. New route is additive — zero impact on existing routes or components. Rollback: remove the route from `App.tsx` and delete the two new directories.

## Open Questions

- [ ] Confirm `TABLE_LIST` fires with updated `currentScore`/`currentSets` after every point. Monitoring the `RECORD_POINT` handler shows only room-level `MATCH_UPDATE` — need to verify `onTableUpdate` interceptor propagates correctly. (Risk: Low — tested by inference from `onTableUpdate` wiring in SocketHandler.ts:55)
