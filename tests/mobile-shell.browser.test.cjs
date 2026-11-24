/* Run with D8_PLAYWRIGHT_PATH pointing to a Playwright installation, or install playwright locally. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require(process.env.D8_PLAYWRIGHT_PATH || 'playwright')); } catch (_) {}

test('mobile shell has one theme-aware moving indicator and stays hidden on login', { skip: !chromium }, async (t) => {
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
    const page = await browser.newPage({ viewport:{ width:390, height:844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.goto(base);
    await page.waitForSelector('#appLoader.done', { state:'attached' });
    await t.test('login does not show authenticated navigation', async () => {
      await page.evaluate(() => showLogin());assert.equal(await page.locator('#mobileNav').isVisible(),false);
    });
    await page.evaluate(() => startApp('Partner',false));await page.waitForSelector('#appLoader.done',{state:'attached'});
    await t.test('there is one moving selection, with no inner icon bubble', async () => {
      assert.equal(await page.locator('.mobile-nav-indicator').count(),1);
      await page.locator('#mobileTasksButton').click();await page.waitForTimeout(400);
      const icon=await page.locator('#mobileTasksButton .nav-icon-wrap').evaluate(el=>({background:getComputedStyle(el).backgroundColor,image:getComputedStyle(el).backgroundImage,shadow:getComputedStyle(el).boxShadow}));
      assert.equal(icon.background,'rgba(0, 0, 0, 0)');assert.equal(icon.image,'none');assert.equal(icon.shadow,'none');
      const before=await page.locator('.mobile-nav-indicator').boundingBox();
      await page.evaluate(()=>closeMobileSheets());await page.locator('#mobileLeadAdd').click();await page.waitForTimeout(400);
      const after=await page.locator('.mobile-nav-indicator').boundingBox();assert.ok(Math.abs(before.x-after.x)>30);
    });
    await t.test('light sheet icons use the brown accent rather than legacy purple', async () => {
      await page.locator('#mobileTasksButton').click();await page.waitForTimeout(350);
      const color=await page.locator('#mobileTasks .mobile-client-options svg').first().evaluate(el=>getComputedStyle(el).color);
      const accent=await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--pl').trim());
      assert.equal(color,'rgb(115, 83, 61)');
      assert.ok(accent);
    });
    await t.test('mobile destinations reuse the exact desktop SVG geometry and stroke', async () => {
      const differences = await page.evaluate(() => {
        const desktop = {};
        document.querySelectorAll('.sbi').forEach(button => { const route=(button.getAttribute('onclick')||'').match(/'([^']+)'/);if(route)desktop[route[1]]=button.querySelector('svg'); });
        const errors=[];
        document.querySelectorAll('.mobile-more-grid button,.mobile-client-options button').forEach(button => {
          const route=(button.getAttribute('onclick')||'').match(/'([^']+)'/),icon=button.querySelector('svg');
          const source=route&&desktop[route[1]];
          if(source&&(!icon||source.innerHTML!==icon.innerHTML||source.getAttribute('stroke-width')!==icon.getAttribute('stroke-width')))errors.push(route[1]);
        });
        [['#mobileClientsButton','smm'],['#mobileLeadAdd','leads'],['.nav-home','dash'],['#mobileTasksButton','work']].forEach(([selector,route])=>{const icon=document.querySelector(selector+' svg');if(icon.innerHTML!==desktop[route].innerHTML||getComputedStyle(icon).strokeWidth!==getComputedStyle(desktop[route]).strokeWidth)errors.push(selector);});
        return errors;
      });
      assert.deepEqual(differences,[]);
    });
    assert.deepEqual(errors, []);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
