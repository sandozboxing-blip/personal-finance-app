// ── AUTH (SERVER SESSION) ──────────────────────────────
function doLogin(){var u=document.getElementById('lu').value.trim(),p=document.getElementById('lp').value,err=document.getElementById('lerr'),btn=document.getElementById('loginBtn');err.classList.remove('show');btn.disabled=true;btn.textContent='Влизане...';fetch('api.php?action=login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Грешка');return d;});}).then(function(d){startApp(d.user||u);}).catch(function(){err.classList.add('show');document.getElementById('lp').value='';document.getElementById('lp').focus();}).finally(function(){btn.disabled=false;btn.textContent='Вход в панела';});}
document.getElementById('loginBtn').addEventListener('click',doLogin);document.getElementById('lp').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});document.getElementById('lu').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('lp').focus();});
function startApp(user){document.getElementById('lw').classList.add('hidden');document.getElementById('app').classList.add('on');document.getElementById('sbav').textContent=(user||'A')[0].toUpperCase();document.getElementById('sbname').textContent=user||'Admin';loadData();goPage('dash',document.querySelector('.sbi.active'));}
function logout(){fetch('api.php?action=logout',{credentials:'same-origin'}).finally(function(){location.reload();});}

// ── STATE (SHARED SERVER DATA) ───────────────────────
var leads=[],smm=[],web=[],sharedTasks=[],syncTimer=null;
var leadPage=1,leadPageSize=50,leadFilterKey='';var lftab='all',lbid=null,curpg='dash',editid=null,edittype=null;
function localState(){return{leads:leads,smm:smm,web:web,tasks:sharedTasks};}
function saveLocal(){try{localStorage.setItem('d8l',JSON.stringify(leads));localStorage.setItem('d8s2',JSON.stringify(smm));localStorage.setItem('d8w',JSON.stringify(web));localStorage.setItem('d8tasks',JSON.stringify(sharedTasks));}catch(e){}}
function saveData(){saveLocal();clearTimeout(syncTimer);syncTimer=setTimeout(function(){fetch('api.php?action=save',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(localState())}).then(function(r){if(r.status===401)location.reload();if(!r.ok)throw new Error();}).catch(function(){toast('⚠ Данните са локални — няма връзка със сървъра','var(--yellow)');});},180);}
function normalizeData(){leads.forEach(function(l){l.tags=l.tags||[];l.extra=l.extra||{};l.aiPhone=l.aiPhone||'';l.aiEmail=l.aiEmail||'';});smm.forEach(function(c){c.cost=c.cost||'';});web.forEach(function(c){c.cost=c.cost||'';c.duration=c.duration||c.months||'';c.paymentType=c.paymentType||(c.total?'one_time':'monthly');c.oneTime=c.oneTime||c.total||'';c.initial=c.initial||'';if(!c.monthly){var n=Math.max(1,parseInt(c.months)||1);c.monthly=c.total?String((parseFloat(c.total)||0)/n):'';}});}
function loadData(){try{leads=JSON.parse(localStorage.getItem('d8l')||'[]');smm=JSON.parse(localStorage.getItem('d8s2')||'[]');web=JSON.parse(localStorage.getItem('d8w')||'[]');sharedTasks=JSON.parse(localStorage.getItem('d8tasks')||'[]');}catch(e){leads=[];smm=[];web=[];sharedTasks=[];}normalizeData();fetch('api.php?action=load',{credentials:'same-origin'}).then(function(r){if(r.status===401){location.reload();throw new Error('auth');}return r.json();}).then(function(d){var state=d.state||{},serverHasData=!!state.updatedAt||(state.leads||[]).length||(state.smm||[]).length||(state.web||[]).length||(state.tasks||[]).length;if(serverHasData){leads=state.leads||[];smm=state.smm||[];web=state.web||[];sharedTasks=state.tasks||[];normalizeData();saveLocal();}else if(leads.length||smm.length||web.length||sharedTasks.length){saveData();}populateCats();updateBadges();if(curpg==='dash')renderDash();if(curpg==='smm')renderSmm();if(curpg==='web')renderWeb();if(curpg==='leads')renderLeads();}).catch(function(e){if(e.message!=='auth')toast('⚠ Работа офлайн — промените се пазят на това устройство','var(--yellow)');});}

// ── NAVIGATION ─────────────────────────────────────────
var PTITLES = {dash: 'Dashboard', smm: 'SMM Клиенти', web: 'Уеб Дизайн', leads: 'Leads', settings: 'Настройки'};

function goPage(id, el) {
  curpg = id;
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.sbi').forEach(function(x) { x.classList.remove('active'); });
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
  updateBadges();
  closeSb();
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
  document.getElementById('bdg-leads').textContent = leads.length;
}

