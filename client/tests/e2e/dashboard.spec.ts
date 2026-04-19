import { test, expect } from '@playwright/test'

// Safe localStorage helpers
async function setLocalStorage(page: any, key: string, value: string) {
  try {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value])
  } catch { /* ignore */ }
}

test.describe('Dashboard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setLocalStorage(page, 'role', 'owner')
    await page.goto('/dashboard/owner')
    await page.waitForLoadState('networkidle')
  })

  test('loads owner dashboard', async ({ page }) => {
    // Just check it loads without error
    await expect(page).toHaveURL(/.*\/dashboard\/owner/)
  })

  test('shows create table button for owner', async ({ page }) => {
    await expect(page.locator('button:has-text("Nueva Mesa")')).toBeVisible()
  })
})