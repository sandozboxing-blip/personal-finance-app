const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.D8_PLAYWRIGHT_PATH||'playwright'));}catch(_){}
test('video UX patterns preserve focus, continuity, quick repeats and honest feedback',{skip:!chromium},async()=>{
 const root=path.resolve(__dirname,'..');
 const state={version:8,updatedAt:'2026-11-27T10:00:00Z',leads:[{id:901,name:'Test business',folder:'Test folder',category:'Дизайн',tags:[],stars:4,status:'prospect',phone:'0888000000',email:'test@example.test'}],leadFolders:['Test folder'],leadFolderMeta:{},smm:[],web:[{id:'w1',name:'Test project',status:'active',paymentType:'monthly',monthly:150,cost:10,start:'2026-10-01'}],expenses:[],tasks:[],workTasks:[],focusTasks:[],focusInitialized:true,taskCategories:[],settings:{}};
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api.php'){
   response.setHeader('Content-Type','application/json');
   if(url.searchParams.get('action')==='login'){request.resume();setTimeout(()=>{response.writeHead(401);response.end(JSON.stringify({error:'Тестова грешка при вход'}));},400);}
   else if(url.searchParams.get('action')==='save'){request.resume();request.on('end',()=>response.end(JSON.stringify({ok:true,updatedAt:new Date().toISOString()})));}
   else response.end(JSON.stringify(url.searchParams.get('action')==='me'?{authenticated:true,user:'Partner'}:{ok:true,state}));return;
  }
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');response.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.D8_BROWSER_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());await page.goto(base);await page.waitForSelector('#appLoader.done',{state:'attached'});
  const repeat=await page.evaluate(()=>{jumpPage('web');jumpPage('dash');jumpPage('web');return Array.from(document.querySelectorAll('#webCards .ccard')).reduce((n,card)=>n+card.getAnimations().length,0);});
  assert.equal(repeat,0,'Frequent navigation does not replay the list entrance');
  const trigger=page.getByRole('button',{name:'+ Нов WD проект',exact:true});await trigger.click();
  const footerInside=await page.locator('#addOv>.modal').evaluate(panel=>{const r=panel.getBoundingClientRect();return Array.from(panel.querySelectorAll('.mfoot button')).every(button=>button.getBoundingClientRect().bottom<=r.bottom+1);});
  assert.ok(footerInside,'Dialog actions must stay inside the glass panel');
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),true);
  for(let i=0;i<18;i++){await page.keyboard.press(i%3===0?'Shift+Tab':'Tab');assert.ok(await page.locator('#addOv').evaluate(el=>el.contains(document.activeElement)),'Keyboard focus escaped the dialog');}
  await page.locator('#addOv .mclose').click();
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);assert.ok(await trigger.evaluate(el=>document.activeElement===el),'Focus should return to the opening button');
  await page.evaluate(()=>{openLB(901);openIndividualEmail(901);});
  assert.equal(await page.locator('#lbOv').evaluate(el=>el.inert),true);
  await page.evaluate(()=>closeIndividualEmail());assert.equal(await page.locator('#lbOv').evaluate(el=>el.inert),false);assert.equal(await page.locator('#app').evaluate(el=>el.inert),true);
  await page.evaluate(()=>closeLB());
  await page.locator('#themeToggle').click();assert.ok(await page.locator('#themeToggle svg').count()<=2);
  await page.waitForFunction(()=>document.querySelectorAll('#themeToggle svg').length===1);
  const confirmed=await page.evaluate(()=>{setSyncState('saving','Записване');setSyncState('error','Грешка');const status=document.getElementById('syncStatus'),outline=()=>status.getAnimations().some(a=>a.effect.getKeyframes().some(frame=>'outline' in frame));const errorPulse=outline();setSyncState('saving','Записване');setSyncState('saved','Запазено');return{errorPulse,savedPulse:outline()};});
  assert.deepEqual(confirmed,{errorPulse:false,savedPulse:true});
  await page.evaluate(()=>{jumpPage('leads');openLeadFolder('Test folder');});assert.equal(await page.locator('.d8-shared-icon').count(),1);
  await page.waitForFunction(()=>!document.querySelector('.d8-shared-icon'));
  await page.evaluate(()=>{showLeadFolders();openLeadFolder('Test folder');showLeadFolders();});
  await page.waitForFunction(()=>!document.querySelector('.d8-shared-icon'));
  assert.equal(await page.locator('.leadfoldercard').count(),1);
  await page.setViewportSize({width:390,height:844});await page.locator('#mobileTasksButton').click();await page.waitForTimeout(300);
  const handle=page.locator('#mobileTasks .mobile-more-handle'),box=await handle.boundingBox(),sheet=page.locator('#mobileTasks'),before=await sheet.boundingBox();
  assert.ok(box.height>=44);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-100,{steps:5});
  const pulled=await sheet.boundingBox();assert.ok(before.y-pulled.y<=25&&before.y-pulled.y>0,'Upward drag should resist at the edge');
  await page.mouse.up();await page.waitForTimeout(300);
  const restored=await sheet.boundingBox();assert.ok(Math.abs(restored.y-before.y)<1);
  const grip=await handle.boundingBox();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2+120,{steps:6});await page.mouse.up();
  assert.equal(await sheet.evaluate(el=>el.classList.contains('open')),false);
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{jumpPage('leads');openLeadFolder('Test folder');});assert.equal(await page.locator('.d8-shared-icon').count(),0);
  await page.evaluate(()=>showLogin());await page.locator('#lu').fill('Test');await page.locator('#lp').fill('not-a-real-password');
  const busy=await page.evaluate(()=>{doLogin();const b=document.getElementById('loginBtn');return{disabled:b.disabled,busy:b.getAttribute('aria-busy'),label:b.textContent};});assert.equal(busy.disabled,true);assert.equal(busy.busy,'true');assert.match(busy.label,/Влизане/);
  await page.waitForFunction(()=>document.getElementById('loginBtn').getAttribute('aria-busy')==='false');assert.equal(await page.locator('#lerr.show').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
