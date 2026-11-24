/* Run with D8_PLAYWRIGHT_PATH pointing to a Playwright installation, or install playwright locally. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require(process.env.D8_PLAYWRIGHT_PATH || 'playwright')); } catch (_) {}

test('selected navigation and lead profile use consistent theme materials', { skip: !chromium }, async (t) => {
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
    await t.test('selected category has a brown capsule and readable light text', async () => {
      await page.evaluate(() => jumpPage('reports'));await page.waitForTimeout(400);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.sbi.active')).color === 'rgb(255, 250, 242)');
      const selected = await page.locator('.sbi.active').evaluate(el => getComputedStyle(el).color);
      assert.equal(selected, 'rgb(255, 250, 242)');
    });
    await page.evaluate(() => {leads=[{id:901,name:'Theme test lead',folder:'Test',category:'Дизайн',phone:'0888000000',email:'test@example.test',stars:4.8,tags:[],status:'prospect'}];leadFolders=['Test'];normalizeData();openLB(901);});
    await t.test('lead header and footer are light material in the light theme', async () => {
      assert.ok((await page.locator('#lbOv .lbhdr').boundingBox()).height < 260, 'Missing URL hint must not expand the header');
      for (const selector of ['#lbOv .lbhdr','#lbOv .mfoot']) {
        const color = await page.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor);
        const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number);
        assert.ok(rgb.every(value => value > 150), selector + ' still has a hard-coded dark surface');
      }
    });
    await t.test('lead profile text changes with the dark theme', async () => {
      await page.evaluate(() => closeLB());await page.locator('#themeToggle').click();
      await page.evaluate(() => openLB(901));
      const text = await page.locator('#lbOv .lbname').evaluate(el => getComputedStyle(el).color.match(/[\d.]+/g).slice(0,3).map(Number));
      assert.ok(text.every(value=>value>180));
    });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
