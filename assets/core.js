// ── AUTH (STATELESS TAB SESSION) ─────────────────────
var AUTH_KEY='d8-auth';
var nativeFetch=window.fetch.bind(window);
window.fetch=function(url,options){
  options=options||{};
  if(typeof url==='string'&&url.indexOf('api.php')>=0){
    options.headers=Object.assign({},options.headers||{});
    var token=sessionStorage.getItem(AUTH_KEY);
    if(token)options.headers['X-D8-Auth']=token;
  }
  return nativeFetch(url,options);
};
function togglePassword(){
  var input=document.getElementById('lp'),button=document.querySelector('.passwordtoggle');
  input.type=input.type==='password'?'text':'password';
  button.textContent=input.type==='password'?'Покажи':'Скрий';
  button.setAttribute('aria-label',input.type==='password'?'Покажи паролата':'Скрий паролата');
}
function showLogin(message){
  sessionStorage.removeItem(AUTH_KEY);
  document.getElementById('app').classList.remove('on');
  document.getElementById('lw').classList.remove('hidden');
  var loader=document.getElementById('appLoader');if(loader)loader.classList.add('done');
  if(message){var err=document.getElementById('lerr');err.textContent=message;err.classList.add('show');}
}
function doLogin(){
  var u=document.getElementById('lu').value.trim(),p=document.getElementById('lp').value,err=document.getElementById('lerr'),btn=document.getElementById('loginBtn');
  err.classList.remove('show');btn.disabled=true;btn.textContent='Влизане...';
  fetch('api.php?action=login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Грешка при вход');return d;});})
    .then(function(d){if(!d.authToken)throw new Error('Сървърът не върна защитена сесия');sessionStorage.setItem(AUTH_KEY,d.authToken);startApp(d.user||u,true);})
    .catch(function(e){err.textContent=e.message||'Грешно потребителско име или парола';err.classList.add('show');document.getElementById('lp').value='';document.getElementById('lp').focus();})
    .finally(function(){btn.disabled=false;btn.textContent='Влез в панела →';});
}
document.getElementById('loginBtn').addEventListener('click',doLogin);
document.getElementById('lp').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
document.getElementById('lu').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('lp').focus();});
function startApp(user,showTransition){
  currentUser=user||'Admin';
  if(window.D8OneSignal)window.D8OneSignal.login(currentUser);
  var loader=document.getElementById('appLoader');
  if(loader){loader.classList.remove('done');loader.classList.toggle('login-transition',!!showTransition);var welcome=document.getElementById('loaderWelcome');if(welcome)welcome.textContent=showTransition?'Добре дошъл, '+currentUser:'Синхронизираме данните';}
  window.d8LoaderUntil=Date.now()+(showTransition?750:0);
  document.getElementById('lw').classList.add('hidden');
  document.getElementById('app').classList.add('on');
  document.getElementById('sbav').textContent=(user||'A')[0].toUpperCase();
  document.getElementById('sbname').textContent=user||'Admin';
  setSyncState('loading','Зареждане');
  goPage('dash',document.querySelector('.sbi.active'));
  loadData();
  setTimeout(hideAppLoader,showTransition?1200:2500);
}
function logout(){
  if(window.D8OneSignal)window.D8OneSignal.logout();
  fetch('api.php?action=logout',{credentials:'same-origin'}).catch(function(){})
    .finally(function(){sessionStorage.removeItem(AUTH_KEY);showLogin();});
}

