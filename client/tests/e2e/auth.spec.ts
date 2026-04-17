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
    await page.goto('/')
    await clearLocalStorage(page)
  })

  test('shows auth page by default', async ({ page }) => {
    expect(page.url()).toContain('/auth')
    await expect(page.locator('text=RallyOS')).toBeVisible()
    await expect(page.locator('text=Ingresa tu PIN')).toBeVisible()
  })

  test('renders PIN input field', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('maxlength', '5')
  })

  test('submit button is disabled with empty PIN', async ({ page }) => {
    const button = page.locator('button:has-text("Ingresar")')
    await expect(button).toBeDisabled()
  })

  test('submit button is disabled with short PIN', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await input.fill('123')
    const button = page.locator('button:has-text("Ingresar")')
    await expect(button).toBeDisabled()
  })

  test('submit button is enabled with 5-digit PIN', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await input.fill('12345')
    const button = page.locator('button:has-text("Ingresar")')
    await expect(button).not.toBeDisabled()
  })

  test('accepts only numeric input', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await input.fill('abc12xyz34')
    const value = await input.inputValue()
    expect(/^\d*$/.test(value)).toBe(true)
    expect(value.length).toBeLessThanOrEqual(5)
  })

  test('shows error for invalid PIN', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await input.fill('00000')
    const button = page.locator('button:has-text("Ingresar")')
    await button.click()
    await expect(page.locator('text=PIN inválido')).toBeVisible()
  })

  test('navigates to dashboard with valid PIN', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await input.fill('12345')
    const button = page.locator('button:has-text("Ingresar")')
    await button.click()
    await page.waitForURL('**/dashboard')
    expect(page.url()).toContain('/dashboard')
    const role = await getLocalStorage(page, 'role')
    expect(role).toBe('referee')
  })

  test('stores role in localStorage', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await input.fill('12345')
    const button = page.locator('button:has-text("Ingresar")')
    await button.click()
    await page.waitForURL('**/dashboard')
    const role = await getLocalStorage(page, 'role')
    expect(role).toBe('referee')
  })
})

test.describe('Dashboard Access', () => {
  test('dashboard requires authentication', async ({ page }) => {
    await page.goto('/dashboard')
    expect(page.url()).toContain('/auth')
  })

  test('authenticated user can access dashboard', async ({ page }) => {
    await setLocalStorage(page, 'role', 'referee')
    await page.goto('/dashboard')
    expect(page.url()).toContain('/dashboard')
  })
})

test.describe('Logout Flow', () => {
  test('logout clears auth and redirects to login', async ({ page }) => {
    await setLocalStorage(page, 'role', 'referee')
    await page.goto('/dashboard')
    const logoutButton = page.locator('button:has-text("Salir")')
    await logoutButton.click()
    expect(page.url()).toContain('/auth')
    const role = await getLocalStorage(page, 'role')
    expect(role).toBeNull()
  })
})
