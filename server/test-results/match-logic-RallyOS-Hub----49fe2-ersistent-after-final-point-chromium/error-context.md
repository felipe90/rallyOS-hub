# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: match-logic.spec.ts >> RallyOS Hub - Match Engine Logic >> Match finish: Positions remain persistent after final point
- Location: tests/match-logic.spec.ts:38:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#pinInput')

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
  - generic [ref=e33]:
    - generic [ref=e35]:
      - generic [ref=e36]: Historial de Puntos
      - button "Cerrar" [ref=e37] [cursor=pointer]
    - button "↩ Deshacer Último" [ref=e38] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('RallyOS Hub - Match Engine Logic', () => {
  4  |   
  5  |   test.beforeEach(async ({ page }) => {
  6  |     // 1. Navigate
  7  |     await page.goto('/');
  8  |     
  9  |     // 2. Authenticate
> 10 |     await page.fill('#pinInput', '12345');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  11 |     await page.dispatchEvent('#pinInput', 'change');
  12 |     
  13 |     // 3. Wait for stable state
  14 |     await page.waitForLoadState('networkidle');
  15 |     await expect(page.locator('#refereePanel')).toBeVisible({ timeout: 15000 });
  16 |   });
  17 | 
  18 |   test('ITTF 2.15.03: Side swap at 5 points in decisive set', async ({ page }) => {
  19 |     // Open config with force click
  20 |     await page.click('.btn-config', { force: true });
  21 |     await page.waitForSelector('#configModal', { state: 'visible' });
  22 |     
  23 |     await page.selectOption('#bestOfSelect', '1');
  24 |     // Using precise selector for START button
  25 |     await page.click('#configModal button:has-text("INICIAR MATCH")', { force: true });
  26 |     
  27 |     await expect(page.locator('#configModal')).not.toBeVisible();
  28 | 
  29 |     // Use specific locator for referee panel buttons
  30 |     const btnPlusA = page.locator('#refereePanel button:has-text("A +1")');
  31 |     for (let i = 0; i < 5; i++) {
  32 |         await btnPlusA.click();
  33 |     }
  34 |     await expect(page.locator('#scoreA')).toHaveText('5');
  35 |     await expect(page.locator('.scoreboard')).toHaveClass(/swapped/);
  36 |   });
  37 | 
  38 |   test('Match finish: Positions remain persistent after final point', async ({ page }) => {
  39 |     await page.click('.btn-config', { force: true });
  40 |     await page.selectOption('#bestOfSelect', '1');
  41 |     await page.click('#configModal button:has-text("INICIAR MATCH")', { force: true });
  42 |     
  43 |     const btnPlusA = page.locator('#refereePanel button:has-text("A +1")');
  44 |     // Win match (ensure we reach at least 5 to trigger swap, then win at 11)
  45 |     for (let i = 0; i < 11; i++) {
  46 |         await btnPlusA.click();
  47 |     }
  48 |     
  49 |     // Check for winner display and persistence of side swap
  50 |     await expect(page.locator('#status')).toHaveText(/WINNER: TEAM A/);
  51 |     await expect(page.locator('.scoreboard')).toHaveClass(/swapped/);
  52 |   });
  53 | 
  54 |   test('Handicap: Match starts with correct offset', async ({ page }) => {
  55 |     await page.click('.btn-config');
  56 |     await page.fill('#handicapA', '-5');
  57 |     await page.fill('#handicapB', '3');
  58 |     await page.click('button:has-text("INICIAR MATCH")');
  59 |     
  60 |     await expect(page.locator('#scoreA')).toHaveText('-5');
  61 |     await expect(page.locator('#scoreB')).toHaveText('3');
  62 |   });
  63 | });
  64 | 
```