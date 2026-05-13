# Proposal: add-qr-and-referi-session

## Intent

Solve four user needs:
1. **WiFi QR to TV Scoreboard**: A WiFi QR code on the TV scoreboard lets attendees scan and connect to the network instantly — no password sharing needed. Domain text below the QR guides them to the app.
2. **Referee PIN Session Persistence**: When a referee enters their PIN to join a table, the session should persist in localStorage so that if the referee refreshes the page, they don't have to re-enter the PIN.
3. **Scoreboard Default Language**: The TV scoreboard page should default to Spanish (`es`) instead of the browser's language, since the deployment target speaks Spanish.
4. **Language Toggle Scope**: The language toggle button should only appear on `/auth`. After authentication, the chosen language is used app-wide and the toggle is hidden on all other pages.

## Scope

### In Scope
- WiFi QR code display on TV scoreboard page (standard `WIFI:T:WPA;S:{ssid};P:{pass};;` format)
- Domain/link text rendered below QR: "Abrí rallyos-hub.local" or equivalent
- Referee session persistence via localStorage (`rallyos_ref_session_{tableId}`)
- Session restoration on app load (skip PIN modal if session valid and table still active)
- PIN modal behavior: show only if no valid session exists
- Scoreboard page defaults to Spanish (`es`) regardless of browser locale
- Language toggle visible ONLY on `/auth` page; hidden on all other routes
- User's language choice on `/auth` persists app-wide via context/localStorage

### Out of Scope
- Changes to server-side PIN validation logic
- New authentication flows beyond PIN
- Custom app deep-linking (QR is WiFi-only, app accessed via captive portal / domain)

## Capabilities

### New Capabilities
- **`referee-session-persistence`**: localStorage-based PIN session for referees — app reads session on load, skips PIN modal if valid
- **`qr-scoreboard-link`**: WiFi QR code on TV scoreboard — connects attendees to the network instantly, with domain text below for manual navigation
- **`scoreboard-default-spanish`**: Scoreboard page defaults to Spanish language regardless of browser/OS locale
- **`auth-only-language-toggle`**: Language toggle rendered exclusively on `/auth` page; after authentication, the chosen language persists app-wide and the toggle is removed from all other routes

### Modified Capabilities
- None — existing PIN validation and QR protocol remain unchanged

## Approach

### Referee Session Persistence
- **Storage key**: `rallyos_ref_session_{tableId}` storing `{ pin, joinedAt }`
- **On PIN entry**: After `SET_REF` succeeds, write session to localStorage
- **On app load**: Check localStorage for session; if found and table is `WAITING|CONFIGURING|LIVE`, skip PIN modal and restore session
- **Session invalidation**: Clear session on `LEAVE_TABLE` or when table transitions to `FINISHED`

### QR Scoreboard Link
- QR encodes standard WiFi format: `WIFI:T:WPA;S:{ssid};P:{password};H:false;;`
- SSID and password sourced from `HUB_SSID` env var and setup config (dynamic per deployment)
- Domain/URL text displayed below QR: "Abrí {domain}" (uses `HUB_DOMAIN` env var)
- No deep link — QR is network-gateway only; app access via standard domain

### Scoreboard Default Spanish
- Override the scoreboard page's locale to `es` on mount, ignoring browser/OS locale
- All other pages (owner, referee, admin) keep the existing language detection behavior

### Auth-Only Language Toggle
- Conditionally render the language toggle: only when current route is `/auth`
- Language choice made on `/auth` is stored (context or localStorage) and applied globally
- On pages other than `/auth`, the toggle is not rendered regardless of route changes
- Scoreboard, owner, referee pages all respect the user's chosen language without showing the toggle

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/pages/ScoreboardPage.tsx` | Modified | Add QR code display; force Spanish locale |
| `client/src/hooks/useRefereeSession.ts` | New | localStorage session CRUD (read/write/clear) |
| `client/src/components/.../RefereePinModal.tsx` | Modified | Check session before showing modal |
| `client/src/contexts/SocketContext.tsx` | Modified | Restore session after reconnect |
| `client/src/components/LanguageSwitcher.tsx` | Modified | Only render when route is `/auth` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Browser clears localStorage | Low | Referee re-enters PIN; graceful degradation |
| Dev/prod WiFi mismatch in QR | Med | SSID/password from env vars; dev overrides with `.env.local` |
| Session persists for wrong table state | Low | Validate table status on restoration |

## Rollback Plan

1. Remove localStorage read/write calls from `useRefereeSession.ts`
2. Remove QR display from `ScoreboardPage.tsx` (WiFi QR + domain text)
3. Revert `RefereePinModal` to always show on load
4. Remove route restriction from `LanguageSwitcher` to restore toggle on all pages

## Success Criteria

- [ ] Attendee scans WiFi QR and device connects to the correct network
- [ ] Domain text below QR is readable on TV and matches the deployment domain
- [ ] QR SSID/password change per environment (local dev vs Orange Pi production)
- [ ] Referee with valid session skips PIN modal on page refresh
- [ ] Referee who leaves table or refreshes on FINISHED table must re-enter PIN
- [ ] Scoreboard page always renders in Spanish regardless of browser language settings
- [ ] Language toggle visible only on `/auth`; hidden on all other pages
- [ ] User's language choice on `/auth` persists across all pages after navigation