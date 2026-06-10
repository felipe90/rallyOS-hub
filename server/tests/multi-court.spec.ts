import { test, expect } from '@playwright/test';

test.describe('Multi-Table Tournament System', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('https://localhost:3000', { ignoreHTTPSErrors: true });
    
    await page.evaluate(() => {
      const dashboard = document.getElementById('screen-dashboard');
      const waiting = document.getElementById('screen-waiting');
      const scoreboard = document.getElementById('screen-scoreboard');
      const drawer = document.getElementById('drawer-history');
      
      dashboard?.classList.add('active');
      waiting?.classList.remove('active');
      scoreboard?.classList.remove('active');
      drawer?.classList.remove('active');
    });
    
    await page.waitForTimeout(300);
  });

  test('dashboard shows empty state or tables', async ({ page }) => {
    await page.waitForTimeout(1500);
    
    // Wait for socket data to arrive
    const hasEmptyState = await page.locator('.empty-state').isVisible().catch(() => false);
    const hasTables = await page.locator('.table-card').first().isVisible().catch(() => false);
    
    expect(hasEmptyState || hasTables).toBeTruthy();
  });

  test('create table button opens modal', async ({ page }) => {
    await page.click('button.btn-primary:has-text("Nueva Mesa")');
    await expect(page.locator('#modal-create-table')).toHaveClass(/active/);
  });

  test('create table with custom name', async ({ page }) => {
    const uniqueName = 'Test ' + Date.now();
    
    page.on('dialog', dialog => dialog.accept('TestPlayer'));
    
    await page.click('button.btn-primary:has-text("Nueva Mesa")');
    await page.fill('#input-table-name', uniqueName);
    await page.click('#modal-create-table button:has-text("Crear")');
    
    await page.waitForSelector('#screen-waiting.active', { timeout: 10000 });
    await page.click('button:has-text("← Volver al Hub")');
    await page.waitForSelector('#screen-dashboard.active', { timeout: 5000 });
    
    await expect(page.locator('.table-card').first()).toBeVisible();
    await expect(page.locator('.table-name').first()).toContainText('Test');
  });

  test('create table generates PIN in card', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept('TestPlayer'));
    
    await page.click('button.btn-primary:has-text("Nueva Mesa")');
    await page.click('#modal-create-table button:has-text("Crear")');
    
    await page.waitForSelector('#screen-waiting.active', { timeout: 10000 });
    await page.click('button:has-text("← Volver al Hub")');
    await page.waitForSelector('#screen-dashboard.active', { timeout: 5000 });
    
    // The card has two .table-info elements - second one has PIN
    const tableInfos = page.locator('.table-info');
    const count = await tableInfos.count();
    
    let foundPin = false;
    for (let i = 0; i < count; i++) {
      const text = await tableInfos.nth(i).textContent();
      if (text.includes('PIN:')) {
        foundPin = true;
        break;
      }
    }
    expect(foundPin).toBeTruthy();
  });

  test('socket connects successfully', async ({ page }) => {
    await expect(page.locator('text=Error')).not.toBeVisible();
  });

  test('logo is visible', async ({ page }) => {
    await expect(page.locator('.logo')).toContainText('RALLY');
  });

  test('new table button is visible', async ({ page }) => {
    await expect(page.locator('button.btn-primary:has-text("Nueva Mesa")')).toBeVisible();
  });
});