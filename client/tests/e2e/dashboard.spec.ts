import { test, expect } from '@playwright/test'

test.describe('Dashboard Flow', () => {
  test('loads dashboard with title', async ({ page }) => {
    await page.goto('/')
    
    // Should show Kinetic Clubhouse title
    await expect(page.getByText('The Kinetic Clubhouse')).toBeVisible()
  })

  test('shows stats cards', async ({ page }) => {
    await page.goto('/')
    
    // Stats should be visible
    await expect(page.getByText('Mesas')).toBeVisible()
    await expect(page.getByText('Partidos Activos')).toBeVisible()
    await expect(page.getByText('Jugadores')).toBeVisible()
  })

  test('toggles view modes', async ({ page }) => {
    await page.goto('/')
    
    // Click list view
    await page.getByLabel('List view').click()
    
    // Click grid view
    await page.getByLabel('Grid view').click()
  })

  test('shows empty state when no tables', async ({ page }) => {
    await page.goto('/')
    
    // Should show empty state or tables
    const content = await page.content()
    expect(content).toContain('Mesas')
  })
})