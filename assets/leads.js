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
  function walk(v,fromArray){
    if(Array.isArray(v)){v.forEach(function(item){walk(item,true);});return;}
    if(!v||typeof v!=='object')return;
    var keys=Object.keys(v),scalarCount=keys.filter(function(k){var x=v[k];return x!=null&&(typeof x==='string'||typeof x==='number'||typeof x==='boolean');}).length;
    var looksLikeLead=keys.some(function(k){return /name|title|company|business|phone|tel|email|website|url|address|category|rating|review/i.test(k);});
    if(looksLikeLead||(fromArray&&scalarCount>=2)){out.push(v);return;}
    keys.forEach(function(k){walk(v[k],false);});
  }
  walk(value,false);return out;
}
function handleDrop(e) {
  e.preventDefault();
  var f = e.dataTransfer.files[0]; if (!f) return;
  handleFile({target: {files: [f], value: ''}});
}

function parseCSV(txt) {
  var lines=txt.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n'),rows=lines.filter(function(l){return l.trim();});
  if(rows.length<2)throw new Error('Файлът е твърде кратък или празен');
  var first=rows[0],counts={',':(first.match(/,/g)||[]).length,';':(first.match(/;/g)||[]).length,'\t':(first.match(/\t/g)||[]).length};
  var delimiter=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];})[0];
  var hdrs=splitLine(rows[0],delimiter).map(function(h){return h.trim().replace(/^"|"$/g,'').toLowerCase();});
  return rows.slice(1).map(function(line){var vals=splitLine(line,delimiter),o={};hdrs.forEach(function(h,i){o[h]=(vals[i]||'').trim().replace(/^"|"$/g,'');});return o;}).filter(function(o){return Object.values(o).some(function(v){return v;});});
}
function splitLine(line,delimiter) {
  var res=[],cur='',inQ=false;delimiter=delimiter||',';
  for(var i=0;i<line.length;i++){var ch=line[i];if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(ch===delimiter&&!inQ){res.push(cur);cur='';}else cur+=ch;}
  res.push(cur);return res;
}
var SKIP = ['name','title','company','business_name','full_name','fullname','website','url','link','site','web','homepage','phone','tel','telephone','phone_number','mobile','email','email_address','contact_email','mail','category','type','niche','industry','business_category','address','location','city','place','full_address','rating','stars','score','rate','reviews'];
function normalizeLeadKey(key){return String(key||'').toLowerCase().replace(/[^a-z0-9а-я]+/g,'');}
function leadValue(value){if(value==null)return'';if(Array.isArray(value))return value.map(leadValue).filter(Boolean).join(', ');if(typeof value==='object'){var vals=Object.keys(value).map(function(k){return leadValue(value[k]);}).filter(Boolean);return vals.join(', ');}return String(value).trim();}
function pick(o, keys) {
  var wanted=keys.map(normalizeLeadKey);
  for(var ok in o){if(wanted.indexOf(normalizeLeadKey(ok))>=0){var value=leadValue(o[ok]);if(value)return value;}}
  return '';
}
function pickN(o, keys) { var v=pick(o,keys),n=parseFloat(v.replace(',','.'));return isNaN(n)?0:Math.min(5,Math.max(0,n)); }function cleanGoogle(v) { return String(v||'').replace(/^[\s·•-]+/,'').trim(); }
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
function renderLeadPager(total,pages){
  var pager=document.getElementById('leadPager');if(!pager)return;
  if(!total){pager.style.display='none';pager.innerHTML='';return;}
  pager.style.display='flex';pager.innerHTML='<span>Показани '+(((leadPage-1)*leadPageSize)+1)+'–'+Math.min(leadPage*leadPageSize,total)+' от '+total+'</span><span class="pagergrow"></span><button class="btn btng btnsm" '+(leadPage<=1?'disabled':'')+' onclick="changeLeadPage(-1)">←</button><strong>'+leadPage+' / '+pages+'</strong><button class="btn btng btnsm" '+(leadPage>=pages?'disabled':'')+' onclick="changeLeadPage(1)">→</button><label>На страница <select onchange="changeLeadPageSize(this.value)"><option '+(leadPageSize===25?'selected':'')+'>25</option><option '+(leadPageSize===50?'selected':'')+'>50</option><option '+(leadPageSize===100?'selected':'')+'>100</option></select></label>';
}
function renderMobileLeadCards(rows){
  var list=document.getElementById('leadMobileList');if(!list)return;
  list.innerHTML=rows.map(function(l){
    var phone=l.phone?'<a href="tel:'+esc(l.phone)+'" onclick="event.stopPropagation()">Обади се</a>':'',email=l.email?'<a href="mailto:'+esc(l.email)+'" onclick="event.stopPropagation()">Имейл</a>':'';
    return '<article class="lead-mobile-card" onclick="openLB('+JSON.stringify(l.id)+')"><div class="lmc-head"><div class="lmc-title"><strong>'+esc(l.name)+'</strong><span>'+esc(l.category||l.address||'Без категория')+'</span></div><div class="lmc-score">'+(l.stars?Number(l.stars).toFixed(1)+' ★':'Няма ★')+'</div></div><div class="lmc-meta">'+(l.phone?'<span class="lmc-chip good">Телефон</span>':'<span class="lmc-chip">Без телефон</span>')+(l.email?'<span class="lmc-chip good">Имейл</span>':'')+(l.website?'<span class="lmc-chip">Има сайт</span>':'<span class="lmc-chip good">Без сайт</span>')+(l.followup?'<span class="lmc-chip">Follow-up '+fmtD(l.followup)+'</span>':'')+'</div><div class="lmc-actions"><button class="primary" onclick="event.stopPropagation();openLB('+JSON.stringify(l.id)+')">Отвори профила</button>'+(phone||email||'<button disabled>Няма контакт</button>')+'</div></article>';
  }).join('');
}
function renderLeads() {
  normalizeData();ensureLeadPriorities();
  var q = (document.getElementById('srchQ').value || '').toLowerCase();
  var cat = document.getElementById('lCatF').value;
  var sort = document.getElementById('lSortF').value;
  var contact = (document.getElementById('lContactF') || {}).value || '';
  var rating = parseFloat((document.getElementById('lRatingF') || {}).value) || 0;
  var follow = (document.getElementById('lFollowF') || {}).value || '';
  renderActiveLeadFilters();
  var fil = leads.filter(function(l) {
    var mQ = !q || [l.name,l.website,l.phone,l.email,l.category,l.address,l.note,l.reviews,l.price,(l.tags||[]).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    var mC = !cat || l.category === cat;
    var mF = lftab === 'all' || l.status === lftab;
    var mContact = !contact || (contact==='phone'&&l.phone) || (contact==='email'&&l.email) || (contact==='website'&&l.website) || (contact==='no_website'&&!l.website) || (contact==='missing'&&!l.phone&&!l.email);
    var mRating = !rating || (parseFloat(l.stars)||0) >= rating;
    var now=new Date();now.setHours(0,0,0,0);var fu=l.followup?new Date(l.followup):null;if(fu)fu.setHours(0,0,0,0);var week=new Date(now);week.setDate(week.getDate()+7);
    var mFollow=!follow||(follow==='none'&&!fu)||(follow==='today'&&fu&&fu<=now)||(follow==='week'&&fu&&fu>=now&&fu<=week);
    return mQ && mC && mF && mContact && mRating && mFollow;
  });
  fil.sort(function(a,b){
    var contactScore=function(x){return (x.phone?3:0)+(x.email?2:0)+(x.website?1:0);};
    if(sort==='priority') return leadPriorityCompare(a,b);
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
  var filterKey=[q,cat,sort,contact,rating,follow,lftab,leadPriorityRules.join(',')].join('|');if(filterKey!==leadFilterKey){leadFilterKey=filterKey;leadPage=1;}
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
  document.getElementById('bdg-leads').textContent = leads.length; var taskBadge=document.getElementById('bdg-tasks');if(taskBadge)taskBadge.textContent=getTasks().filter(function(t){return !t.done;}).length;
  if (!has || !fil.length) { document.getElementById('ltbody').innerHTML = ''; renderMobileLeadCards([]); renderLeadPager(0,1); return; }
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
  renderMobileLeadCards(rows);
  renderLeadPager(fil.length,pages);
}
function changeLeadPage(delta){leadPage=Math.max(1,leadPage+delta);renderLeads();document.getElementById('pgleads').scrollIntoView({behavior:'smooth'});}
function changeLeadPageSize(value){leadPageSize=parseInt(value)||25;userSettings.leadPageSize=leadPageSize;saveData('profile');leadPage=1;renderLeads();}
function leadFilterLabel(id,value){var el=document.getElementById(id);if(!el||!value)return'';var option=Array.prototype.find.call(el.options,function(o){return o.value===String(value);});return option?option.textContent:String(value);}
function renderActiveLeadFilters(){
  var box=document.getElementById('activeLeadFilters'),count=document.getElementById('leadFilterCount');if(!box)return;
  var filters=[],q=(document.getElementById('srchQ').value||'').trim(),pairs=[['category','lCatF'],['contact','lContactF'],['rating','lRatingF'],['followup','lFollowF']];
  if(q)filters.push({key:'search',label:'Търсене: '+q});if(lftab!=='all')filters.push({key:'status',label:{prospect:'Потенциални',maybe:'Може би',not:'Не'}[lftab]||lftab});
  pairs.forEach(function(x){var value=document.getElementById(x[1]).value;if(value)filters.push({key:x[0],label:leadFilterLabel(x[1],value)});});
  if(count){count.textContent=filters.length||'';count.style.display=filters.length?'inline-grid':'none';}
  box.innerHTML=filters.length?'<span>Активни:</span>'+filters.map(function(f){return'<button onclick="clearLeadFilter(\''+f.key+'\')">'+esc(f.label)+' <b>×</b></button>';}).join('')+'<button class="clearall" onclick="resetLeadFilters()">Изчисти всички</button>':'';
}
function clearLeadFilter(key){var ids={category:'lCatF',contact:'lContactF',rating:'lRatingF',followup:'lFollowF'};if(key==='search')document.getElementById('srchQ').value='';else if(key==='status')lftab='all';else if(ids[key])document.getElementById(ids[key]).value='';if(key==='status'){var first=document.querySelector('#lfTabs .btn');if(first)setLFTab(first);else renderLeads();}else renderLeads();}
function applyLeadQuickFilter(key,value){var ids={category:'lCatF',contact:'lContactF',rating:'lRatingF',followup:'lFollowF'},id=ids[key],el=document.getElementById(id);if(!el)return;if(leadAddons.indexOf(key)<0)leadAddons.push(key);localStorage.setItem('d8LeadAddons',JSON.stringify(leadAddons));el.value=value;renderLeadAddons();document.getElementById('leadFilterMenu').classList.remove('open');renderLeads();}
function resetLeadFilters(){document.getElementById('srchQ').value='';document.getElementById('lCatF').value='';document.getElementById('lContactF').value='';document.getElementById('lRatingF').value='';document.getElementById('lFollowF').value='';document.getElementById('lSortF').value='priority';lftab='all';setLFTab(document.querySelector('#lfTabs .btn'));}
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


// ── LEADS FILTER BUILDER ──
var leadAddons=[],leadPriorityRules=[],leadPriorityProfile='';
try{leadAddons=JSON.parse(localStorage.getItem('d8LeadAddons')||'[]');if(!Array.isArray(leadAddons))leadAddons=[];}catch(e){leadAddons=[];}
function renderLeadAddons(){document.querySelectorAll('.lead-addon').forEach(function(el){var on=leadAddons.indexOf(el.dataset.addon)>=0;el.classList.toggle('shown',on);var mark=document.getElementById('fa-'+el.dataset.addon);if(mark)mark.textContent=on?'✓':'＋';});renderLeadPriorityRules();}
function toggleLeadFilterMenu(e){if(e)e.stopPropagation();document.getElementById('leadFilterMenu').classList.toggle('open');}
function toggleLeadAddon(key){var i=leadAddons.indexOf(key);if(i>=0){leadAddons.splice(i,1);var el=document.querySelector('.lead-addon[data-addon="'+key+'"]');if(el)el.value='';}else leadAddons.push(key);localStorage.setItem('d8LeadAddons',JSON.stringify(leadAddons));renderLeadAddons();renderLeads();}
function ensureLeadPriorities(){var profile=currentUser||'guest';if(leadPriorityProfile===profile)return;leadPriorityProfile=profile;try{var saved=JSON.parse(localStorage.getItem('d8LeadPriority:'+profile)||'null');leadPriorityRules=Array.isArray(userSettings.leadPriorityRules)?userSettings.leadPriorityRules.slice():(Array.isArray(saved)?saved:['no_site','low_reviews']);}catch(e){leadPriorityRules=['no_site','low_reviews'];}}
var LEAD_PRIORITY_LABELS={no_site:'Без сайт',low_reviews:'Малко ревюта',low_rating:'Ниска оценка',has_phone:'С телефон',has_email:'С имейл'};
function saveLeadPriorities(){localStorage.setItem('d8LeadPriority:'+(currentUser||'guest'),JSON.stringify(leadPriorityRules));userSettings.leadPriorityRules=leadPriorityRules.slice();saveData('profile');renderLeadPriorityRules();renderLeads();}
function toggleLeadPriority(key){ensureLeadPriorities();var i=leadPriorityRules.indexOf(key);if(i>=0)leadPriorityRules.splice(i,1);else leadPriorityRules.push(key);saveLeadPriorities();}
function moveLeadPriority(key,delta){ensureLeadPriorities();var i=leadPriorityRules.indexOf(key),n=i+delta;if(i<0||n<0||n>=leadPriorityRules.length)return;var x=leadPriorityRules[i];leadPriorityRules[i]=leadPriorityRules[n];leadPriorityRules[n]=x;saveLeadPriorities();}
function removeLeadPriority(key){ensureLeadPriorities();leadPriorityRules=leadPriorityRules.filter(function(x){return x!==key;});saveLeadPriorities();}
function renderLeadPriorityRules(){ensureLeadPriorities();Object.keys(LEAD_PRIORITY_LABELS).forEach(function(key){var mark=document.getElementById('fp-'+key);if(mark)mark.textContent=leadPriorityRules.indexOf(key)>=0?'✓':'＋';});var box=document.getElementById('leadPriorityRules');if(!box)return;box.innerHTML=leadPriorityRules.length?'<span class="prioritylabel">ВАЖНОСТ:</span>'+leadPriorityRules.map(function(key,i){return'<span class="priorityrule"><b>'+(i+1)+'</b>'+esc(LEAD_PRIORITY_LABELS[key]||key)+'<button title="Нагоре" onclick="moveLeadPriority(\''+key+'\',-1)">↑</button><button title="Надолу" onclick="moveLeadPriority(\''+key+'\',1)">↓</button><button title="Премахни" onclick="removeLeadPriority(\''+key+'\')">×</button></span>';}).join(''):'<span class="priorityempty">Добави правила за приоритет</span>';}
function leadPriorityCompare(a,b){ensureLeadPriorities();for(var i=0;i<leadPriorityRules.length;i++){var key=leadPriorityRules[i],d=0;if(key==='no_site')d=(a.website?1:0)-(b.website?1:0);else if(key==='low_reviews')d=parseReviewCount(a.reviews)-parseReviewCount(b.reviews);else if(key==='low_rating')d=(parseFloat(a.stars)||0)-(parseFloat(b.stars)||0);else if(key==='has_phone')d=(b.phone?1:0)-(a.phone?1:0);else if(key==='has_email')d=(b.email?1:0)-(a.email?1:0);if(d)return d;}return a.name.localeCompare(b.name,'bg');}
document.addEventListener('click',function(e){var menu=document.getElementById('leadFilterMenu');if(menu&&!e.target.closest('.leadfilterpicker'))menu.classList.remove('open');});

