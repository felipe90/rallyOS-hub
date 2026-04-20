# Design: pwa-enable

## Technical Approach

Transform rallyOS-hub client into an installable PWA using vite-plugin-pwa. The approach leverages Vite's built-in service worker generation to cache static assets (HTML, JS, CSS) while excluding Socket.IO connections from caching to ensure real-time functionality works correctly when online.

## Architecture Decisions

### Decision: Service Worker Strategy

**Choice**: `generateSW` strategy (default from vite-plugin-pwa)
**Alternatives considered**: `injectManifest` (more control, requires manual SW creation)
**Rationale**: Simpler implementation with auto-update capability. The spec requires auto-update on rebuilds, which `generateSW` handles natively with `registerType: 'autoUpdate'`.

### Decision: Runtime Caching Strategy

**Choice**: CacheFirst for static assets, NetworkOnly for Socket.IO
**Alternatives considered**: NetworkFirst (slower), StaleWhileRevalidate (complex)
**Rationale**: Static assets (JS, CSS, assets) rarely change between sessions. CacheFirst ensures instant load. Socket.IO must always connect fresh — NetworkOnly prevents SW from intercepting WS connections.

### Decision: Icon Source

**Choice**: Use existing `client/src/assets/icon.jpeg` as source
**Alternatives considered**: Create new SVG icons from scratch
**Rationale**: Already exists in project. Will generate PNG variants at build time using vite-plugin-pwa's workbox banner plugin.

### Decision: Error Handling

**Choice**: Display friendly connection error in SocketContext
**Alternatives considered**: Show raw network errors
**Rationale**: Per spec REQ-005, users should see "Servidor no disponible. Verificá la red." — not cryptic error codes.

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser                                  │
├─────────────────────────────────────────────────────────────┤
│  User opens app                                              │
│       │                                                     │
│       ├───► Service Worker registers                       │
│       │         │                                           │
│       │         ├───► Cache: /assets/*, *.js, *.css (CacheFirst)│
│       │         │                                           │
│       │         └───► Socket.IO ──► Server (NetworkOnly)     │
│       │                                                     │
│       └───► If offline ──► Show "Servidor no disponible"    │
└─────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/vite.config.ts` | Modify | Add VitePWA plugin with workbox config |
| `client/index.html` | Modify | Add PWA meta tags (theme-color, apple-touch-icon) |
| `client/public/manifest.json` | Create | PWA manifest for installability |
| `client/public/icons/` | Create | Generated icons (192x192, 512x512, 180x180) |

## Open Questions

- [ ] Should we auto-register the service worker or defer to user interaction? (Current: auto via registerType: 'autoUpdate')
- [ ] Do we need to handle iOS Safari specifically? (Note: iOS requires apple-touch-icon, already in spec)

## Next Step

Ready for tasks (sdd-tasks).