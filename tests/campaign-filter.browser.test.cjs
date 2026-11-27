const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.D8_PLAYWRIGHT_PATH||'playwright'));}catch(_){}
test('campaign recipients match the current filter across pages and keep its order',{skip:!chromium},async()=>{
 const root=path.resolve(__dirname,'..'),sent=[];
 const targets=Array.from({length:30},(_,i)=>({id:i+1,name:'Подбран '+String(i+1).padStart(2,'0'),folder:'Филтрирани',category:'Дизайн',tags:[],stars:4.8,status:'prospect',email:'test'+i+'@example.test',phone:'0888000000',website:i%2?'https://example.test':'',extra:i%3?{instagram:'https://instagram.com/example'}:{},followup:'2020-01-01'}));
 const outside=[{id:301,category:'Друго'},{id:302,folder:'Друга папка'},{id:303,status:'not'},{id:304,stars:2},{id:305,followup:'9999-01-01'},{id:306,name:'Друг бизнес'}].map(row=>Object.assign({},targets[0],{name:'Подбран извън филтъра'},row));
 const state={version:8,updatedAt:'2026-11-27T10:00:00Z',leads:targets.concat(outside),leadFolders:['Филтрирани','Друга папка'],leadFolderMeta:{},smm:[],web:[],expenses:[],tasks:[],workTasks:[],focusTasks:[],focusInitialized:true,taskCategories:[],settings:{}};
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api.php'){
   response.setHeader('Content-Type','application/json');const action=url.searchParams.get('action');
   if(action==='save'||action==='sendOutreach'){let body='';request.on('data',chunk=>body+=chunk);request.on('end',()=>{if(action==='sendOutreach')sent.push(JSON.parse(body));response.end(JSON.stringify({ok:true,updatedAt:new Date().toISOString()}));});}
   else response.end(JSON.stringify(action==='me'?{authenticated:true,user:'Partner'}:{ok:true,state}));return;
  }
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');response.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.D8_BROWSER_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());await page.goto(base);await page.waitForSelector('#appLoader.done',{state:'attached'});
  await page.evaluate(()=>{jumpPage('leads');openLeadFolder('Филтрирани');document.getElementById('lCatF').value='Дизайн';document.getElementById('lContactF').value='email';document.getElementById('lRatingF').value='4.5';document.getElementById('lFollowF').value='today';document.getElementById('lSortF').value='name_desc';document.getElementById('srchQ').value='Подбран';lftab='prospect';leadPageSize=25;renderLeads();leadPage=2;renderLeads();});
  const expected=targets.map(row=>row.id).reverse();
  await page.getByRole('button',{name:/Стартирай кампания/}).click();
  assert.deepEqual(await page.evaluate(()=>outreachRows(outreachSegment).map(row=>row.id)),expected,'The campaign must use the filtered results rather than an extra no-website/no-social segment');
  assert.equal(await page.locator('#outreachList .outreachlead').count(),30,'All filtered pages belong to the campaign');assert.match(await page.locator('#leadOutreachTitle').innerText(),/30/);
  assert.equal(sent.length,0,'Opening a campaign must not send messages');
  await page.evaluate(()=>{document.getElementById('srchQ').value='Друг бизнес';renderLeads();outreachScopeIds=outreachScopeIds.map(String);});
  assert.deepEqual(await page.evaluate(()=>outreachRows(outreachSegment).map(row=>row.id)),expected,'An open campaign keeps the selected scope, including imported string/numeric IDs');
  await page.evaluate(()=>{leads.forEach(row=>row.outreach={status:'ready'});renderLeadOutreach();});
  assert.deepEqual(await page.evaluate(()=>approvedOutreachRows().map(row=>row.id)),expected,'Approval/send eligibility must stay inside the filtered scope');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   await page.waitForFunction(()=>{const trigger=document.querySelector('#outreachSegments .custom-control-trigger');return trigger&&trigger.getClientRects().length;});
   const headerIssues=await page.locator('#leadOutreachOv .mhdr').evaluate(header=>{const r=header.closest('.modal').getBoundingClientRect();return Array.from(header.querySelectorAll('#outreachSendAllBtn,.outreachheadactions>details>summary,.outreachheadactions>.mclose')).map(element=>{const b=element.getBoundingClientRect();return {element:element.id||element.className,left:b.left,right:b.right,panelLeft:r.left,panelRight:r.right,width:b.width,height:b.height};}).filter(b=>b.width&&b.height&&(b.left<b.panelLeft-1||b.right>b.panelRight+1));});
   if(process.env.D8_CAMPAIGN_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.D8_CAMPAIGN_PREVIEW_DIR,'campaign-filter-'+width+'.png')});
   assert.deepEqual(headerIssues,[],'Campaign actions fit the mobile header at '+width);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#outreachSegments .custom-control-trigger').click();
  await page.getByRole('option',{name:/^Без сайт и socials/}).click();
  const narrowed=await page.evaluate(()=>outreachRows(outreachSegment).map(row=>row.id));assert.ok(narrowed.length<30&&narrowed.every(id=>expected.includes(id)));
  assert.deepEqual(await page.evaluate(()=>approvedOutreachRows().map(row=>row.id)),narrowed,'Sending must follow the displayed campaign segment');
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>{leads.forEach(row=>row.outreach={status:'draft'});approveOutreachSegment();});
  assert.deepEqual(await page.evaluate(()=>leads.filter(row=>row.outreach.status==='ready').map(row=>row.id).sort((a,b)=>a-b)),[...narrowed].sort((a,b)=>a-b),'Bulk approval must not approve records outside the displayed segment');
  await page.evaluate(()=>{leads.filter(row=>!outreachScopeIds.includes(String(row.id))).forEach(row=>row.outreach={status:'ready'});const timer=window.setTimeout;window.originalCampaignTimer=timer;window.setTimeout=function(callback,delay,...args){return timer(callback,delay>=3000&&delay<=5500?0:delay,...args);};sendApprovedOutreachBatch();});
  await page.waitForFunction(()=>!outreachSending);
  assert.deepEqual(sent.map(message=>message.leadId),narrowed,'Only approved recipients in the displayed segment reach the local mock send endpoint');
  assert.ok(sent.every(message=>message.consentConfirmed===true));
  await page.evaluate(()=>{window.setTimeout=window.originalCampaignTimer;closeOutreachProgress();});
  await page.evaluate(()=>{closeLeadOutreach();document.getElementById('srchQ').value='Подбран';document.getElementById('lContactF').value='';leads.push({id:401,name:'Подбран без имейл',folder:'Филтрирани',category:'Дизайн',stars:4.8,status:'prospect',tags:[],email:'',phone:'0888000000',followup:'2020-01-01',outreach:{status:'ready'}});renderLeads();openLeadOutreach();});
  assert.equal(await page.locator('#outreachList .outreachlead').count(),26,'Reopening recomputes the current filter, including phone-only records and the updated follow-up dates');
  assert.match(await page.locator('#leadOutreachTitle').innerText(),/25 с имейл/);
  assert.equal(await page.evaluate(()=>approvedOutreachRows().some(row=>row.id===401)),false,'A record without email cannot be sent');
  await page.evaluate(()=>{closeLeadOutreach();document.getElementById('srchQ').value='няма такъв бизнес';renderLeads();openLeadOutreach();});
  assert.equal(await page.locator('#outreachList .outreachlead').count(),0);assert.equal(await page.locator('#outreachSendAllBtn').isDisabled(),true);
  await page.evaluate(()=>{closeLeadOutreach();document.getElementById('srchQ').value='Подбран';renderLeads();openLeadCampaignHistory();});
  assert.equal(await page.evaluate(()=>outreachScopeIds),null,'History remains available beyond the current filter');
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
