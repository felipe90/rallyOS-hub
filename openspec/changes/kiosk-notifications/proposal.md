# Proposal: Kiosk Notifications

## Intent

Tournament organizers need real-time alerts on the kiosk TV screen. No notification infrastructure exists. Add `SEND_NOTIFICATION` → `KIOSK_NOTIFICATION` Socket.IO event pair, following the `REGENERATE_PIN`/`PIN_REGENERATED` pattern.

## Scope

**In:** Socket events + types + validation (`shared/`); `AdminHandler` handler (PIN check, rate limit 5/min, HTML sanitization, broadcast); `KioskNotificationToast` organism (animated snackbar at bottom, auto-dismiss); Web Audio API sounds per type; "Create Notification" modal in OwnerDashboardPage; i18n labels.

**Out:** Notification history/persistence; table-targeting; spectator/referee consumption.

## Capabilities

### New Capabilities
- `kiosk-notifications`: Real-time organizer-to-kiosk alert delivery with typed notifications, color-coded toast display, and distinct audio per type

### Modified Capabilities
- `kiosk-display`: Kiosk page renders notification toast overlay consuming `KIOSK_NOTIFICATION`; toast must not obscure match scores

## Approach

**Approach 1 (exploration recommended):** Dedicated event pair in `AdminHandler`. Owner emits `SEND_NOTIFICATION` → server validates PIN, sanitizes HTML, rate-limits, broadcasts `KIOSK_NOTIFICATION`. Kiosk `useSocketState` listens and exposes state. `KioskNotificationToast` renders at screen bottom with Framer Motion. Web Audio API generates 4 distinct chimes (info=soft, warning=attention, error=alert, important=bell). Chromium kiosk already uses `--autoplay-policy=no-user-gesture-required`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `shared/events.ts` | Modified | SEND_NOTIFICATION / KIOSK_NOTIFICATION events |
| `shared/types.ts` | Modified | KioskNotificationType / KioskNotificationData |
| `shared/validation.ts` | Modified | Validation rules (type enum, max 280 chars) |
| `server/src/handlers/AdminHandler.ts` | Modified | Register handler: validate PIN, sanitize, broadcast |
| `client/src/hooks/useSocketState.ts` | Modified | Listen for KIOSK_NOTIFICATION |
| `client/src/pages/OwnerDashboardPage/` | Modified | Add "Create Notification" button + modal |
| `client/src/pages/KioskAllTablesPage/` | Modified | Render KioskNotificationToast |
| `client/src/components/organisms/KioskNotificationToast/` | New | Toast component (animations + audio) |
| `client/src/i18n/locales/{es,en-US}.json` | Modified | Notification labels |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Toast obscures scores | Low | Bottom position, compact, semi-transparent, auto-dismiss |
| Audio blocked | Low | `--autoplay-policy=no-user-gesture-required` already active; silent fallback |
| Spam notifications | Low | Rate limit 5/min/IP, PIN-gated, HTML stripped |

## Rollback Plan

Revert commit. Remove `KIOSK_NOTIFICATION` listener from `useSocketState` (kiosk ignores unknown events). Delete `KioskNotificationToast` directory. Remove modal code from OwnerDashboardPage.

## Dependencies

- Web Audio API (built-in, zero npm deps)
- Framer Motion (already in project)
- Existing Chromium autoplay kiosk flag

## Success Criteria

- [ ] Owner opens modal, selects type, writes message, submits
- [ ] Notification appears as color-coded toast at screen bottom within 500ms
- [ ] Each type plays distinct sound on kiosk
- [ ] Toast auto-dismisses after configured duration
- [ ] Rate limit blocks >5/min from same IP
- [ ] HTML tags stripped; message ≤280 chars enforced
- [ ] Scores remain visible and unobstructed
- [ ] All tests pass under `strict_tdd: true`
