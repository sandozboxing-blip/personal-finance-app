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
  var loader=document.getElementById('appLoader');if(loader)loader.classList.remove('done');
  if(message){var err=document.getElementById('lerr');err.textContent=message;err.classList.add('show');}
}
function doLogin(){
  var u=document.getElementById('lu').value.trim(),p=document.getElementById('lp').value,err=document.getElementById('lerr'),btn=document.getElementById('loginBtn');
  err.classList.remove('show');btn.disabled=true;btn.textContent='Влизане...';
  fetch('api.php?action=login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Грешка при вход');return d;});})
    .then(function(d){if(!d.authToken)throw new Error('Сървърът не върна защитена сесия');sessionStorage.setItem(AUTH_KEY,d.authToken);startApp(d.user||u);})
    .catch(function(e){err.textContent=e.message||'Грешно потребителско име или парола';err.classList.add('show');document.getElementById('lp').value='';document.getElementById('lp').focus();})
    .finally(function(){btn.disabled=false;btn.textContent='Влез в панела →';});
}
document.getElementById('loginBtn').addEventListener('click',doLogin);
document.getElementById('lp').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
document.getElementById('lu').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('lp').focus();});
function startApp(user){
  currentUser=user||'Admin';
  document.getElementById('lw').classList.add('hidden');
  document.getElementById('app').classList.add('on');
  document.getElementById('sbav').textContent=(user||'A')[0].toUpperCase();
  document.getElementById('sbname').textContent=user||'Admin';
  setSyncState('loading','Зареждане');
  goPage('dash',document.querySelector('.sbi.active'));
  loadData();
  setTimeout(hideAppLoader,4000);
}
function logout(){
  fetch('api.php?action=logout',{credentials:'same-origin'}).catch(function(){})
    .finally(function(){sessionStorage.removeItem(AUTH_KEY);showLogin();});
}

