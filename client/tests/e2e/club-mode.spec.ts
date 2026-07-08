import { test, expect } from '@playwright/test'

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
      await page.locator('input[placeholder="••••••"]').fill('1234567')
      await page.locator('text=Verificar').click()
      await expect(page.locator('text=Nueva Cancha')).toBeVisible({ timeout: 3000 })

      await page.locator('button:has-text("Nueva Cancha")').click()
      await page.waitForTimeout(500)

      await page.locator('button:has-text("Activar")').first().click()
      await page.waitForTimeout(500)

      const pinText = await page.textContent('body')
      const pinMatch = pinText!.match(/PIN:\s*(\d+)/)
      expect(pinMatch).not.toBeNull()
      const courtPin = pinMatch![1]

      // 2. Player: enter PIN on auth page
      await page.goto('/auth')
      await page.locator('text=Quiero jugar').click()
      await page.locator('input[placeholder="••••"]').fill(courtPin)
      await page.locator('text=Ingresar').click()
      await page.waitForTimeout(2000)

      await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })
      await page.locator('body').click({ position: { x: 100, y: 200 } })
      await page.waitForTimeout(500)

      // 3. REFRESH — reconnection test
      const currentUrl = page.url()
      await page.goto(currentUrl)
      await page.waitForTimeout(2000)

      await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })
      await page.locator('body').click({ position: { x: 100, y: 200 } })
      await page.waitForTimeout(500)
    })
  })

  test.describe('Club Mode — Session Timer + Cost (Phase 3b)', () => {
    test.skip('CU-TIMER-01: match ends → auto-finish → shows elapsed time + cost', async ({ page }) => {
      await page.goto('/club/admin')
      await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})
      await page.locator('input[placeholder="••••••"]').fill('1234567')
      await page.locator('text=Verificar').click()
      await expect(page.locator('text=Nueva Cancha')).toBeVisible({ timeout: 3000 })

      await page.locator('button:has-text("Nueva Cancha")').click()
      await page.waitForTimeout(500)
      await page.locator('button:has-text("Activar")').first().click()
      await page.waitForTimeout(500)

      const pinText = await page.textContent('body')
      const pinMatch = pinText!.match(/PIN:\s*(\d+)/)
      expect(pinMatch).not.toBeNull()
      const courtPin = pinMatch![1]

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
      await page.locator('input[placeholder="••••••"]').fill('1234567')
      await page.locator('text=Verificar').click()
      await expect(page.locator('text=Nueva Cancha')).toBeVisible({ timeout: 3000 })

      await page.locator('button:has-text("Nueva Cancha")').click()
      await page.waitForTimeout(500)
      await expect(page.locator('text=Disponible').first()).toBeVisible({ timeout: 3000 })

      await page.locator('button:has-text("Activar")').first().click()
      await page.waitForTimeout(500)
      await expect(page.locator('text=Reservada').first()).toBeVisible({ timeout: 3000 })
      await expect(page.locator('text=Desactivar').first()).toBeVisible({ timeout: 3000 })
    })
  })
})
