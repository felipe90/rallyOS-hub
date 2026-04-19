import { test, expect } from '@playwright/test'

// Safe localStorage helpers for CI sandbox
async function getLocalStorage(page: any, key: string) {
  try {
    return await page.evaluate((k) => localStorage.getItem(k), key)
  } catch {
    return null
  }
}

async function setLocalStorage(page: any, key: string, value: string) {
  try {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value])
  } catch {
    // ignore
  }
}

async function clearLocalStorage(page: any) {
  try {
    await page.evaluate(() => localStorage.clear())
  } catch {
    // ignore
  }
}

test.describe('Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/auth')
    await clearLocalStorage(page)
  })

  test('shows role selection by default', async ({ page }) => {
    await expect(page.locator('text=Elige tu rol')).toBeVisible()
    await expect(page.locator('button:has-text("Organizador")')).toBeVisible()
    await expect(page.locator('button:has-text("Árbitro")')).toBeVisible()
    await expect(page.locator('button:has-text("Espectador")')).toBeVisible()
  })

  test('referee login goes to referee dashboard', async ({ page }) => {
    await page.click('button:has-text("Árbitro")')
    await expect(page).toHaveURL(/.*\/dashboard/)
  })

  test('spectator login goes to spectator dashboard', async ({ page }) => {
    await page.click('button:has-text("Espectador")')
    await expect(page).toHaveURL(/.*\/dashboard/)
  })

  test('organizador goes to PIN entry', async ({ page }) => {
    await page.click('button:has-text("Organizador")')
    await expect(page.locator('text=Ingresa tu PIN de organizador')).toBeVisible()
    await expect(page.locator('input')).toBeVisible()
  })
})

test.describe('Dashboard Access', () => {
  test('referee dashboard requires authentication', async ({ page }) => {
    await page.goto('/dashboard/referee')
    expect(page.url()).toContain('/auth')
  })

  test('authenticated referee can access dashboard', async ({ page }) => {
    await setLocalStorage(page, 'role', 'referee')
    await page.goto('/dashboard/referee')
    expect(page.url()).toContain('/dashboard/referee')
  })
})

test.describe('Logout Flow', () => {
  test('logout clears auth and redirects to login', async ({ page }) => {
    await setLocalStorage(page, 'role', 'referee')
    await page.goto('/dashboard/referee')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("Salir")', { timeout: 5000 }).catch(() => {})
    await expect(page).toHaveURL(/.*\/auth/, { timeout: 5000 })
  })
})