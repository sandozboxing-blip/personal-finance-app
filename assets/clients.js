// ── SMM ────────────────────────────────────────────────
var SMM_ST = {active: 'Активен', paused: 'Пауза', ended: 'Приключен'};
var SMM_PLAT = ['Facebook','Instagram','TikTok','LinkedIn','YouTube','Twitter/X','Pinterest','Google Ads'];
var SMM_ST_CLS = {active: 'cg', paused: 'cy', ended: 'cgr'};

function renderSmm(){var f=document.getElementById('smmF').value,q=(document.getElementById('srchQ').value||'').toLowerCase(),active=smm.filter(function(c){return c.status==='active';}),revenue=active.reduce(function(x,c){return x+(parseFloat(c.monthly)||0);},0),costs=active.reduce(function(x,c){return x+(parseFloat(c.cost)||0);},0),profit=revenue-costs,earned=smm.reduce(function(x,c){return x+smmEarned(c);},0),today=new Date();today.setHours(0,0,0,0);var exp=active.filter(function(c){if(!c.start||!c.duration)return false;var end=addMonths(new Date(c.start),parseInt(c.duration)),days=Math.ceil((end-today)/86400000);return days>=0&&days<=30;}).length;document.getElementById('smmStats').innerHTML='<div class="sc acc"><div class="sclbl">Месечен приход</div><div class="scval purple">'+fmt(revenue)+' €</div><div class="scsub">'+active.length+' текущи клиента</div></div><div class="sc"><div class="sclbl">Нетно / месец</div><div class="scval green">'+fmt(profit)+' €</div><div class="scsub">Разходи '+fmt(costs)+' €</div></div><div class="sc"><div class="sclbl">Нетно изкарано до днес</div><div class="scval">'+fmt(earned)+' €</div><div class="scsub">По изминалите платежни дати</div></div><div class="sc"><div class="sclbl">За подновяване</div><div class="scval">'+exp+'</div><div class="scsub">Изтичат до 30 дни</div></div>';var data=smm.filter(function(c){return(!f||c.status===f)&&(!q||c.name.toLowerCase().includes(q));}),el=document.getElementById('smmCards');if(!data.length){el.innerHTML='<div class="empty"><h3>Няма SMM клиенти</h3></div>';return;}el.innerHTML='<div class="cgrid">'+data.map(smmCard).join('')+'</div>';}

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
  var stc = SMM_ST_CLS[c.status] || 'cgr', currentMonthly=c.status==='active'?(parseFloat(c.monthly)||0):0, currentNet=c.status==='active'?currentMonthly-(parseFloat(c.cost)||0):0;
  var plts = (c.platforms || []).slice(0,3).map(function(p) { return '<span class="chip cgr" style="font-size:11px;padding:3px 8px">' + esc(p) + '</span>'; }).join(' ');
  return '<div class="ccard ' + (c.status === 'active' ? 'act' : '') + '" onclick="openAdd(\'smm\',\'' + c.id + '\')">' +
    '<div class="cctop"><div><div class="ccname">' + esc(c.name) + '</div><div class="cccat" style="margin-top:6px">' + plts + '</div></div><span class="chip ' + stc + '">' + (SMM_ST[c.status] || c.status) + '</span></div>' +
    '<div class="ccstats">' +
    '<div class="ccs"><div class="cl">Месечно</div><div class="cv green">' + fmt(currentMonthly) + ' €</div></div>' +
    '<div class="ccs"><div class="cl">Нетно / месец</div><div class="cv">' + fmt(currentNet) + ' €</div></div>' +
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
      statusChangedAt: (function(){var old=editid?smm.find(function(x){return x.id===editid;}):null,ns=(document.getElementById('fcstatus')||{}).value||'active';return old&&old.status===ns?(old.statusChangedAt||(ns==='active'?'':new Date().toISOString().slice(0,10))):new Date().toISOString().slice(0,10);})(),
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

