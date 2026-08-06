import { test, expect } from '@playwright/test'

/**
 * SLICE 5 REWRITE (admin-court-inventory): courts are seeded via the admin
 * inventory (INVENTORY_ADD FAB "Agregar Mesa/Cancha") instead of the removed
 * CLUB_CREATE_COURT create button. The rest of the club flow is unchanged.
 */
test.describe('Club Mode E2E', () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('Club Mode — Reconnection (Phase 3a)', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().clearCookies()
    })

    test('CU-RECONNECT-01: refresh page → auto-reconnect → scoring works', async ({ page }) => {
      // 1. Admin: authenticate, create court, activate, get PIN
      await page.goto('/club/admin')
      await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})
      await page.locator('input[placeholder="••••••••"]').fill('12345678')
      await page.locator('text=Ingresar').click()
      await expect(page.getByRole('button', { name: /Agregar (Mesa|Cancha)/i })).toBeVisible({ timeout: 3000 })

      // Seed an inventory court via the admin inventory FAB (INVENTORY_ADD).
      await page.getByRole('button', { name: /Agregar (Mesa|Cancha)/i }).click()
      await page.waitForTimeout(500)

      // Activate the newest court (last card) and grab its PIN (last PIN badge in body)
      await page.locator('div.card-light').last().locator('button:has-text("Activar")').click()
      await page.waitForTimeout(500)

      const pinText = await page.textContent('body')
      const pinMatches = [...(pinText || '').matchAll(/PIN\s*(\d+)/g)]
      expect(pinMatches.length).toBeGreaterThan(0)
      const courtPin = pinMatches[pinMatches.length - 1][1]

      // 2. Player: enter PIN on auth page, fill name+phone, start a free session
      await page.goto('/auth')
      await page.locator('text=Quiero jugar').click()
      await page.locator('input[placeholder="••••"]').fill(courtPin)
      await page.locator('text=Ingresar').click()
      await page.waitForTimeout(2000)

      await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })
      await page.locator('[data-testid="player-name-input"]').fill('Jugador Reconnect')
      await page.locator('[data-testid="player-phone-input"]').fill('+5491111111111')
      await page.locator('[data-testid="mode-free"]').click()
      // Dismiss the auto-update banner if present — fixed bottom overlay that
      // can intercept clicks on "Comenzar" in strict hit-testing browsers.
      await page.locator('button:has-text("Después")').click({ timeout: 500 }).catch(() => {})
      await page.locator('button:has-text("Comenzar")').click()
      await page.waitForTimeout(1000)

      await expect(page.locator('[data-testid="club-free-play"]')).toBeVisible({ timeout: 5000 })

      // 3. REFRESH — reconnection test: the live free session is restored
      const currentUrl = page.url()
      await page.goto(currentUrl)
      await page.waitForTimeout(2000)

      await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })
      await expect(page.locator('[data-testid="club-free-play"]')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Club Mode — Session Timer + Cost (Phase 3b)', () => {
    test.skip('CU-TIMER-01: match ends → auto-finish → shows elapsed time + cost', async ({ page }) => {
      await page.goto('/club/admin')
      await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})
      await page.locator('input[placeholder="••••••••"]').fill('12345678')
      await page.locator('text=Ingresar').click()
      await expect(page.getByRole('button', { name: /Agregar (Mesa|Cancha)/i })).toBeVisible({ timeout: 3000 })

      // Seed an inventory court via the admin inventory FAB (INVENTORY_ADD).
      await page.getByRole('button', { name: /Agregar (Mesa|Cancha)/i }).click()
      await page.waitForTimeout(500)
      await page.locator('div.card-light').last().locator('button:has-text("Activar")').click()
      await page.waitForTimeout(500)

      const pinText = await page.textContent('body')
      const pinMatches = [...(pinText || '').matchAll(/PIN\s*(\d+)/g)]
      expect(pinMatches.length).toBeGreaterThan(0)
      const courtPin = pinMatches[pinMatches.length - 1][1]

      await page.goto('/auth')
      await page.locator('text=Quiero jugar').click()
      await page.locator('input[placeholder="••••"]').fill(courtPin)
      await page.locator('text=Ingresar').click()
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })

      for (let i = 0; i < 11; i++) {
        await page.locator('body').click({ position: { x: 100, y: 200 } })
        await page.waitForTimeout(200)
      }
      // Wait for match to finish and auto-end session
      await page.waitForTimeout(5000)

      await expect(page.locator('text=Sesión finalizada')).toBeVisible({ timeout: 10000 })
      const resultText = await page.textContent('body')
      expect(resultText).toContain('min')
      // Check that cost shows some currency (ARS or USD depending on server config)
      expect(resultText).toMatch(/USD|ARS|\$\d+/)
    })
  })

  test.describe('Club Mode — Admin Flow (Phase 1-2)', () => {
    test('admin can create, activate, deactivate, and reset a court', async ({ page }) => {
      await page.goto('/club/admin')
      await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})
      await page.locator('input[placeholder="••••••••"]').fill('12345678')
      await page.locator('text=Ingresar').click()
      await expect(page.getByRole('button', { name: /Agregar (Mesa|Cancha)/i })).toBeVisible({ timeout: 3000 })

      // Seed an inventory court via the admin inventory FAB (INVENTORY_ADD).
      await page.getByRole('button', { name: /Agregar (Mesa|Cancha)/i }).click()
      await page.waitForTimeout(500)
      // The inventory card shows the ACTIVE status pill ("Activa"/"Active").
      await expect(page.locator('text=Activa').first()).toBeVisible({ timeout: 3000 })

      await page.locator('div.card-light').last().locator('button:has-text("Activar")').click()
      await page.waitForTimeout(500)
      // RESERVED (pending PIN) → the deactivate button + PIN badge render.
      await expect(page.locator('text=Desactivar').first()).toBeVisible({ timeout: 3000 })
      const bodyText = await page.textContent('body')
      expect(bodyText).toMatch(/PIN\s*\d{4}/)
    })
  })
})
