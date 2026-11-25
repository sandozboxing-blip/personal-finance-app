const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
let chromium;
try{({chromium}=require(process.env.D8_PLAYWRIGHT_PATH||'playwright'));}catch(_){}

test('expressive motion is bounded, anchored, interruptible and saved per profile',{skip:!chromium},async()=>{
 const root=path.resolve(__dirname,'..');
 const state={version:8,updatedAt:'2026-11-25T10:00:00Z',leads:[],leadFolders:[],leadFolderMeta:{},smm:[],web:[],expenses:[],tasks:[],workTasks:[],focusTasks:[],focusInitialized:true,taskCategories:[],settings:{}};
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api.php'){
   response.setHeader('Content-Type','application/json');
   if(url.searchParams.get('action')==='save'){
    let body='';request.on('data',chunk=>body+=chunk);request.on('end',()=>{const incoming=JSON.parse(body);state.settings=incoming.settings;response.end(JSON.stringify({ok:true,updatedAt:new Date().toISOString()}));});
   }else response.end(JSON.stringify(url.searchParams.get('action')==='me'?{authenticated:true,user:'Partner'}:{ok:true,state}));
   return;
  }
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');response.end(fs.readFileSync(file));
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
  assert.equal(await page.locator('body').getAttribute('data-motion-style'),'expressive');
  const list=await page.evaluate(()=>{
   web=Array.from({length:150},(_,i)=>({id:'m-'+i,name:'Client '+i,status:'active',paymentType:'monthly',monthly:100,cost:10,start:'2026-10-01'}));
   jumpPage('web');
   const cards=Array.from(document.querySelectorAll('#webCards .ccard'));
   return {count:cards.length,animated:cards.filter(card=>card.getAnimations().length).length,lastAnimations:cards.at(-1).getAnimations().length,lateOpacity:getComputedStyle(cards.at(-1)).opacity};
  });
  assert.equal(list.count,150);assert.ok(list.animated>0&&list.animated<=6);assert.equal(list.lastAnimations,0);assert.equal(list.lateOpacity,'1');
  await page.evaluate(()=>{
   const panel=document.querySelector('#addOv>.modal');
   const original=panel.animate;panel.animate=function(frames,options){window.lastModalMotion={frames,duration:options.duration};return original.call(this,frames,options);};
  });
  await page.getByRole('button',{name:'+ Нов WD проект',exact:true}).click();
  const anchored=await page.evaluate(()=>window.lastModalMotion);
  assert.ok(anchored);assert.match(anchored.frames[0].transformOrigin,/px/);assert.ok(anchored.duration<=300);
  await page.evaluate(()=>closeAdd());
  assert.equal(await page.locator('#addOv>.modal').evaluate(el=>el.getAnimations().length),0,'Closing cancels entry instead of waiting for it');
  await page.evaluate(()=>jumpPage('settings'));
  await page.locator('.custom-control-trigger[data-source=settingsMotionStyle]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#customControlPopover').isVisible(),true,'Queued activation scroll must not immediately close the menu');
  await Promise.all([page.waitForResponse(response=>response.url().includes('action=save')),page.getByRole('option',{name:'Спокоен — фини ефекти',exact:true}).click()]);
  assert.equal(state.settings.motionStyle,'calm');
  await page.locator('.custom-control-trigger[data-source=settingsMotionStyle]').click();
  await page.mouse.wheel(0,140);
  await page.waitForFunction(()=>document.getElementById('customControlPopover').hidden);
  await page.getByRole('button',{name:'Преглед на ефектите',exact:true}).click();
  assert.equal(await page.locator('#motionPreview svg').evaluateAll(icons=>icons.reduce((total,icon)=>total+icon.getAnimations().length,0)),0,'Calm preview leaves the icons still');
  await page.reload();await page.waitForSelector('#appLoader.done',{state:'attached'});
  assert.equal(await page.locator('body').getAttribute('data-motion-style'),'calm','Selected style survives a reload');
  await page.evaluate(()=>{userSettings.motionStyle='expressive';applyProfileSettings();jumpPage('settings');});
  await page.setViewportSize({width:390,height:800});
  await page.getByRole('button',{name:'Преглед на ефектите',exact:true}).click();
  assert.ok(await page.locator('#motionPreview svg').evaluateAll(icons=>icons.some(icon=>icon.getAnimations().length)));
  assert.ok(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Преглед на ефектите',exact:true}).click();
  assert.equal(await page.locator('#motionPreview').evaluate(el=>el.getAnimations({subtree:true}).length),0,'System reduced motion wins over expressive mode');
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