// ── STATE + RELIABLE SYNC ────────────────────────────
var leads=[],smm=[],web=[],workTasks=[],sharedTasks=[],focusTasks=[],taskCategories=[],userSettings={},currentUser='',syncTimer=null,syncInFlight=false,syncPending=false,syncScope='',dataLoaded=false,lastServerUpdatedAt='';
var leadPage=1,leadPageSize=50,leadFilterKey='';var lftab='all',lbid=null,curpg='dash',editid=null,edittype=null;
function localState(){return{leads:leads,smm:smm,web:web,workTasks:workTasks,tasks:sharedTasks,focusTasks:focusTasks,taskCategories:taskCategories,settings:userSettings};}
function setSyncState(state,text){
  var el=document.getElementById('syncStatus'),label=document.getElementById('settingsSyncLabel');
  if(el){el.dataset.state=state;var span=el.querySelector('span');if(span)span.textContent=text;}
  if(label)label.textContent=text;
}
function hideAppLoader(){
  var loader=document.getElementById('appLoader');if(!loader)return;
  var wait=Math.max(0,(window.d8LoaderUntil||0)-Date.now());
  if(wait){setTimeout(hideAppLoader,wait);return;}
  loader.classList.add('done');
}
function saveLocal(markDirty,scope){
  try{
    var k=currentUser||'guest';
    localStorage.setItem('d8l',JSON.stringify(leads));localStorage.setItem('d8s2',JSON.stringify(smm));localStorage.setItem('d8w',JSON.stringify(web));localStorage.setItem('d8work',JSON.stringify(workTasks));
    localStorage.setItem('d8tasks:'+k,JSON.stringify(sharedTasks));localStorage.setItem('d8focus:'+k,JSON.stringify(focusTasks));localStorage.setItem('d8taskcats:'+k,JSON.stringify(taskCategories));localStorage.setItem('d8settings:'+k,JSON.stringify(userSettings));
    if(markDirty!==false&&scope!=='profile'){localStorage.setItem('d8LocalUpdatedAt',new Date().toISOString());localStorage.setItem('d8SyncDirty','1');}
  }catch(e){setSyncState('error','Няма място');}
}
function saveData(scope){
  scope=scope||'shared';syncScope=syncPending&&syncScope&&syncScope!==scope?'all':scope;
  saveLocal(true,scope);syncPending=true;setSyncState('saving','Записване...');
  clearTimeout(syncTimer);syncTimer=setTimeout(flushSave,120);
}
function flushSave(){
  clearTimeout(syncTimer);
  if(syncInFlight||!syncPending||!currentUser)return;
  var scope=syncScope||'all';syncScope='';syncPending=false;syncInFlight=true;setSyncState('saving','Записване...');
  var payload=JSON.stringify(Object.assign(localState(),{saveScope:scope}));
  fetch('api.php?action=save',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:payload})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(r.status===401)throw new Error('AUTH');if(!r.ok)throw new Error(d.error||'SAVE');return d;});})
    .then(function(d){lastServerUpdatedAt=d.updatedAt||new Date().toISOString();localStorage.setItem('d8LastServerAt',lastServerUpdatedAt);if(scope!=='profile')localStorage.removeItem('d8SyncDirty');setSyncState('saved','Всичко е запазено');})
    .catch(function(e){if(e.message==='AUTH'){showLogin('Сесията изтече. Влез отново.');return;}syncScope=syncScope&&syncScope!==scope?'all':scope;syncPending=true;setSyncState('error','Не е записано');toast('Промените са запазени на устройството, но сървърът не отговори.','var(--yellow)');})
    .finally(function(){syncInFlight=false;if(syncPending&&document.visibilityState==='visible')syncTimer=setTimeout(flushSave,700);});
}
function normalizeData(){
  if(!Array.isArray(leads))leads=[];if(!Array.isArray(workTasks))workTasks=[];
  leads=leads.filter(function(l){return l&&typeof l==='object';});
  leads.forEach(function(l,i){
    if(Array.isArray(l.tags))l.tags=l.tags.filter(Boolean).map(String);
    else if(typeof l.tags==='string')l.tags=l.tags.split(/[,;|]/).map(function(t){return t.trim();}).filter(Boolean);
    else l.tags=[];
    l.extra=l.extra&&typeof l.extra==='object'&&!Array.isArray(l.extra)?l.extra:{};
    l.id=l.id||Date.now()+i;l.name=String(l.name||l.title||l.business||'Без име');
    l.website=String(l.website||'');l.phone=String(l.phone||'');l.email=String(l.email||'');
    l.category=String(l.category||'');l.address=String(l.address||'');l.note=String(l.note||'');
    l.reviews=String(l.reviews||'');l.price=String(l.price||'');l.followup=String(l.followup||'');
    l.stars=parseFloat(l.stars)||0;l.status=['unset','prospect','maybe','not'].indexOf(l.status)>=0?l.status:'unset';
    l.aiPhone=String(l.aiPhone||'');l.aiEmail=String(l.aiEmail||'');
  });
  smm.forEach(function(c){c.cost=c.cost||'';});
  web.forEach(function(c){c.cost=c.cost||'';c.duration=c.duration||c.months||'';c.paymentType=c.paymentType||(c.total?'one_time':'monthly');c.oneTime=c.oneTime||c.total||'';c.initial=c.initial||'';if(!c.monthly){var n=Math.max(1,parseInt(c.months)||1);c.monthly=c.total?String((parseFloat(c.total)||0)/n):'';}});
}
function readLocalData(){
  var k=currentUser||'guest';
  try{leads=JSON.parse(localStorage.getItem('d8l')||'[]');smm=JSON.parse(localStorage.getItem('d8s2')||'[]');web=JSON.parse(localStorage.getItem('d8w')||'[]');workTasks=JSON.parse(localStorage.getItem('d8work')||'[]');sharedTasks=JSON.parse(localStorage.getItem('d8tasks:'+k)||'[]');focusTasks=JSON.parse(localStorage.getItem('d8focus:'+k)||'[]');taskCategories=JSON.parse(localStorage.getItem('d8taskcats:'+k)||'[]');userSettings=JSON.parse(localStorage.getItem('d8settings:'+k)||'{}');}
  catch(e){leads=[];smm=[];web=[];workTasks=[];sharedTasks=[];focusTasks=[];taskCategories=[];userSettings={};}
  normalizeData();
}
function finishDataLoad(){
  dataLoaded=true;populateCats();renderLeadAddons();renderTaskCategories();applyProfileSettings();updateBadges();
  renderDash();if(curpg==='smm')renderSmm();if(curpg==='web')renderWeb();if(curpg==='leads')renderLeads();if(curpg==='tasks')renderTaskManager();if(curpg==='work')renderWorkTaskManager();
  setTimeout(hideAppLoader,100);
}
function loadData(){
  readLocalData();var localSnapshot=localState(),hasUnsyncedLocal=localStorage.getItem('d8SyncDirty')==='1';
  finishDataLoad();
  fetch('api.php?action=load',{credentials:'same-origin'})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(r.status===401)throw new Error('AUTH');if(!r.ok)throw new Error(d.error||'LOAD');return d;});})
    .then(function(d){
      var state=d.state||{},localSharedCount=localSnapshot.leads.length+localSnapshot.smm.length+localSnapshot.web.length,serverSharedCount=(state.leads||[]).length+(state.smm||[]).length+(state.web||[]).length,localStamp=localStorage.getItem('d8LocalUpdatedAt')||'',localOnlyRecovery=localSharedCount>serverSharedCount&&(!state.updatedAt||localStamp>state.updatedAt),useLocal=hasUnsyncedLocal||localOnlyRecovery;
      if(useLocal){syncScope='shared';syncPending=true;setSyncState('saving','Възстановяване...');flushSave();}
      else{
        leads=state.leads||[];smm=state.smm||[];web=state.web||[];workTasks=state.workTasks||[];sharedTasks=state.tasks||[];focusTasks=state.focusTasks||[];taskCategories=state.taskCategories||[];userSettings=state.settings||{};
        if(!state.focusInitialized){var migratedFocus=sharedTasks.filter(function(t){return !t.due&&!t.category&&(t.repeat||'none')==='none';});if(migratedFocus.length){syncScope='profile';focusTasks=migratedFocus.map(function(t){return{id:t.id,text:t.text||'',done:!!t.done};});sharedTasks=sharedTasks.filter(function(t){return migratedFocus.indexOf(t)<0;});syncPending=true;}}
        normalizeData();saveLocal(false);lastServerUpdatedAt=state.updatedAt||new Date().toISOString();localStorage.setItem('d8LastServerAt',lastServerUpdatedAt);setSyncState('saved','Всичко е запазено');if(syncPending)flushSave();
      }
      localStorage.setItem('d8ServerInitialized','1');
      finishDataLoad();
    })
    .catch(function(e){if(e.message==='AUTH'){showLogin('Сесията изтече. Влез отново.');return;}setSyncState('error','Офлайн режим');toast('Работиш офлайн — локалните данни са заредени.','var(--yellow)');finishDataLoad();});
}
function refreshServerData(){
  if(!currentUser||!dataLoaded||syncPending||syncInFlight||document.visibilityState==='hidden')return;
  fetch('api.php?action=load',{credentials:'same-origin'}).then(function(r){return r.json().then(function(d){if(r.status===401)throw new Error('AUTH');if(!r.ok)throw new Error('LOAD');return d;});}).then(function(d){var state=d.state||{},stamp=state.updatedAt||'';if(!stamp||stamp===lastServerUpdatedAt)return;leads=state.leads||[];smm=state.smm||[];web=state.web||[];workTasks=state.workTasks||[];sharedTasks=state.tasks||[];focusTasks=state.focusTasks||[];taskCategories=state.taskCategories||[];userSettings=state.settings||{};lastServerUpdatedAt=stamp;normalizeData();saveLocal(false,'');finishDataLoad();setSyncState('saved','Синхронизирано');}).catch(function(e){if(e.message==='AUTH')showLogin('Сесията изтече. Влез отново.');});
}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&syncPending)flushSave();else if(document.visibilityState==='visible')refreshServerData();});
setInterval(refreshServerData,15000);
// ── NAVIGATION ─────────────────────────────────────────
var PTITLES = {dash: 'Dashboard', tasks: 'Календар', work: 'Task Manager', smm: 'SMM Клиенти', web: 'Уеб Дизайн', leads: 'Leads', settings: 'Настройки'};

