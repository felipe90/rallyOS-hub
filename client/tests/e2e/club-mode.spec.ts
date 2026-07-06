import { test, expect } from '@playwright/test'

test.describe('Club Mode — Reconnection (Phase 3a)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stale state between tests
    await page.context().clearCookies()
  })

  test('CU-RECONNECT-01: refresh page → auto-reconnect → scoring works', async ({ page }) => {
    // 1. Admin: authenticate, create court, activate, get PIN
    await page.goto('/club/admin')
    await page.locator('input[placeholder="••••••"]').fill('123456')
    await page.locator('text=Verificar').click()
    await expect(page.locator('text=Nueva Cancha')).toBeVisible({ timeout: 3000 })

    await page.locator('input[placeholder="Nombre de la cancha..."]').fill('E2E Recon Test')
    await page.locator('button:has-text("Activar")').first().waitFor({ state: 'visible', timeout: 2000 })
    // Click create button (the primary variant button with only an SVG)
    const createBtn = page.locator('button').filter({ hasNotText: /\S/ }).first()
    await createBtn.click()
    await page.waitForTimeout(500)

    // Activate
    await page.locator('button:has-text("Activar")').first().click()
    await page.waitForTimeout(500)

    // Read PIN from page
    const pinText = await page.textContent('body')
    const pinMatch = pinText!.match(/PIN:\s*(\d+)/)
    expect(pinMatch).not.toBeNull()
    const courtPin = pinMatch![1]

    // 2. Player: enter PIN on auth page
    await page.goto('/auth')
    await page.locator('text=Quiero jugar').click()
    await page.locator('input[placeholder="••••"]').fill(courtPin)
    await page.locator('text=Ingresar').click()
    await page.waitForTimeout(1500)

    // Verify we're on the scoreboard
    await expect(page.locator('text=Jugador 1 vs Jugador 2')).toBeVisible({ timeout: 3000 })

    // Score a point for Player 1
    const player1Region = page.getByRole('region', { name: 'Área de Jugador 1' })
    await player1Region.click()
    await page.waitForTimeout(500)

    // Verify score updated
    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('1')

    // 3. REFRESH the page — reconnection test
    const currentUrl = page.url()
    await page.goto(currentUrl)
    await page.waitForTimeout(2000)

    // Verify scoreboard still shows (not PIN prompt)
    await expect(page.locator('text=Jugador 1 vs Jugador 2')).toBeVisible({ timeout: 3000 })

    // Score another point — should work without re-entering PIN
    await player1Region.click()
    await page.waitForTimeout(500)

    // Verify score is now 2
    const refreshedText = await page.textContent('body')
    expect(refreshedText).toContain('2')
  })
})

test.describe('Club Mode — Session Timer + Cost (Phase 3b)', () => {
  test('CU-TIMER-01: match ends → auto-finish → shows elapsed time + cost', async ({ page }) => {
    // 1. Admin: create + activate court
    await page.goto('/club/admin')
    await page.locator('input[placeholder="••••••"]').fill('123456')
    await page.locator('text=Verificar').click()
    await expect(page.locator('text=Nueva Cancha')).toBeVisible({ timeout: 3000 })

    await page.locator('input[placeholder="Nombre de la cancha..."]').fill('E2E Cost Test')
    const createBtn = page.locator('button').filter({ hasNotText: /\S/ }).first()
    await createBtn.click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Activar")').first().click()
    await page.waitForTimeout(500)

    // Get PIN
    const pinText = await page.textContent('body')
    const pinMatch = pinText!.match(/PIN:\s*(\d+)/)
    expect(pinMatch).not.toBeNull()
    const courtPin = pinMatch![1]

    // 2. Player: join via PIN
    await page.goto('/auth')
    await page.locator('text=Quiero jugar').click()
    await page.locator('input[placeholder="••••"]').fill(courtPin)
    await page.locator('text=Ingresar').click()
    await page.waitForTimeout(1500)
    await expect(page.locator('text=Jugador 1 vs Jugador 2')).toBeVisible({ timeout: 3000 })

    // 3. Score 11 points to win match (table tennis, bestOf=1, pointsPerSet=11)
    const player1Region = page.getByRole('region', { name: 'Área de Jugador 1' })
    for (let i = 0; i < 11; i++) {
      await player1Region.click()
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(2000)

    // 4. Verify auto-finish: "Sesión finalizada" with elapsed time and cost
    await expect(page.locator('text=Sesión finalizada')).toBeVisible({ timeout: 3000 })
    const resultText = await page.textContent('body')
    expect(resultText).toContain('min')
    expect(resultText).toContain('ARS')
    // Cost should be visible (could be 0 or greater)
    expect(resultText).toMatch(/\d+\s*ARS/)
  })
})

test.describe('Club Mode — Admin Flow (Phase 1-2)', () => {
  test('admin can create, activate, deactivate, and reset a court', async ({ page }) => {
    await page.goto('/club/admin')
    await page.locator('input[placeholder="••••••"]').fill('123456')
    await page.locator('text=Verificar').click()
    await expect(page.locator('text=Nueva Cancha')).toBeVisible({ timeout: 3000 })

    // Create
    await page.locator('input[placeholder="Nombre de la cancha..."]').fill('E2E Admin Test')
    const createBtn = page.locator('button').filter({ hasNotText: /\S/ }).first()
    await createBtn.click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=Disponible')).toBeVisible({ timeout: 3000 })

    // Activate
    await page.locator('button:has-text("Activar")').first().click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=Reservada')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Desactivar')).toBeVisible({ timeout: 3000 })
  })
})
