# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: multi-table.spec.ts >> Multi-Table Tournament System >> create table with custom name
- Location: tests/multi-table.spec.ts:38:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.table-name').first()
Expected substring: "Test"
Received string:    "Mesa 1"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.table-name').first()
    9 × locator resolved to <div class="table-name">Mesa 1</div>
      - unexpected value "Mesa 1"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]: RALLYOS HUB
    - button "+ Nueva Mesa" [ref=e4] [cursor=pointer]
  - generic [ref=e6]:
    - generic [ref=e7] [cursor=pointer]:
      - generic [ref=e8]:
        - generic [ref=e9]: Mesa 1
        - generic [ref=e10]: LIVE
      - generic [ref=e11]: Player A vs Player B
      - generic [ref=e12]:
        - generic [ref=e13]: "11"
        - generic [ref=e14]: "-"
        - generic [ref=e15]: "0"
      - generic [ref=e16]: "PIN: 6696 · 0 jugadores"
      - generic [ref=e17]:
        - button "Ver" [ref=e18]
        - button "QR" [ref=e19]
    - generic [ref=e20] [cursor=pointer]:
      - generic [ref=e21]:
        - generic [ref=e22]: mesa 2
        - generic [ref=e23]: LIVE
      - generic [ref=e24]: Player A vs Player B
      - generic [ref=e25]:
        - generic [ref=e26]: "0"
        - generic [ref=e27]: "-"
        - generic [ref=e28]: "0"
      - generic [ref=e29]: "PIN: 6050 · 1 jugadores"
      - generic [ref=e30]:
        - button "Ver" [ref=e31]
        - button "QR" [ref=e32]
    - generic [ref=e33] [cursor=pointer]:
      - generic [ref=e34]:
        - generic [ref=e35]: Test 1775533024290
        - generic [ref=e36]: WAITING
      - generic [ref=e37]: Player A vs Player B
      - generic [ref=e38]:
        - generic [ref=e39]: "0"
        - generic [ref=e40]: "-"
        - generic [ref=e41]: "0"
      - generic [ref=e42]: "PIN: 6634 · 1 jugadores"
      - generic [ref=e43]:
        - button "Ver" [ref=e44]
        - button "QR" [ref=e45]
  - generic [ref=e46]:
    - generic [ref=e48]:
      - generic [ref=e49]: Historial de Puntos
      - button "Cerrar" [ref=e50] [cursor=pointer]
    - button "↩ Deshacer Último" [ref=e51] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Multi-Table Tournament System', () => {
  4  |   
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await page.goto('https://localhost:3000', { ignoreHTTPSErrors: true });
  7  |     
  8  |     await page.evaluate(() => {
  9  |       const dashboard = document.getElementById('screen-dashboard');
  10 |       const waiting = document.getElementById('screen-waiting');
  11 |       const scoreboard = document.getElementById('screen-scoreboard');
  12 |       const drawer = document.getElementById('drawer-history');
  13 |       
  14 |       dashboard?.classList.add('active');
  15 |       waiting?.classList.remove('active');
  16 |       scoreboard?.classList.remove('active');
  17 |       drawer?.classList.remove('active');
  18 |     });
  19 |     
  20 |     await page.waitForTimeout(300);
  21 |   });
  22 | 
  23 |   test('dashboard shows empty state or tables', async ({ page }) => {
  24 |     await page.waitForTimeout(1500);
  25 |     
  26 |     // Wait for socket data to arrive
  27 |     const hasEmptyState = await page.locator('.empty-state').isVisible().catch(() => false);
  28 |     const hasTables = await page.locator('.table-card').first().isVisible().catch(() => false);
  29 |     
  30 |     expect(hasEmptyState || hasTables).toBeTruthy();
  31 |   });
  32 | 
  33 |   test('create table button opens modal', async ({ page }) => {
  34 |     await page.click('button.btn-primary:has-text("Nueva Mesa")');
  35 |     await expect(page.locator('#modal-create-table')).toHaveClass(/active/);
  36 |   });
  37 | 
  38 |   test('create table with custom name', async ({ page }) => {
  39 |     const uniqueName = 'Test ' + Date.now();
  40 |     
  41 |     page.on('dialog', dialog => dialog.accept('TestPlayer'));
  42 |     
  43 |     await page.click('button.btn-primary:has-text("Nueva Mesa")');
  44 |     await page.fill('#input-table-name', uniqueName);
  45 |     await page.click('#modal-create-table button:has-text("Crear")');
  46 |     
  47 |     await page.waitForSelector('#screen-waiting.active', { timeout: 10000 });
  48 |     await page.click('button:has-text("← Volver al Hub")');
  49 |     await page.waitForSelector('#screen-dashboard.active', { timeout: 5000 });
  50 |     
  51 |     await expect(page.locator('.table-card').first()).toBeVisible();
> 52 |     await expect(page.locator('.table-name').first()).toContainText('Test');
     |                                                       ^ Error: expect(locator).toContainText(expected) failed
  53 |   });
  54 | 
  55 |   test('create table generates PIN in card', async ({ page }) => {
  56 |     page.on('dialog', dialog => dialog.accept('TestPlayer'));
  57 |     
  58 |     await page.click('button.btn-primary:has-text("Nueva Mesa")');
  59 |     await page.click('#modal-create-table button:has-text("Crear")');
  60 |     
  61 |     await page.waitForSelector('#screen-waiting.active', { timeout: 10000 });
  62 |     await page.click('button:has-text("← Volver al Hub")');
  63 |     await page.waitForSelector('#screen-dashboard.active', { timeout: 5000 });
  64 |     
  65 |     // The card has two .table-info elements - second one has PIN
  66 |     const tableInfos = page.locator('.table-info');
  67 |     const count = await tableInfos.count();
  68 |     
  69 |     let foundPin = false;
  70 |     for (let i = 0; i < count; i++) {
  71 |       const text = await tableInfos.nth(i).textContent();
  72 |       if (text.includes('PIN:')) {
  73 |         foundPin = true;
  74 |         break;
  75 |       }
  76 |     }
  77 |     expect(foundPin).toBeTruthy();
  78 |   });
  79 | 
  80 |   test('socket connects successfully', async ({ page }) => {
  81 |     await expect(page.locator('text=Error')).not.toBeVisible();
  82 |   });
  83 | 
  84 |   test('logo is visible', async ({ page }) => {
  85 |     await expect(page.locator('.logo')).toContainText('RALLY');
  86 |   });
  87 | 
  88 |   test('new table button is visible', async ({ page }) => {
  89 |     await expect(page.locator('button.btn-primary:has-text("Nueva Mesa")')).toBeVisible();
  90 |   });
  91 | });
```