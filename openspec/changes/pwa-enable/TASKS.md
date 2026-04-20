# Tasks: pwa-enable

## Phase 1: Dependencies

- [x] 1.1 Install vite-plugin-pwa: `npm install -D vite-plugin-pwa workbox-window`
- [x] 1.2 Verify Vite version compatibility (requires Vite 5+, current is 8.0.4 ✓)

## Phase 2: Vite Configuration

- [x] 2.1 Add VitePWA plugin to `client/vite.config.ts`
- [x] 2.2 Configure workbox: strategy 'GenerateSW', registerType 'autoUpdate'
- [x] 2.3 Configure runtimeCaching for static assets (CacheFirst)
- [x] 2.4 Exclude Socket.IO from caching (NetworkOnly)
- [x] 2.5 Configure manifest auto-generation or reference existing

## Phase 3: Manifest

- [x] 3.1 Create `client/public/manifest.json` with required fields
- [x] 3.2 Fields: name "RallyOS", short_name "RallyOS", theme_color #1a1a2e, display "standalone"
- [x] 3.3 Add icon references (192x192, 512x512)

## Phase 4: Meta Tags

- [x] 4.1 Add `<meta name="theme-color" content="#1a1a2e">` to `client/index.html`
- [x] 4.2 Add `<meta name="apple-mobile-web-app-capable" content="yes">`
- [x] 4.3 Add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- [x] 4.4 Add `<meta name="apple-mobile-web-app-title" content="RallyOS">`
- [x] 4.5 Update viewport with `maximum-scale=1`

## Phase 5: Icons

- [x] 5.1 Verify `client/src/assets/icon.jpeg` exists (✓ already present)
- [x] 5.2 Generate 192x192 PNG → `client/public/icons/icon-192.png`
- [x] 5.3 Generate 512x512 PNG → `client/public/icons/icon-512.png`
- [x] 5.4 Generate 180x180 PNG → `client/public/icons/apple-touch-icon.png` (optional)

## Phase 6: Error Handling

- [x] 6.1 Locate SocketContext or connection handling code
- [x] 6.2 Add friendly error message for connection failure
- [x] 6.3 Message: "Servidor no disponible. Verificá la red."

## Phase 7: Verification

- [x] 7.1 Run `npm run build` to verify no errors
- [x] 7.2 Test service worker registration in dev mode
- [ ] 7.3 Run Lighthouse PWA audit (target: score ≥ 90)
- [x] 7.4 Verify manifest loads at /manifest.json
- [ ] 7.5 Test installation on Chrome/Android (manual)

## Dependencies Graph

```
1.1 (install) → 2.1 (vite config)
2.1 → 3.1 (manifest - may be auto-generated)
2.1 → 5.1 (icons - may be auto-generated)
4.1-4.5 (independent)
6.1-6.2 (independent)
7.1 → 7.2-7.5 (requires build first)
```

## Estimated Time

| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1 | 2 | Dependencies |
| Phase 2 | 5 | Vite Configuration |
| Phase 3 | 3 | Manifest |
| Phase 4 | 5 | Meta Tags |
| Phase 5 | 4 | Icons |
| Phase 6 | 3 | Error Handling |
| Phase 7 | 5 | Verification |
| **Total** | **27** | |