/* Run with D8_PLAYWRIGHT_PATH pointing to a Playwright installation, or install playwright locally. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require(process.env.D8_PLAYWRIGHT_PATH || 'playwright')); } catch (_) {}

test('all sections and mobile sheets fit light and dark responsive layouts', { skip: !chromium }, async (t) => {
  const root = path.resolve(__dirname, '..');
  const state = { version:8, updatedAt:'2026-11-24T10:00:00Z', leads:Array.from({length:24},(_,i)=>({id:900+i,name:'Test lead '+i,folder:'Test folder',category:'Дизайн',tags:[],stars:4.8,status:'prospect',phone:'0888000000'})), leadFolders:['Test folder'], leadFolderMeta:{}, smm:[], web:[], expenses:[], tasks:[], workTasks:[], focusTasks:[], focusInitialized:true, taskCategories:[], settings:{} };
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
    for(const width of [320,390,430,768,820,900,1024,1440]){
      await page.setViewportSize({width,height:900});
      for(const theme of ['light','dark']){
        if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#themeToggle').click();
        for(const section of ['dash','smm','web','leads','reports','tasks','work','expenses','settings']){
          await page.evaluate(id=>jumpPage(id),section);await page.waitForTimeout(60);
          assert.ok(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),theme+' '+width+' '+section+' overflows');
        }
        await page.evaluate(()=>{jumpPage('leads');openLeadFolder('Test folder');});await page.waitForTimeout(70);
        assert.ok(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),'Leads open folder overflow '+width);
        await page.evaluate(()=>openLB(900));await page.waitForTimeout(70);
        const profile=await page.locator('#lbOv .lbm').boundingBox();assert.ok(profile.x>=-1&&profile.x+profile.width<=width+1,'Lead profile overflow '+width);
        const chips=await page.locator('#lbOv .lbchips').boundingBox();assert.ok(chips.x>=profile.x&&chips.x+chips.width<=profile.x+profile.width+1,'Lead chips clipped '+width);
        const website=await page.locator('#lbOv .lbwebline').boundingBox();assert.ok(website.x>=profile.x,'Lead website clipped '+width);
        await page.evaluate(()=>closeLB());
        if(width<=768){
          for(const sheet of ['clients','tasks','more']){
            await page.evaluate(type=>setMobileSheet(type),sheet);await page.waitForTimeout(300);
            const id={clients:'mobileClients',tasks:'mobileTasks',more:'mobileMore'}[sheet];
            await page.waitForFunction(id=>{const sheet=document.getElementById(id).getBoundingClientRect(),nav=document.getElementById('mobileNav').getBoundingClientRect();return sheet.top>=0&&sheet.bottom<=nav.top;},id,{timeout:3000});
            const rect=await page.locator('#'+id).boundingBox(),nav=await page.locator('#mobileNav').boundingBox();
            assert.ok(rect.x>=0&&rect.x+rect.width<=width+1,'Sheet overflow '+sheet+' '+width);
            assert.ok(rect.y>=0&&rect.y+rect.height<=nav.y,'Sheet overlaps navigation '+sheet+' '+width);
          }
          await page.evaluate(()=>closeMobileSheets());
          const nav=await page.locator('#mobileNav').boundingBox();assert.ok(nav.y+nav.height<=890,'Navigation needs a bottom inset');
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
