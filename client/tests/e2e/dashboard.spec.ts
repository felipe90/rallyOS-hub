import { test, expect } from '@playwright/test'

test.describe('Dashboard Flow', () => {
  test('referee can navigate to referee dashboard', async ({ page }) => {
    // First go to auth and login as referee
    await page.goto('/auth')
    await page.click('button:has-text("Árbitro")')
    await expect(page).toHaveURL(/.*\/dashboard\/referee/)
  })

  test('spectator can navigate to spectator dashboard', async ({ page }) => {
    await page.goto('/auth')
    await page.click('button:has-text("Espectador")')
    await expect(page).toHaveURL(/.*\/dashboard/)
  })
})