// ── STATE + RELIABLE SYNC ────────────────────────────
var leads=[],smm=[],web=[],sharedTasks=[],focusTasks=[],taskCategories=[],userSettings={},currentUser='',syncTimer=null,syncInFlight=false,syncPending=false,dataLoaded=false;
var leadPage=1,leadPageSize=50,leadFilterKey='';var lftab='all',lbid=null,curpg='dash',editid=null,edittype=null;
function localState(){return{leads:leads,smm:smm,web:web,tasks:sharedTasks,focusTasks:focusTasks,taskCategories:taskCategories,settings:userSettings};}
function setSyncState(state,text){
  var el=document.getElementById('syncStatus');if(!el)return;
  el.dataset.state=state;var span=el.querySelector('span');if(span)span.textContent=text;
}
function hideAppLoader(){
  var loader=document.getElementById('appLoader');
  if(loader)loader.classList.add('done');
}
function saveLocal(markDirty){
  try{
    var k=currentUser||'guest';
    localStorage.setItem('d8l',JSON.stringify(leads));localStorage.setItem('d8s2',JSON.stringify(smm));localStorage.setItem('d8w',JSON.stringify(web));
    localStorage.setItem('d8tasks:'+k,JSON.stringify(sharedTasks));localStorage.setItem('d8focus:'+k,JSON.stringify(focusTasks));localStorage.setItem('d8taskcats:'+k,JSON.stringify(taskCategories));localStorage.setItem('d8settings:'+k,JSON.stringify(userSettings));
    if(markDirty!==false){localStorage.setItem('d8LocalUpdatedAt',new Date().toISOString());localStorage.setItem('d8SyncDirty','1');}
  }catch(e){setSyncState('error','Няма място');}
}
function saveData(){
  saveLocal(true);syncPending=true;setSyncState('saving','Записване...');
  clearTimeout(syncTimer);syncTimer=setTimeout(flushSave,120);
}
function flushSave(){
  clearTimeout(syncTimer);
  if(syncInFlight||!syncPending||!currentUser)return;
  syncPending=false;syncInFlight=true;setSyncState('saving','Записване...');
  var payload=JSON.stringify(localState());
  fetch('api.php?action=save',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:payload})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(r.status===401)throw new Error('AUTH');if(!r.ok)throw new Error(d.error||'SAVE');return d;});})
    .then(function(d){localStorage.setItem('d8LastServerAt',d.updatedAt||new Date().toISOString());localStorage.removeItem('d8SyncDirty');setSyncState('saved','Всичко е запазено');})
    .catch(function(e){if(e.message==='AUTH'){showLogin('Сесията изтече. Влез отново.');return;}syncPending=true;setSyncState('error','Не е записано');toast('Промените са запазени на устройството, но сървърът не отговори.','var(--yellow)');})
    .finally(function(){syncInFlight=false;if(syncPending&&document.visibilityState==='visible')syncTimer=setTimeout(flushSave,700);});
}
function normalizeData(){leads.forEach(function(l){l.tags=l.tags||[];l.extra=l.extra||{};l.aiPhone=l.aiPhone||'';l.aiEmail=l.aiEmail||'';});smm.forEach(function(c){c.cost=c.cost||'';});web.forEach(function(c){c.cost=c.cost||'';c.duration=c.duration||c.months||'';c.paymentType=c.paymentType||(c.total?'one_time':'monthly');c.oneTime=c.oneTime||c.total||'';c.initial=c.initial||'';if(!c.monthly){var n=Math.max(1,parseInt(c.months)||1);c.monthly=c.total?String((parseFloat(c.total)||0)/n):'';}});}
function readLocalData(){
  var k=currentUser||'guest';
  try{leads=JSON.parse(localStorage.getItem('d8l')||'[]');smm=JSON.parse(localStorage.getItem('d8s2')||'[]');web=JSON.parse(localStorage.getItem('d8w')||'[]');sharedTasks=JSON.parse(localStorage.getItem('d8tasks:'+k)||'[]');focusTasks=JSON.parse(localStorage.getItem('d8focus:'+k)||'[]');taskCategories=JSON.parse(localStorage.getItem('d8taskcats:'+k)||'[]');userSettings=JSON.parse(localStorage.getItem('d8settings:'+k)||'{}');}
  catch(e){leads=[];smm=[];web=[];sharedTasks=[];focusTasks=[];taskCategories=[];userSettings={};}
  normalizeData();
}
function finishDataLoad(){
  dataLoaded=true;populateCats();renderLeadAddons();renderTaskCategories();applyProfileSettings();updateBadges();
  renderDash();if(curpg==='smm')renderSmm();if(curpg==='web')renderWeb();if(curpg==='leads')renderLeads();if(curpg==='tasks')renderTaskManager();
  setTimeout(hideAppLoader,100);
}
function loadData(){
  readLocalData();var localSnapshot=localState(),hasUnsyncedLocal=localStorage.getItem('d8SyncDirty')==='1';
  fetch('api.php?action=load',{credentials:'same-origin'})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(r.status===401)throw new Error('AUTH');if(!r.ok)throw new Error(d.error||'LOAD');return d;});})
    .then(function(d){
      var state=d.state||{},localOnlyRecovery=localSnapshot.leads.length&&!(state.leads||[]).length&&!localStorage.getItem('d8ServerInitialized'),useLocal=hasUnsyncedLocal||localOnlyRecovery;
      if(useLocal){syncPending=true;setSyncState('saving','Възстановяване...');flushSave();}
      else{
        leads=state.leads||[];smm=state.smm||[];web=state.web||[];sharedTasks=state.tasks||[];focusTasks=state.focusTasks||[];taskCategories=state.taskCategories||[];userSettings=state.settings||{};
        if(!state.focusInitialized){var migratedFocus=sharedTasks.filter(function(t){return !t.due&&!t.category&&(t.repeat||'none')==='none';});if(migratedFocus.length){focusTasks=migratedFocus.map(function(t){return{id:t.id,text:t.text||'',done:!!t.done};});sharedTasks=sharedTasks.filter(function(t){return migratedFocus.indexOf(t)<0;});syncPending=true;}}
        normalizeData();saveLocal(false);localStorage.setItem('d8LastServerAt',state.updatedAt||new Date().toISOString());setSyncState('saved','Всичко е запазено');if(syncPending)flushSave();
      }
      localStorage.setItem('d8ServerInitialized','1');
      finishDataLoad();
    })
    .catch(function(e){if(e.message==='AUTH'){showLogin('Сесията изтече. Влез отново.');return;}setSyncState('error','Офлайн режим');toast('Работиш офлайн — локалните данни са заредени.','var(--yellow)');finishDataLoad();});
}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&syncPending)flushSave();});
// ── NAVIGATION ─────────────────────────────────────────
var PTITLES = {dash: 'Dashboard', tasks: 'Task Manager', smm: 'SMM Клиенти', web: 'Уеб Дизайн', leads: 'Leads', settings: 'Настройки'};

