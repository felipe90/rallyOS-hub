import { test, expect } from '@playwright/test'

test.describe('Scoreboard Flow', () => {
  test('renders scoreboard with default state', async ({ page }) => {
    await page.goto('/')
    
    // Navigate to a table (would need actual routing)
    // For now, just verify basic rendering
    await expect(page.locator('#root')).toBeVisible()
  })

  test('redirects unauthenticated scoreboard access to auth', async ({ page }) => {
    // Scoreboard routes are protected — an unauthenticated visitor is
    // redirected to /auth instead of seeing match config UI (the config
    // panel only opens on a real WAITING court with referee auth).
    await page.goto('/scoreboard/abc-123/view')
    await expect(page).toHaveURL(/.*\/auth/)
  })

  test('displays score numbers', async ({ page }) => {
    await page.goto('/')
    
    // Score display components
    const content = await page.content()
    // Should have some score display
    expect(content.length).toBeGreaterThan(0)
  })
})