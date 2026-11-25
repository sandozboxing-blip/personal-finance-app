const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.D8_PLAYWRIGHT_PATH||'playwright'));}catch(_){}
test('desktop sections stay inside the visible viewport at normal and enlarged scales',{skip:!chromium},async()=>{
 const root=path.resolve(__dirname,'..');
 const state={version:8,updatedAt:'2026-11-25T10:00:00Z',leads:Array.from({length:12},(_,i)=>({id:900+i,name:'Test business '+i,folder:'Test folder',category:'Дизайн',tags:[],stars:4,status:'prospect',phone:'0888000000'})),leadFolders:['Test folder'],leadFolderMeta:{},smm:Array.from({length:6},(_,i)=>({id:'s'+i,name:'Test SMM '+i,status:'active',monthly:150,cost:10,start:'2026-10-01'})),web:Array.from({length:6},(_,i)=>({id:'w'+i,name:'Test project '+i,status:'active',paymentType:'monthly',monthly:150,cost:10,start:'2026-10-01'})),expenses:[],tasks:[],workTasks:[],focusTasks:[],focusInitialized:true,taskCategories:[],settings:{}};
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api.php'){response.setHeader('Content-Type','application/json');if(url.searchParams.get('action')==='save'){request.resume();request.on('end',()=>response.end(JSON.stringify({ok:true,updatedAt:new Date().toISOString()})));}else response.end(JSON.stringify(url.searchParams.get('action')==='me'?{authenticated:true,user:'Partner'}:{ok:true,state}));return;}
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');response.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.D8_BROWSER_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:{width:1918,height:958},reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());await page.goto(base);await page.waitForSelector('#appLoader.done',{state:'attached'});
  const session=await page.context().newCDPSession(page);
  for(const [width,scale] of [[1918,1],[1918,1.3333333],[1918,1.5],[1440,1.25],[1280,1.5],[1024,1]]){
   await page.setViewportSize({width,height:958});await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:scale});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   for(const theme of ['light','dark'])for(const compact of [false,true])for(const section of ['dash','expenses','smm','web','leads','reports','tasks','work','settings']){
    await page.evaluate(({theme,compact,section})=>{document.documentElement.dataset.theme=theme;document.body.classList.toggle('nav-compact',compact);jumpPage(section);},{theme,compact,section});
    const issues=await page.evaluate(()=>{
     const v=visualViewport,left=v.offsetLeft,right=left+v.width,issues=[];
     document.querySelectorAll('.app.on,.main,.topbar,.page.active,.page.active .dashwrap,.page.active .dashpanel,.page.active .dc,.page.active .ccard,.page.active .leadfoldercard,.page.active .settings-card,.page.active .report-panel,.page.active .taskcomposer,.page.active .calwrap,.page.active .taskcalendar,.page.active .workcomposer').forEach(el=>{
      if(!el.getClientRects().length)return;const r=el.getBoundingClientRect();if(r.left<left-1||r.right>right+1)issues.push({element:el.id||el.className,left:r.left,right:r.right,visibleRight:right});
     });
     const wrap=document.querySelector('.page.active .dashwrap');
     if(wrap){const r=wrap.getBoundingClientRect(),content=document.getElementById('mainContent').getBoundingClientRect();if(Math.abs((r.left+r.right-content.left-content.right)/2)>2)issues.push({element:'dashboard not centered in content'});}
     return issues;
    });
    if(process.env.D8_PANEL_PREVIEW_DIR&&section==='dash'&&theme==='dark'&&!compact){await page.evaluate(()=>scrollTo(0,360));await page.screenshot({path:path.join(process.env.D8_PANEL_PREVIEW_DIR,'panel-'+width+'-'+scale+'.png')});}
    assert.deepEqual(issues,[],section+' '+width+' @'+scale+' '+theme+' compact='+compact+' is clipped');
   }
   await page.evaluate(()=>{jumpPage('web');openAdd('web');});
   const modal=await page.locator('#addOv>.modal').evaluate(el=>{const r=el.getBoundingClientRect(),v=visualViewport;return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewLeft:v.offsetLeft,viewRight:v.offsetLeft+v.width,viewTop:v.offsetTop,viewBottom:v.offsetTop+v.height};});
   assert.ok(modal.left>=modal.viewLeft&&modal.right<=modal.viewRight+1,'Client dialog is clipped at '+width+' @'+scale);
   assert.ok(modal.top>=modal.viewTop&&modal.bottom<=modal.viewBottom+1,'Client dialog exceeds visible height');
   await page.locator('.custom-control-trigger[data-source=fctype]').click();
   const popup=await page.locator('#customControlPopover').boundingBox();
   assert.ok(popup.x>=modal.viewLeft&&popup.x+popup.width<=modal.viewRight+1,'Dropdown exceeds visible width');
   assert.ok(popup.y>=modal.viewTop&&popup.y+popup.height<=modal.viewBottom+1,'Dropdown exceeds visible height');
   await page.keyboard.press('Escape');await page.evaluate(()=>closeAdd());
  }
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