function goPage(id, el) {
  curpg = id;
  closeMobileSheets();
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.sbi').forEach(function(x) { x.classList.remove('active'); });
  syncMobileNavActive('');
  var pg = document.getElementById('pg' + id);
  if (pg) pg.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('pgtitle').textContent = PTITLES[id] || id;
  var hasSrch = (id === 'leads' || id === 'smm' || id === 'web');
  document.getElementById('tbsr').style.display = hasSrch ? '' : 'none';
  document.getElementById('pgbdg').style.display = 'none';
  if (id === 'dash') renderDash();
  if (id === 'smm') renderSmm();
  if (id === 'web') renderWeb();
  if (id === 'leads') renderLeads();
  if (id === 'tasks') renderTaskManager();
  if (id === 'work') renderWorkTaskManager();
  if (id === 'settings' && window.D8OneSignal) window.D8OneSignal.refresh();
  updateBadges();
  closeSb();
}
function goPageFromMobile(id,el){goPage(id,el);}
function syncMobileNavActive(sheetType){
  var nav=document.getElementById('mobileNav');if(!nav)return;
  Array.prototype.forEach.call(nav.children,function(button){button.classList.remove('active');});
  var target=null;
  if(sheetType==='clients')target=document.getElementById('mobileClientsButton');
  else if(sheetType==='tasks')target=document.getElementById('mobileTasksButton');
  else if(sheetType==='more')target=document.getElementById('mobileMoreButton');
  else if(['smm','web'].indexOf(curpg)>=0)target=document.getElementById('mobileClientsButton');
  else if(['tasks','work'].indexOf(curpg)>=0)target=document.getElementById('mobileTasksButton');
  else if(curpg==='settings')target=document.getElementById('mobileMoreButton');
  else target=nav.querySelector('button[data-page="'+curpg+'"]');
  if(target)target.classList.add('active');
}
function setMobileSheet(type){
  var more=document.getElementById('mobileMore'),clients=document.getElementById('mobileClients'),tasks=document.getElementById('mobileTasks'),backdrop=document.getElementById('mobileMoreBackdrop');
  if(more)more.classList.toggle('open',type==='more');if(clients)clients.classList.toggle('open',type==='clients');if(tasks)tasks.classList.toggle('open',type==='tasks');if(backdrop)backdrop.classList.toggle('open',!!type);
  syncMobileNavActive(type);
}
function toggleMobileMore(){setMobileSheet(document.getElementById('mobileMore').classList.contains('open')?'':'more');}
function toggleMobileClients(){setMobileSheet(document.getElementById('mobileClients').classList.contains('open')?'':'clients');}
function toggleMobileTasks(){setMobileSheet(document.getElementById('mobileTasks').classList.contains('open')?'':'tasks');}
function closeMobileSheets(){setMobileSheet('');}
function closeMobileMore(){closeMobileSheets();}
function goPageFromMore(id){closeMobileSheets();jumpPage(id);}
function goPageFromClients(id){closeMobileSheets();jumpPage(id);}
function goPageFromTasks(id){closeMobileSheets();jumpPage(id);}
function openMobileLeads(){closeMobileSheets();jumpPage('leads');}
function openMobileQuickAdd(){openMobileLeads();}
function openSb() { document.getElementById('sidebar').classList.add('open'); document.getElementById('sbbd').classList.add('open'); }
function closeSb() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sbbd').classList.remove('open'); }
function onSearch() {
  if (curpg === 'leads') renderLeads();
  if (curpg === 'smm') renderSmm();
  if (curpg === 'web') renderWeb();
}
function updateBadges() {
  var mon = smm.filter(function(c) { return c.status === 'active'; }).reduce(function(s, c) { return s + (parseFloat(c.monthly) || 0); }, 0);
  document.getElementById('bdg-dash').textContent = fmt(mon) + ' €/м';
  document.getElementById('bdg-smm').textContent = smm.length;
  document.getElementById('bdg-web').textContent = web.length;
  document.getElementById('bdg-leads').textContent = leads.length; var taskBadge=document.getElementById('bdg-tasks'),workBadge=document.getElementById('bdg-work');if(taskBadge)taskBadge.textContent=getTasks().filter(function(t){return !t.done;}).length;if(workBadge)workBadge.textContent=workTasks.filter(function(t){return t.status!=='done';}).length;
  var mobileLeads=document.getElementById('mbdg-leads'),mobileTasks=document.getElementById('mbdg-tasks'),mobileWork=document.getElementById('mbdg-work');
  if(mobileLeads)mobileLeads.textContent=leads.length>99?'99+':leads.length;
  if(mobileTasks)mobileTasks.textContent=getTasks().filter(function(t){return !t.done;}).length;if(mobileWork)mobileWork.textContent=workTasks.filter(function(t){return t.status!=='done';}).length;
}