function goPage(id, el) {
  curpg = id;
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.sbi').forEach(function(x) { x.classList.remove('active'); });
  document.querySelectorAll('.mobile-nav button[data-page]').forEach(function(x) { x.classList.toggle('active',x.dataset.page===id); });
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
  updateBadges();
  closeSb();
}
function goPageFromMobile(id,el){goPage(id,el);}
function openMobileQuickAdd(){
  if(curpg==='leads'){document.getElementById('fi').click();return;}
  if(curpg==='tasks'){focusTaskComposer();return;}
  openAdd('smm');
}
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
  document.getElementById('bdg-leads').textContent = leads.length; var taskBadge=document.getElementById('bdg-tasks');if(taskBadge)taskBadge.textContent=getTasks().filter(function(t){return !t.done;}).length;
  var mobileLeads=document.getElementById('mbdg-leads'),mobileTasks=document.getElementById('mbdg-tasks');
  if(mobileLeads)mobileLeads.textContent=leads.length>99?'99+':leads.length;
  if(mobileTasks)mobileTasks.textContent=getTasks().filter(function(t){return !t.done;}).length;
}

// ── DASHBOARD ──────────────────────────────────────────
function billingCycles(start,duration,until){if(!start)return 0;var d=new Date(start),today=until?new Date(until):new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);if(isNaN(d)||isNaN(today)||d>today)return 0;var n=(today.getFullYear()-d.getFullYear())*12+(today.getMonth()-d.getMonth())+(today.getDate()>=d.getDate()?1:0);n=Math.max(0,n);if(parseInt(duration)>0)n=Math.min(n,parseInt(duration));return n;}
function smmEarned(c){var until=c.status==='active'?'':(c.statusChangedAt||'');return billingCycles(c.start,c.duration,until)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));}
function webEarned(c){var monthly=(c.paymentType||'monthly')==='monthly',initial=parseFloat(c.initial)||0;if(!monthly)return c.status==='completed'?((parseFloat(c.oneTime)||0)-(parseFloat(c.cost)||0)):0;if(c.status==='active')return initial+billingCycles(c.start,c.duration)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));if(c.status==='completed')return initial+billingCycles(c.start,c.duration,c.statusChangedAt||c.deadline)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));return initial;}
function renderDash(){
 var activeSmm=smm.filter(function(c){return c.status==='active';}),activeWeb=web.filter(function(c){return c.status==='active';}),monthlyWeb=activeWeb.filter(function(c){return(c.paymentType||'monthly')==='monthly';}),oneWeb=activeWeb.filter(function(c){return c.paymentType==='one_time';});
 var smmMrr=activeSmm.reduce(function(x,c){return x+(parseFloat(c.monthly)||0);},0),webMrr=monthlyWeb.reduce(function(x,c){return x+(parseFloat(c.monthly)||0);},0),webInitial=monthlyWeb.reduce(function(x,c){return x+(parseFloat(c.initial)||0);},0),webOne=oneWeb.reduce(function(x,c){return x+(parseFloat(c.oneTime)||0);},0),netToDate=smm.reduce(function(x,c){return x+smmEarned(c);},0)+web.reduce(function(x,c){return x+webEarned(c);},0),ready=leads.filter(function(l){return l.phone||l.email;}).length,today=new Date();today.setHours(0,0,0,0);
 document.getElementById('dashDate').textContent=new Date().toLocaleDateString('bg-BG',{weekday:'long',day:'numeric',month:'long'});document.getElementById('dashName').textContent=document.getElementById('sbname').textContent||'Admin';
 document.getElementById('dashCards').innerHTML='<div class="dc acc"><div class="dcico">↗</div><div class="dclbl">Нетно изкарано до днес</div><div class="dcval">'+fmt(netToDate)+' €</div><div class="dcdelta">Според реалните платежни дати</div></div><div class="dc"><div class="dcico">◫</div><div class="dclbl">Първоначални + еднократни</div><div class="dcval">'+fmt(webInitial+webOne)+' €</div><div class="dcsub">'+activeWeb.length+' незавършени web клиента</div></div><div class="dc"><div class="dcico">◎</div><div class="dclbl">Общ месечен приход</div><div class="dcval">'+fmt(smmMrr+webMrr)+' €</div><div class="dcdelta warn">SMM '+fmt(smmMrr)+' € · Web '+fmt(webMrr)+' €</div></div><div class="dc"><div class="dcico">◇</div><div class="dclbl">Leads с директен контакт</div><div class="dcval">'+ready+'</div><div class="dcsub">'+(leads.length?Math.round(ready/leads.length*100):0)+'% от '+leads.length+' бизнеса</div></div>';
 var soonSmm=activeSmm.filter(function(c){if(!c.start||!c.duration)return false;var end=addMonths(new Date(c.start),parseInt(c.duration)),days=Math.ceil((end-today)/86400000);return days>=0&&days<=30;}),lateWeb=activeWeb.filter(function(c){return c.deadline&&new Date(c.deadline)<today;}),html='';if(!soonSmm.length&&!lateWeb.length)html='<div class="emptymini">Всичко е наред — няма просрочени проекти или изтичащи договори.</div>';soonSmm.forEach(function(c){var end=addMonths(new Date(c.start),parseInt(c.duration)),days=Math.ceil((end-today)/86400000);html+='<div class="alertitem"><span class="alertdot"></span><div><div class="alerttitle">'+esc(c.name)+'</div><div class="alertmeta">SMM договорът изтича след '+days+' дни · '+fmtD(end.toISOString().slice(0,10))+'</div></div></div>';});lateWeb.forEach(function(c){html+='<div class="alertitem"><span class="alertdot red"></span><div><div class="alerttitle">'+esc(c.name)+'</div><div class="alertmeta" style="color:var(--red)">Просрочен дедлайн · '+fmtD(c.deadline)+'</div></div></div>';});document.getElementById('dashAlerts').innerHTML=html;var alertTotal=soonSmm.length+lateWeb.length;document.getElementById('alertCount').textContent=alertTotal+(alertTotal===1?' известие':' известия');
 var max=Math.max(smmMrr,webMrr,netToDate,1);document.getElementById('dashPipeline').innerHTML=pipeRow('SMM приход / месец',smmMrr,max)+pipeRow('Web приход / месец',webMrr,max)+pipeRow('Нетно изкарано до днес',netToDate,max);
 var recurring=smmMrr+webMrr,monthlyCosts=activeSmm.reduce(function(x,c){return x+(parseFloat(c.cost)||0);},0)+monthlyWeb.reduce(function(x,c){return x+(parseFloat(c.cost)||0);},0),margin=recurring?Math.round((recurring-monthlyCosts)/recurring*100):0;document.getElementById('dashAnalysis').innerHTML='<div class="insight"><strong class="'+(margin>=0?'profitpos':'profitneg')+'">'+margin+'% текущ месечен марж</strong><span>На база активните месечни клиенти.</span></div><div class="insight"><strong>'+fmt(netToDate)+' € реално нетно</strong><span>Добавя нов месец на съответния ден за всеки клиент.</span></div><div class="insight"><strong>'+activeWeb.length+' активни web клиента</strong><span>'+monthlyWeb.length+' месечни · '+oneWeb.length+' еднократни.</span></div><div class="insight"><strong>'+ready+' достижими leads</strong><span>Имат телефон или имейл за директен контакт.</span></div>';
 var statuses=[{key:'prospect',label:'Потенциални',color:'var(--green)'},{key:'maybe',label:'Може би',color:'var(--yellow)'},{key:'not',label:'Отказани',color:'var(--red)'}],counts=statuses.map(function(x){return leads.filter(function(l){return l.status===x.key;}).length;}),maxLeads=Math.max.apply(null,counts.concat([1]));document.getElementById('dashFunnel').innerHTML=statuses.map(function(x,i){return'<div class="funnelcol"><div class="funnelbar" style="height:'+Math.max(8,Math.round(counts[i]/maxLeads*74))+'px;background:'+x.color+'"></div><div class="funnelnum">'+counts[i]+'</div><div class="funnellbl">'+x.label+'</div></div>';}).join('');renderTasks();
}

