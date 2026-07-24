/**
 * Club Free Mode — manual verification test
 *
 * Verifies:
 *   1. Free mode screen renders (no player names, only timer + buttons)
 *   2. Timer increments locally while the session is active
 *   3. No player names present in the free mode UI
 */
import { test, expect } from '@playwright/test'

test.describe('Club Free Mode', () => {
  test.describe.configure({ mode: 'serial' })

  let courtPin: string

  test('admin creates and activates a court', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/club/admin')

    // Wait for connection
    await page.locator('text=Conectado').or(page.locator('text=Connected')).waitFor({ timeout: 5000 }).catch(() => {})

    // Enter admin PIN (use TOURNAMENT_OWNER_PIN=12345678 env var on server)
    await page.locator('input[placeholder="••••••"]').fill('12345678')
    await page.locator('text=Verificar').click()
    await expect(page.locator('text=Nueva Cancha')).toBeVisible({ timeout: 8000 })

    // Create court
    await page.locator('button:has-text("Nueva Cancha")').click()
    await page.waitForTimeout(500)

    // Activate
    await page.locator('button:has-text("Activar")').first().click()
    await page.waitForTimeout(500)

    // Extract PIN
    const bodyText = await page.textContent('body')
    const pinMatch = bodyText!.match(/PIN:\s*(\d+)/)
    expect(pinMatch).not.toBeNull()
    courtPin = pinMatch![1]
  })

  test('player enters PIN and selects Modo Libre', async ({ page }) => {
    expect(courtPin).toBeDefined()

    // Navigate to auth page
    await page.goto('/auth')
    await page.locator('text=Quiero jugar').click()

    // Enter court PIN
    await page.locator('input[placeholder="••••"]').fill(courtPin)
    await page.locator('text=Ingresar').click()
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })

    // Click somewhere to dismiss focus/keyboard
    await page.locator('body').click({ position: { x: 100, y: 200 } })
    await page.waitForTimeout(500)

    // Should see mode selector (ClubSessionConfig)
    await expect(page.locator('[data-testid="club-session-config"]')).toBeVisible({ timeout: 5000 })

    // Select "Modo Libre" and click "Comenzar"
    await page.locator('[data-testid="mode-free"]').click()
    await page.locator('button:has-text("Comenzar")').click()
    await page.waitForTimeout(1000)

    // Should now see free play screen
    await expect(page.locator('[data-testid="club-free-play"]')).toBeVisible({ timeout: 5000 })

    // Verify the badge shows "Modo Libre"
    await expect(page.locator('text=Modo Libre').first()).toBeVisible()

    // Verify player names are NOT present
    // "Jugar" appears in the "Jugar partido" button — that's fine
    // But "Jugador 1" / "Jugador 2" fallback names should NOT appear
    // Match player names or fallback names that should NOT exist in free mode
    const bodyText = await page.textContent('body')
    expect(bodyText).not.toContain('Jugador 1')
    expect(bodyText).not.toContain('Jugador 2')
  })

  test('timer increments while in free mode', async ({ page }) => {
    expect(courtPin).toBeDefined()

    // Same setup: auth + free play selection
    await page.goto('/auth')
    await page.locator('text=Quiero jugar').click()
    await page.locator('input[placeholder="••••"]').fill(courtPin)
    await page.locator('text=Ingresar').click()
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/club\/play\//, { timeout: 10000 })

    await page.locator('body').click({ position: { x: 100, y: 200 } })
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="club-session-config"]')).toBeVisible({ timeout: 5000 })
    await page.locator('[data-testid="mode-free"]').click()
    await page.locator('button:has-text("Comenzar")').click()
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="club-free-play"]')).toBeVisible({ timeout: 5000 })

    // Read initial timer text
    const initialTime = await page.locator('[data-testid="club-free-play"] .font-mono').textContent()
    console.log('Initial timer:', initialTime)

    // Wait 2 seconds
    await page.waitForTimeout(2500)

    // Read timer again — should have incremented
    const currentTime = await page.locator('[data-testid="club-free-play"] .font-mono').textContent()
    console.log('Timer after 2.5s:', currentTime)

    // Timer should have changed (MM:SS format should increment)
    expect(currentTime).not.toBe(initialTime)

    // Should not be "00:00" anymore (unless somehow timer is massive)
    expect(currentTime).not.toBe('00:00')
  })
})
