/* Run with D8_PLAYWRIGHT_PATH pointing to a Playwright installation, or install playwright locally. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require(process.env.D8_PLAYWRIGHT_PATH || 'playwright')); } catch (_) {}

test('UI work stays bounded when unrelated elements change and lists grow', { skip: !chromium }, async (t) => {
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
    await t.test('unrelated style changes do not remeasure every form control', async () => {
      const reads = await page.evaluate(async () => {
        const original=window.getComputedStyle;let count=0;
        window.getComputedStyle=function(el,...args){if(el.classList?.contains('custom-native'))count++;return original.call(window,el,...args);};
        const probe=document.createElement('div');document.body.appendChild(probe);
        const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        await frame();count=0;
        for(let i=0;i<8;i++){probe.style.opacity=String(.5+i/100);await frame();}
        probe.remove();window.getComputedStyle=original;return count;
      });
      assert.equal(reads,0,'An unrelated animation must not remeasure all native controls');
    });
    await t.test('large client lists do not add a backdrop filter to every card', async () => {
      await page.evaluate(()=>{web=Array.from({length:150},(_,i)=>({id:'perf-'+i,name:'Test client '+i,status:'active',paymentType:'monthly',monthly:100,cost:10,start:'2026-10-01'}));jumpPage('web');});
      const layers=await page.locator('#webCards .ccard').evaluateAll(cards=>cards.filter(el=>getComputedStyle(el).backdropFilter!=='none').length);
      assert.equal(layers,0,'Glass cards must reuse the blurred backdrop, not create 150 blur layers');
    });
    await t.test('dark selected category uses the violet theme accent', async () => {
      await page.locator('#themeToggle').click();
      const accent=await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--nav-active'));
      assert.match(accent,/violet|139,92,246|151,105,193/,'Dark selection should be violet rather than brown');
    });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
