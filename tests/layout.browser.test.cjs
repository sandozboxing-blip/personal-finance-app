/* Run with D8_PLAYWRIGHT_PATH pointing to a Playwright installation, or install playwright locally. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require(process.env.D8_PLAYWRIGHT_PATH || 'playwright')); } catch (_) {}

test('one page scroll, stable hover and visible create menu', { skip: !chromium }, async (t) => {
  const root = path.resolve(__dirname, '..');
  const state = { version:8, updatedAt:'2026-11-24T10:00:00Z', leads:[], leadFolders:[], leadFolderMeta:{}, smm:[], web:Array.from({length:20},(_,i)=>({id:'test-'+i,name:'Test project '+i,status:'active',paymentType:'monthly',monthly:150,cost:20,start:'2026-10-01'})), expenses:[], tasks:[], workTasks:[], focusTasks:[], focusInitialized:true, taskCategories:[], settings:{} };
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
    await t.test('Wheel scroll moves the document, not a client-list viewport', async () => {
      await page.evaluate(() => jumpPage('web'));
      await page.waitForTimeout(500);
      await page.locator('#webCards .ccard').first().hover();
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(400);
      const scroll = await page.evaluate(() => ({ page:document.scrollingElement.scrollTop, cards:document.getElementById('webCards').scrollTop }));
      assert.ok(scroll.page > 100, 'The whole page should scroll');
      assert.equal(scroll.cards, 0, 'Client list must not own a vertical scroll');
    });
    await t.test('Hover highlights a card without moving it into the previous row', async () => {
      await page.evaluate(() => jumpPage('web'));
      await page.evaluate(() => window.scrollTo({ top:0, behavior:'instant' }));
      await page.mouse.move(0, 0);
      await page.waitForTimeout(600);
      const card = page.locator('#webCards .ccard').first();
      const before = await card.boundingBox();
      await card.hover(); await page.waitForTimeout(400);
      const after = await card.boundingBox();
      assert.ok(Math.abs(before.y-after.y) < .5, 'Hover must not lift the card');
    });
    await t.test('All create actions remain visible and hit-testable below the hero', async () => {
      await page.evaluate(() => jumpPage('dash'));
      await page.waitForTimeout(500);
      await page.locator('.quick-create > summary').click();
      const actions = page.locator('.quick-create-menu button');
      for (const action of await actions.all()) {
        const hit = await action.evaluate(el => { const r=el.getBoundingClientRect(); const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return top===el||el.contains(top); });
        assert.equal(hit, true, 'Create action is clipped or covered');
      }
      await actions.last().click();
      assert.equal(await page.locator('#addOv').isVisible(), true);
      await page.evaluate(() => closeAdd());
    });
    await t.test('Mobile page scroll and Leads folder header do not create nested/cropped regions', async () => {
      await page.setViewportSize({ width:390, height:800 });
      await page.evaluate(() => jumpPage('web'));
      await page.waitForTimeout(500);
      await page.locator('#webCards .ccard').first().hover();
      await page.mouse.wheel(0, 400); await page.waitForTimeout(300);
      assert.ok(await page.evaluate(() => document.scrollingElement.scrollTop > 100));
      assert.equal(await page.locator('#webCards').evaluate(el => el.scrollTop), 0);
      await page.evaluate(() => {
        leads = Array.from({length:30}, (_,i) => ({id:1000+i,name:'Test lead '+i,folder:'Тестови клиенти',category:'Дизайн',phone:'0888000000',tags:[],stars:4.8,status:'prospect'}));
        leadFolders=['Тестови клиенти'];normalizeData();jumpPage('leads');openLeadFolder('Тестови клиенти');
      });
      await page.waitForTimeout(400);
      assert.ok(await page.locator('.compactfoldericon').evaluate(el => el.getBoundingClientRect().width <= 60));
      assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1));
      await page.evaluate(() => jumpPage('reports'));
      await page.waitForTimeout(400);
      assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1));
    });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