function pipeRow(label,value,max){return '<div class="piperow"><div class="pipelabel">'+label+'</div><div class="pipetrack"><div class="pipefill" style="width:'+Math.round(value/max*100)+'%"></div></div><div class="pipeval">'+fmt(value)+' €</div></div>';}
function jumpPage(id){var btn=Array.prototype.find.call(document.querySelectorAll('.sbi'),function(x){return(x.getAttribute('onclick')||'').indexOf("'"+id+"'")>=0;});goPage(id,btn);}
function getTasks(){return sharedTasks;}
function saveTasks(tasks){sharedTasks=tasks;saveData();}
function addTask(){var input=document.getElementById('taskInp'),value=input.value.trim();if(!value)return;focusTasks.unshift({id:'f'+Date.now().toString(36),text:value,done:false,createdAt:new Date().toISOString()});saveData();input.value='';renderTasks();}
function toggleFocusTask(id){focusTasks.forEach(function(t){if(t.id===id)t.done=!t.done;});saveData();renderTasks();}
function deleteFocusTask(id){focusTasks=focusTasks.filter(function(t){return t.id!==id;});saveData();renderTasks();}
function toggleTask(id,occurrenceIso){var tasks=getTasks(),day=occurrenceIso||taskSelectedDate||taskIso(new Date());tasks.forEach(function(t){if(t.id!==id)return;if((t.repeat||'none')!=='none'){t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];var i=t.completedDates.indexOf(day);if(i>=0)t.completedDates.splice(i,1);else t.completedDates.push(day);t.done=false;}else{t.done=!t.done;t.completedAtDate=t.done?day:'';}});saveTasks(tasks);renderTaskManager();}
function deleteTask(id){saveTasks(getTasks().filter(function(t){return t.id!==id;}));renderTaskManager();}
function renderTasks(){var el=document.getElementById('taskList');if(!el)return;el.innerHTML=focusTasks.length?focusTasks.map(function(t){return'<label class="task '+(t.done?'done':'')+'"><input type="checkbox" '+(t.done?'checked':'')+' onchange="toggleFocusTask(\''+t.id+'\')"><span>'+esc(t.text)+'</span><button type="button" aria-label="Изтрий задача" onclick="event.preventDefault();deleteFocusTask(\''+t.id+'\')">×</button></label>';}).join(''):'<div class="emptymini">Добави кратка задача само за твоя профил.</div>';}

