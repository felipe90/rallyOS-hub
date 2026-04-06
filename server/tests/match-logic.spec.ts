import { test, expect } from '@playwright/test';

test.describe('RallyOS Hub - Match Engine Logic', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Navigate
    await page.goto('/');
    
    // 2. Authenticate
    await page.fill('#pinInput', '12345');
    await page.dispatchEvent('#pinInput', 'change');
    
    // 3. Wait for stable state
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#refereePanel')).toBeVisible({ timeout: 15000 });
  });

  test('ITTF 2.15.03: Side swap at 5 points in decisive set', async ({ page }) => {
    // Open config with force click
    await page.click('.btn-config', { force: true });
    await page.waitForSelector('#configModal', { state: 'visible' });
    
    await page.selectOption('#bestOfSelect', '1');
    // Using precise selector for START button
    await page.click('#configModal button:has-text("INICIAR MATCH")', { force: true });
    
    await expect(page.locator('#configModal')).not.toBeVisible();

    // Use specific locator for referee panel buttons
    const btnPlusA = page.locator('#refereePanel button:has-text("A +1")');
    for (let i = 0; i < 5; i++) {
        await btnPlusA.click();
    }
    await expect(page.locator('#scoreA')).toHaveText('5');
    await expect(page.locator('.scoreboard')).toHaveClass(/swapped/);
  });

  test('Match finish: Positions remain persistent after final point', async ({ page }) => {
    await page.click('.btn-config', { force: true });
    await page.selectOption('#bestOfSelect', '1');
    await page.click('#configModal button:has-text("INICIAR MATCH")', { force: true });
    
    const btnPlusA = page.locator('#refereePanel button:has-text("A +1")');
    // Win match (ensure we reach at least 5 to trigger swap, then win at 11)
    for (let i = 0; i < 11; i++) {
        await btnPlusA.click();
    }
    
    // Check for winner display and persistence of side swap
    await expect(page.locator('#status')).toHaveText(/WINNER: TEAM A/);
    await expect(page.locator('.scoreboard')).toHaveClass(/swapped/);
  });

  test('Handicap: Match starts with correct offset', async ({ page }) => {
    await page.click('.btn-config');
    await page.fill('#handicapA', '-5');
    await page.fill('#handicapB', '3');
    await page.click('button:has-text("INICIAR MATCH")');
    
    await expect(page.locator('#scoreA')).toHaveText('-5');
    await expect(page.locator('#scoreB')).toHaveText('3');
  });
});
