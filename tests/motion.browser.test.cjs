/* D8_PLAYWRIGHT_PATH selects the local Playwright installation. No live data is used. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
let chromium;
try{({chromium}=require(process.env.D8_PLAYWRIGHT_PATH||'playwright'));}catch(_){}

test('motion remains responsive, bounded and optional across navigation and dialogs',{skip:!chromium},async()=>{
 const root=path.resolve(__dirname,'..');
 const state={version:8,updatedAt:'2026-11-25T10:00:00Z',leads:[],leadFolders:[],leadFolderMeta:{},smm:[],web:[],expenses:[],tasks:[],workTasks:[],focusTasks:[],focusInitialized:true,taskCategories:[],settings:{}};
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api.php'){
   response.setHeader('Content-Type','application/json');
   if(url.searchParams.get('action')==='save'){request.resume();request.on('end',()=>response.end(JSON.stringify({ok:true,updatedAt:new Date().toISOString()})));}
   else response.end(JSON.stringify(url.searchParams.get('action')==='me'?{authenticated:true,user:'Partner'}:{ok:true,state}));
   return;
  }
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
  response.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.D8_BROWSER_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base);await page.waitForSelector('#appLoader.done',{state:'attached'});
  const rapid=await page.evaluate(()=>{
   for(const name of ['web','leads','reports','smm','tasks','dash'])jumpPage(name);
   const pages=document.querySelectorAll('.page.active');
   return {active:pages.length,id:pages[0].id,title:document.getElementById('pgtitle').textContent,animations:document.getElementById('pgtitle').getAnimations().length};
  });
  assert.equal(rapid.active,1);assert.equal(rapid.id,'pgdash');assert.equal(rapid.title,'Табло');assert.equal(rapid.animations,1,'Rapid changes replace the previous feedback');
  await page.waitForFunction(()=>document.getElementById('pgtitle').getAnimations().length===0);
  const saved=await page.evaluate(()=>{
   setSyncState('saving','Записване');setSyncState('saved','Запазено');
   return {busy:document.getElementById('syncStatus').getAttribute('aria-busy'),count:document.querySelector('#syncStatus>i').getAnimations().length};
  });
  assert.equal(saved.busy,'false');assert.equal(saved.count,1);
  await page.evaluate(()=>toast('Тестово потвърждение','var(--green)'));
  assert.equal(await page.locator('.toast[role=status] .toast-check').count(),1);
  await page.evaluate(()=>openAdd('web'));
  await page.locator('.custom-control-trigger[data-source=fctype]').click();
  await page.getByRole('option',{name:'Онлайн магазин',exact:true}).click();
  assert.equal(await page.locator('#fctype').inputValue(),'Онлайн магазин','A control stays usable while the dialog enters');
  await page.evaluate(()=>closeAdd());
  for(const reduced of ['system','setting']){
   await page.waitForTimeout(300);
   if(reduced==='system')await page.emulateMedia({reducedMotion:'reduce'});
   else {await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.body.classList.add('reduce-motion'));}
   const counts=await page.evaluate(()=>{
    jumpPage('web');setSyncState('saving','Записване');setSyncState('saved','Запазено');openAdd('web');toast('Готово','var(--green)');
    return {title:document.getElementById('pgtitle').getAnimations().length,dot:document.querySelector('#syncStatus>i').getAnimations().length,dialog:getComputedStyle(document.querySelector('#addOv>.modal')).animationName,check:getComputedStyle(document.querySelector('.toast:last-child .toast-check path')).animationName};
   });
   assert.deepEqual(counts,{title:0,dot:0,dialog:'none',check:'none'},reduced+' reduced-motion preference');
   await page.evaluate(()=>{closeAdd();jumpPage('dash');document.body.classList.remove('reduce-motion');});
  }
  await page.setViewportSize({width:390,height:800});
  await page.evaluate(()=>jumpPage('dash'));
  await page.locator('#mobileTasksButton').click();
  await page.locator('#mobileTasks button').filter({hasText:'Календар'}).click();
  assert.equal(await page.locator('#pgtasks').isVisible(),true,'Mobile navigation remains usable during transitions');
  assert.ok(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
