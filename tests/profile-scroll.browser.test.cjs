/* Run with D8_PLAYWRIGHT_PATH pointing to a Playwright installation, or install playwright locally. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require(process.env.D8_PLAYWRIGHT_PATH || 'playwright')); } catch (_) {}

test('lead profile scrolls as one surface without translucent text overlaps', { skip: !chromium }, async (t) => {
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
    await page.evaluate(()=>{leads=[{id:901,name:'Тестов профил',folder:'Test',category:'Зъболекар',address:'Дълъг тестов адрес, София',phone:'0888000000',email:'test@example.test',tags:[],stars:4.8,status:'prospect',note:'Тестови бележки'}];leadFolders=['Test'];normalizeData();});
    for(const width of [320,390,430,768,1440]){
      await page.setViewportSize({width,height:800});
      for(const theme of ['light','dark']){
        if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#themeToggle').click();
        await page.evaluate(()=>openLB(901));await page.waitForTimeout(120);
        const pane=page.locator('#lbOv .lbm');
        for(const offset of [0,120,300,100000]){
          await pane.evaluate((el,top)=>el.scrollTop=top,offset);await page.waitForTimeout(30);
          const geometry=await page.evaluate(()=>{const root=document.getElementById('lbOv'),header=root.querySelector('.lbhdr').getBoundingClientRect(),communication=root.querySelector('.lbcommunication-pane').getBoundingClientRect(),body=root.querySelector('.lbbody').getBoundingClientRect(),footer=root.querySelector('.mfoot').getBoundingClientRect();return{headerEnd:header.bottom,contentStart:communication.top,bodyEnd:body.bottom,footerStart:footer.top};});
          assert.ok(geometry.headerEnd<=geometry.contentStart+1,'Header overlays communication while scrolling '+theme+' '+width+' @'+offset);
          assert.ok(geometry.bodyEnd<=geometry.footerStart+1,'Footer overlays fields while scrolling '+theme+' '+width+' @'+offset);
        }
        await page.getByRole('button',{name:'Затвори профила',exact:true}).click();
        assert.equal(await page.locator('#lbOv').isVisible(),false);
      }
    }
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:800});
      for(const name of ['email','manual']){
        await page.evaluate(name=>name==='email'?openIndividualEmail(901):openManualLead(),name);await page.waitForTimeout(100);
        const selector=name==='email'?'.individual-email-modal':'.manual-lead-modal';
        for(const offset of [0,150,100000]){
          await page.locator(selector).evaluate((el,top)=>el.scrollTop=top,offset);
          const overlap=await page.locator(selector).evaluate((root,name)=>{
            const header=root.querySelector(name==='email'?'header':'.manual-lead-head').getBoundingClientRect();
            const content=root.querySelector(name==='email'?'main':'.manual-lead-form').getBoundingClientRect();
            const footer=root.querySelector(name==='email'?'footer':'.manual-lead-actions').getBoundingClientRect();
            const fields=name==='email'?content:root.querySelector('.manual-lead-grid').getBoundingClientRect();
            return header.bottom>content.top+1||fields.bottom>footer.top+1;
          },name);
          assert.equal(overlap,false,name+' dialog overlaps at '+width+' @'+offset);
        }
        await page.evaluate(name=>name==='email'?closeIndividualEmail():closeManualLead(),name);
      }
    }
    assert.deepEqual(errors, []);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
