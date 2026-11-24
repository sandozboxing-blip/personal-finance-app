/* Run with D8_PLAYWRIGHT_PATH pointing to a Playwright installation, or install playwright locally. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require(process.env.D8_PLAYWRIGHT_PATH || 'playwright')); } catch (_) {}

test('custom form controls preserve app behavior, keyboard access and theme preference', { skip: !chromium }, async () => {
  const root = path.resolve(__dirname, '..');
  const state = { version:8, updatedAt:'2026-11-24T10:00:00Z', leads:[], leadFolders:[], leadFolderMeta:{}, smm:[], web:[], expenses:[], tasks:[], workTasks:[], focusTasks:[], focusInitialized:true, taskCategories:[], settings:{} };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api.php') {
      response.setHeader('Content-Type', 'application/json');
      if (url.searchParams.get('action') === 'save') {
        request.resume();
        request.on('end', () => response.end(JSON.stringify({ ok:true, updatedAt:new Date().toISOString() })));
      } else response.end(JSON.stringify(url.searchParams.get('action') === 'me' ? { authenticated:true, user:'Partner' } : { ok:true, state }));
      return;
    }
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png' };
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless:true, channel:process.env.D8_BROWSER_CHANNEL || 'msedge' });
    const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.goto(base);
    await page.waitForSelector('#appLoader.done', { state:'attached' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.locator('#themeToggle').click();
    await page.reload();
    await page.waitForSelector('#appLoader.done', { state:'attached' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('img[src*="brand-logo"]').count(), 0);
    const logo = await page.locator('.sblogo > .wordmark').evaluate(el => ({ overflow:getComputedStyle(el).overflow, height:el.getBoundingClientRect().height, fontSize:parseFloat(getComputedStyle(el).fontSize) }));
    assert.equal(logo.overflow, 'visible', 'Wordmark descenders must not be clipped');
    assert.ok(logo.height >= logo.fontSize * 1.35, 'Wordmark needs room below the baseline');

    await page.evaluate(() => { jumpPage('web'); openAdd('web'); });
    const type = page.locator('.custom-control-trigger[data-source=fctype]');
    await type.click();
    await page.getByRole('option', { name:'Онлайн магазин', exact:true }).click();
    assert.equal(await page.locator('#fctype').inputValue(), 'Онлайн магазин');
    await page.locator('.custom-control-trigger[data-source=fcpayment]').click();
    await page.getByRole('option', { name:'Еднократно плащане', exact:true }).click();
    assert.equal(await page.locator('#webMonthlyFields').isVisible(), false);
    await page.evaluate(() => {
      const input = document.getElementById('fcstart');
      input.min='2026-02-01'; input.max='2026-03-05'; input.value='2026-02-28';
    });
    const start = page.locator('.custom-control-trigger[data-source=fcstart]');
    assert.match(await start.innerText(), /28/);
    await start.click();
    await page.getByRole('button', { name:'Следващ месец', exact:true }).click();
    assert.equal(await page.locator('[data-date="2026-03-06"]').isDisabled(), true);
    await page.locator('[data-date="2026-03-04"]').click();
    assert.equal(await page.locator('#fcstart').inputValue(), '2026-03-04');
    await start.click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#customControlPopover').isVisible(), false);
    assert.equal(await page.locator('#addOv').isVisible(), true);
    await type.focus(); await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#fctype').inputValue(), 'Друго');
    await type.click(); await page.keyboard.press('Tab');
    assert.equal(await page.locator('#customControlPopover').isVisible(), false);
    await page.evaluate(() => closeAdd());

    await page.evaluate(() => jumpPage('tasks'));
    await page.locator('.custom-control-trigger[data-source=tmTime]').click();
    await page.getByRole('spinbutton', { name:'Час', exact:true }).fill('11');
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('spinbutton', { name:'Минути', exact:true }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('spinbutton', { name:'Минути', exact:true }).fill('37');
    await page.getByRole('button', { name:'Потвърди часа', exact:true }).click();
    assert.equal(await page.locator('#tmTime').inputValue(), '11:37');
    await page.evaluate(() => { jumpPage('expenses'); renderExpenses(); });
    await page.locator('#newExpense').click();
    await page.locator('.custom-control-trigger[data-source=type]').click();
    await page.getByRole('option', { name:'Годишен абонамент', exact:true }).click();
    assert.equal(await page.locator('#expenseForm select[name=type]').inputValue(), 'yearly');
    await page.evaluate(() => document.getElementById('expenseForm').reset());
    await page.waitForTimeout(50);
    assert.match(await page.locator('.custom-control-trigger[data-source=type]').innerText(), /Еднократен/);
    await page.emulateMedia({ reducedMotion:'reduce' });
    await page.locator('.custom-control-trigger[data-source=type]').click();
    assert.equal(await page.locator('#customControlPopover').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width:390, height:700 });
    await page.evaluate(() => jumpPage('tasks'));
    await page.locator('.custom-control-trigger[data-source=tmDate]').click();
    const bounds = await page.locator('#customControlPopover').boundingBox();
    assert.ok(bounds.y >= 11 && bounds.y + bounds.height <= 689, 'Calendar stays inside the mobile viewport');
    const calendarFits = await page.locator('#customControlPopover').evaluate(el => el.scrollHeight <= el.clientHeight + 2);
    assert.equal(calendarFits, true, 'Mobile calendar footer remains visible without scrolling');
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
