import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
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
    
    // Only numeric characters should remain
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
    
    // Wait for navigation
    await page.waitForURL('**/dashboard')
    expect(page.url()).toContain('/dashboard')
    
    // Check that we're logged in
    const role = await page.evaluate(() => localStorage.getItem('role'))
    expect(role).toBe('referee')
  })

  test('stores role in localStorage', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await input.fill('12345')
    
    const button = page.locator('button:has-text("Ingresar")')
    await button.click()
    
    await page.waitForURL('**/dashboard')
    
    const role = await page.evaluate(() => localStorage.getItem('role'))
    expect(role).toBe('referee')
  })
})

test.describe('Dashboard Access', () => {
  test('dashboard requires authentication', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard')
    
    // Should redirect to auth
    expect(page.url()).toContain('/auth')
  })

  test('authenticated user can access dashboard', async ({ page }) => {
    // Set auth token
    await page.evaluate(() => localStorage.setItem('role', 'referee'))
    
    await page.goto('/dashboard')
    
    // Should stay on dashboard
    expect(page.url()).toContain('/dashboard')
  })
})

test.describe('Logout Flow', () => {
  test('logout clears auth and redirects to login', async ({ page }) => {
    // Set up authenticated state
    await page.evaluate(() => localStorage.setItem('role', 'referee'))
    
    await page.goto('/dashboard')
    
    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Salir")')
    await logoutButton.click()
    
    // Should redirect to auth
    expect(page.url()).toContain('/auth')
    
    // localStorage should be cleared
    const role = await page.evaluate(() => localStorage.getItem('role'))
    expect(role).toBeNull()
  })
})
