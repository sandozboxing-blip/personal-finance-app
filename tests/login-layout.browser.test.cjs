const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
let chromium;
try{({chromium}=require(process.env.D8_PLAYWRIGHT_PATH||'playwright'));}catch(_){}

test('login is centered on the viewport and remains reachable on short screens',{skip:!chromium},async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api.php'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({authenticated:false}));return;}
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');response.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.D8_BROWSER_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:{width:1913,height:948},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base);await page.waitForSelector('#lw',{state:'visible'});
  const session=await page.context().newCDPSession(page);
  for(const [width,height,scale] of [[1913,948,1],[1913,948,1.2],[1440,900,1.5],[1280,600,1],[1024,600,1],[768,1024,1],[390,844,1],[320,568,1],[844,390,1],[390,844,1.25]]){
   await page.setViewportSize({width,height});
   await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:scale});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.querySelector('#lw').scrollTop=0;},theme);
    for(const compact of [false,true]){
     await page.evaluate(compact=>{document.body.classList.toggle('nav-compact',compact);document.getElementById('lw').scrollTop=0;},compact);
     const layout=await page.evaluate(()=>{const overlay=document.getElementById('lw'),card=overlay.querySelector('.lcard'),r=card.getBoundingClientRect(),o=overlay.getBoundingClientRect(),v=window.visualViewport;return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,overlay:o.toJSON(),scrollHeight:overlay.scrollHeight,clientHeight:overlay.clientHeight,documentWidth:document.scrollingElement.scrollWidth,visible:{left:v.offsetLeft,top:v.offsetTop,width:v.width,height:v.height}};});
     if(process.env.D8_LOGIN_PREVIEW_DIR&&theme==='light'&&!compact){await page.screenshot({path:path.join(process.env.D8_LOGIN_PREVIEW_DIR,'login-'+width+'x'+height+'-'+scale+'.png')});}
     const label=width+'x'+height+' '+theme+' compact='+compact+' '+JSON.stringify(layout);
     const visible=layout.visible;
     assert.ok(Math.abs((layout.left+layout.right)/2-(visible.left+visible.width/2))<=2,'Login is shifted: '+label);
     assert.ok(layout.left>=visible.left+10&&layout.right<=visible.left+visible.width-10,'Login exceeds horizontal edges: '+label);
     assert.ok(layout.top>=visible.top+10,'Top of login is clipped: '+label);
     if(layout.height<=visible.height-48){assert.ok(Math.abs((layout.top+layout.bottom)/2-(visible.top+visible.height/2))<=2,'Login is not vertically centered: '+label);assert.ok(layout.bottom<=visible.top+visible.height-10,'Login bottom is clipped: '+label);}
     await page.locator('#lw').evaluate(el=>el.scrollTop=el.scrollHeight);
     const reachable=await page.locator('.loginsecure').evaluate(el=>{const r=el.getBoundingClientRect(),v=visualViewport;return r.bottom<=v.offsetTop+v.height-8&&r.top>=v.offsetTop;});
     assert.equal(reachable,true,'Footer cannot be reached by scrolling: '+label);
     assert.ok(layout.documentWidth<=width+1,'Horizontal page scroll: '+label);
    }
   }
  }
  await page.evaluate(()=>{document.getElementById('lerr').textContent='Грешно потребителско име или парола';document.getElementById('lerr').classList.add('show');});
  await page.getByRole('button',{name:'Влез в панела →',exact:true}).scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#mobileNav').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
