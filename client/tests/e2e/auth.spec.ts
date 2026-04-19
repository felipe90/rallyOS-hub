import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/auth')
  })

  test('shows role selection by default', async ({ page }) => {
    await expect(page.locator('text=Elige tu rol')).toBeVisible()
    await expect(page.locator('button:has-text("Organizador")')).toBeVisible()
    await expect(page.locator('button:has-text("Árbitro")')).toBeVisible()
    await expect(page.locator('button:has-text("Espectador")')).toBeVisible()
  })

  test('referee login goes to referee dashboard', async ({ page }) => {
    await page.click('button:has-text("Árbitro")')
    await expect(page).toHaveURL(/.*\/dashboard\/referee/)
  })

  test('spectator login goes to spectator dashboard', async ({ page }) => {
    await page.click('button:has-text("Espectador")')
    await expect(page).toHaveURL(/.*\/dashboard/)
  })

  test('organizador goes to PIN entry', async ({ page }) => {
    await page.click('button:has-text("Organizador")')
    await expect(page.locator('text=Ingresa tu PIN de organizador')).toBeVisible()
  })
})

test.describe('Dashboard Access', () => {
  test('referee dashboard redirects without auth', async ({ page }) => {
    await page.goto('/dashboard/referee')
    // Should redirect to auth
    await expect(page).toHaveURL(/.*\/auth/)
  })
})