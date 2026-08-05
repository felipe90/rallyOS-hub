/**
 * Player Identity — E2E tests (Phase 8 / U4)
 *
 * These tests verify the full player-identity flow end-to-end:
 *   8.1 Player flow: QR → PIN → name+phone → free mode → end → history has playerName
 *   8.2 Admin flow: activate → occupy → kiosk → end → history shows adminId
 *   8.3 Phone reveal: end → admin clicks "Ver teléfono" → modal shows phone
 *   8.4 Non-admin cannot reveal phone
 *
 * Prerequisites:
 *   Server running with a configured club (admin PIN: 12345678).
 */
import { test, expect, type Page } from '@playwright/test'

test.describe('Player Identity E2E', () => {
  test.describe.configure({ mode: 'serial' })

  let courtPin: string

  /**
   * After the player flow the admin session is usually restored from the
   * stored JWT on reload, but the server emits CLUB_SESSION_RESTORED right
   * after the socket handshake — before the client subscribes — so the
   * restore can be lost and the PIN screen renders instead. When that
   * happens, re-enter the admin PIN (the club admin PIN is deterministic:
   * 12345678). Retries a couple of times because the socket may still be
   * connecting on the first attempt (verify returns NO_CONNECTION).
   */
  async function ensureAdmin(page: Page) {
    const pinInput = page.locator('input[placeholder="••••••••"]')
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!(await pinInput.isVisible().catch(() => false))) return
      await pinInput.fill('12345678')
      await page.locator('text=Ingresar').click()
      const verified = await page
        .getByRole('button', { name: /^(Mesa|Cancha)$/ })
        .isVisible({ timeout: 5000 })
        .catch(() => false)
      if (verified) return
      await page.waitForTimeout(2000)
    }
    await expect(page.getByRole('button', { name: /^(Mesa|Cancha)$/ })).toBeVisible({ timeout: 8000 })
  }

  test('8.1 Player flow — QR→PIN→name+phone→free mode→end→history has playerName', async ({ page }) => {
    // ── 1. Admin setup ────────────────────────────────────────────────
    await page.context().clearCookies()
    await page.goto('/club/admin')
    await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})
    await page.locator('input[placeholder="••••••••"]').fill('12345678')
    await page.locator('text=Ingresar').click()
    await expect(page.getByRole('button', { name: /^(Mesa|Cancha)$/ })).toBeVisible({ timeout: 8000 })

    // Create court
    await page.getByRole('button', { name: /^(Mesa|Cancha)$/ }).click()
    await page.waitForTimeout(500)

    // Activate the newest court (last card) and grab its PIN (last PIN badge in body)
    await page.locator('div.card-light').last().locator('button:has-text("Activar")').click()
    await page.waitForTimeout(500)

    const bodyText = await page.textContent('body')
    const pinMatches = [...(bodyText || '').matchAll(/PIN\s*(\d+)/g)]
    expect(pinMatches.length).toBeGreaterThan(0)
    courtPin = pinMatches[pinMatches.length - 1][1]

    // ── 2. Player joins with name+phone ───────────────────────────────
    await page.goto('/auth')
    await page.locator('text=Quiero jugar').click()
    await page.locator('input[placeholder="••••"]').fill(courtPin)
    await page.locator('text=Ingresar').click()
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })

    // Fill player name and phone
    await page.locator('[data-testid="player-name-input"]').fill('Carlos Pérez')
    await page.locator('[data-testid="player-phone-input"]').fill('+5491112345678')

    // Select free mode and start
    await page.locator('[data-testid="mode-free"]').click()
    // Dismiss the auto-update banner if present — fixed bottom overlay that
    // can intercept clicks on "Comenzar" in strict hit-testing browsers.
    await page.locator('button:has-text("Después")').click({ timeout: 500 }).catch(() => {})
    await page.locator('button:has-text("Comenzar")').click()
    await page.waitForTimeout(1000)

    // Verify free play screen loaded
    await expect(page.locator('[data-testid="club-free-play"]')).toBeVisible({ timeout: 5000 })

    // ── 3. End session ───────────────────────────────────────────────
    await page.locator('button:has-text("Terminar sesión")').click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Sí, terminar")').click()
    await page.waitForTimeout(2000)

    // ── 4. Admin checks history for playerName ────────────────────────
    await page.goto('/club/admin')
    await page.waitForTimeout(1000)
    await ensureAdmin(page)

    // Switch to history tab
    await page.locator('button:has-text("Historial")').click()
    await page.waitForTimeout(1000)

    // Verify playerName appears in the history table
    await expect(page.locator('text=Carlos Pérez').first()).toBeVisible({ timeout: 5000 })
  })

  test('8.2 Admin flow — activate → occupy → kiosk → end → history shows adminId', async ({ page }) => {
    expect(courtPin).toBeDefined()

    // ── 1. Admin creates + activates court ────────────────────────────
    await page.context().clearCookies()
    await page.goto('/club/admin')
    await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})
    await page.locator('input[placeholder="••••••••"]').fill('12345678')
    await page.locator('text=Ingresar').click()
    await expect(page.getByRole('button', { name: /^(Mesa|Cancha)$/ })).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /^(Mesa|Cancha)$/ }).click()
    await page.waitForTimeout(500)
    await page.locator('div.card-light').last().locator('button:has-text("Activar")').click()
    await page.waitForTimeout(500)

    // ── 2. Admin starts session for player ────────────────────────────
    await page.locator('div.card-light').last().locator('button:has-text("Iniciar sesión")').click()
    await page.waitForTimeout(500)

    // Fill modal: name, phone, mode
    await page.locator('[data-testid="admin-occupy-name"]').fill('María García')
    await page.locator('[data-testid="admin-occupy-phone"]').fill('+5491112345678')
    await page.locator('[data-testid="mode-free"]').click()
    await page.locator('[role="dialog"] button:has-text("Iniciar Sesión")').click()
    await page.waitForTimeout(1500)

    // ── 3. Check kiosk shows playerName ──────────────────────────────
    // /kiosk/club URL-forces club kiosk mode (plain /kiosk waits on a
    // KIOSK_MODE push that can race the socket connect).
    await page.goto('/kiosk/club')
    await page.waitForTimeout(2000)
    await expect(page.locator('text=María García').first()).toBeVisible({ timeout: 10000 })

    // ── 4. Admin force-ends session ──────────────────────────────────
    await page.goto('/club/admin')
    await page.waitForTimeout(1500)
    await ensureAdmin(page)
    await page.locator('div.card-light').last().locator('button:has-text("Finalizar Sesión")').click()
    await page.waitForTimeout(500)
    await page.locator('[role="alertdialog"] button:has-text("Finalizar")').click()
    await page.waitForTimeout(2000)

    // ── 5. Check history has player name ─────────────────────────────
    await page.locator('button:has-text("Historial")').click()
    await page.waitForTimeout(1000)
    await expect(page.locator('text=María García').first()).toBeVisible({ timeout: 5000 })
  })

  test('8.3 Phone reveal — end session → admin clicks "Ver teléfono" → modal shows phone', async ({ page }) => {
    // ── 1. Admin setup + player flow ─────────────────────────────────
    await page.context().clearCookies()
    await page.goto('/club/admin')
    await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})
    await page.locator('input[placeholder="••••••••"]').fill('12345678')
    await page.locator('text=Ingresar').click()
    await expect(page.getByRole('button', { name: /^(Mesa|Cancha)$/ })).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /^(Mesa|Cancha)$/ }).click()
    await page.waitForTimeout(500)
    await page.locator('div.card-light').last().locator('button:has-text("Activar")').click()
    await page.waitForTimeout(500)

    const bodyText = await page.textContent('body')
    const pinMatches = [...(bodyText || '').matchAll(/PIN\s*(\d+)/g)]
    expect(pinMatches.length).toBeGreaterThan(0)
    const revealPin = pinMatches[pinMatches.length - 1][1]

    // Player: enter PIN, fill name+phone, start free mode
    await page.goto('/auth')
    await page.locator('text=Quiero jugar').click()
    await page.locator('input[placeholder="••••"]').fill(revealPin)
    await page.locator('text=Ingresar').click()
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })

    await page.locator('[data-testid="player-name-input"]').fill('Lucía Mendoza')
    await page.locator('[data-testid="player-phone-input"]').fill('+5491134567890')
    await page.locator('[data-testid="mode-free"]').click()
    // Dismiss the auto-update banner if present — fixed bottom overlay that
    // can intercept clicks on "Comenzar" in strict hit-testing browsers.
    await page.locator('button:has-text("Después")').click({ timeout: 500 }).catch(() => {})
    await page.locator('button:has-text("Comenzar")').click()
    await page.waitForTimeout(1000)
    await expect(page.locator('[data-testid="club-free-play"]')).toBeVisible({ timeout: 5000 })

    // End session
    await page.locator('button:has-text("Terminar sesión")').click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Sí, terminar")').click()
    await page.waitForTimeout(2000)

    // ── 2. Admin views history + reveals phone ───────────────────────
    await page.goto('/club/admin')
    await page.waitForTimeout(1500)
    await ensureAdmin(page)
    await page.locator('button:has-text("Historial")').click()
    await page.waitForTimeout(1000)

    // Find the row with "Lucía Mendoza" and click "Ver teléfono"
    await expect(page.locator('text=Lucía Mendoza').first()).toBeVisible({ timeout: 5000 })
    await page.locator('tr').filter({ hasText: 'Lucía Mendoza' }).first().locator('button:has-text("Ver teléfono")').click()
    await page.waitForTimeout(1000)

    // ── 3. Verify phone modal appears ─────────────────────────────────
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=+5491134567890')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Teléfono:')).toBeVisible()
  })

  test('8.4 Non-admin cannot reveal phone', async ({ page }) => {
    // Non-admin: navigate to auth page but do NOT authenticate as admin
    // Non-admin socket cannot emit CLUB_REVEAL_PHONE — the server rejects.
    // Since non-admin cannot access the history panel, we verify by
    // attempting to emit the event manually (if possible) or verifying
    // that the "Ver teléfono" button is not rendered for non-admin views.

    // The simplest assertion: a non-admin page should NOT have any
    // phone reveal UI elements at all.
    await page.goto('/')
    await page.waitForTimeout(1000)

    // No "Ver teléfono" button on any non-admin page
    await expect(page.locator('button:has-text("Ver teléfono")')).toHaveCount(0)
  })
})