// ── DASHBOARD ──────────────────────────────────────────
function billingCycles(start,duration,until){if(!start)return 0;var d=new Date(start),today=until?new Date(until):new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);if(isNaN(d)||isNaN(today)||d>today)return 0;var n=(today.getFullYear()-d.getFullYear())*12+(today.getMonth()-d.getMonth())+(today.getDate()>=d.getDate()?1:0);n=Math.max(0,n);if(parseInt(duration)>0)n=Math.min(n,parseInt(duration));return n;}
function smmEarned(c){return billingCycles(c.start,c.duration)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));}
function webEarned(c){var monthly=(c.paymentType||'monthly')==='monthly',initial=parseFloat(c.initial)||0;if(!monthly)return c.status==='completed'?((parseFloat(c.oneTime)||0)-(parseFloat(c.cost)||0)):0;if(c.status==='active')return initial+billingCycles(c.start,c.duration)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));if(c.status==='completed')return initial+billingCycles(c.start,c.duration,c.statusChangedAt||c.deadline)*((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0));return initial;}
function renderDash(){
 var activeSmm=smm.filter(function(c){return c.status!=='ended';}),activeWeb=web.filter(function(c){return c.status==='active';}),monthlyWeb=activeWeb.filter(function(c){return(c.paymentType||'monthly')==='monthly';}),oneWeb=activeWeb.filter(function(c){return c.paymentType==='one_time';});
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
function addTask(){var input=document.getElementById('taskInp'),value=input.value.trim();if(!value)return;var tasks=getTasks();tasks.unshift({id:Date.now().toString(36),text:value,done:false});saveTasks(tasks);input.value='';renderTasks();}
function toggleTask(id){var tasks=getTasks();tasks.forEach(function(t){if(t.id===id)t.done=!t.done;});saveTasks(tasks);renderTasks();}
function deleteTask(id){saveTasks(getTasks().filter(function(t){return t.id!==id;}));renderTasks();}
function renderTasks(){var el=document.getElementById('taskList');if(!el)return;var tasks=getTasks();el.innerHTML=tasks.length?tasks.map(function(t){return '<label class="task '+(t.done?'done':'')+'"><input type="checkbox" '+(t.done?'checked':'')+' onchange="toggleTask(\''+t.id+'\')"><span>'+esc(t.text)+'</span><button type="button" aria-label="Изтрий задача" onclick="event.preventDefault();deleteTask(\''+t.id+'\')">×</button></label>';}).join(''):'<div class="emptymini">Добави до 3 важни задачи за деня.</div>';}


// ── SMM ────────────────────────────────────────────────
var SMM_ST = {active: 'Активен', paused: 'Пауза', ended: 'Приключен'};
var SMM_PLAT = ['Facebook','Instagram','TikTok','LinkedIn','YouTube','Twitter/X','Pinterest','Google Ads'];
var SMM_ST_CLS = {active: 'cg', paused: 'cy', ended: 'cgr'};

function renderSmm(){var f=document.getElementById('smmF').value,q=(document.getElementById('srchQ').value||'').toLowerCase(),active=smm.filter(function(c){return c.status!=='ended';}),revenue=active.reduce(function(x,c){return x+(parseFloat(c.monthly)||0);},0),costs=active.reduce(function(x,c){return x+(parseFloat(c.cost)||0);},0),profit=revenue-costs,earned=smm.reduce(function(x,c){return x+smmEarned(c);},0),today=new Date();today.setHours(0,0,0,0);var exp=active.filter(function(c){if(!c.start||!c.duration)return false;var end=addMonths(new Date(c.start),parseInt(c.duration)),days=Math.ceil((end-today)/86400000);return days>=0&&days<=30;}).length;document.getElementById('smmStats').innerHTML='<div class="sc acc"><div class="sclbl">Месечен приход</div><div class="scval purple">'+fmt(revenue)+' €</div><div class="scsub">'+active.length+' текущи клиента</div></div><div class="sc"><div class="sclbl">Нетно / месец</div><div class="scval green">'+fmt(profit)+' €</div><div class="scsub">Разходи '+fmt(costs)+' €</div></div><div class="sc"><div class="sclbl">Нетно изкарано до днес</div><div class="scval">'+fmt(earned)+' €</div><div class="scsub">По изминалите платежни дати</div></div><div class="sc"><div class="sclbl">За подновяване</div><div class="scval">'+exp+'</div><div class="scsub">Изтичат до 30 дни</div></div>';var data=smm.filter(function(c){return(!f||c.status===f)&&(!q||c.name.toLowerCase().includes(q));}),el=document.getElementById('smmCards');if(!data.length){el.innerHTML='<div class="empty"><h3>Няма SMM клиенти</h3></div>';return;}el.innerHTML='<div class="cgrid">'+data.map(smmCard).join('')+'</div>';}

function smmCard(c) {
  var today = new Date(); today.setHours(0,0,0,0);
  var end = null, ml = null, md = null, tot = null, pct = 0;
  if (c.start && c.duration) {
    end = addMonths(new Date(c.start), parseInt(c.duration));
    ml = Math.max(0, Math.ceil((end - today) / 2629800000));
    md = Math.max(0, parseInt(c.duration) - ml);
    tot = (parseFloat(c.monthly) || 0) * parseInt(c.duration);
    pct = Math.min(100, Math.round(md / parseInt(c.duration) * 100));
  }
  var stc = SMM_ST_CLS[c.status] || 'cgr';
  var plts = (c.platforms || []).slice(0,3).map(function(p) { return '<span class="chip cgr" style="font-size:11px;padding:3px 8px">' + esc(p) + '</span>'; }).join(' ');
  return '<div class="ccard ' + (c.status === 'active' ? 'act' : '') + '" onclick="openAdd(\'smm\',\'' + c.id + '\')">' +
    '<div class="cctop"><div><div class="ccname">' + esc(c.name) + '</div><div class="cccat" style="margin-top:6px">' + plts + '</div></div><span class="chip ' + stc + '">' + (SMM_ST[c.status] || c.status) + '</span></div>' +
    '<div class="ccstats">' +
    '<div class="ccs"><div class="cl">Месечно</div><div class="cv green">' + fmt(parseFloat(c.monthly) || 0) + ' €</div></div>' +
    '<div class="ccs"><div class="cl">Нетно / месец</div><div class="cv">' + fmt((parseFloat(c.monthly)||0)-(parseFloat(c.cost)||0)) + ' €</div></div>' +
    '<div class="ccs"><div class="cl">Договор</div><div class="cv">' + (c.duration || '—') + ' мес.</div></div>' +
    (tot !== null ? '<div class="ccs"><div class="cl">Обща стойност</div><div class="cv">' + fmt(tot) + ' €</div></div>' : '') +
    (ml !== null ? '<div class="ccs"><div class="cl">Оставащи</div><div class="cv ' + (ml <= 2 ? 'red' : '') + '">' + ml + ' мес.</div></div>' : '') +
    '</div>' +
    (end ? '<div class="progwrap"><div class="proglbls"><span>Прогрес</span><span>' + fmtD(end.toISOString().slice(0,10)) + '</span></div><div class="progbar"><div class="progfill ' + (pct > 80 ? 'red' : '') + '" style="width:' + pct + '%"></div></div></div>' : '') +
    (c.note ? '<div class="ccnote">' + esc(c.note.slice(0, 90)) + (c.note.length > 90 ? '...' : '') + '</div>' : '') +
    '</div>';
}

// ── WEB ────────────────────────────────────────────────
var WEB_ST = {in_progress:'В процес · подготвяме', active:'Активен · плаща месечно', waiting:'Чакащ', paused:'Пауза', completed:'Завършен · платен'};
var WEB_TYPES = ['Уебсайт','Онлайн магазин','Лендинг','Редизайн','Уеб приложение','Друго'];
var WEB_ST_CLS = {in_progress:'cb',active:'cg',waiting:'cy',paused:'cy',completed:'cgr'};

function renderWeb(){var f=document.getElementById('webF').value,q=(document.getElementById('srchQ').value||'').toLowerCase(),active=web.filter(function(c){return c.status==='active';}),monthly=active.filter(function(c){return(c.paymentType||'monthly')==='monthly';}),one=web.filter(function(c){return c.status==='completed'&&c.paymentType==='one_time';}),mrr=monthly.reduce(function(x,c){return x+(parseFloat(c.monthly)||0);},0),mCosts=monthly.reduce(function(x,c){return x+(parseFloat(c.cost)||0);},0),initial=web.reduce(function(x,c){return x+(parseFloat(c.initial)||0);},0),oneRev=one.reduce(function(x,c){return x+(parseFloat(c.oneTime)||0);},0),earned=web.reduce(function(x,c){return x+webEarned(c);},0),today=new Date();today.setHours(0,0,0,0),late=web.filter(function(c){return c.status==='in_progress'&&c.deadline&&new Date(c.deadline)<today;}).length;document.getElementById('webStats').innerHTML='<div class="sc acc"><div class="sclbl">Месечен приход (MRR)</div><div class="scval purple">'+fmt(mrr)+' €</div><div class="scsub">Нетно '+fmt(mrr-mCosts)+' € · '+monthly.length+' клиента</div></div><div class="sc"><div class="sclbl">Първоначални плащания</div><div class="scval green">'+fmt(initial)+' €</div><div class="scsub">От месечните клиенти</div></div><div class="sc"><div class="sclbl">Еднократни проекти</div><div class="scval">'+fmt(oneRev)+' €</div><div class="scsub">'+one.length+' проекта</div></div><div class="sc"><div class="sclbl">Нетно изкарано до днес</div><div class="scval">'+fmt(earned)+' €</div><div class="scsub">'+active.length+' активни · '+late+' просрочени в процес</div></div>';var data=web.filter(function(c){return(!f||c.status===f)&&(!q||[c.name,c.type,c.contact,c.note].join(' ').toLowerCase().includes(q));}),el=document.getElementById('webCards');if(!data.length){el.innerHTML='<div class="empty"><h3>Няма Web Design проекти</h3></div>';return;}el.innerHTML='<div class="cgrid">'+data.map(webCard).join('')+'</div>';}
function webCard(c){var monthly=(c.paymentType||'monthly')==='monthly',income=parseFloat(monthly?c.monthly:c.oneTime)||0,initial=parseFloat(c.initial)||0,cost=parseFloat(c.cost)||0,cycles=(c.status==='active'||c.status==='completed')?billingCycles(c.start,c.duration,c.status==='completed'?(c.statusChangedAt||c.deadline):''):0,earned=webEarned(c),stc=WEB_ST_CLS[c.status]||'cgr';return'<div class="ccard '+(c.status!=='completed'?'act':'')+'" onclick="openAdd(\'web\',\''+c.id+'\')"><div class="cctop"><div><div class="ccname">'+esc(c.name)+'</div><div class="cccat">'+esc(c.type||'—')+'</div></div><span class="chip '+stc+'">'+(WEB_ST[c.status]||c.status||'Текущ')+'</span></div><div class="ccstats"><div class="ccs"><div class="cl">'+(monthly?'Месечно':'Еднократно')+'</div><div class="cv green">'+fmt(income)+' €</div></div>'+(monthly?'<div class="ccs"><div class="cl">Първоначално</div><div class="cv">'+fmt(initial)+' €</div></div><div class="ccs"><div class="cl">Платени месеци</div><div class="cv">'+cycles+'</div></div>':'')+'<div class="ccs"><div class="cl">Нетно до днес</div><div class="cv">'+fmt(earned)+' €</div></div><div class="ccs"><div class="cl">Следващо плащане</div><div class="cv">'+(monthly&&c.status==='active'&&c.start?nextBillingLabel(c.start):'—')+'</div></div></div></div>';}
function nextBillingLabel(start){if(!start)return'—';var d=new Date(start),today=new Date(),candidate=new Date(today.getFullYear(),today.getMonth(),d.getDate());if(candidate<=today)candidate.setMonth(candidate.getMonth()+1);return fmtD(candidate.toISOString().slice(0,10));}

// ── ADD / EDIT MODAL ───────────────────────────────────
function openAdd(type,id){
  edittype=type;editid=id||null;var arr=type==='smm'?smm:web,c=id?(arr.find(function(x){return x.id===id;})||{}):{},title=(id?'Редактирай ':'Нов ')+(type==='smm'?'SMM клиент':'Web Design проект'),body='';
  if(type==='smm'){
    var plts=SMM_PLAT.map(function(p){return '<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 9px 4px 0;font-size:14px;color:var(--w2)"><input type="checkbox" value="'+p+'" '+((c.platforms||[]).indexOf(p)>=0?'checked':'')+'> '+p+'</label>';}).join(''),stOpts=Object.keys(SMM_ST).map(function(v){return '<option value="'+v+'"'+(c.status===v?' selected':'')+'>'+SMM_ST[v]+'</option>';}).join('');
    body='<div class="frow"><div class="fg"><label class="flbl">Наименование *</label><input class="fi" id="fcname" value="'+esc(c.name||'')+'"></div><div class="fg"><label class="flbl">Статус</label><select class="fsel" id="fcstatus">'+stOpts+'</select></div></div><div class="frow"><div class="fg"><label class="flbl">Месечна такса (€) *</label><input type="number" class="fi" id="fcmonthly" value="'+esc(c.monthly||'')+'" oninput="calcSmm()"></div><div class="fg"><label class="flbl">Месечни разходи (€)</label><input type="number" class="fi" id="fccost" value="'+esc(c.cost||'')+'" oninput="calcSmm()"></div></div><div class="frow"><div class="fg"><label class="flbl">Срок (месеци, незадължително)</label><input type="number" class="fi" id="fcdur" value="'+esc(c.duration||'')+'" placeholder="Остави празно за месец за месец" oninput="calcSmm()"></div><div class="fg"><label class="flbl">Начало (незадължително)</label><input type="date" class="fi" id="fcstart" value="'+esc(c.start||'')+'" oninput="calcSmm()"></div></div><div class="fg"><label class="flbl">Изчисление</label><div class="fcalc" id="smmCalc">—</div></div><div class="fg"><label class="flbl">Платформи</label><div style="background:var(--b3);border:1px solid var(--line);border-radius:var(--r);padding:10px 14px">'+plts+'</div></div><div class="fg"><label class="flbl">Контакт</label><input class="fi" id="fccontact" value="'+esc(c.contact||'')+'"></div><div class="fg"><label class="flbl">Бележки</label><textarea class="fta" id="fcnote">'+esc(c.note||'')+'</textarea></div>';setTimeout(calcSmm,30);
  }else{
    var tyOpts=WEB_TYPES.map(function(t){return '<option'+(c.type===t?' selected':'')+'>'+t+'</option>';}).join(''),stOpts=Object.keys(WEB_ST).map(function(v){return '<option value="'+v+'"'+(c.status===v?' selected':'')+'>'+WEB_ST[v]+'</option>';}).join(''),pay=c.paymentType||(c.total?'one_time':'monthly');
    body='<div class="frow"><div class="fg"><label class="flbl">Наименование *</label><input class="fi" id="fcname" value="'+esc(c.name||'')+'"></div><div class="fg"><label class="flbl">Тип проект</label><select class="fsel" id="fctype">'+tyOpts+'</select></div></div><div class="frow"><div class="fg"><label class="flbl">Статус</label><select class="fsel" id="fcstatus">'+stOpts+'</select></div><div class="fg"><label class="flbl">Начин на плащане</label><select class="fsel" id="fcpayment" onchange="toggleWebPayment()"><option value="monthly"'+(pay==='monthly'?' selected':'')+'>Месечно плащане</option><option value="one_time"'+(pay==='one_time'?' selected':'')+'>Еднократно плащане</option></select></div></div><div id="webMonthlyFields"><div class="frow"><div class="fg"><label class="flbl">Месечна такса (€)</label><input type="number" class="fi" id="fcmonthly" value="'+esc(c.monthly||'')+'" oninput="calcWeb()"></div><div class="fg"><label class="flbl">Срок (незадължително)</label><input type="number" class="fi" id="fcdur" value="'+esc(c.duration||'')+'" placeholder="Празно = месец за месец" oninput="calcWeb()"></div></div><div class="fg"><label class="flbl">Първоначално плащане (€)</label><input type="number" class="fi" id="fcinitial" value="'+esc(c.initial||'')+'" placeholder="0" oninput="calcWeb()"></div></div><div id="webOneFields"><div class="fg"><label class="flbl">Еднократна цена (€)</label><input type="number" class="fi" id="fcone" value="'+esc(c.oneTime||c.total||'')+'" oninput="calcWeb()"></div></div><div class="fg"><label class="flbl" id="webCostLabel">Разходи (€)</label><input type="number" class="fi" id="fccost" value="'+esc(c.cost||'')+'" oninput="calcWeb()"></div><div class="fg"><label class="flbl">Изчисление</label><div class="fcalc" id="webCalc">—</div></div><div class="frow"><div class="fg"><label class="flbl">Начало</label><input type="date" class="fi" id="fcstart" value="'+esc(c.start||'')+'"></div><div class="fg"><label class="flbl">Дедлайн (незадължително)</label><input type="date" class="fi" id="fcdeadline" value="'+esc(c.deadline||'')+'"></div></div><div class="fg"><label class="flbl">Контакт</label><input class="fi" id="fccontact" value="'+esc(c.contact||'')+'"></div><div class="fg"><label class="flbl">Бележки</label><textarea class="fta" id="fcnote">'+esc(c.note||'')+'</textarea></div>';setTimeout(toggleWebPayment,30);
  }
  document.getElementById('addTitle').textContent=title;document.getElementById('addBody').innerHTML=body;document.getElementById('addDelBtn').style.display=id?'':'none';document.getElementById('addOv').classList.add('open');
}
function calcSmm(){var m=parseFloat((document.getElementById('fcmonthly')||{}).value)||0,c=parseFloat((document.getElementById('fccost')||{}).value)||0,d=parseInt((document.getElementById('fcdur')||{}).value)||0,start=(document.getElementById('fcstart')||{}).value,parts=[];if(m)parts.push('Нетно / месец: '+fmt(m-c)+' €');parts.push(d?'Договор: '+d+' мес.':'Безсрочно · месец за месец');if(m&&d)parts.push('Нетно за периода: '+fmt((m-c)*d)+' €');if(start&&d)parts.push('Край: '+fmtD(addMonths(new Date(start),d).toISOString().slice(0,10)));var el=document.getElementById('smmCalc');if(el)el.textContent=parts.join(' · ');}
function toggleWebPayment(){var monthly=(document.getElementById('fcpayment')||{}).value!=='one_time',m=document.getElementById('webMonthlyFields'),o=document.getElementById('webOneFields'),l=document.getElementById('webCostLabel');if(m)m.style.display=monthly?'':'none';if(o)o.style.display=monthly?'none':'';if(l)l.textContent=monthly?'Месечни разходи (€)':'Разходи за проекта (€)';calcWeb();}
function calcWeb(){var monthly=(document.getElementById('fcpayment')||{}).value!=='one_time',income=parseFloat((document.getElementById(monthly?'fcmonthly':'fcone')||{}).value)||0,initial=parseFloat((document.getElementById('fcinitial')||{}).value)||0,c=parseFloat((document.getElementById('fccost')||{}).value)||0,d=parseInt((document.getElementById('fcdur')||{}).value)||0,el=document.getElementById('webCalc');if(!el)return;if(!income&&!initial){el.textContent='—';return;}el.textContent=monthly?('Първи месец: '+fmt(initial+income)+' € · Нетно месечно: '+fmt(income-c)+' € · '+(d?('Общо за '+d+' мес.: '+fmt(initial+income*d)+' €'):'Месец за месец')):('Нетна печалба: '+fmt(income-c)+' €');}

function saveClient() {
  var nameEl = document.getElementById('fcname');
  if (!nameEl || !nameEl.value.trim()) { toast('Въведи наименование', 'var(--yellow)'); return; }
  var name = nameEl.value.trim();
  if (edittype === 'smm') {
    var plats = [];
    document.querySelectorAll('#addBody input[type=checkbox]:checked').forEach(function(cb) { plats.push(cb.value); });
    var obj = {
      id: editid || ('s' + Date.now()),
      name: name,
      status: (document.getElementById('fcstatus') || {}).value || 'active',
      monthly: (document.getElementById('fcmonthly') || {}).value || '',
      cost: (document.getElementById('fccost') || {}).value || '',
      duration: (document.getElementById('fcdur') || {}).value || '',
      start: (document.getElementById('fcstart') || {}).value || '',
      contact: (document.getElementById('fccontact') || {}).value || '',
      note: (document.getElementById('fcnote') || {}).value || '',
      platforms: plats
    };
    if (editid) smm = smm.map(function(c) { return c.id === editid ? obj : c; }); else smm.push(obj);
  } else {
    var obj = {
      id: editid || ('w' + Date.now()), name: name,
      type: (document.getElementById('fctype') || {}).value || '',
      status: (document.getElementById('fcstatus') || {}).value || 'in_progress',
      statusChangedAt: (function(){var old=editid?web.find(function(x){return x.id===editid;}):null,ns=(document.getElementById('fcstatus')||{}).value||'in_progress';return old&&old.status===ns?(old.statusChangedAt||''):new Date().toISOString().slice(0,10);})(),
      paymentType: (document.getElementById('fcpayment') || {}).value || 'monthly',
      monthly: (document.getElementById('fcmonthly') || {}).value || '',
      oneTime: (document.getElementById('fcone') || {}).value || '',
      initial: (document.getElementById('fcinitial') || {}).value || '',
      cost: (document.getElementById('fccost') || {}).value || '',
      duration: (document.getElementById('fcdur') || {}).value || '',
      start: (document.getElementById('fcstart') || {}).value || '',
      deadline: (document.getElementById('fcdeadline') || {}).value || '',
      contact: (document.getElementById('fccontact') || {}).value || '',
      note: (document.getElementById('fcnote') || {}).value || ''
    };
    if (editid) web = web.map(function(c) { return c.id === editid ? obj : c; }); else web.push(obj);
  }
  saveData(); closeAdd();
  if (edittype === 'smm') renderSmm(); else renderWeb();
  updateBadges(); toast('✓ Запазено', 'var(--green)');
}
function delClient() {
  if (!editid || !confirm('Изтриваш клиента?')) return;
  if (edittype === 'smm') smm = smm.filter(function(c) { return c.id !== editid; });
  else web = web.filter(function(c) { return c.id !== editid; });
  saveData(); closeAdd();
  if (edittype === 'smm') renderSmm(); else renderWeb();
  updateBadges(); toast('⌫ Изтрит', 'var(--red)');
}
function closeAdd() { document.getElementById('addOv').classList.remove('open'); editid = null; edittype = null; }

// ── LEADS FILE IMPORT ──────────────────────────────────
function handleFile(e) {
  var f = e.target.files[0]; if (!f) return;
  if (!f.size) { toast('⚠ Файлът е празен (0 байта). Запази данните в него и опитай отново.', 'var(--yellow)'); e.target.value = ''; return; }
  e.target.value = '';
  var r = new FileReader();
  r.onload = function(ev) {
    var txt = ev.target.result;
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    var ext = f.name.split('.').pop().toLowerCase();
    try {
      var raw;
      if (ext === 'json') {
        if (!txt.trim()) throw new Error('JSON файлът е празен');
        raw = flattenJsonRecords(JSON.parse(txt));
        if (!raw.length) throw new Error('JSON файлът няма разпознаваеми бизнес записи');
      } else {
        raw = parseCSV(txt);
      }
      importLeads(raw);
    } catch(err) { toast('⚠ ' + err.message, 'var(--red)'); }
  };
  r.onerror = function() { toast('⚠ Грешка при четене на файла', 'var(--red)'); };
  r.readAsText(f, 'UTF-8');
}
function flattenJsonRecords(value) {
  var out=[];
  function walk(v){
    if(Array.isArray(v)){v.forEach(walk);return;}
    if(!v||typeof v!=='object')return;
    var keys=Object.keys(v),looksLikeLead=keys.some(function(k){return /name|title|company|business|phone|email|website|address|category/i.test(k);});
    if(looksLikeLead){out.push(v);return;}
    keys.forEach(function(k){walk(v[k]);});
  }
  walk(value);return out;
}
function handleDrop(e) {
  e.preventDefault();
  var f = e.dataTransfer.files[0]; if (!f) return;
  handleFile({target: {files: [f], value: ''}});
}

function parseCSV(txt) {
  var lines = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  var rows = lines.filter(function(l) { return l.trim(); });
  if (rows.length < 2) throw new Error('Файлът е твърде кратък или празен');
  var hdrs = splitLine(rows[0]).map(function(h) { return h.trim().replace(/^"|"$/g, '').toLowerCase(); });
  return rows.slice(1).map(function(line) {
    var vals = splitLine(line); var o = {};
    hdrs.forEach(function(h, i) { o[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
    return o;
  }).filter(function(o) { return Object.values(o).some(function(v) { return v; }); });
}
function splitLine(line) {
  var res = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { res.push(cur); cur = ''; }
    else cur += ch;
  }
  res.push(cur); return res;
}
var SKIP = ['name','title','company','business_name','full_name','fullname','website','url','link','site','web','homepage','phone','tel','telephone','phone_number','mobile','email','email_address','contact_email','mail','category','type','niche','industry','business_category','address','location','city','place','full_address','rating','stars','score','rate','reviews'];
function pick(o, keys) {
  for (var i = 0; i < keys.length; i++) {
    for (var ok in o) { if (ok.toLowerCase() === keys[i] && o[ok] != null && o[ok] !== '') return String(o[ok]).trim(); }
  } return '';
}
function pickN(o, keys) { var v = pick(o, keys); var n = parseFloat(v.replace(',','.')); return isNaN(n) ? 0 : Math.min(5, Math.max(0, Math.round(n))); }
function cleanGoogle(v) { return String(v||'').replace(/^[\s·•-]+/,'').trim(); }
function importLeads(raw) {
  var now = Date.now(); var imported = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i]; var extra = {};
    for (var k in r) { if (SKIP.indexOf(k.toLowerCase()) < 0 && r[k]) extra[k] = r[k]; }
    var n = pick(r, ['name','title','company','business_name','full_name','fullname','business','store_name','osrxxb']);
    if (!n) { var vals=Object.values(r); n=vals.length ? String(vals[0]||'').trim() : ''; }
    if (!n) continue;
    var sourceUrl = pick(r, ['url','link','googleMapsUrl','mapsUrl']);
    if (sourceUrl) extra['Google Maps / source URL'] = sourceUrl;
    imported.push({id: now + i, name: n, website: pick(r, ['website','site','web','homepage','mre4xd href']), phone: pick(r, ['phone','tel','telephone','phone_number','mobile']), email: pick(r, ['email','email_address','contact_email','mail']), category: cleanGoogle(pick(r, ['category','categories','categoryName','type','niche','industry','business_category','rllt__details'])), address: pick(r, ['address','location','place','full_address','rllt__details 3']) || [pick(r,['street']),pick(r,['city']),pick(r,['state']),pick(r,['country','countryCode'])].filter(Boolean).join(', '), stars: pickN(r, ['rating','stars','score','rate','totalScore','yi40hd']), reviews: pick(r,['reviews','review_count','reviewsCount','rdapee']), price: pick(r,['price','price_range','rllt__details 2']), image: pick(r,['image','image_url','wA1Bge src','wa1bge src']), status: 'unset', pipeline: 'new', note: '', followup: '', tags: [], extra: extra, aiPhone: '', aiEmail: ''});
  }
  if (!imported.length) { toast('⚠ Не намерих записи с наименование. Провери файла.', 'var(--yellow)'); return; }
  leads = leads.concat(imported);
  saveData(); renderLeads(); updateBadges(); populateCats();
  var withPhone=imported.filter(function(x){return x.phone;}).length,withEmail=imported.filter(function(x){return x.email;}).length,withWeb=imported.filter(function(x){return x.website;}).length;
  toast('✓ '+imported.length+' записа · '+withPhone+' телефона · '+withEmail+' имейла · '+withWeb+' сайта','var(--green)');
}
function loadSample() {
  importLeads([
    {name:'Coffee Time Sofia',website:'coffeetime.bg',phone:'0888-123456',email:'hello@coffeetime.bg',category:'Food & Beverage',address:'Витоша 32, София',rating:'4'},
    {name:'TechHub Bulgaria',website:'techhub.bg',phone:'0899-234567',email:'info@techhub.bg',category:'Technology',address:'Бизнес парк',rating:'5'},
    {name:'Fitness Pro Gym',website:'fitnesspro.bg',phone:'0877-345678',email:'gym@fitpro.bg',category:'Фитнес',address:'Лозенец',rating:'3'},
    {name:'Студио Форма',website:'forma.bg',phone:'0888-456789',email:'forma@studio.bg',category:'Архитектура',address:'Граф Игнатиев 20',rating:'4'},
    {name:'BG Digital Marketing',website:'bgdigital.io',phone:'0898-567890',email:'team@bgdigital.io',category:'Marketing',address:'Бизнес парк',rating:'5'}
  ]);
}

// ── LEADS RENDER ───────────────────────────────────────
var SC = {unset:'prospect', prospect:'maybe', maybe:'not', not:'unset'};
var SL = {prospect:'✓ Потенциален', maybe:'? Може би', not:'✗ Не', unset:'— ?'};
var SCL = {prospect:'cg', maybe:'cy', not:'cr', unset:'cgr'};

function setLFTab(el) {
  document.querySelectorAll('#lfTabs .btn').forEach(function(b) { b.classList.remove('active'); b.classList.add('btng'); b.style.background = ''; b.style.color = ''; });
  el.classList.add('active'); el.classList.remove('btng'); el.style.background = 'var(--b4)'; el.style.color = 'var(--w0)';
  lftab = el.dataset.f; renderLeads();
}
function populateCats() {
  var cats = []; leads.forEach(function(l) { if (l.category && cats.indexOf(l.category) < 0) cats.push(l.category); }); cats.sort();
  var sel = document.getElementById('lCatF'); var cur = sel.value;
  sel.innerHTML = '<option value="">Всички категории</option>' + cats.map(function(c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
  if (cur) sel.value = cur;
}
function parseReviewCount(v){var x=String(v||'').replace(/[()\s,]/g,'').toUpperCase(),m=parseFloat(x)||0;return x.indexOf('K')>=0?m*1000:x.indexOf('M')>=0?m*1000000:m;}
function renderLeads() {
  var q = (document.getElementById('srchQ').value || '').toLowerCase();
  var cat = document.getElementById('lCatF').value;
  var sort = document.getElementById('lSortF').value;
  var contact = (document.getElementById('lContactF') || {}).value || '';
  var fil = leads.filter(function(l) {
    var mQ = !q || [l.name,l.website,l.phone,l.email,l.category,l.address,l.note,l.reviews,l.price,(l.tags||[]).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    var mC = !cat || l.category === cat;
    var mF = lftab === 'all' || l.status === lftab;
    var mContact = !contact || (contact==='phone'&&l.phone) || (contact==='email'&&l.email) || (contact==='website'&&l.website) || (contact==='missing'&&!l.phone&&!l.email);
    return mQ && mC && mF && mContact;
  });
  fil.sort(function(a,b){
    var contactScore=function(x){return (x.phone?3:0)+(x.email?2:0)+(x.website?1:0);};
    if(sort==='quality') return (b.stars-a.stars)||(parseReviewCount(b.reviews)-parseReviewCount(a.reviews))||a.name.localeCompare(b.name,'bg');
    if(sort==='stars_desc') return (b.stars-a.stars)||a.name.localeCompare(b.name,'bg');
    if(sort==='stars_asc') return (a.stars-b.stars)||a.name.localeCompare(b.name,'bg');
    if(sort==='name_asc') return a.name.localeCompare(b.name,'bg');
    if(sort==='name_desc') return b.name.localeCompare(a.name,'bg');
    if(sort==='category') return (a.category||'').localeCompare(b.category||'','bg')||a.name.localeCompare(b.name,'bg');
    if(sort==='status'){var rank={prospect:0,maybe:1,unset:2,not:3};return (rank[a.status]??9)-(rank[b.status]??9)||b.stars-a.stars;}
    if(sort==='contacts') return contactScore(b)-contactScore(a)||b.stars-a.stars;
    if(sort==='followup') return (a.followup?new Date(a.followup):new Date('9999'))-(b.followup?new Date(b.followup):new Date('9999'));
    if(sort==='newest') return String(b.id).localeCompare(String(a.id));
    return b.stars-a.stars;
  });
  var filterKey=[q,cat,sort,contact,lftab].join('|');if(filterKey!==leadFilterKey){leadFilterKey=filterKey;leadPage=1;}
  var pages=Math.max(1,Math.ceil(fil.length/leadPageSize));leadPage=Math.min(leadPage,pages);
  var rowStart=(leadPage-1)*leadPageSize,rows=fil.slice(rowStart,rowStart+leadPageSize);
  var has = leads.length > 0;
  document.getElementById('upzone').style.display = has ? 'none' : 'block';
  document.getElementById('ltable').style.display = has ? 'table' : 'none';
  document.getElementById('lempty').style.display = (has && !fil.length) ? 'block' : 'none';
  var summary=document.getElementById('leadSummary');
  if(summary){var phones=leads.filter(function(l){return l.phone;}).length,emails=leads.filter(function(l){return l.email;}).length,sites=leads.filter(function(l){return l.website;}).length,ready=leads.filter(function(l){return l.phone||l.email;}).length;summary.innerHTML='<div><strong>'+leads.length+'</strong><span>Всички бизнеси</span></div><div><strong>'+ready+'</strong><span>С директен контакт</span></div><div><strong>'+phones+'</strong><span>Телефони</span></div><div><strong>'+emails+'</strong><span>Имейли</span></div><div><strong>'+sites+'</strong><span>Уебсайтове</span></div>';}
  var bdg = document.getElementById('pgbdg');
  bdg.style.display = has ? '' : 'none';
  bdg.textContent = fil.length + ' записа';
  document.getElementById('bdg-leads').textContent = leads.length;
  if (!has || !fil.length) { document.getElementById('ltbody').innerHTML = ''; return; }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  document.getElementById('ltbody').innerHTML = rows.map(function(l) {
    var stars = ''; for (var s = 1; s <= 5; s++) stars += '<span class="star' + (s <= l.stars ? ' on' : '') + '" onclick="event.stopPropagation();lStar(' + l.id + ',' + s + ')">★</span>';
    var fu = l.followup ? new Date(l.followup) : null; if (fu) fu.setHours(0,0,0,0);
    var fust = fu && fu <= today ? 'color:var(--red)' : 'color:var(--w3)';
    var tags = (l.tags || []).slice(0, 2).map(function(t) { return '<span class="tagp">' + esc(t) + '</span>'; }).join('');
    return '<tr onclick="openLB(' + l.id + ')">' +
      '<td><div class="tdn">' + esc(l.name) + '</div><div class="tds">' + (l.website ? '<a href="' + (l.website.indexOf('http') === 0 ? l.website : 'https://' + l.website) + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue)">' + esc(l.website) + '</a>' : esc(l.phone || '')) + '</div>' + (tags ? '<div style="display:flex;gap:4px;margin-top:5px">' + tags + '</div>' : '') + '</td>' +
      '<td><div class="stars">' + stars + '</div></td>' +
      '<td><button class="chip ' + SCL[l.status] + '" onclick="event.stopPropagation();lCS(' + l.id + ')">' + SL[l.status] + '</button></td>' +
      '<td style="font-size:14px;color:var(--w2)">' + esc(l.category || '—') + '</td>' +
      '<td style="font-size:12px;color:var(--w3)">' + (l.phone?'<div>✆ '+esc(l.phone)+'</div>':'') + (l.email?'<div>✉ '+esc(l.email)+'</div>':'') + (!l.phone&&!l.email?'<span style="color:var(--w4)">Няма във файла</span>':'') + '</td>' +
      '<td style="font-size:13px;font-family:var(--mono);' + fust + '">' + (l.followup ? fmtD(l.followup) : '—') + '</td>' +
      '<td onclick="event.stopPropagation()" style="padding:10px 14px">' +
        (l.email ? '<a href="mailto:' + esc(l.email) + '" class="btn btng btnsm" title="Имейл">✉</a> ' : '') +
        (l.phone ? '<a href="tel:' + esc(l.phone) + '" class="btn btng btnsm" title="Тел">✆</a> ' : '') +
        '<button class="btn btnd btnsm" onclick="delLead(' + l.id + ')">⌫</button>' +
      '</td></tr>';
  }).join('');
}
function changeLeadPage(delta){leadPage=Math.max(1,leadPage+delta);renderLeads();document.getElementById('pgleads').scrollIntoView({behavior:'smooth'});}
function changeLeadPageSize(value){leadPageSize=parseInt(value)||25;leadPage=1;renderLeads();}
function resetLeadFilters(){document.getElementById('srchQ').value='';document.getElementById('lCatF').value='';document.getElementById('lContactF').value='';document.getElementById('lSortF').value='quality';setLFTab(document.querySelector('#lfTabs .btn'));}
function deleteAllLeads(){if(!leads.length)return;if(!confirm('Изтрий всички '+leads.length+' leads? Това действие не може да се върне.'))return;leads=[];leadPage=1;saveData();renderLeads();populateCats();updateBadges();toast('Всички leads са изтрити','var(--red)');}
function deleteAllWeb(){if(!web.length)return;if(!confirm('Изтрий всички '+web.length+' Web Design проекта? Това действие не може да се върне.'))return;web=[];saveData();renderWeb();updateBadges();toast('Всички Web Design проекти са изтрити','var(--red)');}
function lCS(id) { var l = leads.find(function(x) { return x.id === id; }); if (!l) return; l.status = SC[l.status] || 'unset'; saveData(); renderLeads(); }
function lStar(id, n) { var l = leads.find(function(x) { return x.id === id; }); if (!l) return; l.stars = l.stars === n ? 0 : n; saveData(); renderLeads(); }
function delLead(id) { if (!confirm('Изтрий?')) return; leads = leads.filter(function(l) { return l.id !== id; }); saveData(); renderLeads(); updateBadges(); toast('⌫ Изтрит', 'var(--red)'); }

// ── LIGHTBOX ───────────────────────────────────────────
function openLB(id) {
  lbid = id; var l = leads.find(function(x) { return x.id === id; }); if (!l) return;
  var init = (l.name || '?').split(' ').slice(0, 2).map(function(w) { return w[0]; }).join('').toUpperCase();
  var stars = ''; for (var s = 1; s <= 5; s++) stars += '<span class="lbstar' + (s <= l.stars ? ' on' : '') + '" onclick="lbStar(' + s + ')">★</span>';
  document.getElementById('lbhdr').innerHTML =
    '<div class="lbav">' + esc(init) + '</div>' +
    '<div style="flex:1"><div class="lbname">' + esc(l.name) + '</div>' +
    (l.website ? '<div class="lburl"><a href="' + (l.website.indexOf('http') === 0 ? l.website : 'https://' + l.website) + '" target="_blank">' + esc(l.website) + '</a></div>' : '') +
    '<div class="lbchips" id="lbchips"><button class="chip ' + SCL[l.status] + '" onclick="lbCS()">' + SL[l.status] + '</button><div class="lbstars">' + stars + '</div>' +
    (l.email ? '<a href="mailto:' + esc(l.email) + '" class="chip cgr">✉ ' + esc(l.email) + '</a>' : '') +
    (l.phone ? '<a href="tel:' + esc(l.phone) + '" class="chip cgr">✆ ' + esc(l.phone) + '</a>' : '') +
    '</div></div><button class="mclose" onclick="closeLB()">✕</button>';

  document.getElementById('lbinfo').innerHTML =
    '<div class="lbsec">Информация</div>' +
    '<div class="fg"><label class="flbl">Телефон</label><input class="fi" value="' + esc(l.phone || '') + '" placeholder="—" onchange="lbSet(\'phone\',this.value)"></div>' +
    '<div class="fg"><label class="flbl">Имейл</label><input class="fi" value="' + esc(l.email || '') + '" placeholder="—" onchange="lbSet(\'email\',this.value)"></div>' +
    '<div class="fg"><label class="flbl">Адрес</label><input class="fi" value="' + esc(l.address || '') + '" placeholder="—" onchange="lbSet(\'address\',this.value)"></div>' +
    '<div class="fg"><label class="flbl">Категория</label><input class="fi" value="' + esc(l.category || '') + '" placeholder="—" onchange="lbSet(\'category\',this.value)"></div>' +
    '<div class="fdiv"></div>' +
    '<div class="fg"><label class="flbl">Followup дата</label><input type="date" class="fi" value="' + esc(l.followup || '') + '" onchange="lbSet(\'followup\',this.value);renderLeads()"></div>' +
    '<div class="fg"><label class="flbl">Статус</label><select class="fsel" onchange="lbSet(\'status\',this.value);lbRefresh();renderLeads()">' +
    Object.keys(SL).map(function(v) { return '<option value="' + v + '"' + (l.status === v ? ' selected' : '') + '>' + SL[v] + '</option>'; }).join('') + '</select></div>' +
    (Object.keys(l.extra || {}).length ? '<div class="fdiv"></div><div class="lbsec">Данни от скрейпъра</div><div style="background:var(--b2);border:1px solid var(--line);border-radius:var(--r);padding:10px;font-family:var(--mono);font-size:12px;color:var(--w2);line-height:1.8;max-height:130px;overflow-y:auto">' + Object.entries(l.extra).slice(0, 12).map(function(e) { return '<span style="color:var(--w4)">' + esc(e[0]) + ':</span> ' + esc(e[1]) + '<br>'; }).join('') + '</div>' : '');

  document.getElementById('lbnotes').innerHTML =
    '<div class="lbsec">Бележки</div>' +
    '<textarea class="fta" style="min-height:130px" placeholder="Бележки — предишни разговори, наблюдения..." onblur="lbSet(\'note\',this.value)">' + esc(l.note || '') + '</textarea>' +
    '<div class="fdiv"></div><div class="lbsec">Тагове</div>' +
    '<div class="tagsbox" id="lbTagsBox"></div>';
  lbRenderTags();

  document.getElementById('lbai').innerHTML =
    '<div class="lbsec">Безплатен Sales Assistant</div>' +
    '<div class="aitabs"><button class="aitab active" onclick="aiTab(\'phone\',this)">📞 Телефонен скрипт</button><button class="aitab" onclick="aiTab(\'email\',this)">✉ Имейл / съобщение</button></div>' +
    '<div class="aitc active" id="aitcPhone"><button class="aibtn" id="aiBtnP" onclick="genAI(\'phone\')">✦ Създай безплатен телефонен скрипт</button>' +
    '<div class="aibox" id="aiBoxP">' + (l.aiPhone || '<div class="aiph"><div class="ico">📞</div><p>Работи офлайн и без API — opener, въпроси, възражения и затваряне.</p></div>') + '</div></div>' +
    '<div class="aitc" id="aitcEmail"><button class="aibtn" id="aiBtnE" onclick="genAI(\'email\')">✦ Създай безплатен имейл / съобщение</button>' +
    '<div class="aibox" id="aiBoxE">' + (l.aiEmail || '<div class="aiph"><div class="ico">✉</div><p>Работи офлайн и без API — готов персонализиран първи контакт и follow-up.</p></div>') + '</div></div>';

  document.getElementById('lbOv').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLB() { document.getElementById('lbOv').classList.remove('open'); document.body.style.overflow = ''; lbid = null; }
function getLB() { return leads.find(function(x) { return x.id === lbid; }); }
function lbSet(f, v) { var l = getLB(); if (!l) return; l[f] = v; saveData(); }
function lbStar(n) { var l = getLB(); if (!l) return; l.stars = l.stars === n ? 0 : n; saveData(); lbRefresh(); }
function lbCS() { var l = getLB(); if (!l) return; l.status = SC[l.status] || 'unset'; saveData(); lbRefresh(); renderLeads(); }
function lbRefresh() {
  var l = getLB(); if (!l) return;
  var stars = ''; for (var s = 1; s <= 5; s++) stars += '<span class="lbstar' + (s <= l.stars ? ' on' : '') + '" onclick="lbStar(' + s + ')">★</span>';
  document.getElementById('lbchips').innerHTML = '<button class="chip ' + SCL[l.status] + '" onclick="lbCS()">' + SL[l.status] + '</button><div class="lbstars">' + stars + '</div>' + (l.email ? '<a href="mailto:' + esc(l.email) + '" class="chip cgr">✉ ' + esc(l.email) + '</a>' : '') + (l.phone ? '<a href="tel:' + esc(l.phone) + '" class="chip cgr">✆ ' + esc(l.phone) + '</a>' : '');
}
function lbRenderTags() {
  var l = getLB(); if (!l) return;
  document.getElementById('lbTagsBox').innerHTML = (l.tags || []).map(function(t) { return '<span class="tagp">' + esc(t) + '<button onclick="lbRmTag(\'' + esc(t) + '\')">×</button></span>'; }).join('') + '<input class="tinp" placeholder="Добави таг (Enter)..." onkeydown="lbAddTag(event)">';
}
function lbAddTag(e) { if (e.key !== 'Enter' && e.key !== ',') return; e.preventDefault(); var v = e.target.value.trim(); if (!v) return; var l = getLB(); if (!l) return; if (l.tags.indexOf(v) < 0) l.tags.push(v); saveData(); lbRenderTags(); }
function lbRmTag(t) { var l = getLB(); if (!l) return; l.tags = l.tags.filter(function(x) { return x !== t; }); saveData(); lbRenderTags(); }
function lbDel() { if (!confirm('Изтрий?')) return; var id = lbid; closeLB(); leads = leads.filter(function(l) { return l.id !== id; }); saveData(); renderLeads(); updateBadges(); toast('⌫ Изтрит', 'var(--red)'); }
function aiTab(t, el) {
  document.querySelectorAll('.aitab').forEach(function(x) { x.classList.remove('active'); });
  document.querySelectorAll('.aitc').forEach(function(x) { x.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('aitc' + t.charAt(0).toUpperCase() + t.slice(1)).classList.add('active');
}

function saveOpenAIKey(){
  var input=document.getElementById('openaiKeyInp'),status=document.getElementById('apiStatus');
  var key=(input||{}).value||'';
  if(!key.startsWith('sk-')){toast('⚠ Ключът трябва да започва с sk-','var(--yellow)');return;}
  fetch('/api/key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:key})})
    .then(function(resp){return resp.json().then(function(data){if(!resp.ok)throw new Error(data.error||'Грешка');return data;});})
    .then(function(){input.value='';status.textContent='Свързан';status.className='chip cg';toast('✓ ChatGPT е свързан','var(--green)');})
    .catch(function(err){status.textContent='Грешка';status.className='chip cr';toast('⚠ '+err.message,'var(--red)');});
}
function refreshApiStatus(){
  fetch('/api/status').then(function(r){return r.json();}).then(function(data){
    var status=document.getElementById('apiStatus');if(!status)return;
    status.textContent=data.connected?'Свързан':'Не е свързан';status.className='chip '+(data.connected?'cg':'cgr');
  }).catch(function(){});
}

// ── AI ADVICE ──────────────────────────────────────────
function salesAngle(l){
  var c=String(l.category||'').toLowerCase();
  if(/restaurant|ресторант|cafe|кафе|food|bar|bakery|пекар/.test(c)) return 'повече резервации, по-силно локално присъствие и съдържание, което показва атмосферата и менюто';
  if(/hotel|хотел|travel|туриз/.test(c)) return 'повече директни резервации, по-добро представяне на преживяването и по-малка зависимост от платформи';
  if(/beauty|salon|красот|spa|фризьор|nail/.test(c)) return 'повече записани часове, силно портфолио преди/след и редовно връщане на клиентите';
  if(/fitness|gym|фитнес|sport|спорт/.test(c)) return 'повече запитвания за членство, показване на резултати и изграждане на активна общност';
  if(/clinic|doctor|medical|dental|health|клиника|лекар|дент|здрав/.test(c)) return 'повече качествени запитвания, ясно представяне на услугите и по-високо доверие';
  if(/shop|store|retail|магазин|fashion|мода/.test(c)) return 'повече продажби, по-добро представяне на продуктите и кампании към точната аудитория';
  if(/real estate|имот|property/.test(c)) return 'повече качествени запитвания и по-силно визуално представяне на офертите';
  if(/law|legal|адвокат|account|счетов/.test(c)) return 'повече доверие, ясно обяснени услуги и постоянен поток от подходящи запитвания';
  return 'повече качествени запитвания, по-силно онлайн присъствие и по-ясно представяне на услугите';
}
function freePhoneScript(l){
  var name=l.name||'фирмата',category=l.category||'вашия бизнес',angle=salesAngle(l);
  var site=l.website?'Разгледах сайта ви '+l.website+' и':'Попаднах на '+name+' и';
  return '**ПОДГОТОВКА**\nЦел: кратък разговор от 2–3 минути и уговаряне на следваща стъпка.\n\n**НАЧАЛО**\n„Здравейте, обаждам се от Digital Eight. '+site+' ми направи впечатление начинът, по който представяте '+category+'. Удобно ли е да ви отнема 30 секунди, за да кажа защо се обаждам?“\n\n**ПРИЧИНА ЗА ОБАЖДАНЕТО**\n„Помагаме на бизнеси като '+name+' да постигат '+angle+'. Имам две конкретни идеи за вас и исках първо да разбера как работите в момента.“\n\n**КВАЛИФИКАЦИОННИ ВЪПРОСИ**\n1. „Откъде идват повечето ви нови клиенти в момента?“\n2. „Кое искате да подобрите най-много през следващите 3 месеца — повече запитвания, продажби или разпознаваемост?“\n3. „Имате ли човек, който редовно следи сайта, социалните мрежи и рекламите?“\n\n**ПРЕДЛОЖЕНИЕ**\n„На база това бих започнал с кратък анализ и 2–3 бързи подобрения, които могат да дадат видим резултат без да променяте всичко наведнъж.“\n\n**АКО КАЖАТ „НЕ МЕ ИНТЕРЕСУВА“**\n„Разбирам напълно. Мога ли само да ви изпратя две конкретни идеи за '+name+'? Ако не са полезни, няма нужда да продължаваме.“\n\n**ЗАТВАРЯНЕ**\n„Кое е по-удобно — кратък 15-минутен разговор утре или да ви изпратя идеите по имейл/WhatsApp?“\n\n**БЕЛЕЖКА СЛЕД РАЗГОВОРА**\nЗапиши нуждата, възражението и точната следваща дата за контакт.';
}
function freeEmailScript(l){
  var name=l.name||'вашия бизнес',category=l.category||'вашата сфера',angle=salesAngle(l);
  var observation=l.website?'Разгледах '+l.website+' и виждам добра основа, върху която може да се надгради.':'Попаднах на '+name+' и ми направи впечатление начинът, по който представяте бизнеса си.';
  return '**ТЕМА**\n2 конкретни идеи за '+name+'\n\n**ИМЕЙЛ**\nЗдравейте,\n\n'+observation+'\n\nВ Digital Eight помагаме на бизнеси в сферата на '+category+' да постигат '+angle+'. За '+name+' виждам няколко практични възможности, които могат да се приложат без голяма промяна наведнъж.\n\nМога да ви изпратя кратък безплатен анализ с 2–3 конкретни идеи. Ако ви бъдат полезни, можем да направим 15-минутен разговор и да обсъдим следващите стъпки.\n\nУдобно ли е да ви го изпратя?\n\nПоздрави,\nDigital Eight\n\n**КРАТЪК FOLLOW-UP СЛЕД 3 ДНИ**\n„Здравейте, пиша във връзка с идеите за '+name+'. Мога да ги изпратя в кратък вид тук — без ангажимент. Кое е по-важно за вас в момента: повече запитвания или по-силно онлайн представяне?“\n\n**СЪВЕТ**\nДобави името на конкретен човек, ако го знаеш, и спомени едно реално наблюдение от сайта или профила им.';
}
function genAI(type){
  var l=getLB();if(!l)return;var isP=type==='phone';
  var btn=document.getElementById(isP?'aiBtnP':'aiBtnE'),box=document.getElementById(isP?'aiBoxP':'aiBoxE');
  btn.disabled=true;btn.textContent='Създава...';
  var text=isP?freePhoneScript(l):freeEmailScript(l),html=fmtAI(text);
  setTimeout(function(){
    box.innerHTML=html;if(isP)l.aiPhone=html;else l.aiEmail=html;saveData();
    btn.disabled=false;btn.textContent=isP?'↻ Създай нов телефонен скрипт':'↻ Създай нов имейл';
    toast('✓ Безплатният скрипт е готов','var(--green)');
  },180);
}

function fmtAI(text) {
  var h = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h4>$1</h4>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  return '<div class="air"><p>' + h + '</p><button class="aircopy" onclick="cpAI(this)">⎘ Копирай текста</button></div>';
}
function cpAI(btn) {
  var t = btn.closest('.air').innerText.replace('⎘ Копирай текста', '').trim();
  navigator.clipboard.writeText(t).then(function() { toast('⎘ Копирано', 'var(--green)'); }).catch(function() { toast('⚠ Грешка при копиране', 'var(--red)'); });
}

// ── EXPORT ─────────────────────────────────────────────
function doExport() {
  if (!leads.length) { toast('Няма данни за експорт', 'var(--yellow)'); return; }
  var cols = ['name','website','phone','email','category','address','stars','status','followup','tags','note'];
  var hdrs = ['Наименование','Уебсайт','Телефон','Имейл','Категория','Адрес','Оценка','Статус','Followup','Тагове','Бележки'];
  var rows = leads.map(function(l) {
    return cols.map(function(c) {
      var v = c === 'tags' ? (l.tags || []).join('; ') : String(l[c] || '');
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(',');
  });
  var csv = '\ufeff' + hdrs.join(',') + '\n' + rows.join('\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = 'd8_leads_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  toast('↓ CSV изтегля се', 'var(--green)');
}

// ── UTILS ──────────────────────────────────────────────
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n) { return Number(n || 0).toLocaleString('bg-BG', {maximumFractionDigits: 0}); }
function fmtD(d) { try { return new Date(d).toLocaleDateString('bg-BG', {day: '2-digit', month: 'short'}); } catch(e) { return d || ''; } }
function addMonths(date, m) { var d = new Date(date); d.setMonth(d.getMonth() + m); return d; }
function toast(msg, col) {
  var c = document.getElementById('toasts'); var t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = '<span style="color:' + col + '">●</span> ' + msg;
  c.appendChild(t); setTimeout(function() { t.classList.add('out'); setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 150); }, 3200);
}
function nukeAll() {
  if (!confirm('Изтриваш ВСИЧКИ данни? Не може да се върне.')) return;
  leads = []; smm = []; web = []; saveData(); renderDash(); renderLeads(); updateBadges();
  toast('Всички данни изчистени', 'var(--red)');
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeLB(); closeAdd(); } });

// ── INIT ───────────────────────────────────────────────
(function(){fetch('api.php?action=me',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){if(d.authenticated)startApp(d.user);}).catch(function(){});})();