// ── DASHBOARD ──────────────────────────────────────────
function billingCycles(start,duration,until){if(!start)return 0;var d=new Date(start),today=until?new Date(until):new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);if(isNaN(d)||isNaN(today)||d>today)return 0;var n=(today.getFullYear()-d.getFullYear())*12+(today.getMonth()-d.getMonth())+(today.getDate()>=d.getDate()?1:0);n=Math.max(0,n);if(parseInt(duration)>0)n=Math.min(n,parseInt(duration));return n;}
function smmEarned(c){var until=c.status==='active'?'':(c.statusChangedAt||'');return billingCycles(c.start,c.duration,until)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));}
function webEarned(c){var monthly=(c.paymentType||'monthly')==='monthly',initial=parseFloat(c.initial)||0;if(!monthly)return c.status==='completed'?((parseFloat(c.oneTime)||0)-(parseFloat(c.cost)||0)):0;if(c.status==='active')return initial+billingCycles(c.start,c.duration)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));if(c.status==='completed')return initial+billingCycles(c.start,c.duration,c.statusChangedAt||c.deadline)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));return initial;}
function dashboardIcon(type){var paths={earned:'<path d="M5 16l4-4 3 3 7-8"/><path d="M14 7h5v5"/>',payments:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',monthly:'<path d="M4 7h16M7 3v4m10-4v4"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 12h3v3H8z"/>',leads:'<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 5 5M8 10h4M10 8v4"/>'};return '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[type]+'</svg>';}
function renderDash(){
 var activeSmm=smm.filter(function(c){return c.status==='active';}),activeWeb=web.filter(function(c){return c.status==='active';}),monthlyWeb=activeWeb.filter(function(c){return(c.paymentType||'monthly')==='monthly';}),oneWeb=activeWeb.filter(function(c){return c.paymentType==='one_time';});
 var smmMrr=activeSmm.reduce(function(x,c){return x+(parseFloat(c.monthly)||0);},0),webMrr=monthlyWeb.reduce(function(x,c){return x+(parseFloat(c.monthly)||0);},0),webInitial=monthlyWeb.reduce(function(x,c){return x+(parseFloat(c.initial)||0);},0),webOne=oneWeb.reduce(function(x,c){return x+(parseFloat(c.oneTime)||0);},0),netToDate=smm.reduce(function(x,c){return x+smmEarned(c);},0)+web.reduce(function(x,c){return x+webEarned(c);},0),ready=leads.filter(function(l){return l.phone||l.email;}).length,today=new Date();today.setHours(0,0,0,0);
 document.getElementById('dashDate').textContent=new Date().toLocaleDateString('bg-BG',{weekday:'long',day:'numeric',month:'long'});document.getElementById('dashName').textContent=document.getElementById('sbname').textContent||'Admin';
 document.getElementById('dashCards').innerHTML='<div class="dc acc"><div class="dcico">'+dashboardIcon('earned')+'</div><div class="dclbl">Нетно изкарано до днес</div><div class="dcval">'+fmt(netToDate)+' €</div><div class="dcdelta">Според реалните платежни дати</div></div><div class="dc"><div class="dcico">'+dashboardIcon('payments')+'</div><div class="dclbl">Първоначални + еднократни</div><div class="dcval">'+fmt(webInitial+webOne)+' €</div><div class="dcsub">'+activeWeb.length+' незавършени web клиента</div></div><div class="dc"><div class="dcico">'+dashboardIcon('monthly')+'</div><div class="dclbl">Общ месечен приход</div><div class="dcval">'+fmt(smmMrr+webMrr)+' €</div><div class="dcdelta warn">SMM '+fmt(smmMrr)+' € · Web '+fmt(webMrr)+' €</div></div><div class="dc"><div class="dcico">'+dashboardIcon('leads')+'</div><div class="dclbl">Leads с директен контакт</div><div class="dcval">'+ready+'</div><div class="dcsub">'+(leads.length?Math.round(ready/leads.length*100):0)+'% от '+leads.length+' бизнеса</div></div>';
 var soonSmm=activeSmm.filter(function(c){if(!c.start||!c.duration)return false;var end=addMonths(new Date(c.start),parseInt(c.duration)),days=Math.ceil((end-today)/86400000);return days>=0&&days<=30;}),lateWeb=activeWeb.filter(function(c){return c.deadline&&new Date(c.deadline)<today;}),html='';if(!soonSmm.length&&!lateWeb.length)html='<div class="emptymini">Всичко е наред — няма просрочени проекти или изтичащи договори.</div>';soonSmm.forEach(function(c){var end=addMonths(new Date(c.start),parseInt(c.duration)),days=Math.ceil((end-today)/86400000);html+='<div class="alertitem"><span class="alertdot"></span><div><div class="alerttitle">'+esc(c.name)+'</div><div class="alertmeta">SMM договорът изтича след '+days+' дни · '+fmtD(end.toISOString().slice(0,10))+'</div></div></div>';});lateWeb.forEach(function(c){html+='<div class="alertitem"><span class="alertdot red"></span><div><div class="alerttitle">'+esc(c.name)+'</div><div class="alertmeta" style="color:var(--red)">Просрочен дедлайн · '+fmtD(c.deadline)+'</div></div></div>';});document.getElementById('dashAlerts').innerHTML=html;var alertTotal=soonSmm.length+lateWeb.length;document.getElementById('alertCount').textContent=alertTotal+(alertTotal===1?' известие':' известия');
 var max=Math.max(smmMrr,webMrr,netToDate,1);document.getElementById('dashPipeline').innerHTML=pipeRow('SMM приход / месец',smmMrr,max)+pipeRow('Web приход / месец',webMrr,max)+pipeRow('Нетно изкарано до днес',netToDate,max);
 var recurring=smmMrr+webMrr,monthlyCosts=activeSmm.reduce(function(x,c){return x+(parseFloat(c.cost)||0);},0)+monthlyWeb.reduce(function(x,c){return x+(parseFloat(c.cost)||0);},0),margin=recurring?Math.round((recurring-monthlyCosts)/recurring*100):0;document.getElementById('dashAnalysis').innerHTML='<div class="insight"><strong class="'+(margin>=0?'profitpos':'profitneg')+'">'+margin+'% текущ месечен марж</strong><span>На база активните месечни клиенти.</span></div><div class="insight"><strong>'+fmt(netToDate)+' € реално нетно</strong><span>Добавя нов месец на съответния ден за всеки клиент.</span></div><div class="insight"><strong>'+activeWeb.length+' активни web клиента</strong><span>'+monthlyWeb.length+' месечни · '+oneWeb.length+' еднократни.</span></div><div class="insight"><strong>'+ready+' достижими leads</strong><span>Имат телефон или имейл за директен контакт.</span></div>';
 var statuses=[{key:'prospect',label:'Потенциални',color:'var(--green)'},{key:'maybe',label:'Може би',color:'var(--yellow)'},{key:'not',label:'Отказани',color:'var(--red)'}],counts=statuses.map(function(x){return leads.filter(function(l){return l.status===x.key;}).length;}),maxLeads=Math.max.apply(null,counts.concat([1]));document.getElementById('dashFunnel').innerHTML=statuses.map(function(x,i){return'<div class="funnelcol"><div class="funnelbar" style="height:'+Math.max(8,Math.round(counts[i]/maxLeads*74))+'px;background:'+x.color+'"></div><div class="funnelnum">'+counts[i]+'</div><div class="funnellbl">'+x.label+'</div></div>';}).join('');renderTasks();
}

function pipeRow(label,value,max){return '<div class="piperow"><div class="pipelabel">'+label+'</div><div class="pipetrack"><div class="pipefill" style="width:'+Math.round(value/max*100)+'%"></div></div><div class="pipeval">'+fmt(value)+' €</div></div>';}
function jumpPage(id){var btn=Array.prototype.find.call(document.querySelectorAll('.sbi'),function(x){return(x.getAttribute('onclick')||'').indexOf("'"+id+"'")>=0;});goPage(id,btn);}
function getTasks(){return sharedTasks;}
function saveTasks(tasks){sharedTasks=tasks;saveData('profile');}
function addTask(){var input=document.getElementById('taskInp'),value=input.value.trim();if(!value)return;focusTasks.unshift({id:'f'+Date.now().toString(36),text:value,done:false,createdAt:new Date().toISOString()});saveData('profile');input.value='';renderTasks();}
function toggleFocusTask(id){focusTasks.forEach(function(t){if(t.id===id)t.done=!t.done;});saveData('profile');renderTasks();}
function deleteFocusTask(id){if(!confirm('Изтрий тази кратка задача?'))return;focusTasks=focusTasks.filter(function(t){return t.id!==id;});saveData('profile');renderTasks();}
function toggleTask(id,occurrenceIso){var tasks=getTasks(),day=occurrenceIso||taskSelectedDate||taskIso(new Date());tasks.forEach(function(t){if(t.id!==id)return;if((t.repeat||'none')!=='none'){t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];var i=t.completedDates.indexOf(day);if(i>=0)t.completedDates.splice(i,1);else t.completedDates.push(day);t.done=false;}else{t.done=!t.done;t.completedAtDate=t.done?day:'';}});saveTasks(tasks);renderTaskManager();}
function deleteTask(id){if(!confirm('Изтрий тази задача от календара?'))return;saveTasks(getTasks().filter(function(t){return t.id!==id;}));renderTaskManager();}
function renderTasks(){var el=document.getElementById('taskList');if(!el)return;el.innerHTML=focusTasks.length?focusTasks.map(function(t){return'<label class="task '+(t.done?'done':'')+'"><input type="checkbox" '+(t.done?'checked':'')+' onchange="toggleFocusTask(\''+t.id+'\')"><span>'+esc(t.text)+'</span><button type="button" aria-label="Изтрий задача" onclick="event.preventDefault();deleteFocusTask(\''+t.id+'\')">×</button></label>';}).join(''):'<div class="emptymini">Добави кратка задача само за твоя профил.</div>';}

